"""
Turn the five Body Map reference images into rotating 3D models (GLB).

    python -m venv .venv && .venv/bin/pip install numpy scipy pillow
    .venv/bin/python src/components/medic/assets/organs/image-to-3d.py

For each image in ./source:
 1. Cut the organ out of its dark background (colour distance + clean-up).
 2. "Inflate" the outline into a volume: solve  laplace(h) = -2  inside the outline
    (h = 0 on the edge) and use depth = sqrt(h). Every part, thick (brain) or thin
    (DNA strands, leg bones), gets a round cross-section of its own width.
 3. Add fine relief from the image's own light/dark detail (gyri, muscle fibres,
    vessels), so the surface catches the moving light as it turns.
 4. Front and back surfaces + a stitched rim make a closed mesh. The original image
    is the texture (front; mirrored on the back) with a smooth alpha edge.
The front view matches the image exactly; sides and back are a rounded estimate
from a single picture, not a scan. Output: ./image-<name>.glb
"""

from __future__ import annotations

import io
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.sparse import coo_matrix
from scipy.sparse.linalg import spsolve

HERE = Path(__file__).resolve().parent
SRC = HERE / "source"

# name: (file, depth factor, relief strength, keep holes larger than (fraction of area), threshold)
ORGANS = {
    "brain": ("brain.jpg", 0.95, 0.9, 0.002, 22),
    "heart": ("heart.jpg", 0.90, 0.7, 0.002, 22),
    "liver": ("liver.jpg", 0.70, 0.5, 0.002, 22),
    "dna": ("dna.jpg", 1.00, 0.35, 0.0005, 24),
    "leg": ("leg.jpg", 0.85, 0.6, 0.002, 20),
}
GRID_LONG_SIDE = 170  # geometry resolution (vertices on the long side)
TEXTURE_LONG_SIDE = 1024


