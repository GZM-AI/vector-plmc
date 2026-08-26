/**
 * Suppliers — vendors, manufacturers, integrators
 * New/Edit: pick Subsystem, then components. Vertical Integrator is a separate action.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Factory,
  Plus,
  Search,
  ExternalLink,
  Trash2,
  Link2,
  Building2,
} from 'lucide-react';
import type { ResourceEntity } from '../types/plm';
import {
  getSuppliers,
  upsertSupplier,
  deleteSupplier,
  linkSupplierToEntity,
  unlinkSupplierFromEntity,
  getEntitySourcing,
  setEntitySourcing,
  subscribeSuppliersStore,
  type Supplier,
  type SupplierKind,
  type EngagementStatus,
  type SourcingRisk,
  type MakeBuy,
} from '../lib/suppliersStore';

function useProductData(): {
  byId: Map<string, ResourceEntity>;
  list: ResourceEntity[];
  subsystems: ResourceEntity[];
} {
  const [list, setList] = useState<ResourceEntity[]>([]);
  const [subsystems, setSubsystems] = useState<ResourceEntity[]>([]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const mod = await import('../lib/configStore');
        const load = () => {
          const tree = mod.getRegistryTree();
          setList(mod.getMergedAllEntities());
          setSubsystems(
            (tree.children || []).filter(
              (c: ResourceEntity) => c.type === 'Subsystem' && !isIntegratorNode(c)
            )
          );
        };
        load();
        unsub = mod.subscribeConfigStore(load);
      } catch {
        try {
          const seed = await import('../data/tarSeedData');
          setList(seed.ALL_ENTITIES || []);
          const tree = seed.TAR_TREE;
          setSubsystems(
            (tree?.children || []).filter(
              (c: ResourceEntity) => c.type === 'Subsystem' && !isIntegratorNode(c)
            )
          );
        } catch {
          setList([]);
          setSubsystems([]);
        }
      }
    })();
    return () => unsub?.();
  }, []);

  const byId = useMemo(() => new Map(list.map((e) => [e.id, e])), [list]);
  return { byId, list, subsystems };
}

const KIND_OPTIONS: SupplierKind[] = [
  'Vendor',
  'Manufacturer',
  'Integrator',
  'Distributor',
  'Other',
];
const ENGAGEMENT_OPTIONS: EngagementStatus[] = [
  'Identified',
  'Contacted',
  'NDA',
  'Quoting',
  'Selected',
  'Active',
  'On hold',
  'Dropped',
];
const RISK_OPTIONS: SourcingRisk[] = ['Unknown', 'Low', 'Medium', 'High'];
const MAKE_BUY_OPTIONS: MakeBuy[] = ['Undecided', 'Buy', 'Make', 'Make-or-buy'];

const RISK_STYLE: Record<SourcingRisk, string> = {
  Unknown: 'bg-zinc-800 text-zinc-400',
  Low: 'bg-emerald-950/50 text-emerald-300',
  Medium: 'bg-amber-950/50 text-amber-300',
  High: 'bg-red-950/50 text-red-300',
};

const emptyForm = (): Partial<Supplier> & { name: string } => ({
  name: '',
  kind: 'Vendor',
  engagement: 'Identified',
  risk: 'Unknown',
  website: '',
  contactName: '',
  contactEmail: '',
  location: '',
  notes: '',
  entityIds: [],
  subsystemIds: [],
});

type MaybeKind = ResourceEntity & { kind?: string };

function isIntegratorNode(e: ResourceEntity): boolean {
  const kind = (e as MaybeKind).kind;
  if (kind === 'integrator') return true;
  const n = (e.name || '').toLowerCase();
  return (
    n.includes('vertical integrator') ||
    n.includes('integration candidate') ||
    n === 'integrator' ||
    n.includes('integrators')
  );
}

function componentsUnderSubsystem(sub: ResourceEntity): ResourceEntity[] {
  return (sub.children || []).filter(
    (c) => c.type === 'Component' && !isIntegratorNode(c)
  );
}

function integratorNodeUnderSubsystem(sub: ResourceEntity): ResourceEntity | undefined {
  const kids = sub.children || [];
  const named = kids.find((c) => c.name === 'Integration Candidates');
  if (named) return named;
  const kindOnChild = kids.find((c) => (c as MaybeKind).kind === 'integrator');
  if (kindOnChild) return kindOnChild;
  for (const c of kids) {
    const hit = (c.children || []).find(
      (e) =>
        e.type === 'Element' &&
        ((e as MaybeKind).kind === 'integrator' || /integrator/i.test(e.name))
    );
    if (hit) return hit;
  }
  return undefined;
}

const Suppliers: React.FC = () => {
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [linkEntityId, setLinkEntityId] = useState('');
  const [formSubsystemId, setFormSubsystemId] = useState('');
  const { byId, list: entities, subsystems } = useProductData();

  useEffect(() => subscribeSuppliersStore(() => setTick((t) => t + 1)), []);

  const suppliers = useMemo(() => getSuppliers(), [tick]);
  const selected = selectedId ? suppliers.find((s) => s.id === selectedId) : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.kind.toLowerCase().includes(q) ||
        s.engagement.toLowerCase().includes(q) ||
        (s.location || '').toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const formSubsystem = useMemo(
    () => subsystems.find((s) => s.id === formSubsystemId) || null,
    [subsystems, formSubsystemId]
  );

  const formComponents = useMemo(() => {
    if (!formSubsystem) return [] as ResourceEntity[];
    return componentsUnderSubsystem(formSubsystem);
  }, [formSubsystem]);

  const partOptions = useMemo(() => {
    return entities
      .filter(
        (e) =>
          e.type !== 'System' &&
          e.type !== 'Subsystem' &&
          !isIntegratorNode(e)
      )
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entities]);

  const formViNode = formSubsystem
    ? integratorNodeUnderSubsystem(formSubsystem)
    : undefined;
  const viChecked = !!(
    formSubsystem &&
    (formViNode
      ? (form.entityIds || []).includes(formViNode.id)
      : form.kind === 'Integrator' &&
        (form.subsystemIds || []).includes(formSubsystem.id))
  );

  const toggleFormEntity = (entityId: string) => {
    setForm((f) => {
      const ids = f.entityIds || [];
      return {
        ...f,
        entityIds: ids.includes(entityId)
          ? ids.filter((id) => id !== entityId)
          : [...ids, entityId],
      };
    });
  };

  const selectSubsystem = (id: string) => {
    setFormSubsystemId(id);
    if (!id) return;
    setForm((f) => ({
      ...f,
      subsystemIds: Array.from(new Set([...(f.subsystemIds || []), id])),
    }));
  };

  const toggleVerticalIntegrator = (checked: boolean) => {
    if (!formSubsystem) return;
    const vi = integratorNodeUnderSubsystem(formSubsystem);
    setForm((f) => {
      const subsystemIds = Array.from(
        new Set([...(f.subsystemIds || []), formSubsystem.id])
      );
      if (checked) {
        return {
          ...f,
          kind: 'Integrator',
          subsystemIds,
          entityIds: vi
            ? Array.from(new Set([...(f.entityIds || []), vi.id]))
            : f.entityIds || [],
        };
      }
      return {
        ...f,
        entityIds: vi
          ? (f.entityIds || []).filter((id) => id !== vi.id)
          : f.entityIds || [],
        subsystemIds,
      };
    });
  };

  const startCreate = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setFormSubsystemId('');
    setEditing(true);
  };

  const startEdit = (s: Supplier) => {
    setSelectedId(s.id);
    setForm({
      ...s,
      entityIds: [...(s.entityIds || [])],
      subsystemIds: [...(s.subsystemIds || [])],
    });
    setFormSubsystemId((s.subsystemIds && s.subsystemIds[0]) || '');
    setEditing(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const saved = upsertSupplier({
      ...form,
      id: selectedId || undefined,
      name: form.name,
      entityIds: form.entityIds || [],
      subsystemIds: form.subsystemIds || [],
    });
    setSelectedId(saved.id);
    setForm({
      ...saved,
      entityIds: [...(saved.entityIds || [])],
      subsystemIds: [...(saved.subsystemIds || [])],
    });
    setEditing(false);
    setFormSubsystemId((saved.subsystemIds && saved.subsystemIds[0]) || '');
  };

  const handleDelete = () => {
    if (!selectedId) return;
    if (!confirm('Remove this supplier?')) return;
    deleteSupplier(selectedId);
    setSelectedId(null);
    setEditing(false);
    setForm(emptyForm());
    setFormSubsystemId('');
  };

  const handleLink = () => {
    if (!selectedId || !linkEntityId) return;
    linkSupplierToEntity(selectedId, linkEntityId);
    setLinkEntityId('');
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen text-white">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold flex items-center gap-3">
            <Factory className="text-blue-400" /> Suppliers
          </h1>
          <p className="text-zinc-400 mt-1">
            Vendors, manufacturers, integrators · linked to Registry parts ·{' '}
            {suppliers.length} records
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium"
        >
          <Plus size={16} /> Add supplier
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers…"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl divide-y divide-zinc-800 max-h-[70vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-6 text-sm text-zinc-600">
                No suppliers yet. Add a candidate company to start sourcing tracking.
              </p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(s.id);
                    setForm({
                      ...s,
                      entityIds: [...(s.entityIds || [])],
                      subsystemIds: [...(s.subsystemIds || [])],
                    });
                    setEditing(false);
                    setFormSubsystemId((s.subsystemIds && s.subsystemIds[0]) || '');
                  }}
                  className={
                    'w-full text-left px-4 py-3 hover:bg-zinc-800/80 transition ' +
                    (selectedId === s.id ? 'bg-zinc-800/90' : '')
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-white truncate">{s.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {s.kind} · {s.engagement}
                        {s.location ? ` · ${s.location}` : ''}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${RISK_STYLE[s.risk]}`}
                    >
                      {s.risk}
                    </span>
                  </div>
                  {(s.subsystemIds?.length || 0) > 0 && (
                    <div className="text-[10px] text-zinc-600 mt-1">
                      {(s.subsystemIds || [])
                        .map((id) => byId.get(id)?.name || id)
                        .join(' · ')}
                    </div>
                  )}
                  {s.entityIds.length > 0 && (
                    <div className="text-[10px] text-zinc-600 mt-1">
                      {s.entityIds.length} linked part{s.entityIds.length === 1 ? '' : 's'}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="xl:col-span-7">
          {!selected && !editing ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-12 text-center text-zinc-500">
              <Building2 className="mx-auto mb-3 text-zinc-600" size={36} />
              Select a supplier or add a new one.
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-xl font-semibold">
                  {editing ? (selectedId ? 'Edit supplier' : 'New supplier') : selected?.name}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {!editing && selected && (
                    <button
                      type="button"
                      onClick={() => startEdit(selected)}
                      className="px-3 py-1.5 rounded-xl text-xs bg-zinc-800 border border-zinc-600 text-zinc-200"
                    >
                      Edit
                    </button>
                  )}
                  {editing && (
                    <>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={!form.name?.trim()}
                        className="px-3 py-1.5 rounded-xl text-xs bg-emerald-600 text-white disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(false);
                          if (selected)
                            setForm({
                              ...selected,
                              entityIds: [...selected.entityIds],
                              subsystemIds: [...(selected.subsystemIds || [])],
                            });
                          else setForm(emptyForm());
                          setFormSubsystemId(
                            (selected?.subsystemIds && selected.subsystemIds[0]) || ''
                          );
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs bg-zinc-800 text-zinc-300"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {selectedId && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-3 py-1.5 rounded-xl text-xs bg-red-950/40 border border-red-900/50 text-red-300 inline-flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </div>
              </div>

              {editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] text-zinc-500 block mb-1">Name</label>
                    <input
                      value={form.name || ''}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500 block mb-1">Kind</label>
                    <select
                      value={form.kind || 'Vendor'}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, kind: e.target.value as SupplierKind }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
                    >
                      {KIND_OPTIONS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500 block mb-1">Engagement</label>
                    <select
                      value={form.engagement || 'Identified'}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          engagement: e.target.value as EngagementStatus,
                        }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
                    >
                      {ENGAGEMENT_OPTIONS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500 block mb-1">Sourcing risk</label>
                    <select
                      value={form.risk || 'Unknown'}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, risk: e.target.value as SourcingRisk }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
                    >
                      {RISK_OPTIONS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500 block mb-1">Location</label>
                    <input
                      value={form.location || ''}
                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500 block mb-1">Website</label>
                    <input
                      value={form.website || ''}
                      onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                      placeholder="https://"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500 block mb-1">Contact name</label>
                    <input
                      value={form.contactName || ''}
                      onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500 block mb-1">Contact email</label>
                    <input
                      value={form.contactEmail || ''}
                      onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <label
                      className={
                        'flex items-start gap-3 w-full px-3 py-2 rounded-xl border cursor-pointer ' +
                        (formSubsystemId
                          ? 'bg-zinc-950 border-zinc-700'
                          : 'bg-zinc-950/50 border-zinc-800 opacity-60 cursor-not-allowed')
                      }
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        disabled={!formSubsystemId}
                        checked={viChecked}
                        onChange={(e) => toggleVerticalIntegrator(e.target.checked)}
                      />
                      <span>
                        <span className="text-sm text-zinc-200 block">
                          Vertical Integrator candidate
                        </span>
                        <span className="text-[11px] text-zinc-600 block mt-0.5">
                          {formSubsystemId
                            ? `For ${formSubsystem?.name}`
                            : 'Select a subsystem below first'}
                        </span>
                      </span>
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] text-zinc-500 block mb-1">Notes</label>
                    <textarea
                      value={form.notes || ''}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm resize-y"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-3 pt-2 border-t border-zinc-800">
                    <div>
                      <label className="text-[11px] text-zinc-500 block mb-1">Subsystem</label>
                      <select
                        value={formSubsystemId}
                        onChange={(e) => selectSubsystem(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Select a subsystem…</option>
                        {subsystems.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-zinc-600 mt-1">
                        Saved on this supplier. Check components below if they supply parts in
                        this branch.
                      </p>
                    </div>

                    {formSubsystemId && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] text-zinc-500 block mb-2">
                            Components in {formSubsystem?.name}
                          </label>
                          <div className="max-h-52 overflow-y-auto bg-zinc-950 border border-zinc-700 rounded-2xl divide-y divide-zinc-800">
                            {formComponents.length === 0 ? (
                              <p className="p-3 text-xs text-zinc-600">
                                No components under this subsystem yet. Add them in System
                                Registry.
                              </p>
                            ) : (
                              formComponents.map((e) => {
                                const checked = (form.entityIds || []).includes(e.id);
                                return (
                                  <label
                                    key={e.id}
                                    className="flex items-start gap-3 px-3 py-2 hover:bg-zinc-900/80 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleFormEntity(e.id)}
                                      className="mt-1"
                                    />
                                    <span className="text-sm text-zinc-200">{e.name}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {(form.entityIds?.length || 0) > 0 && (
                      <p className="text-[11px] text-zinc-500">
                        {form.entityIds!.length} linked item
                        {form.entityIds!.length === 1 ? '' : 's'} selected
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                selected && (
                  <div className="space-y-4 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700">
                        {selected.kind}
                      </span>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700">
                        {selected.engagement}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full ${RISK_STYLE[selected.risk]}`}
                      >
                        Risk: {selected.risk}
                      </span>
                    </div>
                    {(() => {
                      const subNames = (selected.subsystemIds || []).map(
                        (id) => byId.get(id)?.name || id
                      );
                      const linked = (selected.entityIds || [])
                        .map((id) => byId.get(id))
                        .filter(Boolean) as ResourceEntity[];
                      const viLinked = linked.filter((e) => isIntegratorNode(e));
                      const componentLinked = linked.filter((e) => !isIntegratorNode(e));
                      return (
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 space-y-3">
                          <div>
                            <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                              Subsystem
                            </div>
                            <div className="text-zinc-100 mt-0.5">
                              {subNames.length > 0 ? subNames.join(', ') : 'None selected'}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                              Components
                            </div>
                            {componentLinked.length === 0 ? (
                              <div className="text-zinc-500 mt-0.5">None linked</div>
                            ) : (
                              <ul className="mt-1 space-y-0.5 text-zinc-200">
                                {componentLinked.map((e) => (
                                  <li key={e.id}>• {e.name}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {viLinked.length > 0 || selected.kind === 'Integrator' ? (
                            <div className="text-xs text-blue-300">
                              Vertical Integrator candidate
                              {subNames.length > 0 ? ` · ${subNames.join(', ')}` : ''}
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-zinc-400">
                      {selected.location && (
                        <div>
                          <div className="text-[11px] text-zinc-600">Location</div>
                          {selected.location}
                        </div>
                      )}
                      {selected.website && (
                        <div>
                          <div className="text-[11px] text-zinc-600">Website</div>
                          <a
                            href={selected.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 hover:underline break-all"
                          >
                            {selected.website}
                          </a>
                        </div>
                      )}
                      {selected.contactName && (
                        <div>
                          <div className="text-[11px] text-zinc-600">Contact</div>
                          {selected.contactName}
                          {selected.contactEmail ? ` · ${selected.contactEmail}` : ''}
                        </div>
                      )}
                    </div>
                    {selected.notes && (
                      <p className="text-zinc-300 whitespace-pre-wrap">{selected.notes}</p>
                    )}
                  </div>
                )
              )}

              {selected && !editing && (
                <div className="pt-4 border-t border-zinc-800 space-y-3">
                  <h3 className="text-sm font-medium text-blue-400 flex items-center gap-2">
                    <Link2 size={14} /> Linked Registry parts
                  </h3>

                  {selected.entityIds.length === 0 ? (
                    <p className="text-xs text-zinc-600">
                      No parts linked. Use Edit → Subsystem → components, or the Vertical
                      Integrator button.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {selected.entityIds.map((eid) => {
                        const ent = byId.get(eid);
                        const parent = ent?.parentId ? byId.get(ent.parentId) : undefined;
                        const sourcing = getEntitySourcing(eid);
                        return (
                          <li
                            key={eid}
                            className="bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-white truncate">
                                  {ent?.name || eid}
                                </span>
                                {ent && (
                                  <Link
                                    to={`/system-registry?id=${encodeURIComponent(eid)}`}
                                    className="text-zinc-600 hover:text-blue-400"
                                  >
                                    <ExternalLink size={12} />
                                  </Link>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-600 mt-0.5">
                                {ent?.type || 'Unknown'}
                                {parent ? ` · ${parent.name}` : ''} · Make/Buy: {sourcing.makeBuy}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={sourcing.makeBuy}
                                onChange={(e) =>
                                  setEntitySourcing(eid, {
                                    makeBuy: e.target.value as MakeBuy,
                                    preferredSupplierId: selected.id,
                                  })
                                }
                                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs"
                              >
                                {MAKE_BUY_OPTIONS.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => unlinkSupplierFromEntity(selected.id, eid)}
                                className="text-xs text-zinc-500 hover:text-red-300"
                              >
                                Unlink
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <select
                      value={linkEntityId}
                      onChange={(e) => setLinkEntityId(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="">Link another Registry part…</option>
                      {partOptions.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({e.type})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleLink}
                      disabled={!linkEntityId}
                      className="px-4 py-2 rounded-xl text-sm bg-zinc-800 border border-zinc-600 text-zinc-200 disabled:opacity-40"
                    >
                      Link part
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Suppliers;
