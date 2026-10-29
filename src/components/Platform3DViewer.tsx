import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Center, Bounds } from '@react-three/drei';

type Platform3DViewerProps = {
  /** Path under public/, e.g. "/models/tar.glb" */
  modelSrc: string;
  /** Optional label shown while loading or on error */
  label?: string;
  className?: string;
};

function Model({ src }: { src: string }) {
  const { scene } = useGLTF(src);
  // Clone so multiple viewers (or remounts) don't fight over the same scene
  const cloned = useMemo(() => scene.clone(), [scene]);
  return <primitive object={cloned} />;
}

/**
 * Interactive 3D viewer for a platform model (GLB recommended).
 * Drop-in replacement for the silhouette map area.
 */
export function Platform3DViewer({ modelSrc, label, className = '' }: Platform3DViewerProps) {
  return (
    <div className={`relative w-full bg-black rounded-2xl overflow-hidden ${className}`} style={{ minHeight: 480 }}>
      <Canvas
        camera={{ position: [2.5, 1.6, 3.2], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#09090b']} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[5, 8, 5]} intensity={1.1} />
        <directionalLight position={[-4, 3, -2]} intensity={0.35} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.2}>
            <Center>
              <Model src={modelSrc} />
            </Center>
          </Bounds>
          <Environment preset="studio" />
        </Suspense>
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={0.5}
          maxDistance={20}
        />
      </Canvas>

      <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-black/70 text-xs text-zinc-300 border border-zinc-700 pointer-events-none">
        {label || '3D view'} · drag to orbit · scroll to zoom
      </div>
    </div>
  );
}

// Optional preload helper you can call when the platform changes
export function preloadPlatformModel(src: string) {
  try {
    useGLTF.preload(src);
  } catch {
    /* ignore */
  }
}
