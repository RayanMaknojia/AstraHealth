import { useEffect, useRef, useState } from "react";
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  Mesh,
  MeshStandardMaterial,
  NoToneMapping,
} from "three";
import type { BufferGeometry } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
/**
 * The image-based models carry the reference picture as a front projection. Surfaces
 * that face sideways would only show a stretched edge of that picture, so they are
 * coloured by projecting the same picture from the side (alpha still comes from the
 * front projection, so the outline never changes).
 */
function addSideProjection(mesh: Mesh) {
  const material = mesh.material;
  if (!(material instanceof MeshStandardMaterial) || !material.map) return;
  // Per-vertex (row centre u, u per unit of depth), written by image-to-3d.py.
  if (!(mesh.geometry as BufferGeometry).getAttribute("_side")) return;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec2 _side;\nvarying vec2 vSide;\nvarying vec3 vObjPos;\nvarying vec3 vObjNormal;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvSide = _side;\nvObjPos = position;\nvObjNormal = normal;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vSide;\nvarying vec3 vObjPos;\nvarying vec3 vObjNormal;",
      )
      .replace(
        "#include <map_fragment>",
        `
        vec4 frontTex = texture2D( map, vMapUv );
        vec3 n = normalize( vObjNormal );
        vec2 sideUv = vec2( vSide.x + vSide.y * vObjPos.z * sign( n.x ), vMapUv.y );
        vec3 sideTex = texture2D( map, sideUv ).rgb;
        float sideWeight = smoothstep( 0.45, 0.9, abs( n.x ) );
        // Side surfaces turned toward the camera are solid; seen edge-on (front view) the
        // picture's soft outline still decides the silhouette.
        float facing = abs( normalize( vNormal ).z );
        float solid = smoothstep( 0.45, 0.9, 1.0 - abs( n.z ) ) * smoothstep( 0.12, 0.4, facing );
        diffuseColor *= vec4( mix( frontTex.rgb, sideTex, sideWeight ), max( frontTex.a, solid ) );
        `,
      );
  };
  material.needsUpdate = true;
}
/** One full turn every 12 seconds (30° per second), like the reference turntable. */
const DEGREES_PER_SECOND = 30;
export function OrganModel({
  url,
  label,
  paused,
}: {
  url: string;
  label: string;
  paused: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const [error, setError] = useState(false);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      queueMicrotask(() => setError(true));
      return;
    }
    let live = true,
      frame = 0,
      visible = true,
      loaded: Group | null = null;
    const scene = new Scene();
    const camera = new PerspectiveCamera(32, 1, 0.01, 100);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = SRGBColorSpace;
    // The models are textured with the reference images, which already contain their
    // studio lighting: keep the colours true (no tone mapping) and add gentle lights so
    // the surface relief still shades as it turns.
    renderer.toneMapping = NoToneMapping;
    element.appendChild(renderer.domElement);
    scene.add(new AmbientLight(new Color("#ffffff"), 1.55));
    const key = new DirectionalLight("#fff6f0", 1.15);
    key.position.set(2, 3, 5);
    scene.add(key);
    const rim = new DirectionalLight("#9fd3e6", 0.9);
    rim.position.set(-4, 2, -3);
    scene.add(rim);
    const pivot = new Group();
    pivot.rotation.y = 0;
    scene.add(pivot);
    let normalizedSize: Vector3 | null = null;
    const fitCamera = () => {
      if (!normalizedSize) return;
      const tangent = Math.tan((camera.fov * Math.PI) / 360);
      const width = Math.hypot(normalizedSize.x, normalizedSize.z);
      const distance =
        (Math.max(
          normalizedSize.y / (2 * tangent),
          width / (2 * tangent * camera.aspect),
        ) +
          Math.max(normalizedSize.x, normalizedSize.z) * 0.45) *
        1.05;
      camera.position.set(0, 0.06, distance);
      camera.lookAt(0, 0, 0);
    };
    const dispose = (object: Group) =>
      object.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          const materials = Array.isArray(o.material)
            ? o.material
            : [o.material];
          materials.forEach((m) => {
            if (m instanceof MeshStandardMaterial) m.map?.dispose();
            m.dispose();
          });
        }
      });
    new GLTFLoader().load(
      url,
      (gltf) => {
        if (!live) {
          dispose(gltf.scene);
          return;
        }
        loaded = gltf.scene;
        loaded.traverse((o) => {
          if (o instanceof Mesh) addSideProjection(o);
        });
        const box = new Box3().setFromObject(loaded);
        const size = box.getSize(new Vector3());
        const center = box.getCenter(new Vector3());
        loaded.position.sub(center);
        pivot.add(loaded);
        const scale = 2 / Math.max(size.x, size.y, size.z);
        pivot.scale.setScalar(scale);
        normalizedSize = size.clone().multiplyScalar(scale);
        fitCamera();
        renderer.render(scene, camera);
      },
      undefined,
      () => {
        if (live) setError(true);
      },
    );
    const resize = new ResizeObserver(() => {
      const w = element.clientWidth,
        h = element.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      fitCamera();
    });
    resize.observe(element);
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    });
    observer.observe(element);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let previous = 0;
    const animate = (time: number) => {
      frame = requestAnimationFrame(animate);
      const delta = previous ? Math.min(0.1, (time - previous) / 1000) : 0;
      previous = time;
      if (!visible || document.hidden) return;
      if (!pausedRef.current && !reduced.matches)
        pivot.rotation.y += (delta * DEGREES_PER_SECOND * Math.PI) / 180;
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      if (loaded) dispose(loaded);
      renderer.forceContextLoss();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url]);
  return (
    <div ref={host} className="organ-model" role="img" aria-label={label}>
      {error && (
        <span className="model-error">
          3D view unavailable. Select this system to read its details.
        </span>
      )}
    </div>
  );
}
