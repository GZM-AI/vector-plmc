import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Box, Crosshair, Layers, ChevronRight, X, Move } from 'lucide-react';
import { TAR_TREE, ALL_ENTITIES } from '../data/tarSeedData';

type Hotspot = {
  id: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
};

const DEFAULT_HOTSPOTS: Hotspot[] = [
  { id: 'sub-optical', label: 'Optical Sensor Integration', left: 38, top: 14, width: 14, height: 18, color: '#22c55e' },
  { id: 'sub-scope', label: 'Scope', left: 40, top: 6, width: 12, height: 12, color: '#f43f5e' },
  { id: 'sub-machine-vision', label: 'Machine Vision', left: 42, top: 20, width: 12, height: 14, color: '#0ea5e9' },
  { id: 'sub-pixel-to-position', label: 'Pixel to Position', left: 48, top: 16, width: 12, height: 14, color: '#14b8a6' },
  { id: 'sub-sensor-fusion', label: 'Sensor Fusion', left: 32, top: 30, width: 12, height: 22, color: '#f97316' },
  { id: 'sub-ballistics', label: 'Ballistic Computation', left: 34, top: 38, width: 12, height: 20, color: '#d946ef' },
  { id: 'sub-barrel-actuation', label: 'Barrel Actuation', left: 52, top: 28, width: 34, height: 26, color: '#ef4444' },
  { id: 'sub-chassis', label: 'Chassis', left: 10, top: 42, width: 16, height: 26, color: '#a3e635' },
  { id: 'sub-receiver', label: 'Receiver Configuration', left: 30, top: 32, width: 14, height: 24, color: '#06b6d4' },
  { id: 'sub-trigger', label: 'Trigger', left: 26, top: 48, width: 10, height: 14, color: '#fbbf24' },
  { id: 'sub-power', label: 'Power', left: 28, top: 54, width: 12, height: 16, color: '#f8fafc' },
  { id: 'sub-closed-loop', label: 'Closed Loop', left: 28, top: 34, width: 12, height: 22, color: '#6366f1' },
];

const STORAGE_KEY = 'vector-tar-hotspots-v3';

function loadHotspots(): Hotspot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_HOTSPOTS.map((h) => ({ ...h }));
    const parsed = JSON.parse(raw) as Hotspot[];
    const byId = Object.fromEntries(parsed.map((h) => [h.id, h]));
    return DEFAULT_HOTSPOTS.map((d) => ({
      ...d,
      left: byId[d.id]?.left ?? d.left,
      top: byId[d.id]?.top ?? d.top,
      width: byId[d.id]?.width ?? d.width,
      height: byId[d.id]?.height ?? d.height,
    }));
  } catch {
    return DEFAULT_HOTSPOTS.map((h) => ({ ...h }));
  }
}

function findInTree(node: any, id: string): any | null {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findInTree(child, id);
    if (found) return found;
  }
  return null;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const SystemArchitecture: React.FC = () => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showZones, setShowZones] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [hotspots, setHotspots] = useState<Hotspot[]>(() => loadHotspots());

  const containerRef = useRef<HTMLDivElement>(null);
  const editModeRef = useRef(editMode);
  const dragRef = useRef<{
    id: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
    origWidth: number;
    origHeight: number;
  } | null>(null);

  editModeRef.current = editMode;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hotspots));
  }, [hotspots]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      const el = containerRef.current;
      if (!drag || !el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const dx = ((e.clientX - drag.startX) / rect.width) * 100;
      const dy = ((e.clientY - drag.startY) / rect.height) * 100;
      setHotspots((prev) =>
        prev.map((h) => {
          if (h.id !== drag.id) return h;
          if (drag.mode === 'move') {
            return {
              ...h,
              left: Math.max(0, Math.min(95, drag.origLeft + dx)),
              top: Math.max(0, Math.min(95, drag.origTop + dy)),
            };
          }
          return {
            ...h,
            width: Math.max(6, Math.min(100 - drag.origLeft, drag.origWidth + dx)),
            height: Math.max(6, Math.min(100 - drag.origTop, drag.origHeight + dy)),
          };
        })
      );
    };
    const onMouseUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const subsystems = useMemo(
    () => (TAR_TREE?.children || []).filter((c: any) => c.type === 'Subsystem'),
    []
  );

  const active = useMemo(() => {
    if (!activeId) return null;
    return findInTree(TAR_TREE, activeId) || ALL_ENTITIES?.find((e: any) => e.id === activeId) || null;
  }, [activeId]);

  const visibleHotspots = useMemo(() => {
    if (showZones) return hotspots;
    if (activeId) return hotspots.filter((h) => h.id === activeId);
    return [];
  }, [showZones, hotspots, activeId]);

  const beginMove = (e: React.MouseEvent, h: Hotspot) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveId(h.id);
    if (!editModeRef.current) return;
    dragRef.current = {
      id: h.id,
      mode: 'move',
      startX: e.clientX,
      startY: e.clientY,
      origLeft: h.left,
      origTop: h.top,
      origWidth: h.width,
      origHeight: h.height,
    };
  };

  const beginResize = (e: React.MouseEvent, h: Hotspot) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editModeRef.current) return;
    dragRef.current = {
      id: h.id,
      mode: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      origLeft: h.left,
      origTop: h.top,
      origWidth: h.width,
      origHeight: h.height,
    };
  };

  const selectSubsystem = (id: string) => setActiveId(id);

  const resetZones = () => {
    setHotspots(DEFAULT_HOTSPOTS.map((h) => ({ ...h })));
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen text-white select-none">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold flex items-center gap-3">
            <Crosshair className="text-blue-400" /> System Architecture
          </h1>
          <p className="text-zinc-400 mt-1">
            {editMode
              ? 'EDIT ON — drag zones · white corner resizes'
              : showZones
                ? `TAR™ · ${hotspots.length} zones · Click a zone or list item`
                : 'TAR™ · Zones hidden · Select a subsystem to highlight it'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className={
              'px-4 py-2 rounded-xl text-sm border flex items-center gap-2 font-medium ' +
              (editMode
                ? 'bg-amber-500 border-amber-400 text-black'
                : 'bg-zinc-900 border-zinc-700 text-zinc-300')
            }
          >
            <Move size={14} /> {editMode ? 'EDITING — click when done' : 'Edit zones'}
          </button>
          {editMode && (
            <button
              type="button"
              onClick={resetZones}
              className="px-4 py-2 rounded-xl text-sm bg-zinc-900 border border-zinc-700 text-zinc-300"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowZones((v) => !v)}
            className="px-4 py-2 rounded-xl text-sm bg-zinc-900 border border-zinc-700 text-zinc-300"
          >
            {showZones ? 'Hide zones' : 'Show all zones'}
          </button>
          <Link
            to="/system-registry"
            className="px-4 py-2 rounded-xl text-sm bg-blue-600 text-white flex items-center gap-2"
          >
            <Box size={16} /> Open Registry
          </Link>
        </div>
      </div>

      {editMode && (
        <div className="mb-4 px-4 py-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-sm">
          Edit mode is ON. Drag colored boxes; use the white corner to resize.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-zinc-900 border border-zinc-800 rounded-3xl p-4 lg:p-6">
          <div
            ref={containerRef}
            className="relative w-full bg-black rounded-2xl overflow-hidden"
            style={{ userSelect: 'none' }}
          >
            <img
              src="/images/tar-system-map.png"
              alt="TAR system silhouette"
              className="w-full h-auto block pointer-events-none"
              draggable={false}
            />

            {visibleHotspots.map((h) => (
              <div
                key={h.id}
                onMouseDown={(e) => beginMove(e, h)}
                className={
                  'absolute rounded-xl border-2 flex items-start ' +
                  (activeId === h.id ? ' outline outline-2 outline-white z-20' : ' z-10') +
                  (editMode ? ' cursor-move' : ' cursor-pointer')
                }
                style={{
                  left: `${h.left}%`,
                  top: `${h.top}%`,
                  width: `${h.width}%`,
                  height: `${h.height}%`,
                  borderColor: h.color,
                  backgroundColor: hexToRgba(h.color, 0.35),
                }}
              >
                <div className="m-1 text-[10px] sm:text-[11px] leading-tight bg-black/80 text-white px-1.5 py-0.5 rounded pointer-events-none max-w-[95%] truncate">
                  {h.label}
                </div>
                {editMode && (
                  <div
                    onMouseDown={(e) => beginResize(e, h)}
                    className="absolute bottom-0 right-0 w-6 h-6 bg-white cursor-se-resize z-30"
                    style={{ borderTopLeftRadius: 6 }}
                    title="Resize"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {hotspots.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => selectSubsystem(h.id)}
                className={
                  'text-xs px-3 py-1.5 rounded-full border transition bg-zinc-950 ' +
                  (activeId === h.id ? 'ring-2 ring-white' : '')
                }
                style={{ borderColor: h.color, color: h.color }}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>

        <div className="xl:col-span-4">
          {active ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sticky top-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-950 border border-zinc-700 flex items-center justify-center">
                    <Layers className="text-blue-400" size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Subsystem</p>
                    <h2 className="text-lg font-semibold leading-snug">{active.name}</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="p-2 rounded-xl text-zinc-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {active.description && (
                <p className="text-sm text-zinc-400 leading-relaxed mb-5">{active.description}</p>
              )}

              <Link
                to={`/system-registry?id=${encodeURIComponent(active.id)}`}
                className="mb-4 inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
              >
                <Box size={14} /> Open this subsystem in Registry
              </Link>

              <h3 className="text-sm font-medium text-blue-400 mb-3">
                Constituents ({active.children?.length || 0})
              </h3>
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {(active.children || []).map((child: any) => (
                  <Link
                    key={child.id}
                    to={`/system-registry?id=${encodeURIComponent(child.id)}`}
                    className="block bg-zinc-950 border border-zinc-800 hover:border-blue-600 rounded-2xl p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate">{child.name}</span>
                      <ChevronRight size={14} className="text-zinc-600" />
                    </div>
                    {child.description && (
                      <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{child.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-10 text-center sticky top-6">
              <Crosshair className="mx-auto text-zinc-600 mb-3" size={36} />
              <p className="text-zinc-400 text-sm mb-6">
                Select a region or subsystem name.
              </p>
              <div className="grid grid-cols-1 gap-2 text-left">
                {subsystems.map((s: any) => {
                  const hs = hotspots.find((h) => h.id === s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectSubsystem(s.id)}
                      className="text-left text-sm px-3 py-2 rounded-xl bg-zinc-950 border text-zinc-300 hover:border-blue-600"
                      style={hs ? { borderColor: hs.color, color: hs.color } : undefined}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemArchitecture;