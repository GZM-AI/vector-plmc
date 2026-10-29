import React, { Component, Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center, Bounds } from '@react-three/drei';
import * as THREE from 'three';

type Platform3DViewerProps = {
  modelSrc: string;
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

function toStringSrc(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof URL) return value.href;
  if (value && typeof (value as { href?: string }).href === 'string') return (value as { href: string }).href;
  return String(value ?? '');
}

function looksLikeGlb(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 12) return false;
  const view = new DataView(buf);
  return view.getUint32(0, true) === 0x46546c67;
}

/** Clone and scale so the largest dimension fills the stage. */
function Model({ src }: { src: string }) {
  const { scene } = useGLTF(src);
  const prepared = useMemo(() => {
    const cloned = scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const target = 14;
    const scale = target / maxDim;
    cloned.scale.setScalar(scale);
    const scaledBox = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);
    cloned.position.sub(center);
    return cloned;
  }, [scene]);
  return <primitive object={prepared} />;
}

export function Platform3DViewer({ modelSrc, label, className = '' }: Platform3DViewerProps) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const safeSrc = toStringSrc(modelSrc);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    setChecking(true);
    setLoadError(null);
    setBlobUrl(null);

    (async () => {
      try {
        const res = await fetch(safeSrc);
        if (!res.ok) throw new Error(`Model request failed (${res.status})`);
        const buf = await res.arrayBuffer();
        if (!looksLikeGlb(buf)) {
          const preview = new TextDecoder().decode(buf.slice(0, 180)).replace(/\s+/g, ' ').trim();
          throw new Error(
            preview.startsWith('<?xml') || preview.startsWith('<Error') || preview.startsWith('<!DOCTYPE') || preview.startsWith('<html')
              ? `Storage returned an error page instead of a GLB. ${preview.slice(0, 140)}`
              : 'File is not a valid GLB (missing glTF header).'
          );
        }
        const blob = new Blob([buf], { type: 'model/gltf-binary' });
        created = URL.createObjectURL(blob);
        if (!cancelled) setBlobUrl(created);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [safeSrc]);

  return (
    <div className={`absolute inset-0 bg-black ${className}`}>
      {checking && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-sm">
          Loading 3D model…
        </div>
      )}

      {!checking && blobUrl && (
        <ViewerErrorBoundary onError={setLoadError}>
          <Canvas
            style={{ width: '100%', height: '100%', display: 'block' }}
            camera={{ position: [0, 0.4, 3.6], fov: 28 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: false }}
          >
            <color attach="background" args={['#09090b']} />
            <ambientLight intensity={1.05} />
            <directionalLight position={[6, 10, 6]} intensity={1.8} />
            <directionalLight position={[-5, 4, -3]} intensity={0.75} />
            <directionalLight position={[0, 2, 8]} intensity={0.55} />
            <Suspense fallback={null}>
              <Bounds fit clip observe margin={0.7}>
                <Center>
                  <Model src={blobUrl} />
                </Center>
              </Bounds>
            </Suspense>
            <OrbitControls
              makeDefault
              enableDamping
              dampingFactor={0.08}
              minDistance={0.2}
              maxDistance={30}
              target={[0, 0, 0]}
            />
          </Canvas>
        </ViewerErrorBoundary>
      )}

      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <div className="max-w-md text-sm text-zinc-300">
            <p className="font-medium text-white mb-2">Could not load 3D model</p>
            <p className="text-zinc-400 break-words">{loadError}</p>
          </div>
        </div>
      )}

      <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-black/70 text-xs text-zinc-300 border border-zinc-700 pointer-events-none z-10">
        {label || '3D view'} · drag to orbit · scroll to zoom
      </div>
    </div>
  );
}

export function preloadPlatformModel(src: string) {
  try {
    useGLTF.preload(toStringSrc(src));
  } catch {
    /* ignore */
  }
}
