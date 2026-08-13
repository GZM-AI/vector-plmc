/**
 * Change Control — skeleton
 * Tracks proposed / approved / implemented changes against Registry entities
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GitBranch,
  Box,
  Crosshair,
  Search,
  ChevronRight,
  X,
  CircleDot,
} from 'lucide-react';
import { TAR_TREE, ALL_ENTITIES } from '../data/tarSeedData';

type ChangeStatus = 'draft' | 'proposed' | 'approved' | 'implemented' | 'rejected';
type ChangeImpact = 'low' | 'medium' | 'high';

type ChangeRecord = {
  id: string;
  title: string;
  status: ChangeStatus;
  impact: ChangeImpact;
  /** Registry entity ids affected */
  affectedEntityIds: string[];
  summary: string;
  requestedBy?: string;
  createdAt: string;
};

const STATUS_STYLE: Record<ChangeStatus, string> = {
  draft: 'bg-zinc-700 text-zinc-300',
  proposed: 'bg-blue-900/60 text-blue-300',
  approved: 'bg-emerald-900/60 text-emerald-300',
  implemented: 'bg-green-900/60 text-green-300',
  rejected: 'bg-red-900/60 text-red-300',
};

const IMPACT_STYLE: Record<ChangeImpact, string> = {
  low: 'text-zinc-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
};

/** Placeholder change records — replace when wiring real workflow */
const SEED_CHANGES: ChangeRecord[] = [
  {
    id: 'ecr-001',
    title: 'Optical package form-factor envelope update',
    status: 'draft',
    impact: 'medium',
    affectedEntityIds: ['sub-optical', 'comp-opt-form-factor'],
    summary:
      'Placeholder ECR. Adjust mechanical envelope for optical/sensor assembly after chassis interface review.',
    requestedBy: 'Zedekiah',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ecr-002',
    title: 'Barrel actuation mount interface revision',
    status: 'proposed',
    impact: 'high',
    affectedEntityIds: ['sub-barrel-actuation', 'comp-ba-chassis-mount'],
    summary:
      'Placeholder ECR. Update chassis mount geometry to support two-axis micro-actuation loads.',
    requestedBy: 'Zedekiah',
    createdAt: new Date().toISOString(),
  },
];

const ChangeControl: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChangeStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return SEED_CHANGES.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.affectedEntityIds.some((id) => id.toLowerCase().includes(q))
      );
    });
  }, [search, statusFilter]);

  const selected = SEED_CHANGES.find((c) => c.id === selectedId) || null;

  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    SEED_CHANGES.forEach((c) => {
      by[c.status] = (by[c.status] || 0) + 1;
    });
    return by;
  }, []);

  const entityName = (id: string) => ALL_ENTITIES.find((e) => e.id === id)?.name || id;

  const subsystemCount = (TAR_TREE.children || []).filter((c) => c.type === 'Subsystem').length;

  return (
    <div className="p-8 max-w-[1600px] mx-auto bg-zinc-950 text-white min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <GitBranch className="text-blue-400" /> Change Control
          </h1>
          <p className="text-zinc-400 mt-2">
            ECRs · impact · Registry traceability · TAR™ configuration baseline
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/system-registry"
            className="px-4 py-2 rounded-xl text-sm bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-blue-500 flex items-center gap-2"
          >
            <Box size={16} /> System Registry
          </Link>
          <Link
            to="/system-architecture"
            className="px-4 py-2 rounded-xl text-sm bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-blue-500 flex items-center gap-2"
          >
            <Crosshair size={16} /> System Architecture
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Open records</div>
          <div className="text-2xl font-semibold">{SEED_CHANGES.length}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Proposed</div>
          <div className="text-2xl font-semibold">{counts.proposed || 0}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Approved</div>
          <div className="text-2xl font-semibold">{counts.approved || 0}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Registry scope</div>
          <div className="text-2xl font-semibold">{subsystemCount}</div>
          <div className="text-xs text-zinc-500 mt-1">Subsystems</div>
        </div>
      </div>

      <div className="mb-6 px-4 py-3 rounded-2xl bg-blue-950/30 border border-blue-900/40 text-blue-200 text-sm">
        Skeleton change log. Each ECR points at Registry entity ids. Next: create/edit workflow,
        revision bumps on implement, and baseline snapshots.
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, id, entity…"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {(
            ['all', 'draft', 'proposed', 'approved', 'implemented', 'rejected'] as const
          ).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-xl border transition ${
                statusFilter === s
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-5 py-4 font-medium">Change</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Impact</th>
                <th className="px-5 py-4 font-medium">Affected</th>
                <th className="px-5 py-4 font-medium w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`border-b border-zinc-800/80 cursor-pointer transition ${
                    selectedId === c.id ? 'bg-blue-600/20' : 'hover:bg-zinc-800/40'
                  }`}
                >
                  <td className="px-5 py-4">
                    <div className="font-medium text-white flex items-center gap-2">
                      <CircleDot size={14} className="text-zinc-500 shrink-0" />
                      <span className="truncate">{c.title}</span>
                    </div>
                    <div className="text-[11px] text-zinc-600 font-mono mt-0.5">{c.id}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_STYLE[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className={`px-5 py-4 text-xs uppercase ${IMPACT_STYLE[c.impact]}`}>
                    {c.impact}
                  </td>
                  <td className="px-5 py-4 text-zinc-500 text-xs">
                    {c.affectedEntityIds.length} entit{c.affectedEntityIds.length === 1 ? 'y' : 'ies'}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-zinc-500">
                    No change records match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="xl:col-span-5">
          {selected ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sticky top-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Change record</p>
                  <h2 className="text-xl font-semibold text-white mt-1 leading-snug">
                    {selected.title}
                  </h2>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs font-mono text-zinc-500">{selected.id}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_STYLE[selected.status]}`}>
                      {selected.status}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full bg-zinc-800 ${IMPACT_STYLE[selected.impact]}`}>
                      impact: {selected.impact}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="p-2 rounded-xl text-zinc-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <h4 className="text-sm font-medium text-blue-400 mb-2">Summary</h4>
                <p className="text-sm text-zinc-400 leading-relaxed">{selected.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3">
                  <div className="text-[10px] uppercase text-zinc-500 mb-1">Requested by</div>
                  <div className="text-zinc-300">{selected.requestedBy || '—'}</div>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3">
                  <div className="text-[10px] uppercase text-zinc-500 mb-1">Created</div>
                  <div className="text-zinc-300">
                    {new Date(selected.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-blue-400 mb-2">
                  Affected Registry entities ({selected.affectedEntityIds.length})
                </h4>
                <ul className="space-y-2">
                  {selected.affectedEntityIds.map((id) => (
                    <li key={id}>
                      <Link
                        to={`/system-registry?id=${encodeURIComponent(id)}`}
                        className="flex items-center justify-between gap-2 text-sm bg-zinc-950 border border-zinc-800 hover:border-blue-600 rounded-xl px-3 py-2"
                      >
                        <span className="truncate text-zinc-300">{entityName(id)}</span>
                        <span className="text-[10px] font-mono text-zinc-600 shrink-0">{id}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-zinc-600">
                Workflow actions (submit, approve, implement) will land here after the data model is
                hooked up.
              </p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-10 text-center sticky top-6">
              <GitBranch className="mx-auto text-zinc-600 mb-3" size={36} />
              <p className="text-zinc-400 text-sm">
                Select a change record to view impact and Registry links.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangeControl;