import React, { Component, Suspense, useEffect, useMemo, useState } from 'react';
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

function toStringSrc(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof URL) return value.href;
  if (value && typeof (value as { href?: string }).href === 'string') return (value as { href: string }).href;
  return String(value ?? '');
}

function looksLikeGlb(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 12) return false;
  const view = new DataView(buf);
  // GLB magic is "glTF" (0x46546C67 little-endian)
  return view.getUint32(0, true) === 0x46546c67;
}

function Model({ src }: { src: string }) {
  const { scene } = useGLTF(src);
  const cloned = useMemo(() => scene.clone(), [scene]);
  return <primitive object={cloned} />;
}

/**
 * Interactive 3D viewer for a platform model (GLB).
 * Fetches as binary first so an S3/XML error page is not parsed as a model.
 */
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
        if (!res.ok) {
          throw new Error(`Model request failed (${res.status})`);
        }
        const buf = await res.arrayBuffer();
        if (!looksLikeGlb(buf)) {
          // Likely an XML/HTML error page from S3 or Amplify
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
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
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
    <div
      className={`relative w-full bg-black rounded-2xl overflow-hidden ${className}`}
      style={{ minHeight: 480 }}
    >
      {checking && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-sm">
          Loading 3D model…
        </div>
      )}

      {!checking && blobUrl && (
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
                  <Model src={blobUrl} />
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
      )}

      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
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
    useGLTF.preload(toStringSrc(src));
  } catch {
    /* ignore */
  }
}
