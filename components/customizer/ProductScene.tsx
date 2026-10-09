"use client";

import { OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { Component, type ReactNode, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { LogoArt } from "@/components/customizer/logoArt";
import { BASE_COLOR } from "@/lib/colors";
import type { Method, Zone } from "@/lib/marking";

export type Placement = { point: THREE.Vector3; normal: THREE.Vector3 };
export type SceneApi = { capture: () => string };

/** One print on the product: the logo at a position, or the name print. */
export type Layer = {
  key: string;
  zone: string;
  point?: [number, number, number];
  normal?: [number, number, number];
  sizeCm: number;
  method: Method;
  art: LogoArt | null;
};

type Props = {
  modelUrl: string | null;
  fallback: "box" | "cylinder" | "shirt";
  color: string;
  layers: Layer[];
  active: string;
  zones: Zone[];
  sizeCm: number;
  onPlace: (key: string, p: Placement) => void;
  onSelect: (key: string) => void;
  onReady: (api: SceneApi) => void;
};

function Studio() {
  const gl = useThree((s) => s.gl);
  const env = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return texture;
  }, [gl]);
  useEffect(() => () => env.dispose(), [env]);
  return (
    <>
      <primitive object={env} attach="environment" />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2, 3, 2.5]} intensity={1.1} />
    </>
  );
}

type Tint = { color: { value: THREE.Color }; amount: { value: number } };

/**
 * Compile the tint shader once per material. It dyes the near-black catalogue texture while keeping
 * seams, stitching and metal parts; switching colour afterwards only changes two uniforms.
 */
function prepareTint(material: THREE.Material): Tint {
  const m = material as THREE.MeshStandardMaterial;
  if (m.map) {
    m.map.generateMipmaps = false;
    m.map.minFilter = THREE.LinearFilter;
    m.map.needsUpdate = true;
  }
  const uniforms: Tint = { color: { value: new THREE.Color("#ffffff") }, amount: { value: 0 } };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.tint = uniforms.color;
    shader.uniforms.tintAmount = uniforms.amount;
    shader.fragmentShader = shader.fragmentShader.replace("void main() {", "uniform vec3 tint;\nuniform float tintAmount;\nvoid main() {").replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP
        vec4 texel = texture2D( map, vMapUv );
        float l = dot( texel.rgb, vec3( 0.299, 0.587, 0.114 ) );
        vec3 dyed = tint * ( 0.62 + 2.4 * l );
        float keep = smoothstep( 0.32, 0.5, l );
        diffuseColor *= vec4( mix( texel.rgb, mix( dyed, texel.rgb, keep ), tintAmount ), texel.a );
      #else
        diffuseColor.rgb *= mix( vec3( 1.0 ), tint, tintAmount );
      #endif`,
    );
  };
  m.customProgramCacheKey = () => "tint-v2";
  m.needsUpdate = true;
  return uniforms;
}

function applyTint(t: Tint, hex: string) {
  t.color.value.set(hex);
  t.amount.value = hex.toUpperCase() === BASE_COLOR ? 0 : 1;
}

/** Normalise any model so its largest dimension is 1 unit, centred on the origin. */
function useNormalised(object: THREE.Object3D) {
  return useMemo(() => {
    const root = new THREE.Group();
    const copy = object.clone(true);
    copy.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.material = (mesh.material as THREE.Material).clone();
    });
    const box = new THREE.Box3().setFromObject(copy);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const s = 1 / (Math.max(size.x, size.y, size.z) || 1);
    copy.position.sub(centre).multiplyScalar(s);
    copy.scale.setScalar(s);
    root.add(copy);
    root.updateMatrixWorld(true);
    return root;
  }, [object]);
}

function useFallbackObject(kind: Props["fallback"]) {
  return useMemo(() => {
    const geo = kind === "cylinder" ? new THREE.CylinderGeometry(0.32, 0.3, 1, 64) : kind === "shirt" ? new THREE.BoxGeometry(0.9, 1, 0.25, 8, 8, 2) : new THREE.BoxGeometry(0.75, 1, 0.5);
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#2a2a2c", roughness: 0.8 }));
  }, [kind]);
}

function Product(props: Props & { object: THREE.Object3D }) {
  const { color, layers, active, zones, sizeCm, onPlace, onSelect, onReady } = props;
  const root = useNormalised(props.object);
  const { gl, scene, camera } = useThree();
  const get = useThree((s) => s.get);
  const hasControls = useThree((s) => Boolean(s.controls));
  const radius = useMemo(() => new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere()).radius, [root]);

  // Frame the whole product from the side the logo starts on, whatever its proportions.
  const startDir = useRef(new THREE.Vector3(...((zones.find((z) => z.id === layers[0]?.zone) ?? zones[0]).dir as [number, number, number])));
  useEffect(() => {
    const { camera: cam, controls } = get();
    const d = startDir.current.clone().normalize();
    const view = d.y > 0.9 ? new THREE.Vector3(0.25, 1, 0.75) : new THREE.Vector3(d.x * 0.85 + 0.2, 0.28, d.z * 0.85 + (d.x ? 0.2 : 0));
    cam.position.copy(view.normalize().multiplyScalar(radius * 3.6));
    cam.lookAt(0, 0, 0);
    const orbit = controls as unknown as { minDistance: number; maxDistance: number; update: () => void } | null;
    if (orbit) {
      orbit.minDistance = radius * 1.4;
      orbit.maxDistance = radius * 5;
      orbit.update();
    }
  }, [get, hasControls, radius]);
  const meshes = useMemo(() => {
    const list: THREE.Mesh[] = [];
    root.traverse((o) => (o as THREE.Mesh).isMesh && list.push(o as THREE.Mesh));
    return list;
  }, [root]);

  const tints = useMemo(() => meshes.map((m) => prepareTint(m.material as THREE.Material)), [meshes]);
  useLayoutEffect(() => {
    tints.forEach((t) => applyTint(t, color));
  }, [tints, color]);

  const normals = useRef<Record<string, THREE.Vector3>>({});
  const mainKey = layers[0]?.key ?? "";
  useEffect(() => {
    onReady({
      capture: () => {
        const cam = camera as THREE.PerspectiveCamera;
        const saved = cam.position.clone();
        const n = normals.current[mainKey] ?? new THREE.Vector3(0, 0, 1);
        const view = new THREE.Vector3(n.x, Math.max(n.y, 0.12), n.z).normalize().multiplyScalar(radius * 2.7);
        cam.position.copy(view);
        cam.lookAt(0, 0, 0);
        gl.render(scene, cam);
        const shot = gl.domElement.toDataURL("image/jpeg", 0.88);
        cam.position.copy(saved);
        cam.lookAt(0, 0, 0);
        return shot;
      },
    });
  }, [onReady, camera, gl, scene, radius, mainKey]);

  // Selecting another print turns the product so that print faces the camera.
  const shownKey = useRef(active);
  useEffect(() => {
    if (shownKey.current === active) return;
    shownKey.current = active;
    const n = normals.current[active];
    if (!n) return;
    const { camera: cam, controls } = get();
    const from = cam.position.clone();
    const to = new THREE.Vector3(n.x, Math.max(n.y, 0.15), n.z).normalize().multiplyScalar(from.length());
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 600);
      const e = 1 - Math.pow(1 - k, 3);
      moveCamera(cam, from.clone().lerp(to, e).setLength(from.length()), controls);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, get]);

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4 || dragging.current || !e.face) return;
    e.stopPropagation();
    onPlace(active, { point: e.point.clone(), normal: smoothNormal(e as unknown as THREE.Intersection) });
  };

  // Drag a print across the product: grab it, the camera holds still, the print follows the surface.
  const dragging = useRef<string | null>(null);
  const frame = useRef(0);
  const startDrag = (key: string) => {
    dragging.current = key;
    if (key !== active) onSelect(key);
    const controls = get().controls;
    setEnabled(controls, false);
    setCursor("grabbing");
    const end = () => {
      dragging.current = null;
      setEnabled(controls, true);
      setCursor("");
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointerup", end);
  };
  const drag = (e: ThreeEvent<PointerEvent>) => {
    const key = dragging.current;
    if (!key || e.object.userData.decal) return;
    e.stopPropagation();
    cancelAnimationFrame(frame.current);
    const point = e.point.clone();
    const normal = smoothNormal(e as unknown as THREE.Intersection);
    frame.current = requestAnimationFrame(() => onPlace(key, { point, normal }));
  };

  return (
    <>
      <primitive object={root} onClick={click} onPointerMove={drag} />
      {layers.map((l) => (
        <LogoDecal
          key={l.key}
          layer={l}
          root={root}
          meshes={meshes}
          zones={zones}
          sizeCm={sizeCm}
          dim={layers.length > 1 && l.key !== active}
          onNormal={(n) => (normals.current[l.key] = n)}
          onGrab={() => startDrag(l.key)}
          isDragging={() => Boolean(dragging.current)}
        />
      ))}
    </>
  );
}

