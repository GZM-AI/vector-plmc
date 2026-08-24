/**
 * Phase 1 — Named configuration baselines
 * Freeze entity revision maps (“Alpha Integration Build 3”).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  Plus,
  ChevronRight,
  Box,
  Crosshair,
  Search,
  X,
  Layers,
} from 'lucide-react';
import type { Baseline, ReleaseStatus } from '../types/plm';
import {
  createBaseline,
  getAllBaselines,
  getAllEntitiesWithOverlays,
  subscribeConfigStore,
} from '../lib/configStore';
import { ALL_ENTITIES } from '../data/tarSeedData';

const STATUS_STYLE: Record<ReleaseStatus, string> = {
  Draft: 'bg-zinc-700 text-zinc-300',
  'In Review': 'bg-blue-900/60 text-blue-300',
  Released: 'bg-emerald-900/60 text-emerald-300',
  Obsolete: 'bg-red-900/60 text-red-300',
};

const Baselines: React.FC = () => {
  const [, setTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ReleaseStatus>('Draft');

  useEffect(() => subscribeConfigStore(() => setTick((t) => t + 1)), []);

  const baselines = useMemo(() => getAllBaselines(), [/* tick via re-render */]);
  // force dependency on tick by reading state each render
  const list = getAllBaselines();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.description || '').toLowerCase().includes(q)
    );
  }, [list, search]);

  const selected = list.find((b) => b.id === selectedId) || filtered[0] || null;

  const entityName = (id: string) =>
    ALL_ENTITIES.find((e) => e.id === id)?.name || id;

  const handleCreate = () => {
    if (!name.trim()) return;
    const bl = createBaseline({
      name: name.trim(),
      description: description.trim() || undefined,
      status,
    });
    setName('');
    setDescription('');
    setStatus('Draft');
    setShowCreate(false);
    setSelectedId(bl.id);
  };

  const freezeCount = getAllEntitiesWithOverlays().length;

  return (
    <div className="p-8 max-w-[1400px] mx-auto bg-zinc-950 text-white min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Bookmark className="text-blue-400" /> Baselines
          </h1>
          <p className="text-zinc-400 mt-2">
            Named configuration snapshots · frozen entity → revision maps
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium"
          >
            <Plus size={16} />
            Create baseline
          </button>
          <Link
            to="/system-registry"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-zinc-300 hover:border-blue-500"
          >
            <Box size={14} /> System Registry
          </Link>
          <Link
            to="/system-architecture"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-zinc-300 hover:border-blue-500"
          >
            <Crosshair size={14} /> Architecture
          </Link>
        </div>
      </div>

      {showCreate && (
        <div className="mb-6 bg-zinc-900 border border-blue-800/50 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">New baseline</h2>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-zinc-500 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            Freezes current revision of all {freezeCount} product entities into a named
            configuration.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alpha Integration Build 3"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ReleaseStatus)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="Draft">Draft</option>
                <option value="In Review">In Review</option>
                <option value="Released">Released</option>
                <option value="Obsolete">Obsolete</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Why this configuration matters…"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!name.trim()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
            >
              Freeze baseline
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-sm text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search baselines…"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 space-y-2">
          {filtered.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedId(b.id)}
              className={`w-full text-left rounded-2xl border p-4 transition ${
                selected?.id === b.id
                  ? 'bg-blue-600/20 border-blue-500/50'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{b.name}</div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {Object.keys(b.entityRevisions).length} entities ·{' '}
                    {new Date(b.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[b.status]}`}>
                  {b.status}
                </span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-zinc-500 py-8 text-center">No baselines match.</p>
          )}
        </div>

        <div className="xl:col-span-8">
          {selected ? (
            <BaselineDetail baseline={selected} entityName={entityName} />
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-16 text-center text-zinc-500">
              Select or create a baseline.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const BaselineDetail: React.FC<{
  baseline: Baseline;
  entityName: (id: string) => string;
}> = ({ baseline, entityName }) => {
  const entries = Object.entries(baseline.entityRevisions).sort((a, b) =>
    entityName(a[0]).localeCompare(entityName(b[0]))
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">{baseline.name}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_STYLE[baseline.status]}`}>
              {baseline.status}
            </span>
            <span className="text-xs text-zinc-500">
              {entries.length} frozen entities
            </span>
            <span className="text-xs text-zinc-500">
              {new Date(baseline.createdAt).toLocaleString()}
            </span>
            {baseline.createdBy && (
              <span className="text-xs text-zinc-500">by {baseline.createdBy}</span>
            )}
          </div>
        </div>
        <Layers className="text-zinc-600 shrink-0" size={28} />
      </div>

      {baseline.description && (
        <p className="text-zinc-300 text-[15px] leading-relaxed">{baseline.description}</p>
      )}

      <div>
        <h4 className="text-sm font-medium text-blue-400 mb-3">Frozen revisions</h4>
        <div className="border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-950 text-zinc-500 text-left text-xs">
                <th className="px-4 py-2.5 font-medium">Entity</th>
                <th className="px-4 py-2.5 font-medium w-24">Revision</th>
                <th className="px-4 py-2.5 font-medium w-28">Open</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([id, rev]) => (
                <tr key={id} className="border-t border-zinc-800/80 hover:bg-zinc-950/50">
                  <td className="px-4 py-2.5 text-zinc-200">
                    <div className="truncate max-w-md">{entityName(id)}</div>
                    <div className="text-[10px] text-zinc-600 font-mono">{id}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-700 text-zinc-300">
                      Rev {rev}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/system-registry?id=${encodeURIComponent(id)}`}
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      Registry <ChevronRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Baselines;
