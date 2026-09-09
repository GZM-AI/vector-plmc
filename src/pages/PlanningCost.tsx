/**
 * Planning & Cost — TAR™
 * Part-level cost under each subsystem. Each part shows Estimated / Quoted / Actual.
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
  upsertTier,
  lineTotal,
  tierTotal,
  sumLines,
  collectCostableUnder,
  formatMoney,
  subscribePlanningStore,
  lineHasAnyCost,
  COST_TIERS,
  type CostTier,
  type PlanStatus,
} from '../lib/planningStore';

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

const TIER_STYLE: Record<CostTier, string> = {
  Estimated: 'text-amber-300',
  Quoted: 'text-sky-300',
  Actual: 'text-emerald-300',
};

const STATUS_OPTIONS: PlanStatus[] = ['Not started', 'In progress', 'Complete', 'Blocked'];

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

function PartBlock({
  entity,
  tick,
}: {
  entity: ResourceEntity;
  tick: number;
}) {
  const line = useMemo(() => getPlanLine(entity.id), [entity.id, tick]);
  const patchLine = (p: Parameters<typeof upsertPlanLine>[1]) => upsertPlanLine(entity.id, p);

  return (
    <>
      <tr className="border-t border-zinc-800 bg-zinc-950/40">
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
        <td colSpan={4} className="text-[10px] text-zinc-600 px-2">
          Working {formatMoney(lineTotal(line))}
        </td>
        <td className="p-1.5 w-32">
          <select
            value={line.status}
            onChange={(e) => patchLine({ status: e.target.value as PlanStatus })}
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
            onChange={(e) => patchLine({ startDate: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
          />
        </td>
        <td className="p-1.5 w-36">
          <input
            type="date"
            value={line.endDate || ''}
            onChange={(e) => patchLine({ endDate: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
          />
        </td>
        <td className="py-2 px-2 text-sm text-right text-zinc-200 tabular-nums whitespace-nowrap">
          {formatMoney(lineTotal(line))}
        </td>
        <td className="p-1.5 min-w-[140px]">
          <input
            value={line.note}
            onChange={(e) => patchLine({ note: e.target.value })}
            placeholder="Vendor / quote…"
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
          />
        </td>
      </tr>
      {COST_TIERS.map((tier) => {
        const v = line.tiers[tier];
        return (
          <tr key={tier} className="border-t border-zinc-800/40 hover:bg-zinc-900/50">
            <td className="py-1.5 pl-16 pr-2 text-xs">
              <span className={`font-medium ${TIER_STYLE[tier]}`}>{tier}</span>
            </td>
            <td className="p-1 w-28">
              <NumInput value={v.nre} onChange={(n) => upsertTier(entity.id, tier, { nre: n })} />
            </td>
            <td className="p-1 w-28">
              <NumInput
                value={v.unitCost}
                onChange={(n) => upsertTier(entity.id, tier, { unitCost: n })}
              />
            </td>
            <td className="p-1 w-20">
              <NumInput value={v.qty} onChange={(n) => upsertTier(entity.id, tier, { qty: n })} />
            </td>
            <td className="p-1 w-20">
              <NumInput
                value={v.leadTimeDays}
                onChange={(n) => upsertTier(entity.id, tier, { leadTimeDays: n })}
              />
            </td>
            <td colSpan={3} />
            <td className={`py-1.5 px-2 text-xs text-right tabular-nums ${TIER_STYLE[tier]}`}>
              {formatMoney(tierTotal(v))}
            </td>
            <td />
          </tr>
        );
      })}
    </>
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
    ? parts.filter((p) => !lineHasAnyCost(getPlanLine(p.id)))
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
        <td className="py-3 px-2 text-[10px] text-zinc-500" colSpan={4}>
          <span className="text-amber-300/80">Est {formatMoney(rollup.estimated)}</span>
          {' · '}
          <span className="text-sky-300/80">Qtd {formatMoney(rollup.quoted)}</span>
          {' · '}
          <span className="text-emerald-300/80">Act {formatMoney(rollup.actual)}</span>
        </td>
        <td className="py-3 px-2 text-right text-sm font-medium text-blue-300 tabular-nums">
          {formatMoney(rollup.total)}
        </td>
        <td className="py-3 px-2 text-xs text-zinc-600">Working roll-up</td>
      </tr>
      {expanded && visibleParts.map((p) => <PartBlock key={p.id} entity={p} tick={tick} />)}
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

  const allParts = useMemo(() => {
    const list: ResourceEntity[] = [];
    subsystems.forEach((s) => list.push(...collectCostableUnder(s)));
    return list;
  }, [subsystems]);

  const systemRollup = useMemo(() => {
    const lines = allParts.map((p) => getPlanLine(p.id));
    return sumLines(lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return <div className="p-8 text-zinc-400">Loading product tree…</div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen text-white">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold flex items-center gap-3">
            <CalendarClock className="text-blue-400" /> Planning &amp; Cost
          </h1>
          <p className="text-zinc-400 mt-1">
            Estimated, quoted, and actual on every part · {allParts.length} cost lines
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500 flex items-center gap-1">
            <DollarSign size={12} /> Working total
          </div>
          <div className="text-2xl font-semibold text-white mt-1 tabular-nums">
            {formatMoney(systemRollup.total)}
          </div>
          <div className="text-[10px] text-zinc-600 mt-1">Actual, else quoted, else estimated</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-amber-400/80">Estimated</div>
          <div className="text-2xl font-semibold text-amber-200 mt-1 tabular-nums">
            {formatMoney(systemRollup.estimated)}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-sky-400/80">Quoted</div>
          <div className="text-2xl font-semibold text-sky-200 mt-1 tabular-nums">
            {formatMoney(systemRollup.quoted)}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-emerald-400/80 flex items-center gap-1">
            Actual
            {systemRollup.missingCost > 0 && (
              <span className="text-amber-300 font-normal normal-case tracking-normal ml-auto flex items-center gap-1">
                <AlertCircle size={11} />
                {systemRollup.missingCost} missing
              </span>
            )}
          </div>
          <div className="text-2xl font-semibold text-emerald-200 mt-1 tabular-nums">
            {formatMoney(systemRollup.actual)}
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
                <th className="text-left font-medium py-3 px-3">Entity / class</th>
                <th className="text-right font-medium py-3 px-2">NRE</th>
                <th className="text-right font-medium py-3 px-2">Unit</th>
                <th className="text-right font-medium py-3 px-2">Qty</th>
                <th className="text-right font-medium py-3 px-2">Lead (d)</th>
                <th className="text-left font-medium py-3 px-2">Status</th>
                <th className="text-left font-medium py-3 px-2">Start</th>
                <th className="text-left font-medium py-3 px-2">End</th>
                <th className="text-right font-medium py-3 px-2">Line total</th>
                <th className="text-left font-medium py-3 px-2">Note</th>
              </tr>
            </thead>
            <tbody>
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
                <td className="py-3 px-2 text-[10px] text-zinc-500" colSpan={4}>
                  <span className="text-amber-300/80">Est {formatMoney(systemRollup.estimated)}</span>
                  {' · '}
                  <span className="text-sky-300/80">Qtd {formatMoney(systemRollup.quoted)}</span>
                  {' · '}
                  <span className="text-emerald-300/80">Act {formatMoney(systemRollup.actual)}</span>
                </td>
                <td className="py-3 px-2 text-right text-base font-semibold text-white tabular-nums">
                  {formatMoney(systemRollup.total)}
                </td>
                <td className="py-3 px-2 text-xs text-zinc-600">Working roll-up</td>
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
        Each part has three cost classes at once: Estimated, Quoted, and Actual. Working
        total prefers Actual if present, then Quoted, then Estimated. Line total = NRE +
        (unit × qty). Vertical Integrators are not costed here.
      </p>
    </div>
  );
};

export default PlanningCost;