function LogoDecal({
  layer,
  root,
  meshes,
  zones,
  sizeCm,
  dim,
  onNormal,
  onGrab,
  isDragging,
}: {
  layer: Layer;
  root: THREE.Object3D;
  meshes: THREE.Mesh[];
  zones: Zone[];
  sizeCm: number;
  dim: boolean;
  onNormal: (n: THREE.Vector3) => void;
  onGrab: () => void;
  isDragging: () => boolean;
}) {
  const { art, zone, point, normal, method } = layer;
  const logoSize = useMemo(() => {
    const width = Math.max(0.01, layer.sizeCm / sizeCm);
    return { width, height: width / (art?.aspect ?? 1) };
  }, [layer.sizeCm, sizeCm, art?.aspect]);

  /** Where the print goes: a clicked/dragged point, or a ray shot at the model from the zone's direction. */
  const placement = useMemo<{ mesh: THREE.Mesh; point: THREE.Vector3; normal: THREE.Vector3 } | null>(() => {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const ray = new THREE.Raycaster();
    if (zone === "egen" && point && normal) {
      const p = new THREE.Vector3(...point);
      const n = new THREE.Vector3(...normal).normalize();
      ray.set(p.clone().addScaledVector(n, 0.5), n.clone().negate());
    } else {
      const z = zones.find((x) => x.id === zone) ?? zones[0];
      const dir = new THREE.Vector3(...z.dir).normalize();
      const origin = dir.clone().multiplyScalar(3);
      const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
      const side = new THREE.Vector3().crossVectors(up, dir).normalize();
      origin.addScaledVector(side, z.offset[0] * size.x).addScaledVector(up, z.offset[1] * (Math.abs(dir.y) > 0.9 ? size.z : size.y));
      ray.set(origin, dir.clone().negate());
    }
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit?.face) return null;
    const avg = averageNormal(meshes, hit.point, smoothNormal(hit), Math.max(logoSize.width, logoSize.height) * 0.45);
    return { mesh: hit.object as THREE.Mesh, point: hit.point.clone(), normal: avg };
  }, [root, meshes, zones, zone, point, normal, logoSize]);

  useEffect(() => {
    if (placement) onNormal(placement.normal);
  }, [placement, onNormal]);

  const texture = useMemo(() => {
    if (!art) return null;
    const t = new THREE.CanvasTexture(art.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [art]);
  useEffect(() => () => texture?.dispose(), [texture]);

  /**
   * The decal is projected along the average surface direction under the whole print and deep enough to
   * wrap over folds (e.g. where a cap's crown meets the brim); triangles facing away are dropped.
   */
  const decal = useMemo(() => {
    if (!placement || !texture) return null;
    const { width, height } = logoSize;
    const target = placement.point.clone().add(placement.normal);
    const up = Math.abs(placement.normal.y) > 0.92 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const orient = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().lookAt(target, placement.point, up));
    placement.mesh.updateMatrixWorld(true);
    const geometry = new DecalGeometry(placement.mesh, placement.point, orient, new THREE.Vector3(width, height, Math.max(width, height) * 2.2));
    return keepFacing(geometry, placement.normal);
  }, [placement, texture, logoSize]);
  useEffect(() => () => decal?.dispose(), [decal]);

  const material = useMemo(() => {
    if (!texture) return null;
    const embroidered = method === "brodyr";
    return new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      opacity: dim ? 0.82 : 1,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      roughness: embroidered ? 1 : method === "transfer" ? 0.35 : method === "gravyr" ? 0.55 : 0.7,
      metalness: method === "gravyr" ? 0.3 : 0,
    });
  }, [texture, method, dim]);
  useEffect(() => () => material?.dispose(), [material]);

  if (!decal || !material) return null;
  return (
    <mesh
      geometry={decal}
      material={material}
      renderOrder={2}
      userData={{ decal: true }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onGrab();
      }}
      onPointerOver={() => !isDragging() && (document.body.style.cursor = "grab")}
      onPointerOut={() => !isDragging() && (document.body.style.cursor = "")}
    />
  );
}

function setCursor(c: string) {
  document.body.style.cursor = c;
}

function setEnabled(controls: unknown, on: boolean) {
  const c = controls as { enabled: boolean } | null;
  if (c) c.enabled = on;
}

function moveCamera(cam: THREE.Camera, to: THREE.Vector3, controls: unknown) {
  cam.position.copy(to);
  cam.lookAt(0, 0, 0);
  (controls as { update?: () => void } | null)?.update?.();
}

/** Interpolated vertex normal at a hit, in world space – smoother than the flat face normal. */
function smoothNormal(hit: THREE.Intersection): THREE.Vector3 {
  const mesh = hit.object as THREE.Mesh;
  const geo = mesh.geometry as THREE.BufferGeometry;
  const normals = geo.getAttribute("normal");
  const face = hit.face!;
  let n: THREE.Vector3;
  if (normals && hit.barycoord) {
    const a = new THREE.Vector3().fromBufferAttribute(normals, face.a);
    const b = new THREE.Vector3().fromBufferAttribute(normals, face.b);
    const c = new THREE.Vector3().fromBufferAttribute(normals, face.c);
    n = a.multiplyScalar(hit.barycoord.x).add(b.multiplyScalar(hit.barycoord.y)).add(c.multiplyScalar(hit.barycoord.z));
  } else {
    n = face.normal.clone();
  }
  return n.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
}

/** Average surface direction over a disc around the point, so the logo faces the area it covers. */
function averageNormal(meshes: THREE.Mesh[], point: THREE.Vector3, normal: THREE.Vector3, radius: number): THREE.Vector3 {
  const up = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(up, normal).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();
  const sum = normal.clone();
  const ray = new THREE.Raycaster();
  for (const [r, steps] of [[radius * 0.5, 4], [radius, 8]] as const) {
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const origin = point.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r).addScaledVector(normal, radius * 2);
      ray.set(origin, normal.clone().negate());
      const hit = ray.intersectObjects(meshes, false)[0];
      if (hit?.face) sum.add(smoothNormal(hit));
    }
  }
  return sum.normalize();
}

/** Drop decal triangles that face away from the projector (inside of a cap, back of a bottle). */
function keepFacing(geometry: THREE.BufferGeometry, dir: THREE.Vector3) {
  const pos = geometry.getAttribute("position");
  const nor = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  const keep: number[] = [];
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    n.set(0, 0, 0);
    for (let k = 0; k < 3; k++) n.add(new THREE.Vector3().fromBufferAttribute(nor, i + k));
    if (n.normalize().dot(dir) > 0.08) keep.push(i, i + 1, i + 2);
  }
  if (keep.length === pos.count) return geometry;
  const out = new THREE.BufferGeometry();
  const copy = (attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, size: number) => {
    const arr = new Float32Array(keep.length * size);
    keep.forEach((src, dst) => {
      for (let s = 0; s < size; s++) arr[dst * size + s] = attr.getComponent(src, s);
    });
    return new THREE.Float32BufferAttribute(arr, size);
  };
  out.setAttribute("position", copy(pos, 3));
  out.setAttribute("normal", copy(nor, 3));
  if (uv) out.setAttribute("uv", copy(uv, 2));
  geometry.dispose();
  return out;
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Loaded(props: Props) {
  const object = props.modelUrl ? <ModelProduct {...props} url={props.modelUrl} /> : null;
  const fallback = <FallbackProduct {...props} />;
  return object ? <ModelBoundary fallback={fallback}>{object}</ModelBoundary> : fallback;
}

function ModelProduct(props: Props & { url: string }) {
  const object = useGLTF(props.url).scene;
  return <Product {...props} object={object} />;
}

function FallbackProduct(props: Props) {
  const object = useFallbackObject(props.fallback);
  return <Product {...props} object={object} />;
}

export function ProductScene(props: Props) {
  const [touched, setTouched] = useState(false);
  return (
    <Canvas gl={{ preserveDrawingBuffer: true, antialias: true }} dpr={[1, 2]} camera={{ position: [0, 0.25, 2.3], fov: 35, near: 0.01, far: 50 }} onPointerDown={() => setTouched(true)}>
      <color attach="background" args={["#f4f4f6"]} />
      <Studio />
      <Suspense fallback={null}>
        <Loaded {...props} />
      </Suspense>
      <OrbitControls makeDefault enablePan={false} autoRotate={!touched && props.active === "main" && props.layers.length === 1} autoRotateSpeed={1.4} enableDamping />
    </Canvas>
  );
}
