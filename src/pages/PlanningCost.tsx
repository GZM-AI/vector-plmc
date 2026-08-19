/**
 * Planning & Cost — TAR™
 * Part-level cost under each subsystem, expand/collapse, system roll-ups.
 * Rows keyed to System Registry entity ids.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Filter,
  AlertCircle,
  ExternalLink,
  Layers,
} from 'lucide-react';
import type { ResourceEntity } from '../types/plm';
import {
  getPlanLine,
  upsertPlanLine,
  lineTotal,
  sumLines,
  collectCostableUnder,
  formatMoney,
  subscribePlanningStore,
  type PlanLine,
  type CostConfidence,
  type PlanStatus,
} from '../lib/planningStore';

// Prefer live Registry tree (seed + user-added children); fall back to seed only
function useProductTree(): ResourceEntity {
  const [tree, setTree] = useState<ResourceEntity | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('../lib/configStore');
        if (!cancelled) setTree(mod.getRegistryTree());
        const unsub = mod.subscribeConfigStore(() => {
          setTree(mod.getRegistryTree());
        });
        return () => unsub();
      } catch {
        try {
          const seed = await import('../data/tarSeedData');
          if (!cancelled) setTree(seed.TAR_TREE);
        } catch {
          if (!cancelled) setTree(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return tree as ResourceEntity;
}

const CONFIDENCE_STYLE: Record<CostConfidence, string> = {
  Rough: 'text-amber-300 bg-amber-950/40 border-amber-800/50',
  Budget: 'text-sky-300 bg-sky-950/40 border-sky-800/50',
  Firm: 'text-emerald-300 bg-emerald-950/40 border-emerald-800/50',
};

const STATUS_OPTIONS: PlanStatus[] = ['Not started', 'In progress', 'Complete', 'Blocked'];
const CONF_OPTIONS: CostConfidence[] = ['Rough', 'Budget', 'Firm'];

function NumInput({
  value,
  onChange,
  className = '',
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
}) {
  return (
    <input
      type="number"
      min={0}
      step="any"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className={
        'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-right text-zinc-100 focus:outline-none focus:border-blue-500 ' +
        className
      }
    />
  );
}

function PartRow({
  entity,
  tick,
}: {
  entity: ResourceEntity;
  tick: number;
}) {
  const line = useMemo(() => getPlanLine(entity.id), [entity.id, tick]);

  const patch = (p: Partial<PlanLine>) => upsertPlanLine(entity.id, p);
  const total = lineTotal(line);

  return (
    <tr className="border-t border-zinc-800/80 hover:bg-zinc-900/50">
      <td className="py-2 pl-10 pr-2 text-sm text-zinc-200">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate font-medium">{entity.name}</span>
          <span className="text-[10px] text-zinc-600 shrink-0">{entity.type}</span>
          <Link
            to={`/system-registry?id=${encodeURIComponent(entity.id)}`}
            className="text-zinc-600 hover:text-blue-400 shrink-0"
            title="Open in Registry"
          >
            <ExternalLink size={12} />
          </Link>
        </div>
      </td>
      <td className="p-1.5 w-28">
        <NumInput value={line.nre} onChange={(n) => patch({ nre: n })} />
      </td>
      <td className="p-1.5 w-28">
        <NumInput value={line.unitCost} onChange={(n) => patch({ unitCost: n })} />
      </td>
      <td className="p-1.5 w-20">
        <NumInput value={line.qty} onChange={(n) => patch({ qty: n })} />
      </td>
      <td className="p-1.5 w-20">
        <NumInput value={line.leadTimeDays} onChange={(n) => patch({ leadTimeDays: n })} />
      </td>
      <td className="p-1.5 w-28">
        <select
          value={line.confidence}
          onChange={(e) => patch({ confidence: e.target.value as CostConfidence })}
          className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 ${CONFIDENCE_STYLE[line.confidence]}`}
        >
          {CONF_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </td>
      <td className="p-1.5 w-32">
        <select
          value={line.status}
          onChange={(e) => patch({ status: e.target.value as PlanStatus })}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="p-1.5 w-36">
        <input
          type="date"
          value={line.startDate || ''}
          onChange={(e) => patch({ startDate: e.target.value })}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
        />
      </td>
      <td className="p-1.5 w-36">
        <input
          type="date"
          value={line.endDate || ''}
          onChange={(e) => patch({ endDate: e.target.value })}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
        />
      </td>
      <td className="py-2 px-2 text-sm text-right text-zinc-200 tabular-nums whitespace-nowrap">
        {formatMoney(total)}
      </td>
      <td className="p-1.5 min-w-[140px]">
        <input
          value={line.note}
          onChange={(e) => patch({ note: e.target.value })}
          placeholder="Vendor / quote…"
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
        />
      </td>
    </tr>
  );
}

function SubsystemBlock({
  sub,
  expanded,
  onToggle,
  tick,
  onlyMissing,
}: {
  sub: ResourceEntity;
  expanded: boolean;
  onToggle: () => void;
  tick: number;
  onlyMissing: boolean;
}) {
  const parts = useMemo(() => collectCostableUnder(sub), [sub]);
  const lines = useMemo(
    () => parts.map((p) => getPlanLine(p.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parts, tick]
  );
  const rollup = useMemo(() => sumLines(lines), [lines]);
  const visibleParts = onlyMissing
    ? parts.filter((p) => {
        const l = getPlanLine(p.id);
        return !(l.nre > 0) && !(l.unitCost > 0);
      })
    : parts;

  if (onlyMissing && visibleParts.length === 0 && parts.length > 0) {
    return null;
  }

  return (
    <>
      <tr
        className="border-t border-zinc-700 bg-zinc-900/80 cursor-pointer"
        onClick={onToggle}
      >
        <td className="py-3 px-3 text-sm font-semibold text-white" colSpan={1}>
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Layers size={14} className="text-violet-400" />
            <span>{sub.name}</span>
            <span className="text-[10px] font-normal text-zinc-500">
              {parts.length} parts
              {rollup.missingCost > 0 ? ` · ${rollup.missingCost} missing cost` : ''}
            </span>
          </div>
        </td>
        <td className="py-3 px-2 text-right text-xs text-zinc-400 tabular-nums">
          {formatMoney(rollup.nre)}
        </td>
        <td className="py-3 px-2 text-right text-xs text-zinc-500" colSpan={2}>
          unit×qty {formatMoney(rollup.unit)}
        </td>
        <td className="py-3 px-2 text-xs text-zinc-600" colSpan={5} />
        <td className="py-3 px-2 text-right text-sm font-medium text-blue-300 tabular-nums">
          {formatMoney(rollup.total)}
        </td>
        <td className="py-3 px-2 text-xs text-zinc-600">Roll-up</td>
      </tr>
      {expanded &&
        visibleParts.map((p) => <PartRow key={p.id} entity={p} tick={tick} />)}
      {expanded && parts.length === 0 && (
        <tr className="border-t border-zinc-800/50">
          <td colSpan={11} className="py-3 pl-10 text-xs text-zinc-600">
            No components under this subsystem yet. Add children in System Registry, then
            return here to cost them.
          </td>
        </tr>
      )}
    </>
  );
}

const PlanningCost: React.FC = () => {
  const tree = useProductTree();
  const [tick, setTick] = useState(0);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => subscribePlanningStore(() => setTick((t) => t + 1)), []);

  const subsystems = useMemo(() => {
    if (!tree?.children) return [] as ResourceEntity[];
    return tree.children.filter((c) => c.type === 'Subsystem');
  }, [tree]);

  useEffect(() => {
    // Default: expand all subsystems once tree is known
    if (subsystems.length && expandedIds.size === 0) {
      setExpandedIds(new Set(subsystems.map((s) => s.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subsystems.length]);

  const allParts = useMemo(() => {
    const list: ResourceEntity[] = [];
    subsystems.forEach((s) => list.push(...collectCostableUnder(s)));
    return list;
  }, [subsystems]);

  const systemRollup = useMemo(() => {
    const lines = allParts.map((p) => getPlanLine(p.id));
    return sumLines(lines);
  }, [allParts, tick]);

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(subsystems.map((s) => s.id)));
  const collapseAll = () => setExpandedIds(new Set());

  if (!tree) {
    return (
      <div className="p-8 text-zinc-400">
        Loading product tree…
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen text-white">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold flex items-center gap-3">
            <CalendarClock className="text-blue-400" /> Planning &amp; Cost
          </h1>
          <p className="text-zinc-400 mt-1">
            Part-level estimates under each subsystem · linked to System Registry ·{' '}
            {allParts.length} cost lines
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOnlyMissing((v) => !v)}
            className={
              'px-3 py-2 rounded-xl text-sm border flex items-center gap-2 ' +
              (onlyMissing
                ? 'bg-amber-600/20 border-amber-600 text-amber-200'
                : 'bg-zinc-900 border-zinc-700 text-zinc-300')
            }
          >
            <Filter size={14} />
            {onlyMissing ? 'Showing missing cost' : 'Filter missing cost'}
          </button>
          <button
            type="button"
            onClick={expandAll}
            className="px-3 py-2 rounded-xl text-sm bg-zinc-900 border border-zinc-700 text-zinc-300"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-3 py-2 rounded-xl text-sm bg-zinc-900 border border-zinc-700 text-zinc-300"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* System roll-up cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500 flex items-center gap-1">
            <DollarSign size={12} /> System total
          </div>
          <div className="text-2xl font-semibold text-white mt-1 tabular-nums">
            {formatMoney(systemRollup.total)}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">NRE total</div>
          <div className="text-2xl font-semibold text-zinc-200 mt-1 tabular-nums">
            {formatMoney(systemRollup.nre)}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Unit × qty</div>
          <div className="text-2xl font-semibold text-zinc-200 mt-1 tabular-nums">
            {formatMoney(systemRollup.unit)}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500 flex items-center gap-1">
            <AlertCircle size={12} /> Missing cost
          </div>
          <div className="text-2xl font-semibold text-amber-300 mt-1 tabular-nums">
            {systemRollup.missingCost}
            <span className="text-sm font-normal text-zinc-500"> / {allParts.length}</span>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
                <th className="text-left font-medium py-3 px-3">Entity</th>
                <th className="text-right font-medium py-3 px-2">NRE</th>
                <th className="text-right font-medium py-3 px-2">Unit</th>
                <th className="text-right font-medium py-3 px-2">Qty</th>
                <th className="text-right font-medium py-3 px-2">Lead (d)</th>
                <th className="text-left font-medium py-3 px-2">Confidence</th>
                <th className="text-left font-medium py-3 px-2">Status</th>
                <th className="text-left font-medium py-3 px-2">Start</th>
                <th className="text-left font-medium py-3 px-2">End</th>
                <th className="text-right font-medium py-3 px-2">Line total</th>
                <th className="text-left font-medium py-3 px-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {/* System summary row */}
              <tr className="bg-zinc-950 border-b border-zinc-700">
                <td className="py-3 px-3 text-sm font-bold text-blue-300">
                  {tree.name || 'TAR™'}
                </td>
                <td className="py-3 px-2 text-right text-sm text-zinc-300 tabular-nums">
                  {formatMoney(systemRollup.nre)}
                </td>
                <td className="py-3 px-2 text-right text-xs text-zinc-500" colSpan={2}>
                  unit×qty {formatMoney(systemRollup.unit)}
                </td>
                <td colSpan={5} />
                <td className="py-3 px-2 text-right text-base font-semibold text-white tabular-nums">
                  {formatMoney(systemRollup.total)}
                </td>
                <td className="py-3 px-2 text-xs text-zinc-600">System roll-up</td>
              </tr>

              {subsystems.map((sub) => (
                <SubsystemBlock
                  key={sub.id}
                  sub={sub}
                  expanded={expandedIds.has(sub.id)}
                  onToggle={() => toggle(sub.id)}
                  tick={tick}
                  onlyMissing={onlyMissing}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-zinc-600 mt-4">
        Line total = NRE + (unit cost × qty). Data is stored on this browser until the product
        store moves to Amplify (same path as zone map / Registry). Every row is a Registry
        entity — add structure in System Registry, cost it here.
      </p>
    </div>
  );
};

export default PlanningCost;
