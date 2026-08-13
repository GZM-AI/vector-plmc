/**
 * Suppliers — master directory skeleton
 * Links to Registry entities come next (supplier ↔ subsystem / component)
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Factory,
  Box,
  Crosshair,
  Search,
  Building2,
  Globe,
  ChevronRight,
  X,
} from 'lucide-react';
import { TAR_TREE } from '../data/tarSeedData';

type SupplierStatus = 'prospect' | 'engaged' | 'qualified' | 'preferred' | 'do-not-use';
type SupplierKind = 'OEM' | 'Contract mfr' | 'Distributor' | 'Design house' | 'Other';

type Supplier = {
  id: string;
  name: string;
  kind: SupplierKind;
  status: SupplierStatus;
  country?: string;
  website?: string;
  domains: string[];
  /** Registry entity ids this supplier is linked to (empty in skeleton) */
  linkedEntityIds: string[];
  notes?: string;
};

const STATUS_STYLE: Record<SupplierStatus, string> = {
  prospect: 'bg-zinc-700 text-zinc-300',
  engaged: 'bg-blue-900/60 text-blue-300',
  qualified: 'bg-emerald-900/60 text-emerald-300',
  preferred: 'bg-green-900/60 text-green-300',
  'do-not-use': 'bg-red-900/60 text-red-300',
};

/** Placeholder directory — replace / extend when wiring real data */
const SEED_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-example-optics',
    name: 'Example Optics Co.',
    kind: 'OEM',
    status: 'prospect',
    country: 'US',
    website: 'https://example.com',
    domains: ['optics', 'sensors'],
    linkedEntityIds: [],
    notes: 'Placeholder — link to Optical / Machine Vision when ready.',
  },
  {
    id: 'sup-example-actuation',
    name: 'Example Actuation Labs',
    kind: 'Design house',
    status: 'prospect',
    country: 'US',
    domains: ['actuation', 'mechanical'],
    linkedEntityIds: [],
    notes: 'Placeholder — candidate for Barrel Actuation vertical integration.',
  },
  {
    id: 'sup-example-power',
    name: 'Example Power Systems',
    kind: 'OEM',
    status: 'prospect',
    country: 'US',
    domains: ['power', 'electronics'],
    linkedEntityIds: [],
  },
];

const Suppliers: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const subsystems = useMemo(
    () => (TAR_TREE.children || []).filter((c) => c.type === 'Subsystem'),
    []
  );

  const filtered = useMemo(() => {
    return SEED_SUPPLIERS.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.kind.toLowerCase().includes(q) ||
        s.domains.some((d) => d.includes(q)) ||
        (s.country || '').toLowerCase().includes(q)
      );
    });
  }, [search, statusFilter]);

  const selected = SEED_SUPPLIERS.find((s) => s.id === selectedId) || null;

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    SEED_SUPPLIERS.forEach((s) => {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    });
    return byStatus;
  }, []);

  return (
    <div className="p-8 max-w-[1600px] mx-auto bg-zinc-950 text-white min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Factory className="text-blue-400" /> Suppliers
          </h1>
          <p className="text-zinc-400 mt-2">
            Master directory · link to subsystems via Vertical Integrators
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

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Suppliers</div>
          <div className="text-2xl font-semibold">{SEED_SUPPLIERS.length}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Prospect</div>
          <div className="text-2xl font-semibold">{counts.prospect || 0}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Qualified+</div>
          <div className="text-2xl font-semibold">
            {(counts.qualified || 0) + (counts.preferred || 0)}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Registry subsystems</div>
          <div className="text-2xl font-semibold">{subsystems.length}</div>
          <div className="text-xs text-zinc-500 mt-1">Available to link</div>
        </div>
      </div>

      <div className="mb-6 px-4 py-3 rounded-2xl bg-blue-950/30 border border-blue-900/40 text-blue-200 text-sm">
        Skeleton directory. Per-subsystem Vertical Integrators stay local to each branch; this page
        is the shared company master. Next: add/edit suppliers and link <code className="text-blue-300">linkedEntityIds</code> to Registry ids.
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, domain, country…"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {(['all', 'prospect', 'engaged', 'qualified', 'preferred', 'do-not-use'] as const).map(
            (s) => (
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
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* List */}
        <div className="xl:col-span-7 bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-5 py-4 font-medium">Supplier</th>
                <th className="px-5 py-4 font-medium">Kind</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Domains</th>
                <th className="px-5 py-4 font-medium w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`border-b border-zinc-800/80 cursor-pointer transition ${
                    selectedId === s.id ? 'bg-blue-600/20' : 'hover:bg-zinc-800/40'
                  }`}
                >
                  <td className="px-5 py-4">
                    <div className="font-medium text-white flex items-center gap-2">
                      <Building2 size={14} className="text-zinc-500" />
                      {s.name}
                    </div>
                    <div className="text-[11px] text-zinc-600 font-mono mt-0.5">{s.id}</div>
                  </td>
                  <td className="px-5 py-4 text-zinc-400">{s.kind}</td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_STYLE[s.status]}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {s.domains.map((d) => (
                        <span
                          key={d}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-700 text-zinc-500"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-zinc-600">
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-zinc-500">
                    No suppliers match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail */}
        <div className="xl:col-span-5">
          {selected ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sticky top-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Supplier</p>
                  <h2 className="text-xl font-semibold text-white mt-1">{selected.name}</h2>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {selected.kind}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_STYLE[selected.status]}`}>
                      {selected.status}
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

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3">
                  <div className="text-[10px] uppercase text-zinc-500 mb-1">Country</div>
                  <div className="text-zinc-300">{selected.country || '—'}</div>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3">
                  <div className="text-[10px] uppercase text-zinc-500 mb-1 flex items-center gap-1">
                    <Globe size={10} /> Website
                  </div>
                  <div className="text-zinc-300 truncate">
                    {selected.website ? (
                      <a
                        href={selected.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {selected.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-blue-400 mb-2">Domains</h4>
                <div className="flex flex-wrap gap-2">
                  {selected.domains.map((d) => (
                    <span
                      key={d}
                      className="text-xs px-3 py-1 rounded-full bg-zinc-950 border border-zinc-700 text-zinc-400"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>

              {selected.notes && (
                <div>
                  <h4 className="text-sm font-medium text-blue-400 mb-2">Notes</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed">{selected.notes}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-blue-400 mb-2">
                  Linked Registry entities ({selected.linkedEntityIds.length})
                </h4>
                {selected.linkedEntityIds.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    None yet. Next step: attach subsystem / component ids (e.g. sub-optical) so
                    Vertical Integrators and this directory stay in sync.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {selected.linkedEntityIds.map((id) => (
                      <li key={id}>
                        <Link
                          to={`/system-registry?id=${encodeURIComponent(id)}`}
                          className="text-sm text-blue-400 hover:underline font-mono"
                        >
                          {id}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium text-blue-400 mb-2">Link targets (subsystems)</h4>
                <div className="flex flex-wrap gap-2">
                  {subsystems.map((sub) => (
                    <span
                      key={sub.id}
                      className="text-[11px] px-2.5 py-1 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-500"
                      title={sub.id}
                    >
                      {sub.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-10 text-center sticky top-6">
              <Factory className="mx-auto text-zinc-600 mb-3" size={36} />
              <p className="text-zinc-400 text-sm">
                Select a supplier to view profile and Registry link targets.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Suppliers;