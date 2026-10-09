"use client";

import { OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { Component, type ReactNode, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { LogoArt } from "@/components/customizer/logoArt";
import { BASE_COLOR } from "@/lib/colors";
import type { LogoDesign, Zone } from "@/lib/marking";

export type Placement = { point: THREE.Vector3; normal: THREE.Vector3 };
export type SceneApi = { capture: () => string };

type Props = {
  modelUrl: string | null;
  fallback: "box" | "cylinder" | "shirt";
  color: string;
  design: LogoDesign;
  zones: Zone[];
  sizeCm: number;
  art: LogoArt | null;
  onPlace: (p: Placement) => void;
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

/** Tint a near-black catalogue texture to the chosen product colour while keeping seams, stitching and metal parts. */
function tint(material: THREE.Material, hex: string) {
  const m = material as THREE.MeshStandardMaterial;
  if (m.map) {
    m.map.generateMipmaps = false;
    m.map.minFilter = THREE.LinearFilter;
    m.map.needsUpdate = true;
  }
  const on = hex.toUpperCase() !== BASE_COLOR;
  const color = new THREE.Color(hex);
  m.onBeforeCompile = (shader) => {
    if (!on) return;
    shader.uniforms.tint = { value: color };
    shader.fragmentShader = shader.fragmentShader.replace("void main() {", "uniform vec3 tint;\nvoid main() {").replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP
        vec4 texel = texture2D( map, vMapUv );
        float l = dot( texel.rgb, vec3( 0.299, 0.587, 0.114 ) );
        vec3 dyed = tint * ( 0.62 + 2.4 * l );
        float keep = smoothstep( 0.32, 0.5, l );
        diffuseColor *= vec4( mix( dyed, texel.rgb, keep ), texel.a );
      #else
        diffuseColor.rgb *= tint;
      #endif`,
    );
  };
  m.customProgramCacheKey = () => `tint-${on ? hex : "none"}`;
  m.needsUpdate = true;
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
  const { color, design, zones, sizeCm, art, onPlace, onReady } = props;
  const root = useNormalised(props.object);
  const { gl, scene, camera } = useThree();
  const get = useThree((s) => s.get);
  const hasControls = useThree((s) => Boolean(s.controls));
  const radius = useMemo(() => new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere()).radius, [root]);

  // Frame the whole product from the side the logo starts on, whatever its proportions.
  const startDir = useRef(new THREE.Vector3(...((zones.find((z) => z.id === design.zone) ?? zones[0]).dir as [number, number, number])));
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
  const decalRef = useRef<THREE.Mesh>(null);
  const meshes = useMemo(() => {
    const list: THREE.Mesh[] = [];
    root.traverse((o) => (o as THREE.Mesh).isMesh && list.push(o as THREE.Mesh));
    return list;
  }, [root]);

  useLayoutEffect(() => {
    meshes.forEach((m) => tint(m.material as THREE.Material, color));
  }, [meshes, color]);

  /** Where the logo goes: a clicked point, or a ray shot at the model from the zone's direction. */
  const placement = useMemo<{ mesh: THREE.Mesh; point: THREE.Vector3; normal: THREE.Vector3 } | null>(() => {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const ray = new THREE.Raycaster();
    if (design.zone === "egen" && design.point && design.normal) {
      const p = new THREE.Vector3(...design.point);
      const n = new THREE.Vector3(...design.normal).normalize();
      ray.set(p.clone().addScaledVector(n, 0.5), n.clone().negate());
    } else {
      const zone = zones.find((z) => z.id === design.zone) ?? zones[0];
      const dir = new THREE.Vector3(...zone.dir).normalize();
      const origin = dir.clone().multiplyScalar(3);
      const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
      const side = new THREE.Vector3().crossVectors(up, dir).normalize();
      origin.addScaledVector(side, zone.offset[0] * size.x).addScaledVector(up, zone.offset[1] * (Math.abs(dir.y) > 0.9 ? size.z : size.y));
      ray.set(origin, dir.clone().negate());
    }
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit?.face) return null;
    const normal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
    return { mesh: hit.object as THREE.Mesh, point: hit.point.clone(), normal };
  }, [root, meshes, zones, design.zone, design.point, design.normal]);

  const texture = useMemo(() => {
    if (!art) return null;
    const t = new THREE.CanvasTexture(art.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [art]);

  const decal = useMemo(() => {
    if (!placement || !texture || !art) return null;
    const width = Math.max(0.01, design.sizeCm / sizeCm);
    const height = width / art.aspect;
    const target = placement.point.clone().add(placement.normal);
    const up = Math.abs(placement.normal.y) > 0.92 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const orient = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().lookAt(target, placement.point, up));
    placement.mesh.updateMatrixWorld(true);
    return new DecalGeometry(placement.mesh, placement.point, orient, new THREE.Vector3(width, height, Math.max(width, height) * 0.9));
  }, [placement, texture, art, design.sizeCm, sizeCm]);

  const material = useMemo(() => {
    if (!texture) return null;
    const embroidered = design.method === "brodyr";
    return new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      roughness: embroidered ? 1 : design.method === "transfer" ? 0.35 : design.method === "gravyr" ? 0.55 : 0.7,
      metalness: design.method === "gravyr" ? 0.3 : 0,
    });
  }, [texture, design.method]);

  useEffect(() => {
    onReady({
      capture: () => {
        const cam = camera as THREE.PerspectiveCamera;
        const saved = cam.position.clone();
        const n = placement?.normal ?? new THREE.Vector3(0, 0, 1);
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
  }, [onReady, camera, gl, scene, placement, radius]);

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4 || !e.face) return;
    e.stopPropagation();
    const normal = e.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(e.object.matrixWorld)).normalize();
    onPlace({ point: e.point.clone(), normal });
  };

  return (
    <>
      <primitive object={root} onClick={click} />
      {decal && material ? <mesh ref={decalRef} geometry={decal} material={material} renderOrder={2} /> : null}
    </>
  );
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
      <OrbitControls makeDefault enablePan={false} autoRotate={!touched} autoRotateSpeed={1.4} enableDamping />
    </Canvas>
  );
}
