import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Box, Crosshair, Layers, ChevronRight, X, Move, Save, Cloud } from 'lucide-react';
import { TAR_TREE, ALL_ENTITIES } from '../data/tarSeedData';
import {
  getRegistryTree,
  getMergedAllEntities,
  subscribeConfigStore,
} from '../lib/configStore';
import {
  type Hotspot,
  DEFAULT_HOTSPOTS,
  loadHotspotLayout,
  saveHotspotLayout,
  resetHotspotLayoutLocal,
} from '../lib/hotspotLayoutStore';

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

/** Direct children shown inside a zone — skip Vertical Integrators to keep the overlay readable. */
function zoneComponents(node: any): { id: string; name: string }[] {
  if (!node?.children?.length) return [];
  return node.children
    .filter((c: any) => c && c.name && c.name !== 'Vertical Integrators')
    .map((c: any) => ({ id: c.id, name: c.name }));
}

const SystemArchitecture: React.FC = () => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadedIds, setLoadedIds] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [hotspots, setHotspots] = useState<Hotspot[]>(() =>
    DEFAULT_HOTSPOTS.map((h) => ({ ...h }))
  );
  const [layoutSource, setLayoutSource] = useState<'cloud' | 'local' | 'default' | 'loading'>(
    'loading'
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [treeTick, setTreeTick] = useState(0);

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

  useEffect(() => subscribeConfigStore(() => setTreeTick((t) => t + 1)), []);

  const productTree = useMemo(() => {
    try {
      return getRegistryTree();
    } catch {
      return TAR_TREE;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeTick]);

  const allEntities = useMemo(() => {
    try {
      return getMergedAllEntities();
    } catch {
      return ALL_ENTITIES || [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeTick]);

  const labelFor = useCallback(
    (id: string, fallback?: string) => {
      const fromTree = findInTree(productTree, id);
      if (fromTree?.name) return fromTree.name;
      const fromList = allEntities.find((e: any) => e.id === id);
      return fromList?.name || fallback || id;
    },
    [productTree, allEntities]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loadHotspotLayout();
      if (cancelled) return;
      setHotspots(result.hotspots);
      setLayoutSource(result.source);
      setDirty(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      setDirty(true);
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
    () => (productTree?.children || []).filter((c: any) => c.type === 'Subsystem'),
    [productTree]
  );

  const active = useMemo(() => {
    if (!activeId) return null;
    return (
      findInTree(productTree, activeId) ||
      allEntities.find((e: any) => e.id === activeId) ||
      null
    );
  }, [activeId, productTree, allEntities]);

  const loadedSet = useMemo(() => new Set(loadedIds), [loadedIds]);

  const visibleHotspots = useMemo(() => {
    if (editMode) return hotspots;
    return hotspots.filter((h) => loadedSet.has(h.id));
  }, [editMode, hotspots, loadedSet]);

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

  const selectSubsystem = (id: string) => {
    setActiveId(id);
    setLoadedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const toggleZone = (id: string) => {
    setLoadedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        setActiveId((cur) => (cur === id ? next[0] ?? null : cur));
        return next;
      }
      setActiveId(id);
      return [...prev, id];
    });
  };

  const showAllZones = () => setLoadedIds(hotspots.map((h) => h.id));

  const hideAllZones = () => {
    setLoadedIds([]);
    setActiveId(null);
  };

  const resetZones = () => {
    const next = resetHotspotLayoutLocal();
    setHotspots(next);
    setDirty(true);
    setLayoutSource('default');
    setSaveMessage(null);
  };

  const publishLayout = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const { cloudSaved } = await saveHotspotLayout(hotspots);
      setDirty(false);
      setLayoutSource(cloudSaved ? 'cloud' : 'local');
      setSaveMessage(
        cloudSaved
          ? 'Layout saved for the team (cloud).'
          : 'Layout saved on this device. Cloud not available yet — will sync when Amplify Data is live.'
      );
    } catch {
      setSaveMessage('Save failed. Try again.');
    } finally {
      setSaving(false);
    }
  }, [hotspots]);

  const sourceLabel =
    layoutSource === 'loading'
      ? 'Loading layout…'
      : layoutSource === 'cloud'
        ? 'Team layout (cloud)'
        : layoutSource === 'local'
          ? 'Layout from this device cache'
          : 'Default layout';

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen text-white select-none">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold flex items-center gap-3">
            <Crosshair className="text-blue-400" /> System Architecture
          </h1>
          <p className="text-zinc-400 mt-1">
            {editMode
              ? dirty
                ? 'EDIT ON — unsaved changes · drag zones · white corner resizes'
                : 'EDIT ON — drag zones · white corner resizes'
              : `TAR™ · ${loadedIds.length} of ${hotspots.length} zones on map · ${sourceLabel}`}
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
            <Move size={14} /> {editMode ? 'Done editing' : 'Edit zones'}
          </button>
          {editMode && (
            <>
              <button
                type="button"
                onClick={publishLayout}
                disabled={saving || !dirty}
                className={
                  'px-4 py-2 rounded-xl text-sm border flex items-center gap-2 font-medium ' +
                  (dirty && !saving
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-500 cursor-not-allowed')
                }
              >
                <Save size={14} /> {saving ? 'Saving…' : 'Save layout'}
              </button>
              <button
                type="button"
                onClick={resetZones}
                className="px-4 py-2 rounded-xl text-sm bg-zinc-900 border border-zinc-700 text-zinc-300"
              >
                Reset to defaults
              </button>
            </>
          )}
          <button
            type="button"
            onClick={showAllZones}
            className="px-4 py-2 rounded-xl text-sm bg-zinc-900 border border-zinc-700 text-zinc-300"
          >
            Show all zones
          </button>
          <button
            type="button"
            onClick={hideAllZones}
            disabled={loadedIds.length === 0 && !editMode}
            className={
              'px-4 py-2 rounded-xl text-sm border ' +
              (loadedIds.length === 0
                ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                : 'bg-zinc-900 border-zinc-700 text-zinc-300')
            }
          >
            Hide all zones
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
        <div className="mb-4 px-4 py-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-sm flex flex-wrap items-center gap-3">
          <span>
            Edit mode is ON. Drag colored boxes; use the white corner to resize. Click{' '}
            <strong>Save layout</strong> to publish for every device. Zone positions stay
            here; names and children come from System Registry.
          </span>
          {saveMessage && (
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <Cloud size={14} /> {saveMessage}
            </span>
          )}
        </div>
      )}

      {!editMode && saveMessage && (
        <div className="mb-4 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <Cloud size={14} /> {saveMessage}
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

            {visibleHotspots.map((h) => {
              const zoneNode = findInTree(productTree, h.id);
              const components = zoneComponents(zoneNode);
              return (
                <div
                  key={h.id}
                  onMouseDown={(e) => beginMove(e, h)}
                  className={
                    'absolute rounded-xl border-2 flex flex-col items-stretch overflow-hidden ' +
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
                  <div className="m-1 mb-0.5 text-[10px] sm:text-[11px] font-semibold leading-tight bg-black/80 text-white px-1.5 py-0.5 rounded pointer-events-none self-start max-w-[95%] truncate">
                    {labelFor(h.id, h.label)}
                  </div>
                  {components.length > 0 && (
                    <ul className="px-1.5 pb-1 pt-0.5 space-y-px overflow-hidden pointer-events-none flex-1 min-h-0">
                      {components.map((c) => (
                        <li
                          key={c.id}
                          className="text-[10px] sm:text-[11px] leading-tight text-white/95 truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]"
                          title={c.name}
                        >
                          {c.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  {editMode && (
                    <div
                      onMouseDown={(e) => beginResize(e, h)}
                      className="absolute bottom-0 right-0 w-6 h-6 bg-white cursor-se-resize z-30 pointer-events-auto"
                      style={{ borderTopLeftRadius: 6 }}
                      title="Resize"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-[11px] text-zinc-500">
            Click a subsystem to load or remove its zone. Several zones can sit on the map at
            once. White ring = selected for the panel.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {hotspots.map((h) => {
              const onMap = loadedSet.has(h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => toggleZone(h.id)}
                  title={onMap ? 'Remove zone from map' : 'Load zone onto map'}
                  className={
                    'text-xs px-3 py-1.5 rounded-full border transition ' +
                    (activeId === h.id ? 'ring-2 ring-white ' : '') +
                    (onMap ? 'text-black font-medium' : 'bg-zinc-950')
                  }
                  style={
                    onMap
                      ? { borderColor: h.color, backgroundColor: h.color, color: '#111' }
                      : { borderColor: h.color, color: h.color }
                  }
                >
                  {labelFor(h.id, h.label)}
                </button>
              );
            })}
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
                    {active.revision && (
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        Rev {active.revision}
                        {active.status ? ` · ${active.status}` : ''}
                      </p>
                    )}
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
                {(!active.children || active.children.length === 0) && (
                  <p className="text-xs text-zinc-600">
                    No components yet. Add them in System Registry.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-10 text-center sticky top-6">
              <Crosshair className="mx-auto text-zinc-600 mb-3" size={36} />
              <p className="text-zinc-400 text-sm mb-6">Select a region or subsystem name.</p>
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