def load(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB")).astype(np.float32)


def object_mask(img: np.ndarray, threshold: float, keep_holes: float) -> np.ndarray:
    """Soft (0-1) mask of the object against its dark, vignetted background."""
    h, w, _ = img.shape
    border = np.concatenate([img[:10].reshape(-1, 3), img[-10:].reshape(-1, 3), img[:, :10].reshape(-1, 3), img[:, -10:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    # The backgrounds have a blue-teal glow around the object (red channel stays low,
    # about 5-21), while tissue, even in deep creases and bright rim light, has red >= ~30.
    # So the cut-out uses the red channel above the background's red level.
    red = ndimage.gaussian_filter(img[..., 0] - bg[0], 1.0)
    m = red > threshold
    m = ndimage.binary_opening(m, iterations=2)
    # Keep big components only.
    lab, n = ndimage.label(m)
    if n:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        keep = np.zeros(n + 1, bool)
        keep[1:] = sizes >= max(sizes.max() * 0.02, 0.0005 * h * w)
        m = keep[lab]
    # Fill holes, except big real gaps (between DNA strands).
    holes = ndimage.binary_fill_holes(m) & ~m
    lab, n = ndimage.label(holes)
    if n:
        sizes = ndimage.sum(holes, lab, range(1, n + 1))
        small = np.zeros(n + 1, bool)
        small[1:] = sizes < keep_holes * h * w
        m = m | small[lab]
    m = ndimage.binary_closing(m, iterations=2)
    return np.clip(ndimage.gaussian_filter(m.astype(np.float32), 1.5), 0, 1)


def solve_inflation(inside: np.ndarray) -> np.ndarray:
    """h with laplace(h) = -2 inside, h = 0 outside (unit grid spacing)."""
    idx = -np.ones(inside.shape, np.int64)
    ys, xs = np.nonzero(inside)
    idx[ys, xs] = np.arange(len(ys))
    n = len(ys)
    rows, cols, vals = [np.arange(n)], [np.arange(n)], [np.full(n, 4.0)]
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = ys + dy, xs + dx
        ok = (ny >= 0) & (ny < inside.shape[0]) & (nx >= 0) & (nx < inside.shape[1])
        nb = np.full(n, -1)
        nb[ok] = idx[ny[ok], nx[ok]]
        has = nb >= 0
        rows.append(np.arange(n)[has])
        cols.append(nb[has])
        vals.append(np.full(has.sum(), -1.0))
    a = coo_matrix((np.concatenate(vals), (np.concatenate(rows), np.concatenate(cols))), shape=(n, n)).tocsr()
    h = spsolve(a, np.full(n, 2.0))
    out = np.zeros(inside.shape, np.float64)
    out[ys, xs] = h
    return out


def bleed(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Copy the nearest object colour into transparent pixels (no dark fringes)."""
    _, (iy, ix) = ndimage.distance_transform_edt(alpha < 0.5, return_indices=True)
    out = rgb[iy, ix]
    return np.where((alpha >= 0.5)[..., None], rgb, out)


def vertex_normals(pos: np.ndarray, tri: np.ndarray) -> np.ndarray:
    n = np.zeros_like(pos)
    fn = np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]])
    for k in range(3):
        np.add.at(n, tri[:, k], fn)
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    return (n / np.maximum(ln, 1e-12)).astype(np.float32)


def build(name: str, file: str, depth: float, relief: float, keep_holes: float, threshold: float) -> dict:
    img = load(SRC / file)
    alpha_full = object_mask(img, threshold, keep_holes)
    ys, xs = np.nonzero(alpha_full > 0.02)
    pad = 12
    y0, y1 = max(0, ys.min() - pad), min(img.shape[0], ys.max() + pad)
    x0, x1 = max(0, xs.min() - pad), min(img.shape[1], xs.max() + pad)
    img, alpha_full = img[y0:y1, x0:x1], alpha_full[y0:y1, x0:x1]
    H, W = alpha_full.shape

    # Texture (RGBA, alpha = soft outline).
    ts = min(1.0, TEXTURE_LONG_SIDE / max(H, W))
    tw, th = max(1, round(W * ts)), max(1, round(H * ts))
    tex_rgb = np.asarray(Image.fromarray(img.astype(np.uint8)).resize((tw, th), Image.LANCZOS)).astype(np.float32)
    tex_a = np.asarray(Image.fromarray((alpha_full * 255).astype(np.uint8)).resize((tw, th), Image.LANCZOS)).astype(np.float32) / 255
    tex_rgb = bleed(tex_rgb, tex_a)
    rgba = np.dstack([tex_rgb, tex_a * 255]).clip(0, 255).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(buf, "PNG", optimize=True)
    png = buf.getvalue()

    # Geometry grid.
    gs = GRID_LONG_SIDE / max(H, W)
    gw, gh = max(2, round(W * gs)), max(2, round(H * gs))
    a = np.asarray(Image.fromarray((alpha_full * 255).astype(np.uint8)).resize((gw, gh), Image.BILINEAR)).astype(np.float32) / 255
    inside = ndimage.binary_dilation(a > 0.5, iterations=1)  # 1 cell beyond the visible edge (alpha cuts it)
    h = solve_inflation(inside)
    z = depth * np.sqrt(np.maximum(h, 0))
    # Fine relief from the image detail, faded out near the edge.
    lum = np.asarray(Image.fromarray(img.astype(np.uint8)).convert("L").resize((gw, gh), Image.BILINEAR)).astype(np.float32) / 255
    hp = lum - ndimage.gaussian_filter(lum, 2.5)
    fade = np.clip(ndimage.distance_transform_edt(inside) / 4.0, 0, 1)
    z = z + relief * 6.0 * hp * fade
    z = np.where(inside, np.maximum(z, 0.05), 0)

    # Vertices: one per inside cell, front and back.
    vid = -np.ones((gh, gw), np.int64)
    iy, ix = np.nonzero(inside)
    vid[iy, ix] = np.arange(len(iy))
    nv = len(iy)
    cx, cy = (gw - 1) / 2, (gh - 1) / 2
    front = np.stack([(ix - cx), -(iy - cy), z[iy, ix]], 1).astype(np.float32)
    back = front * np.array([1, 1, -1], np.float32)
    uv = np.stack([(ix + 0.5) / gw, (iy + 0.5) / gh], 1).astype(np.float32)

    # Triangles over every 2x2 block that is fully inside.
    q = inside[:-1, :-1] & inside[1:, :-1] & inside[:-1, 1:] & inside[1:, 1:]
    qy, qx = np.nonzero(q)
    v00, v01, v10, v11 = vid[qy, qx], vid[qy, qx + 1], vid[qy + 1, qx], vid[qy + 1, qx + 1]
    tf = np.concatenate([np.stack([v00, v10, v01], 1), np.stack([v01, v10, v11], 1)])  # faces +z
    tb = tf[:, ::-1] + nv
    # Rim: stitch every boundary edge of the front surface to the back surface.
    edges = np.concatenate([tf[:, [0, 1]], tf[:, [1, 2]], tf[:, [2, 0]]])
    key = np.sort(edges, 1)
    _, inv, counts = np.unique(key, axis=0, return_inverse=True, return_counts=True)
    b = edges[counts[inv.ravel()] == 1]
    rim = np.concatenate([np.stack([b[:, 1], b[:, 0], b[:, 0] + nv], 1), np.stack([b[:, 1], b[:, 0] + nv, b[:, 1] + nv], 1)])

    pos = np.concatenate([front, back])
    tri = np.concatenate([tf, tb, rim]).astype(np.uint32)
    # Normalise: tallest side = 2 units, centred.
    pos -= (pos.max(0) + pos.min(0)) / 2
    scale = 2.0 / (pos.max(0) - pos.min(0)).max()
    pos *= scale
    nrm = vertex_normals(pos, tri.astype(np.int64))
    uvs = np.concatenate([uv, uv])
    # Side projection data per row: (centre u of the row, u per unit of depth), so a
    # side-facing surface is coloured from its own row of the picture.
    side_row = np.zeros((gh, 2), np.float32)
    for r in range(gh):
        cols = np.nonzero(inside[r])[0]
        if not len(cols):
            continue
        cu = (cols.min() + cols.max() + 1) / 2 / gw
        hw = (cols.max() - cols.min() + 1) / 2 / gw
        zmax = max(z[r, cols].max() * scale, 1e-4)
        side_row[r] = (cu, 0.85 * hw / zmax)
    side = np.concatenate([side_row[iy], side_row[iy]])
    return {"name": name, "pos": pos, "nrm": nrm, "uv": uvs, "side": side, "tri": tri, "png": png}


def write_glb(m: dict, out: Path) -> None:
    chunks, views, accessors = [], [], []

    def add(data: bytes, target: int | None = None) -> int:
        off = sum(len(c) for c in chunks)
        chunks.append(data + b"\0" * ((4 - len(data) % 4) % 4))
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target:
            v["target"] = target
        views.append(v)
        return len(views) - 1

    def acc(arr: np.ndarray, comp: int, typ: str, target: int, minmax: bool = False) -> int:
        view = add(arr.tobytes(), target)
        a = {"bufferView": view, "componentType": comp, "count": int(arr.shape[0]), "type": typ}
        if minmax:
            a["min"], a["max"] = arr.min(0).tolist(), arr.max(0).tolist()
        accessors.append(a)
        return len(accessors) - 1

    p = acc(m["pos"].astype(np.float32), 5126, "VEC3", 34962, True)
    n = acc(m["nrm"].astype(np.float32), 5126, "VEC3", 34962)
    t = acc(m["uv"].astype(np.float32), 5126, "VEC2", 34962)
    sd = acc(m["side"].astype(np.float32), 5126, "VEC2", 34962)
    i = acc(m["tri"].reshape(-1).astype(np.uint32), 5125, "SCALAR", 34963)
    img_view = add(m["png"])
    gltf = {
        "asset": {"version": "2.0", "generator": "space-medic image-to-3d.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": m["name"]}],
        "meshes": [{"name": m["name"], "primitives": [{"attributes": {"POSITION": p, "NORMAL": n, "TEXCOORD_0": t, "_SIDE": sd}, "indices": i, "material": 0}]}],
        "materials": [
            {
                "name": f"{m['name']} (reference image)",
                "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 0.58},
                "alphaMode": "MASK",
                "alphaCutoff": 0.5,
            }
        ],
        "textures": [{"source": 0, "sampler": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": img_view, "mimeType": "image/png"}],
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": sum(len(c) for c in chunks)}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    binary = b"".join(chunks)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(out, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(binary), 0x004E4942) + binary)


if __name__ == "__main__":
    import sys

    names = sys.argv[1:] or list(ORGANS)
    for name in names:
        file, depth, relief, holes, thr = ORGANS[name]
        mesh = build(name, file, depth, relief, holes, thr)
        out = HERE / f"image-{name}.glb"
        write_glb(mesh, out)
        print(f"{out.name}: {len(mesh['pos'])} vertices, {len(mesh['tri'])} triangles, {out.stat().st_size // 1024} KB")
