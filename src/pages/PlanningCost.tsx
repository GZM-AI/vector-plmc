/**
 * Planning & Cost — skeleton
 * Next: bind rows to TAR_TREE / ALL_ENTITIES from tarSeedData
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  DollarSign,
  GanttChart,
  Box,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { TAR_TREE } from '../data/tarSeedData';

type PlanTab = 'timeline' | 'cost' | 'rollup';

/** Placeholder plan fields — later stored per entity id */
type PlanRow = {
  id: string;
  name: string;
  type: string;
  start?: string;
  end?: string;
  pct: number;
  estimateUsd: number;
  confidence: 'low' | 'med' | 'high';
};

const PlanningCost: React.FC = () => {
  const [tab, setTab] = useState<PlanTab>('timeline');

  // Skeleton rows from live subsystems — no cost/schedule data yet
  const rows: PlanRow[] = useMemo(() => {
    return (TAR_TREE.children || [])
      .filter((c) => c.type === 'Subsystem')
      .map((s) => ({
        id: s.id,
        name: s.name,
        type: 'Subsystem',
        start: undefined,
        end: undefined,
        pct: 0,
        estimateUsd: 0,
        confidence: 'low' as const,
      }));
  }, []);

  const totalEstimate = rows.reduce((sum, r) => sum + r.estimateUsd, 0);
  const avgPct =
    rows.length === 0 ? 0 : Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length);

  return (
    <div className="p-8 max-w-[1600px] mx-auto bg-zinc-950 text-white min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <CalendarClock className="text-blue-400" /> Planning & Cost
          </h1>
          <p className="text-zinc-400 mt-2">
            Timeline · estimates · rollups · linked to System Registry entities
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
            className="px-4 py-2 rounded-xl text-sm bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-blue-500"
          >
            System Architecture
          </Link>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Tracked items</div>
          <div className="text-2xl font-semibold">{rows.length}</div>
          <div className="text-xs text-zinc-500 mt-1">Subsystems (v1 seed)</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1">
            <DollarSign size={12} /> Prospective cost
          </div>
          <div className="text-2xl font-semibold">
            {totalEstimate === 0 ? '—' : `$${totalEstimate.toLocaleString()}`}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Rollup when estimates are entered</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Avg progress</div>
          <div className="text-2xl font-semibold">{avgPct}%</div>
          <div className="text-xs text-zinc-500 mt-1">Placeholder until plans are set</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-900 border border-zinc-700 rounded-2xl p-1 w-fit mb-6">
        {(
          [
            { id: 'timeline' as const, label: 'Timeline', icon: GanttChart },
            { id: 'cost' as const, label: 'Cost', icon: DollarSign },
            { id: 'rollup' as const, label: 'Rollup', icon: Layers },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-xl text-sm flex items-center gap-2 ${
              tab === id ? 'bg-blue-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Frame notice */}
      <div className="mb-6 px-4 py-3 rounded-2xl bg-blue-950/30 border border-blue-900/40 text-blue-200 text-sm">
        Skeleton only. Rows are seeded from Registry subsystems. Next step: editable start/end,
        estimates, and per-component plans hooked to the same entity IDs.
      </div>

      {/* Table frame */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-5 py-4 font-medium">Entity</th>
                <th className="px-5 py-4 font-medium">Type</th>
                {tab !== 'cost' && (
                  <>
                    <th className="px-5 py-4 font-medium">Start</th>
                    <th className="px-5 py-4 font-medium">End</th>
                    <th className="px-5 py-4 font-medium">Progress</th>
                  </>
                )}
                {tab !== 'timeline' && (
                  <>
                    <th className="px-5 py-4 font-medium">Estimate (USD)</th>
                    <th className="px-5 py-4 font-medium">Confidence</th>
                  </>
                )}
                <th className="px-5 py-4 font-medium w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-800/80 hover:bg-zinc-800/40 transition"
                >
                  <td className="px-5 py-4">
                    <div className="font-medium text-white">{r.name}</div>
                    <div className="text-[11px] text-zinc-600 font-mono">{r.id}</div>
                  </td>
                  <td className="px-5 py-4 text-zinc-400">{r.type}</td>
                  {tab !== 'cost' && (
                    <>
                      <td className="px-5 py-4 text-zinc-500">{r.start || '—'}</td>
                      <td className="px-5 py-4 text-zinc-500">{r.end || '—'}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${r.pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500 w-8">{r.pct}%</span>
                        </div>
                      </td>
                    </>
                  )}
                  {tab !== 'timeline' && (
                    <>
                      <td className="px-5 py-4 text-zinc-500">
                        {r.estimateUsd === 0 ? '—' : `$${r.estimateUsd.toLocaleString()}`}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 uppercase">
                          {r.confidence}
                        </span>
                      </td>
                    </>
                  )}
                  <td className="px-5 py-4">
                    <Link
                      to={`/system-registry?id=${encodeURIComponent(r.id)}`}
                      className="text-zinc-500 hover:text-blue-400"
                      title="Open in Registry"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tab === 'rollup' && (
          <div className="px-5 py-4 border-t border-zinc-800 text-sm text-zinc-400">
            Rollup view will aggregate subsystem estimates into a TAR™ total and optional
            work-package breakdown. Structure is ready; values land when cost fields are hooked up.
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanningCost;