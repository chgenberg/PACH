"use client";

import { Center, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

function Light() {
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
      <ambientLight intensity={0.3} />
      <directionalLight position={[2, 3, 2.5]} intensity={1.2} />
      <directionalLight position={[-2.5, 1.5, -2]} intensity={0.6} />
    </>
  );
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

/** Backs the camera off on narrow screens so the whole garment, sleeves included, fits. */
function Fit() {
  const { camera, size } = useThree();
  useEffect(() => {
    const distance = Math.max(3.9, 2.8 / (size.width / size.height));
    camera.position.setLength(distance);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

/** A full-screen 3D model and nothing else – drag to turn, scroll or pinch to zoom. */
export function ModelOnly({ url }: { url: string }) {
  return (
    <div className="model-only">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0.15, 4.4], fov: 32, near: 0.01, far: 50 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={["#f4f3ef"]} />
        <Light />
        <Fit />
        <Suspense fallback={null}>
          <Model url={url} />
        </Suspense>
        <OrbitControls makeDefault enablePan={false} enableDamping autoRotate autoRotateSpeed={0.8} minDistance={0.8} maxDistance={9} />
      </Canvas>
    </div>
  );
}
