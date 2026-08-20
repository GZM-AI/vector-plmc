/**
 * Suppliers — vendors, manufacturers, integrators
 * Link Registry parts on New/Edit form and on detail view.
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

function useEntityIndex(): { byId: Map<string, ResourceEntity>; list: ResourceEntity[] } {
  const [list, setList] = useState<ResourceEntity[]>([]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const mod = await import('../lib/configStore');
        const load = () => setList(mod.getMergedAllEntities());
        load();
        unsub = mod.subscribeConfigStore(load);
      } catch {
        try {
          const seed = await import('../data/tarSeedData');
          setList(seed.ALL_ENTITIES || []);
        } catch {
          setList([]);
        }
      }
    })();
    return () => unsub?.();
  }, []);

  const byId = useMemo(() => new Map(list.map((e) => [e.id, e])), [list]);
  return { byId, list };
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
});

const Suppliers: React.FC = () => {
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [linkEntityId, setLinkEntityId] = useState('');
  const { byId, list: entities } = useEntityIndex();

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

  const partOptions = useMemo(() => {
    return entities
      .filter((e) => e.type !== 'System' && e.type !== 'Subsystem')
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entities]);

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

  const startCreate = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setEditing(true);
  };

  const startEdit = (s: Supplier) => {
    setSelectedId(s.id);
    setForm({ ...s, entityIds: [...(s.entityIds || [])] });
    setEditing(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const saved = upsertSupplier({
      ...form,
      id: selectedId || undefined,
      name: form.name,
      entityIds: form.entityIds || [],
    });
    setSelectedId(saved.id);
    setForm({ ...saved, entityIds: [...(saved.entityIds || [])] });
    setEditing(false);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    if (!confirm('Remove this supplier?')) return;
    deleteSupplier(selectedId);
    setSelectedId(null);
    setEditing(false);
    setForm(emptyForm());
  };

  const handleLink = () => {
    if (!selectedId || !linkEntityId) return;
    linkSupplierToEntity(selectedId, linkEntityId);
    setLinkEntityId('');
  };

  const partsChecklist = (
    <div className="sm:col-span-2">
      <label className="text-[11px] text-zinc-500 block mb-2">
        Registry parts this supplier addresses
      </label>
      <p className="text-[11px] text-zinc-600 mb-2">
        Select components / software / interfaces. Parent subsystem is shown under each name.
      </p>
      <div className="max-h-52 overflow-y-auto bg-zinc-950 border border-zinc-700 rounded-2xl divide-y divide-zinc-800">
        {partOptions.length === 0 ? (
          <p className="p-3 text-xs text-zinc-600">No parts in Registry yet.</p>
        ) : (
          partOptions.map((e) => {
            const parent = e.parentId ? byId.get(e.parentId) : undefined;
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
                <span className="min-w-0">
                  <span className="text-sm text-zinc-200 block truncate">{e.name}</span>
                  <span className="text-[10px] text-zinc-600">
                    {e.type}
                    {parent ? ` · ${parent.name}` : ''}
                  </span>
                </span>
              </label>
            );
          })
        )}
      </div>
      {(form.entityIds?.length || 0) > 0 && (
        <p className="text-[11px] text-zinc-500 mt-2">
          {form.entityIds!.length} part{form.entityIds!.length === 1 ? '' : 's'} selected
        </p>
      )}
    </div>
  );

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
                    setForm({ ...s, entityIds: [...(s.entityIds || [])] });
                    setEditing(false);
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
                          if (selected) setForm({ ...selected, entityIds: [...selected.entityIds] });
                          else setForm(emptyForm());
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
                  <div className="sm:col-span-2">
                    <label className="text-[11px] text-zinc-500 block mb-1">Notes</label>
                    <textarea
                      value={form.notes || ''}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm resize-y"
                    />
                  </div>
                  {partsChecklist}
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
                      No parts linked. Use Edit to select parts, or link one below.
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

      <p className="text-xs text-zinc-600 mt-6">
        Stored on this browser until the product store moves to Amplify. Parts checklist on New/Edit
        saves entity links with the supplier.
      </p>
    </div>
  );
};

export default Suppliers;