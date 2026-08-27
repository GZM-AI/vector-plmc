/**
 * Change Control v1 — ECR/ECO workflow
 * Cloud-backed via changeStore (Amplify apiKey).
 * Route: /changes (already wired in App + Sidebar).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GitBranch,
  Plus,
  Search,
  Trash2,
  Check,
  X,
  MessageSquare,
  Box,
  ChevronRight,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import type { ResourceEntity } from '../types/plm';
import {
  getChangeRequests,
  getChangeRequestById,
  createChangeRequest,
  updateChangeRequest,
  setAffectedEntities,
  submitChangeRequest,
  startReviewChangeRequest,
  approveChangeRequest,
  rejectChangeRequest,
  implementChangeRequest,
  closeChangeRequest,
  addAuditComment,
  deleteChangeRequest,
  transitionChangeRequest,
  subscribeChangeStore,
  isChangeCloudHydrated,
  CHANGE_TRANSITIONS,
  type ChangeRequest,
  type ChangeRequestStatus,
  type ChangeImpact,
} from '../lib/changeStore';

function useEntityIndex(): {
  byId: Map<string, ResourceEntity>;
  list: ResourceEntity[];
  subsystems: ResourceEntity[];
} {
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
  const subsystems = useMemo(
    () => list.filter((e) => e.type === 'Subsystem').sort((a, b) => a.name.localeCompare(b.name)),
    [list]
  );
  return { byId, list, subsystems };
}

const STATUS_STYLE: Record<ChangeRequestStatus, string> = {
  Draft: 'bg-zinc-700 text-zinc-300',
  Submitted: 'bg-sky-900/60 text-sky-300',
  'In Review': 'bg-blue-900/60 text-blue-300',
  Approved: 'bg-emerald-900/60 text-emerald-300',
  Rejected: 'bg-red-900/60 text-red-300',
  Implemented: 'bg-violet-900/60 text-violet-300',
  Closed: 'bg-zinc-800 text-zinc-500',
};

const IMPACT_STYLE: Record<ChangeImpact, string> = {
  low: 'bg-emerald-950/50 text-emerald-300',
  medium: 'bg-amber-950/50 text-amber-300',
  high: 'bg-red-950/50 text-red-300',
};

const emptyForm = () => ({
  title: '',
  summary: '',
  impact: 'medium' as ChangeImpact,
  affectedEntityIds: [] as string[],
});

const ChangeControl: React.FC = () => {
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChangeRequestStatus | 'All'>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [comment, setComment] = useState('');
  const [linkEntityId, setLinkEntityId] = useState('');
  const [subsystemFilter, setSubsystemFilter] = useState('');
  const { byId, list: entities, subsystems } = useEntityIndex();
  const [cloudHint, setCloudHint] = useState(false);

  useEffect(() => subscribeChangeStore(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    setCloudHint(isChangeCloudHydrated());
  }, [tick]);

  const requests = useMemo(() => getChangeRequests(), [tick]);
  const selected = selectedId ? getChangeRequestById(selectedId) : null;

  const filtered = useMemo(() => {
    let rows = requests;
    if (statusFilter !== 'All') {
      rows = rows.filter((r) => r.changeStatus === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          (r.requestedBy || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [requests, search, statusFilter]);

  const partOptions = useMemo(() => {
    let opts = entities.filter((e) => e.type !== 'System');
    if (subsystemFilter) {
      opts = opts.filter(
        (e) =>
          e.id === subsystemFilter ||
          e.parentId === subsystemFilter ||
          // include grandchildren under that subsystem
          (e.parentId && byId.get(e.parentId)?.parentId === subsystemFilter)
      );
    }
    return opts.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [entities, subsystemFilter, byId]);

  const startCreate = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setEditing(true);
    setComment('');
  };

  const startEdit = (cr: ChangeRequest) => {
    if (cr.changeStatus !== 'Draft') return;
    setSelectedId(cr.id);
    setForm({
      title: cr.title,
      summary: cr.summary,
      impact: cr.impact || 'medium',
      affectedEntityIds: [...cr.affectedEntityIds],
    });
    setEditing(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    if (selectedId) {
      const updated = updateChangeRequest(selectedId, {
        title: form.title,
        summary: form.summary,
        impact: form.impact,
        affectedEntityIds: form.affectedEntityIds,
      });
      if (updated) {
        setForm({
          title: updated.title,
          summary: updated.summary,
          impact: updated.impact || 'medium',
          affectedEntityIds: [...updated.affectedEntityIds],
        });
      }
    } else {
      const created = createChangeRequest({
        title: form.title,
        summary: form.summary,
        impact: form.impact,
        affectedEntityIds: form.affectedEntityIds,
      });
      setSelectedId(created.id);
      setForm({
        title: created.title,
        summary: created.summary,
        impact: created.impact || 'medium',
        affectedEntityIds: [...created.affectedEntityIds],
      });
    }
    setEditing(false);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    if (!confirm('Delete this Draft change request?')) return;
    if (deleteChangeRequest(selectedId)) {
      setSelectedId(null);
      setEditing(false);
      setForm(emptyForm());
    }
  };

  const handleAddAffected = () => {
    if (!linkEntityId) return;
    if (editing) {
      if (form.affectedEntityIds.includes(linkEntityId)) {
        setLinkEntityId('');
        return;
      }
      setForm((f) => ({
        ...f,
        affectedEntityIds: [...f.affectedEntityIds, linkEntityId],
      }));
    } else if (selectedId) {
      const cr = getChangeRequestById(selectedId);
      if (!cr) return;
      if (cr.affectedEntityIds.includes(linkEntityId)) {
        setLinkEntityId('');
        return;
      }
      setAffectedEntities(selectedId, [...cr.affectedEntityIds, linkEntityId]);
    }
    setLinkEntityId('');
  };

  const handleRemoveAffected = (entityId: string) => {
    if (editing) {
      setForm((f) => ({
        ...f,
        affectedEntityIds: f.affectedEntityIds.filter((id) => id !== entityId),
      }));
    } else if (selectedId) {
      const cr = getChangeRequestById(selectedId);
      if (!cr) return;
      setAffectedEntities(
        selectedId,
        cr.affectedEntityIds.filter((id) => id !== entityId)
      );
    }
  };

  const runTransition = (
    fn: (id: string, by?: string, comment?: string) => ChangeRequest | null
  ) => {
    if (!selectedId) return;
    fn(selectedId, 'Zedekiah', comment.trim() || undefined);
    setComment('');
  };

  const handleAddComment = () => {
    if (!selectedId || !comment.trim()) return;
    addAuditComment(selectedId, comment.trim());
    setComment('');
  };

  const entityLabel = (id: string) => {
    const e = byId.get(id);
    if (!e) return id;
    return `${e.name} (${e.type})`;
  };

  const nextActions = selected
    ? CHANGE_TRANSITIONS[selected.changeStatus] || []
    : [];

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen text-white">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold flex items-center gap-3">
            <GitBranch className="text-blue-400" /> Change Control
          </h1>
          <p className="text-zinc-400 mt-1">
            Formal change requests for TAR™ · {requests.length} request
            {requests.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/system-registry"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-700"
          >
            <Box size={14} /> Registry
          </Link>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium"
          >
            <Plus size={16} /> New change request
          </button>
        </div>
      </div>

      {/* Hybrid gating note */}
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-400">
        <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
        <span>
          Draft items can still be edited in System Registry. Use a change request here when a
          Released item, or any change that should be reviewed, needs a recorded decision.
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* List */}
        <div className="xl:col-span-5 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search change requests…"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as ChangeRequestStatus | 'All')
              }
              className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-300"
            >
              <option value="All">All status</option>
              {(
                [
                  'Draft',
                  'Submitted',
                  'In Review',
                  'Approved',
                  'Rejected',
                  'Implemented',
                  'Closed',
                ] as ChangeRequestStatus[]
              ).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl divide-y divide-zinc-800 max-h-[70vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-6 text-sm text-zinc-600">
                No change requests yet. Open a CR for Released or multi-item changes.
              </p>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(r.id);
                    setForm({
                      title: r.title,
                      summary: r.summary,
                      impact: r.impact || 'medium',
                      affectedEntityIds: [...r.affectedEntityIds],
                    });
                    setEditing(false);
                    setComment('');
                  }}
                  className={
                    'w-full text-left px-4 py-3 hover:bg-zinc-800/80 transition ' +
                    (selectedId === r.id ? 'bg-zinc-800/90' : '')
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-white truncate">{r.title}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {r.id} · {r.requestedBy || '—'}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[r.changeStatus]}`}
                    >
                      {r.changeStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-600">
                    {r.impact && (
                      <span className={`px-1.5 py-0.5 rounded ${IMPACT_STYLE[r.impact]}`}>
                        {r.impact}
                      </span>
                    )}
                    <span>
                      {r.affectedEntityIds.length} affected
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(r.lastModified).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="xl:col-span-7">
          {!selected && !editing ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-12 text-center text-zinc-500">
              <GitBranch className="mx-auto mb-3 text-zinc-600" size={36} />
              Select a change request or create a new one.
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">
                    {editing
                      ? selectedId
                        ? 'Edit change request'
                        : 'New change request'
                      : selected?.title}
                  </h2>
                  {selected && !editing && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full ${STATUS_STYLE[selected.changeStatus]}`}
                      >
                        {selected.changeStatus}
                      </span>
                      {selected.impact && (
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full ${IMPACT_STYLE[selected.impact]}`}
                        >
                          Impact: {selected.impact}
                        </span>
                      )}
                      <span className="text-xs text-zinc-500 px-2 py-1">{selected.id}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!editing && selected?.changeStatus === 'Draft' && (
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
                        disabled={!form.title.trim()}
                        className="px-3 py-1.5 rounded-xl text-xs bg-emerald-600 text-white disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(false);
                          if (selected) {
                            setForm({
                              title: selected.title,
                              summary: selected.summary,
                              impact: selected.impact || 'medium',
                              affectedEntityIds: [...selected.affectedEntityIds],
                            });
                          } else {
                            setForm(emptyForm());
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs bg-zinc-800 text-zinc-300"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {selectedId && selected?.changeStatus === 'Draft' && (
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
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-zinc-500 block mb-1">Title</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Short change title"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500 block mb-1">Summary</label>
                    <textarea
                      value={form.summary}
                      onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                      rows={4}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm resize-y"
                      placeholder="What is changing and why?"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500 block mb-1">Impact</label>
                    <select
                      value={form.impact}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          impact: e.target.value as ChangeImpact,
                        }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </select>
                  </div>
                </div>
              ) : (
                selected && (
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="text-[11px] text-zinc-600 mb-1">Summary</div>
                      <p className="text-zinc-300 whitespace-pre-wrap">
                        {selected.summary || '—'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-zinc-400">
                      <div>
                        <div className="text-[11px] text-zinc-600">Requested by</div>
                        {selected.requestedBy || '—'}
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-600">Last modified</div>
                        {new Date(selected.lastModified).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Affected items */}
              <div className="border-t border-zinc-800 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-zinc-300">Affected items</h3>
                  <span className="text-[11px] text-zinc-600">
                    Subsystem → elements (same as Suppliers)
                  </span>
                </div>
                {(editing ||
                  selected?.changeStatus === 'Draft' ||
                  selected?.changeStatus === 'Submitted') && (
                  <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <select
                      value={subsystemFilter}
                      onChange={(e) => setSubsystemFilter(e.target.value)}
                      className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-300"
                    >
                      <option value="">All subsystems</option>
                      {subsystems.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={linkEntityId}
                      onChange={(e) => setLinkEntityId(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-300"
                    >
                      <option value="">Select entity…</option>
                      {partOptions.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} · {e.type}
                          {e.revision ? ` · rev ${e.revision}` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddAffected}
                      disabled={!linkEntityId}
                      className="px-3 py-2 rounded-xl text-xs bg-zinc-800 border border-zinc-600 text-zinc-200 disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                )}
                <div className="space-y-1.5">
                  {(editing ? form.affectedEntityIds : selected?.affectedEntityIds || [])
                    .length === 0 ? (
                    <p className="text-xs text-zinc-600">No affected items linked yet.</p>
                  ) : (
                    (editing ? form.affectedEntityIds : selected!.affectedEntityIds).map(
                      (eid) => (
                        <div
                          key={eid}
                          className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="text-zinc-200 truncate">{entityLabel(eid)}</div>
                            <div className="text-[10px] text-zinc-600">{eid}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Link
                              to="/system-registry"
                              className="text-[11px] text-blue-400 hover:underline inline-flex items-center gap-0.5"
                            >
                              Registry <ChevronRight size={10} />
                            </Link>
                            {(editing ||
                              selected?.changeStatus === 'Draft' ||
                              selected?.changeStatus === 'Submitted') && (
                              <button
                                type="button"
                                onClick={() => handleRemoveAffected(eid)}
                                className="text-zinc-500 hover:text-red-400"
                                title="Remove"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>

              {/* Workflow actions */}
              {selected && !editing && (
                <div className="border-t border-zinc-800 pt-4 space-y-3">
                  <h3 className="text-sm font-medium text-zinc-300">Workflow</h3>
                  <div className="flex flex-wrap gap-2">
                    {nextActions.includes('Submitted') && (
                      <button
                        type="button"
                        onClick={() => runTransition(submitChangeRequest)}
                        className="px-3 py-1.5 rounded-xl text-xs bg-sky-700 hover:bg-sky-600 text-white"
                      >
                        Submit
                      </button>
                    )}
                    {nextActions.includes('In Review') && (
                      <button
                        type="button"
                        onClick={() => runTransition(startReviewChangeRequest)}
                        className="px-3 py-1.5 rounded-xl text-xs bg-blue-700 hover:bg-blue-600 text-white"
                      >
                        Start review
                      </button>
                    )}
                    {nextActions.includes('Approved') && (
                      <button
                        type="button"
                        onClick={() => runTransition(approveChangeRequest)}
                        className="px-3 py-1.5 rounded-xl text-xs bg-emerald-700 hover:bg-emerald-600 text-white inline-flex items-center gap-1"
                      >
                        <Check size={12} /> Approve
                      </button>
                    )}
                    {nextActions.includes('Rejected') && (
                      <button
                        type="button"
                        onClick={() => runTransition(rejectChangeRequest)}
                        className="px-3 py-1.5 rounded-xl text-xs bg-red-800 hover:bg-red-700 text-white inline-flex items-center gap-1"
                      >
                        <X size={12} /> Reject
                      </button>
                    )}
                    {nextActions.includes('Implemented') && (
                      <button
                        type="button"
                        onClick={() => runTransition(implementChangeRequest)}
                        className="px-3 py-1.5 rounded-xl text-xs bg-violet-700 hover:bg-violet-600 text-white"
                      >
                        Mark implemented
                      </button>
                    )}
                    {nextActions.includes('Closed') && (
                      <button
                        type="button"
                        onClick={() => runTransition(closeChangeRequest)}
                        className="px-3 py-1.5 rounded-xl text-xs bg-zinc-700 hover:bg-zinc-600 text-white"
                      >
                        Close
                      </button>
                    )}
                    {nextActions.includes('Draft') && (
                      <button
                        type="button"
                        onClick={() =>
                          transitionChangeRequest(selected.id, 'Draft', {
                            comment: comment.trim() || undefined,
                          })
                        }
                        className="px-3 py-1.5 rounded-xl text-xs bg-zinc-800 border border-zinc-600 text-zinc-300"
                      >
                        Return to Draft
                      </button>
                    )}
                    {nextActions.length === 0 && (
                      <span className="text-xs text-zinc-600">No further transitions.</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Optional comment for transition or note…"
                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={!comment.trim()}
                      className="px-3 py-2 rounded-xl text-xs bg-zinc-800 border border-zinc-600 text-zinc-200 disabled:opacity-40 inline-flex items-center gap-1"
                    >
                      <MessageSquare size={12} /> Comment
                    </button>
                  </div>
                </div>
              )}

              {/* Audit trail */}
              {selected && !editing && (
                <div className="border-t border-zinc-800 pt-4">
                  <h3 className="text-sm font-medium text-zinc-300 mb-3">Audit trail</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {[...(selected.auditTrail || [])].reverse().map((ev) => (
                      <div
                        key={ev.id}
                        className="flex gap-3 text-xs rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2"
                      >
                        <div className="text-zinc-600 shrink-0 w-36">
                          {new Date(ev.at).toLocaleString()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-zinc-300">
                            <span className="font-medium">{ev.action}</span>
                            {ev.by ? (
                              <span className="text-zinc-500"> · {ev.by}</span>
                            ) : null}
                          </div>
                          {ev.detail && (
                            <div className="text-zinc-500 mt-0.5">{ev.detail}</div>
                          )}
                        </div>
                      </div>
                    ))}
                    {(selected.auditTrail || []).length === 0 && (
                      <p className="text-xs text-zinc-600">No events yet.</p>
                    )}
                  </div>
                  {selected.linkedRevisionEventIds &&
                    selected.linkedRevisionEventIds.length > 0 && (
                      <div className="mt-3 text-[11px] text-zinc-500">
                        Linked revision events:{' '}
                        {selected.linkedRevisionEventIds.join(', ')}
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangeControl;
