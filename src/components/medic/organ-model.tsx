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
  ACESFilmicToneMapping,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
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
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    element.appendChild(renderer.domElement);
    scene.add(new AmbientLight(new Color("#d7e5f5"), 1.7));
    const key = new DirectionalLight("#ffffff", 3.5);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new DirectionalLight("#9cb9df", 2.5);
    rim.position.set(-3, 1, -2);
    scene.add(rim);
    const pivot = new Group();
    scene.add(pivot);
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
        const box = new Box3().setFromObject(loaded);
        const size = box.getSize(new Vector3());
        const center = box.getCenter(new Vector3());
        loaded.position.sub(center);
        pivot.add(loaded);
        const scale = 2 / Math.max(size.x, size.y, size.z);
        pivot.scale.setScalar(scale);
        camera.position.set(0, 0.15, 4.9);
        camera.lookAt(0, 0, 0);
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
        pivot.rotation.y += (delta * Math.PI) / 18;
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
