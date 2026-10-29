import React, { Component, Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center, Bounds } from '@react-three/drei';

type Platform3DViewerProps = {
  /** Signed URL or public path to a GLB */
  modelSrc: string;
  /** Optional label shown in the overlay */
  label?: string;
  className?: string;
};

class ViewerErrorBoundary extends Component<
  { children: React.ReactNode; onError?: (msg: string) => void },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg || 'Failed to load 3D model' };
  }
  componentDidCatch(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    this.props.onError?.(msg);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <div className="max-w-md text-sm text-zinc-300">
            <p className="font-medium text-white mb-2">Could not load 3D model</p>
            <p className="text-zinc-400 break-words">{this.state.error}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Model({ src }: { src: string }) {
  const { scene } = useGLTF(src);
  const cloned = useMemo(() => scene.clone(), [scene]);
  return <primitive object={cloned} />;
}

/**
 * Interactive 3D viewer for a platform model (GLB).
 * Catches load errors so a bad URL or missing file does not blank the page.
 */
export function Platform3DViewer({ modelSrc, label, className = '' }: Platform3DViewerProps) {
  const [loadError, setLoadError] = useState<string | null>(null);

  return (
    <div
      className={`relative w-full bg-black rounded-2xl overflow-hidden ${className}`}
      style={{ minHeight: 480 }}
    >
      <ViewerErrorBoundary onError={setLoadError}>
        <Canvas
          camera={{ position: [2.5, 1.6, 3.2], fov: 45 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
        >
          <color attach="background" args={['#09090b']} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 8, 5]} intensity={1.2} />
          <directionalLight position={[-4, 3, -2]} intensity={0.4} />
          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.2}>
              <Center>
                <Model src={modelSrc} />
              </Center>
            </Bounds>
          </Suspense>
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            minDistance={0.5}
            maxDistance={30}
          />
        </Canvas>
      </ViewerErrorBoundary>

      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center pointer-events-none">
          <div className="max-w-md text-sm text-zinc-300">
            <p className="font-medium text-white mb-2">Could not load 3D model</p>
            <p className="text-zinc-400 break-words">{loadError}</p>
          </div>
        </div>
      )}

      <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-black/70 text-xs text-zinc-300 border border-zinc-700 pointer-events-none">
        {label || '3D view'} · drag to orbit · scroll to zoom
      </div>
    </div>
  );
}

export function preloadPlatformModel(src: string) {
  try {
    useGLTF.preload(src);
  } catch {
    /* ignore */
  }
}
