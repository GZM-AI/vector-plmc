/**
 * System Registry — TAR™ product structure
 * Overview | Tree (type filter) | Deep-link ?id=
 * Phase 0: revision + status + attachments
 * Phase 1: revision history timeline + bump revision (configStore)
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Box,
  ChevronRight,
  ChevronDown,
  Cpu,
  Layers,
  GitBranch,
  Search,
  Filter,
  Package,
  Zap,
  Eye,
  Crosshair,
  LayoutGrid,
  ListTree,
  Paperclip,
  FileText,
  Plus,
  History,
  ArrowUpCircle,
  Bookmark,
  Factory,
  ChevronUp,
  Trash2,
  Download,
} from 'lucide-react';
import { moveChild, sortChildren, subscribeChildOrderStore } from '../lib/childOrderStore';
import {
  getSuppliersForEntity,
  getSuppliers,
  subscribeSuppliersStore,
} from '../lib/suppliersStore';
import {
  ResourceEntity,
  EntityType,
  EntityStatus,
  SUBSYSTEM_COLORS,
} from '../data/tarSeedData';
import {
  documentsForEntity,
  subscribeDocumentsStore,
  attachDocumentToEntity,
  getDocumentDownloadUrl,
  unlinkDocumentFromEntity,
  hydrateDocumentsStoreFromCloud,
  getDocumentsError,
} from '../lib/documentsStore';
import type { Document, ReleaseStatus, RevisionRecord, ElementKind } from '../types/plm';
import { ELEMENT_KIND_LABEL } from '../types/plm';
import {
  applyOverlay,
  bumpEntityRevision,
  getHistoryForEntity,
  subscribeConfigStore,
  updateEntityFields,
  addChildEntity,
  removeChildEntity,
  getRegistryTree,
  getMergedAllEntities,
  type AddableChildType,
} from '../lib/configStore';
import { nextRevision } from '../lib/revisionUtils';

type ViewMode = 'overview' | 'tree';

const TYPE_ICON: Record<string, React.ReactNode> = {
  System: <Crosshair size={16} className="text-blue-400" />,
  Subsystem: <Layers size={16} className="text-violet-400" />,
  Component: <Package size={16} className="text-zinc-300" />,
  Element: <Cpu size={16} className="text-emerald-400" />,
  SoftwareItem: <Cpu size={16} className="text-emerald-400" />,
  Interface: <GitBranch size={16} className="text-sky-400" />,
  Capability: <Zap size={16} className="text-amber-400" />,
};

const TYPE_LABEL: Record<string, string> = {
  System: 'System',
  Subsystem: 'Subsystem',
  Component: 'Component',
  Element: 'Element',
  SoftwareItem: 'Software',
  Interface: 'Interface',
  Capability: 'Integrator',
};

function typeBadge(entity: { type: string; kind?: string }): string {
  if (entity.type === 'Element' && entity.kind) {
    return `Element · ${ELEMENT_KIND_LABEL[entity.kind as ElementKind] || entity.kind}`;
  }
  return TYPE_LABEL[entity.type] || entity.type;
}

const STATUS_STYLE: Record<EntityStatus, string> = {
  Draft: 'bg-zinc-700 text-zinc-300',
  'In Review': 'bg-blue-900/60 text-blue-300',
  Released: 'bg-emerald-900/60 text-emerald-300',
  Obsolete: 'bg-red-900/60 text-red-300',
};

const DOC_KIND_LABEL: Record<string, string> = {
  spec: 'Spec',
  drawing: 'Drawing',
  cad: 'CAD',
  'test-report': 'Test report',
  photo: 'Photo',
  analysis: 'Analysis',
  procedure: 'Procedure',
  other: 'Document',
};

const SUBSYSTEM_ACCENT: Record<string, string> = {
  amber: 'border-amber-500/40 bg-amber-950/20',
  orange: 'border-orange-500/40 bg-orange-950/20',
  lime: 'border-lime-500/40 bg-lime-950/20',
  emerald: 'border-emerald-500/40 bg-emerald-950/20',
  sky: 'border-sky-500/40 bg-sky-950/20',
  violet: 'border-violet-500/40 bg-violet-950/20',
  red: 'border-red-500/40 bg-red-950/20',
  pink: 'border-pink-500/40 bg-pink-950/20',
  teal: 'border-teal-500/40 bg-teal-950/20',
  yellow: 'border-yellow-500/40 bg-yellow-950/20',
  cyan: 'border-cyan-500/40 bg-cyan-950/20',
  rose: 'border-rose-500/40 bg-rose-950/20',
};

function nodeMatchesTypeFilter(node: ResourceEntity, typeFilter: EntityType | 'all'): boolean {
  if (typeFilter === 'all') return true;
  if (node.type === typeFilter) return true;
  return (node.children || []).some((c) => nodeMatchesTypeFilter(c, typeFilter));
}

interface TreeNodeProps {
  node: ResourceEntity;
  depth: number;
  selectedId: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: ResourceEntity) => void;
  search: string;
  typeFilter: EntityType | 'all';
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  depth,
  selectedId,
  expanded,
  onToggle,
  onSelect,
  search,
  typeFilter,
}) => {
  const display = applyOverlay(node);
  const hasChildren = !!(node.children && node.children.length > 0);
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;

  const matchesSearch =
    !search ||
    display.name.toLowerCase().includes(search.toLowerCase()) ||
    (display.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (display.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));

  const matchesType = nodeMatchesTypeFilter(node, typeFilter);

  if (!matchesType) return null;
  if (search && !matchesSearch && !hasChildren) return null;

  const isTypeHit = typeFilter === 'all' || node.type === typeFilter;
  const visibleChildren = sortChildren(
    node.id,
    (node.children || []).filter((c) => nodeMatchesTypeFilter(c, typeFilter))
  );

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-xl cursor-pointer transition-all group ${
          isSelected
            ? 'bg-blue-600/30 border border-blue-500/50'
            : 'hover:bg-zinc-800/80 border border-transparent'
        } ${!isTypeHit ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelect(node)}
      >
        {visibleChildren.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="text-zinc-500 hover:text-zinc-300 shrink-0"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className="shrink-0">{TYPE_ICON[node.type]}</span>
        <span
          className={`text-sm truncate flex-1 ${
            isSelected ? 'text-white font-medium' : 'text-zinc-300 group-hover:text-white'
          }`}
        >
          {display.name}
        </span>
        <span className="text-[10px] text-zinc-600 shrink-0 hidden sm:inline">
          Rev {display.revision}
        </span>
        {node.type === 'Subsystem' && (
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 shrink-0">
            {node.children?.length || 0}
          </span>
        )}
      </div>
      {visibleChildren.length > 0 && isExpanded && (
        <div>
          {visibleChildren.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              search={search}
              typeFilter={typeFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/** Read-only sourcing line: suppliers on components; integrator candidate on subsystems. */
const RegistrySupplierLine: React.FC<{ entity: ResourceEntity }> = ({ entity }) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    try {
      return subscribeSuppliersStore(() => setTick((t) => t + 1));
    } catch {
      return undefined;
    }
  }, []);

  let partSuppliers: { id: string; name: string }[] = [];
  let integratorNames: string[] = [];
  try {
    partSuppliers = getSuppliersForEntity(entity.id).map((s) => ({ id: s.id, name: s.name }));
    if (entity.type === 'Subsystem') {
      integratorNames = getSuppliers()
        .filter(
          (s) =>
            (s.subsystemIds || []).includes(entity.id) &&
            (s.kind === 'Integrator' ||
              s.name.toLowerCase().includes('integrator'))
        )
        .map((s) => s.name);
    }
  } catch {
    return null;
  }

  if (entity.type === 'Subsystem') {
    if (integratorNames.length === 0) return null;
    return (
      <div className="mt-2 text-xs text-zinc-400 flex items-center gap-1.5">
        <Factory size={12} className="text-zinc-500" />
        Integrator candidate: {integratorNames.join(', ')}
      </div>
    );
  }

  if (entity.type !== 'Component' && entity.type !== 'Element') return null;

  return (
    <div className="mt-2 text-xs text-zinc-400 flex items-center gap-1.5">
      <Factory size={12} className="text-zinc-500" />
      {partSuppliers.length > 0 ? (
        <span>
          Supplier: {partSuppliers.map((s) => s.name).join(', ')}
        </span>
      ) : (
        <span className="text-zinc-600">Supplier: Unassigned</span>
      )}
    </div>
  );
};

interface ComponentCardProps {
  entity: ResourceEntity;
  onSelectRelated?: (id: string) => void;
  historyTick?: number;
}

function findNodeById(node: ResourceEntity, id: string): ResourceEntity | null {
  if (node.id === id) return node;
  for (const c of node.children || []) {
    const found = findNodeById(c, id);
    if (found) return found;
  }
  return null;
}

const ComponentCard: React.FC<ComponentCardProps> = ({
  entity: rawEntity,
  onSelectRelated,
  historyTick = 0,
}) => {
  const entity = applyOverlay(rawEntity);
  const siblingGroup = useMemo(() => {
    if (!entity.parentId) return [] as ResourceEntity[];
    const tree = getRegistryTree();
    const parent = findNodeById(tree, entity.parentId);
    if (!parent) return [] as ResourceEntity[];
    return sortChildren(parent.id, parent.children || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id, entity.parentId, historyTick]);
  const siblingIndex = siblingGroup.findIndex((s) => s.id === entity.id);
  const systemChildren = useMemo(() => {
    if (entity.type !== 'System') return [] as ResourceEntity[];
    return sortChildren(entity.id, entity.children || []).filter((c) => c.type === 'Subsystem');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id, entity.type, entity.children, historyTick]);
  const accent =
    entity.type === 'Subsystem'
      ? SUBSYSTEM_ACCENT[SUBSYSTEM_COLORS[entity.id] || 'sky'] || 'border-zinc-700'
      : 'border-zinc-700';

  const [docsTick, setDocsTick] = useState(0);
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachErr, setAttachErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const linkedDocs: Document[] = useMemo(
    () => documentsForEntity(entity.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entity.id, docsTick]
  );

  useEffect(() => {
    const unsub = subscribeDocumentsStore(() => setDocsTick((t) => t + 1));
    void hydrateDocumentsStoreFromCloud();
    return unsub;
  }, []);

  const history: RevisionRecord[] = useMemo(
    () => getHistoryForEntity(entity.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entity.id, entity.revision, historyTick]
  );

  const [showBump, setShowBump] = useState(false);
  const [bumpComment, setBumpComment] = useState('');
  const [bumpStatus, setBumpStatus] = useState<ReleaseStatus>('Draft');
  const [compareA, setCompareA] = useState<string>('');
  const [compareB, setCompareB] = useState<string>('');

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(entity.name);
  const [draftDescription, setDraftDescription] = useState(entity.description || '');
  const [draftNotes, setDraftNotes] = useState(
    (entity as ResourceEntity & { notes?: string }).notes || ''
  );
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState('');
  const [childType, setChildType] = useState<AddableChildType>(
    entity.type === 'Component' ? 'Element' : entity.type === 'System' ? 'Subsystem' : 'Component'
  );
  const [childKind, setChildKind] = useState<ElementKind>('hardware');
  const [childDescription, setChildDescription] = useState('');
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [draftType, setDraftType] = useState(entity.type);
  const [draftKind, setDraftKind] = useState<ElementKind>(
    ((entity as ResourceEntity).kind as ElementKind) || 'hardware'
  );

  const canRemoveSelf =
    entity.type === 'Component' ||
    entity.type === 'Element' ||
    entity.type === 'SoftwareItem' ||
    entity.type === 'Interface' ||
    entity.type === 'Capability';

  const canAddChild =
    entity.type === 'System' || entity.type === 'Subsystem' || entity.type === 'Component';
  const canEditType = entity.type === 'Component' || entity.type === 'Element';
  const addableTypes: AddableChildType[] =
    entity.type === 'System'
      ? ['Subsystem']
      : entity.type === 'Subsystem'
        ? ['Component', 'Element']
        : entity.type === 'Component'
          ? ['Element']
          : [];

  // Keep drafts in sync when selecting another entity or overlay updates
  useEffect(() => {
    setDraftName(entity.name);
    setDraftDescription(entity.description || '');
    setDraftNotes((entity as ResourceEntity & { notes?: string }).notes || '');
    setDraftType(entity.type);
    setDraftKind(((entity as ResourceEntity).kind as ElementKind) || 'hardware');
    setEditing(false);
    setSaveMsg(null);
    setShowAddChild(false);
    setChildName('');
    setChildDescription('');
    setChildType(
      entity.type === 'Component' ? 'Element' : entity.type === 'System' ? 'Subsystem' : 'Component'
    );
    setChildKind('hardware');
    setPendingRemoveId(null);
  }, [entity.id, entity.name, entity.description, entity.revision, entity.type]);

  const previewNext = nextRevision(entity.revision);

  const handleBump = () => {
    const result = bumpEntityRevision(entity.id, {
      comment: bumpComment.trim() || undefined,
      status: bumpStatus,
    });
    if (result) {
      setBumpComment('');
      setBumpStatus('Draft');
      setShowBump(false);
    }
  };

  const handleStartEdit = () => {
    setDraftName(entity.name);
    setDraftDescription(entity.description || '');
    setDraftNotes((entity as ResourceEntity & { notes?: string }).notes || '');
    setDraftType(entity.type);
    setDraftKind(((entity as ResourceEntity).kind as ElementKind) || 'hardware');
    setEditing(true);
    setSaveMsg(null);
  };

  const handleCancelEdit = () => {
    setDraftName(entity.name);
    setDraftDescription(entity.description || '');
    setDraftNotes((entity as ResourceEntity & { notes?: string }).notes || '');
    setEditing(false);
    setSaveMsg(null);
  };

  const handleSaveFields = () => {
    const updated = updateEntityFields(entity.id, {
      name: draftName.trim() || entity.name,
      description: draftDescription,
      notes: draftNotes,
      ...(canEditType
        ? {
            type: draftType as AddableChildType,
            kind: draftType === 'Element' ? draftKind : undefined,
          }
        : {}),
    });
    if (updated) {
      setEditing(false);
      setSaveMsg('Saved on this device. Cloud sync comes next (same pattern as zone map).');
    }
  };

  const handleAddChild = () => {
    const created = addChildEntity(entity.id, {
      name: childName,
      type: childType,
      description: childDescription,
      kind: childType === 'Element' ? childKind : undefined,
    });
    if (created) {
      setShowAddChild(false);
      setChildName('');
      setChildDescription('');
      setChildType(addableTypes[0] || 'Component');
      setChildKind('hardware');
      setSaveMsg(`Added “${created.name}” under ${entity.name}.`);
      onSelectRelated?.(created.id);
    } else {
      setSaveMsg(
        'Could not add that child. Under a subsystem use Component or Element; under a component use Element.'
      );
    }
  };

  const handleRemove = (id: string, parentId?: string) => {
    const removed = removeChildEntity(id);
    setPendingRemoveId(null);
    if (removed) {
      setSaveMsg(`Removed “${removed.name}”.`);
      if (id === entity.id) {
        const next = parentId || entity.parentId;
        if (next) onSelectRelated?.(next);
      }
    }
  };

  const compareRecords = useMemo(() => {
    if (!compareA || !compareB) return null;
    const a = history.find((r) => r.revision === compareA);
    const b = history.find((r) => r.revision === compareB);
    return { a, b };
  }, [history, compareA, compareB]);

  const revOptions = useMemo(() => {
    const set = new Set(history.map((h) => h.revision));
    set.add(entity.revision);
    return Array.from(set);
  }, [history, entity.revision]);

  return (
    <div className={`bg-zinc-900 border ${accent} rounded-3xl p-8 space-y-6`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-700 flex items-center justify-center shrink-0">
            {TYPE_ICON[entity.type]}
          </div>
          <div className="min-w-0">
            {editing ? (
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="w-full max-w-xl bg-zinc-950 border border-zinc-600 rounded-xl px-3 py-2 text-xl font-semibold text-white focus:outline-none focus:border-blue-500"
              />
            ) : (
              <h2 className="text-2xl font-semibold text-white">{entity.name}</h2>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                {typeBadge(entity)}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_STYLE[entity.status]}`}>
                {entity.status}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-950 border border-zinc-700 text-zinc-300">
                Rev {entity.revision}
              </span>
              {entity.classification && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-red-950/50 text-red-300 border border-red-900/50">
                  {entity.classification}
                </span>
              )}
            </div>
            <RegistrySupplierLine entity={entity} />
          </div>
        </div>
        <div className="text-xs text-zinc-500 text-right shrink-0 space-y-2">
          <div>ID: {entity.id}</div>
          {entity.modifiedBy && <div>By: {entity.modifiedBy}</div>}
          <div className="flex flex-col items-end gap-2">
            {!editing ? (
              <button
                type="button"
                onClick={handleStartEdit}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-zinc-800 border border-zinc-600 text-zinc-200 hover:border-zinc-400"
              >
                Edit details
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveFields}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-300"
                >
                  Cancel
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowBump((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-blue-600/20 border border-blue-700/50 text-blue-300 hover:bg-blue-600/30"
            >
              <ArrowUpCircle size={12} />
              Bump revision
            </button>
            {canRemoveSelf && pendingRemoveId !== entity.id && (
              <button
                type="button"
                onClick={() => setPendingRemoveId(entity.id)}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 hover:bg-red-900/50"
              >
                <Trash2 size={12} />
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {canRemoveSelf && pendingRemoveId === entity.id && (
        <div className="bg-red-950/30 border border-red-800/50 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-red-200">
            Remove <span className="font-medium text-white">{entity.name}</span> from this
            subsystem? It disappears from Registry and Architecture. Seed items can be restored
            only by clearing the removal list.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleRemove(entity.id, entity.parentId)}
              className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-medium hover:bg-red-500"
            >
              Confirm remove
            </button>
            <button
              type="button"
              onClick={() => setPendingRemoveId(null)}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {saveMsg && (
        <div className="text-xs text-emerald-300/90 bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-3 py-2">
          {saveMsg}
        </div>
      )}

      {editing && entity.type === 'Subsystem' && entity.parentId && siblingGroup.length > 1 && (
        <div className="bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500 mb-2">
            Display order among subsystems
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-zinc-200">
              Position {siblingIndex + 1} of {siblingGroup.length}
            </span>
            <button
              type="button"
              disabled={siblingIndex <= 0}
              onClick={() =>
                moveChild(
                  entity.parentId!,
                  siblingGroup.map((s) => s.id),
                  entity.id,
                  -1
                )
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs bg-zinc-800 border border-zinc-600 text-zinc-200 disabled:opacity-30"
            >
              <ChevronUp size={12} /> Move earlier
            </button>
            <button
              type="button"
              disabled={siblingIndex < 0 || siblingIndex >= siblingGroup.length - 1}
              onClick={() =>
                moveChild(
                  entity.parentId!,
                  siblingGroup.map((s) => s.id),
                  entity.id,
                  1
                )
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs bg-zinc-800 border border-zinc-600 text-zinc-200 disabled:opacity-30"
            >
              <ChevronDown size={12} /> Move later
            </button>
          </div>
        </div>
      )}

      {editing && entity.type === 'System' && systemChildren.length > 1 && (
        <div className="bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">
            Subsystem display order
          </div>
          {systemChildren.map((child, index) => (
            <div
              key={child.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() =>
                    moveChild(
                      entity.id,
                      systemChildren.map((s) => s.id),
                      child.id,
                      -1
                    )
                  }
                  className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-20"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  type="button"
                  disabled={index === systemChildren.length - 1}
                  onClick={() =>
                    moveChild(
                      entity.id,
                      systemChildren.map((s) => s.id),
                      child.id,
                      1
                    )
                  }
                  className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-20"
                >
                  <ChevronDown size={12} />
                </button>
              </div>
              <span className="text-[11px] text-zinc-600 w-5">{index + 1}</span>
              <span className="text-sm text-zinc-200 truncate">{applyOverlay(child).name}</span>
            </div>
          ))}
        </div>
      )}

      {showBump && (
        <div className="bg-zinc-950 border border-blue-900/40 rounded-2xl p-4 space-y-3">
          <div className="text-sm text-zinc-300">
            Current <span className="text-white font-medium">Rev {entity.revision}</span>
            <span className="text-zinc-500"> → </span>
            Next <span className="text-blue-300 font-medium">Rev {previewNext}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">New status</label>
              <select
                value={bumpStatus}
                onChange={(e) => setBumpStatus(e.target.value as ReleaseStatus)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="Draft">Draft</option>
                <option value="In Review">In Review</option>
                <option value="Released">Released</option>
                <option value="Obsolete">Obsolete</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">Comment (optional)</label>
              <input
                value={bumpComment}
                onChange={(e) => setBumpComment(e.target.value)}
                placeholder="What changed?"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleBump}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium"
            >
              Confirm bump to {previewNext}
            </button>
            <button
              type="button"
              onClick={() => setShowBump(false)}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-sm text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {editing && canEditType && (
        <div className="bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-zinc-500 block mb-1">Type</label>
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as typeof entity.type)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="Component">Component</option>
              <option value="Element">Element</option>
            </select>
          </div>
          {draftType === 'Element' && (
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">Element kind</label>
              <select
                value={draftKind}
                onChange={(e) => setDraftKind(e.target.value as ElementKind)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="hardware">Hardware</option>
                <option value="software">Software</option>
                <option value="interface">Interface</option>
                <option value="integrator">Integrator</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}
        </div>
      )}

      <div>
        <h4 className="text-sm font-medium text-blue-400 mb-2">Description</h4>
        {editing ? (
          <textarea
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            rows={5}
            placeholder="Describe this subsystem, component, or software item…"
            className="w-full bg-zinc-950 border border-zinc-600 rounded-2xl px-4 py-3 text-sm text-zinc-200 leading-relaxed focus:outline-none focus:border-blue-500 resize-y min-h-[120px]"
          />
        ) : entity.description ? (
          <p className="text-zinc-300 leading-relaxed text-[15px]">{entity.description}</p>
        ) : (
          <p className="text-xs text-zinc-600">No description yet. Click Edit details to add one.</p>
        )}
      </div>

      <div>
        <h4 className="text-sm font-medium text-blue-400 mb-2">Notes</h4>
        {editing ? (
          <textarea
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            rows={3}
            placeholder="Working notes, open questions, links to decisions…"
            className="w-full bg-zinc-950 border border-zinc-600 rounded-2xl px-4 py-3 text-sm text-zinc-200 leading-relaxed focus:outline-none focus:border-blue-500 resize-y"
          />
        ) : (entity as ResourceEntity & { notes?: string }).notes ? (
          <p className="text-zinc-400 leading-relaxed text-sm whitespace-pre-wrap">
            {(entity as ResourceEntity & { notes?: string }).notes}
          </p>
        ) : (
          <p className="text-xs text-zinc-600">No notes yet.</p>
        )}
      </div>

      {entity.tags && entity.tags.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-blue-400 mb-2">Tags</h4>
          <div className="flex flex-wrap gap-2">
            {entity.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-3 py-1 rounded-full bg-zinc-950 border border-zinc-700 text-zinc-400"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Phase 1 — Revision history */}
      <div>
        <h4 className="text-sm font-medium text-blue-400 mb-3 flex items-center gap-2">
          <History size={14} />
          Revision history ({history.length})
        </h4>
        {history.length === 0 ? (
          <p className="text-xs text-zinc-600 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl px-4 py-3">
            No history yet. Use <span className="text-zinc-400">Bump revision</span> to create the
            first recorded change.
          </p>
        ) : (
          <ul className="space-y-2 relative">
            {history.map((r, idx) => (
              <li
                key={r.id}
                className="flex gap-3 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3"
              >
                <div className="flex flex-col items-center pt-0.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      idx === 0 ? 'bg-blue-400' : 'bg-zinc-600'
                    }`}
                  />
                  {idx < history.length - 1 && (
                    <span className="w-px flex-1 bg-zinc-800 mt-1 min-h-[12px]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white">Rev {r.revision}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>
                      {r.status}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(r.changedAt).toLocaleString()}
                    </span>
                    {r.changedBy && (
                      <span className="text-[10px] text-zinc-500">by {r.changedBy}</span>
                    )}
                  </div>
                  {r.comment && (
                    <p className="text-xs text-zinc-400 mt-1">{r.comment}</p>
                  )}
                  {r.changesSummary && (
                    <p className="text-[11px] text-zinc-600 mt-0.5">{r.changesSummary}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Simple compare */}
        {revOptions.length >= 2 && (
          <div className="mt-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4">
            <h5 className="text-xs font-medium text-zinc-400 mb-2">Compare revisions</h5>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <select
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs"
              >
                <option value="">Rev A…</option>
                {revOptions.map((r) => (
                  <option key={`a-${r}`} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <span className="text-zinc-600 text-xs">vs</span>
              <select
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs"
              >
                <option value="">Rev B…</option>
                {revOptions.map((r) => (
                  <option key={`b-${r}`} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            {compareRecords && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-zinc-800 p-3">
                  <div className="text-zinc-400 mb-1">Rev {compareA}</div>
                  {compareRecords.a ? (
                    <>
                      <div className={STATUS_STYLE[compareRecords.a.status] + ' inline-block text-[10px] px-2 py-0.5 rounded-full mb-1'}>
                        {compareRecords.a.status}
                      </div>
                      <p className="text-zinc-300">{compareRecords.a.comment || '—'}</p>
                      <p className="text-zinc-600 mt-1">{compareRecords.a.changesSummary}</p>
                    </>
                  ) : (
                    <p className="text-zinc-600">No history row (current only)</p>
                  )}
                </div>
                <div className="rounded-xl border border-zinc-800 p-3">
                  <div className="text-zinc-400 mb-1">Rev {compareB}</div>
                  {compareRecords.b ? (
                    <>
                      <div className={STATUS_STYLE[compareRecords.b.status] + ' inline-block text-[10px] px-2 py-0.5 rounded-full mb-1'}>
                        {compareRecords.b.status}
                      </div>
                      <p className="text-zinc-300">{compareRecords.b.comment || '—'}</p>
                      <p className="text-zinc-600 mt-1">{compareRecords.b.changesSummary}</p>
                    </>
                  ) : (
                    <p className="text-zinc-600">No history row (current only)</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Attachments — Amplify Storage + Document model (team-shared) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-blue-400 flex items-center gap-2">
            <Paperclip size={14} />
            Attachments ({linkedDocs.length})
          </h4>
          <button
            type="button"
            disabled={attachBusy}
            onClick={() => fileInputRef.current?.click()}
            title="Upload to team Amplify Storage and link to this entity"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-sky-600/20 border border-sky-700/50 text-sky-300 hover:bg-sky-600/30 disabled:opacity-50 disabled:cursor-wait"
          >
            <Plus size={12} />
            {attachBusy ? 'Uploading…' : 'Attach document'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setAttachErr(null);
              setAttachBusy(true);
              try {
                await attachDocumentToEntity(entity.id, file);
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setAttachErr(
                  /not authenticated|unauthenticated|No current user|UserUnAuthenticated/i.test(msg)
                    ? 'Sign in first — attachments are stored in the team cloud, not on this device.'
                    : msg
                );
              } finally {
                setAttachBusy(false);
              }
            }}
          />
        </div>
        {(attachErr || getDocumentsError()) && (
          <p className="text-xs text-red-400 mb-2">
            {attachErr || getDocumentsError()}
          </p>
        )}
        {linkedDocs.length === 0 ? (
          <p className="text-xs text-zinc-600 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl px-4 py-3">
            No documents linked yet. Files are stored in team Amplify Storage (not only this browser).
          </p>
        ) : (
          <ul className="space-y-2">
            {linkedDocs.map((d) => (
              <li
                key={d.id}
                className="flex items-start gap-3 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3"
              >
                <FileText size={16} className="text-sky-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-white font-medium truncate">{d.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-400">
                      {DOC_KIND_LABEL[d.kind] ?? d.kind}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_STYLE[d.status]}`}>
                      {d.status}
                    </span>
                    <span className="text-[10px] text-zinc-500">Rev {d.revision}</span>
                    {typeof d.sizeBytes === 'number' && (
                      <span className="text-[10px] text-zinc-600">
                        {d.sizeBytes >= 1048576
                          ? `${(d.sizeBytes / 1048576).toFixed(1)} MB`
                          : `${Math.max(1, Math.round(d.sizeBytes / 1024))} KB`}
                      </span>
                    )}
                  </div>
                  {d.description && (
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{d.description}</p>
                  )}
                  {d.fileName && (
                    <p className="text-[11px] text-zinc-600 mt-0.5 truncate">{d.fileName}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="Open / download"
                    onClick={async () => {
                      try {
                        const url = await getDocumentDownloadUrl(d);
                        window.open(url, '_blank', 'noopener,noreferrer');
                      } catch (err) {
                        setAttachErr(err instanceof Error ? err.message : String(err));
                      }
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-sky-300 hover:bg-zinc-900"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    type="button"
                    title="Unlink from this entity"
                    onClick={async () => {
                      try {
                        await unlinkDocumentFromEntity(d.id, entity.id);
                      } catch (err) {
                        setAttachErr(err instanceof Error ? err.message : String(err));
                      }
                    }}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-300 hover:bg-zinc-900"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(canAddChild || (entity.children && entity.children.length > 0)) && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h4 className="text-sm font-medium text-blue-400">
              Contained Elements ({entity.children?.length || 0})
            </h4>
            {canAddChild && (
              <button
                type="button"
                onClick={() => setShowAddChild((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-emerald-600/20 border border-emerald-700/50 text-emerald-300 hover:bg-emerald-600/30"
              >
                <Plus size={12} />
                Add child
              </button>
            )}
          </div>

          {showAddChild && (
            <div className="mb-4 bg-zinc-950 border border-emerald-900/40 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-zinc-400">
                Add a child under <span className="text-zinc-200">{entity.name}</span>.
                {entity.type === 'Subsystem'
                  ? ' Use Component for assemblies, or Element for a leaf (hardware, software, interface, integrator).'
                  : entity.type === 'Component'
                    ? ' Components take Elements (hardware / software / interface / integrator).'
                    : ' Systems take subsystems.'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-500 block mb-1">Name</label>
                  <input
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="e.g. Lens barrel assembly"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 block mb-1">Type</label>
                  <select
                    value={childType}
                    onChange={(e) => setChildType(e.target.value as AddableChildType)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {addableTypes.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABEL[t] || t}
                      </option>
                    ))}
                  </select>
                </div>
                {childType === 'Element' && (
                  <div>
                    <label className="text-[11px] text-zinc-500 block mb-1">Element kind</label>
                    <select
                      value={childKind}
                      onChange={(e) => setChildKind(e.target.value as ElementKind)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    >
                      <option value="hardware">Hardware</option>
                      <option value="software">Software</option>
                      <option value="interface">Interface</option>
                      <option value="integrator">Integrator</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 block mb-1">Description (optional)</label>
                <textarea
                  value={childDescription}
                  onChange={(e) => setChildDescription(e.target.value)}
                  rows={2}
                  placeholder="Short description…"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-y"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddChild}
                  disabled={!childName.trim()}
                  className={
                    'px-4 py-2 rounded-xl text-sm font-medium ' +
                    (childName.trim()
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed')
                  }
                >
                  Add to {entity.name}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddChild(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-sm text-zinc-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {entity.children && entity.children.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {entity.children.map((child) => {
                const c = applyOverlay(child);
                const childRemovable =
                  child.type === 'Component' ||
                  child.type === 'SoftwareItem' ||
                  child.type === 'Interface' ||
                  child.type === 'Capability';
                return (
                  <div
                    key={child.id}
                    className="bg-zinc-950 border border-zinc-800 hover:border-blue-600 rounded-2xl p-4 transition group"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectRelated?.(child.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {TYPE_ICON[child.type]}
                        <span className="text-sm font-medium text-white group-hover:text-blue-300 truncate">
                          {c.name}
                        </span>
                        <span className="text-[10px] text-zinc-600 ml-auto">Rev {c.revision}</span>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-2">
                        {c.description || TYPE_LABEL[child.type]}
                      </p>
                    </button>
                    {childRemovable && (
                      <div className="mt-2 flex items-center justify-end">
                        {pendingRemoveId === child.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleRemove(child.id, entity.id)}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-red-600 text-white"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingRemoveId(null)}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPendingRemoveId(child.id)}
                            className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-300"
                          >
                            <Trash2 size={11} />
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            canAddChild &&
            !showAddChild && (
              <p className="text-xs text-zinc-600 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl px-4 py-3">
                No children yet. Use <span className="text-zinc-400">Add child</span> to grow this
                branch during R&amp;D.
              </p>
            )
          )}
        </div>
      )}

      <div className="pt-4 border-t border-zinc-800 flex flex-wrap gap-4 text-xs text-zinc-500">
        {entity.createdAt && (
          <span>Created: {new Date(entity.createdAt).toLocaleDateString()}</span>
        )}
        {entity.lastModified && (
          <span>Last modified: {new Date(entity.lastModified).toLocaleString()}</span>
        )}
        {entity.modifiedBy && <span>By: {entity.modifiedBy}</span>}
      </div>
    </div>
  );
};

const SubsystemOverviewCard: React.FC<{
  sub: ResourceEntity;
  onOpen: (id: string) => void;
}> = ({ sub: rawSub, onOpen }) => {
  const sub = applyOverlay(rawSub);
  const accent = SUBSYSTEM_ACCENT[SUBSYSTEM_COLORS[sub.id] || 'sky'] || 'border-zinc-700 bg-zinc-900';
  const children = sortChildren(sub.id, sub.children || []);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    children.forEach((ch) => {
      c[ch.type] = (c[ch.type] || 0) + 1;
    });
    return c;
  }, [children]);

  return (
    <div className={`border rounded-3xl p-5 flex flex-col ${accent}`}>
      <button type="button" onClick={() => onOpen(sub.id)} className="text-left group mb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Layers size={18} className="text-violet-400 shrink-0" />
            <h3 className="text-base font-semibold text-white group-hover:text-blue-300 leading-snug">
              {sub.name}
            </h3>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[sub.status]}`}>
            {sub.status}
          </span>
        </div>
        {sub.description && (
          <p className="text-xs text-zinc-500 mt-2 line-clamp-2">{sub.description}</p>
        )}
      </button>

      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] text-zinc-500">
        <span className="px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-800">
          {children.length} elements
        </span>
        {Object.entries(counts).map(([t, n]) => (
          <span key={t} className="px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-800">
            {n} {TYPE_LABEL[t as EntityType] ?? t}
          </span>
        ))}
        <span className="px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-800">
          Rev {sub.revision}
        </span>
      </div>

      <div className="flex-1 space-y-1.5 min-h-0">
        {children.map((child, index) => {
          const c = applyOverlay(child);
          return (
            <div
              key={child.id}
              className="w-full flex items-center gap-1 px-1 py-1 rounded-xl bg-zinc-950/80 border border-zinc-800/80 hover:border-blue-600 transition group"
            >
              <div className="flex flex-col shrink-0">
                <button
                  type="button"
                  disabled={index === 0}
                  title="Move up"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveChild(
                      sub.id,
                      children.map((ch) => ch.id),
                      child.id,
                      -1
                    );
                  }}
                  className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-20"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  type="button"
                  disabled={index === children.length - 1}
                  title="Move down"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveChild(
                      sub.id,
                      children.map((ch) => ch.id),
                      child.id,
                      1
                    );
                  }}
                  className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-20"
                >
                  <ChevronDown size={12} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onOpen(child.id)}
                className="flex-1 min-w-0 text-left flex items-center gap-2 px-1.5 py-1"
              >
                <span className="shrink-0 opacity-80">{TYPE_ICON[child.type]}</span>
                <span className="text-xs text-zinc-300 group-hover:text-white truncate flex-1">
                  {c.name}
                </span>
                <span className="text-[10px] text-zinc-600 shrink-0">Rev {c.revision}</span>
                <ChevronRight size={12} className="text-zinc-600 shrink-0" />
              </button>
              {(child.type === 'Component' ||
                child.type === 'SoftwareItem' ||
                child.type === 'Interface' ||
                child.type === 'Capability') && (
                <button
                  type="button"
                  title="Remove from subsystem"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      window.confirm(
                        `Remove “${c.name}” from ${sub.name}? It will leave Registry and Architecture.`
                      )
                    ) {
                      removeChildEntity(child.id);
                    }
                  }}
                  className="p-1.5 text-zinc-600 hover:text-red-300 shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SystemRegistry: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [historyTick, setHistoryTick] = useState(0);

  const registryTree = useMemo(() => getRegistryTree(), [historyTick]);
  const allEntities = useMemo(() => getMergedAllEntities(), [historyTick]);
  const rootId = registryTree.id;

  const [selectedId, setSelectedId] = useState<string | null>(rootId);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootId]));
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<EntityType | 'all'>('all');

  useEffect(() => {
    const unsubConfig = subscribeConfigStore(() => setHistoryTick((t) => t + 1));
    const unsubOrder = subscribeChildOrderStore(() => setHistoryTick((t) => t + 1));
    return () => {
      unsubConfig();
      unsubOrder();
    };
  }, []);

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;

    const entity = allEntities.find((e) => e.id === id);
    if (!entity) return;

    setViewMode('tree');
    setSelectedId(id);

    const path: string[] = [];
    let current: ResourceEntity | undefined = entity;
    while (current?.parentId) {
      path.push(current.parentId);
      current = allEntities.find((e) => e.id === current!.parentId);
    }
    setExpanded((prev) => new Set([...prev, id, ...path, rootId]));
  }, [searchParams, allEntities, rootId]);

  useEffect(() => {
    if (typeFilter === 'all' || viewMode !== 'tree') return;
    const parents = new Set<string>([rootId]);
    allEntities.forEach((e) => {
      if (e.type === typeFilter && e.parentId) parents.add(e.parentId);
    });
    setExpanded((prev) => new Set([...prev, ...parents]));
  }, [typeFilter, viewMode, allEntities, rootId]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    const findInTree = (node: ResourceEntity, id: string): ResourceEntity | null => {
      if (node.id === id) return node;
      for (const c of node.children || []) {
        const found = findInTree(c, id);
        if (found) return found;
      }
      return null;
    };
    // Prefer tree node so Contained Elements includes seed + user-added children
    return findInTree(registryTree, selectedId) || allEntities.find((e) => e.id === selectedId) || null;
  }, [selectedId, registryTree, allEntities]);

  const subsystems = useMemo(
    () => (registryTree.children || []).filter((c) => c.type === 'Subsystem'),
    [registryTree]
  );

  const filteredSubsystems = useMemo(() => {
    if (!search.trim()) return subsystems;
    const q = search.toLowerCase();
    return subsystems.filter((sub) => {
      if (sub.name.toLowerCase().includes(q)) return true;
      if ((sub.description || '').toLowerCase().includes(q)) return true;
      return (sub.children || []).some(
        (ch) =>
          ch.name.toLowerCase().includes(q) ||
          (ch.description || '').toLowerCase().includes(q) ||
          (ch.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [subsystems, search]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (node: ResourceEntity) => setSelectedId(node.id);

  const openInTree = (id: string) => {
    setViewMode('tree');
    setTypeFilter('all');
    setSelectedId(id);
    const entity = allEntities.find((e) => e.id === id);
    const path: string[] = [rootId];
    let current: ResourceEntity | undefined = entity;
    while (current?.parentId) {
      path.push(current.parentId);
      current = allEntities.find((e) => e.id === current!.parentId);
    }
    if (entity) path.push(entity.id);
    setExpanded((prev) => new Set([...prev, ...path]));
  };

  const handleSelectById = (id: string) => {
    setSelectedId(id);
    const entity = allEntities.find((e) => e.id === id);
    if (entity?.parentId) {
      setExpanded((prev) => new Set([...prev, entity.parentId!]));
    }
  };

  const expandAll = () => setExpanded(new Set(allEntities.map((e) => e.id)));
  const collapseAll = () => setExpanded(new Set([rootId]));

  return (
    <div className="p-8 max-w-[1600px] mx-auto bg-zinc-950 text-white min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Box className="text-blue-400" /> System Registry
          </h1>
          <p className="text-zinc-400 mt-2">
            Digital Thread · TAR™ · {subsystems.length} subsystems · {allEntities.length} entities
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex bg-zinc-900 border border-zinc-700 rounded-2xl p-1">
            <button
              type="button"
              onClick={() => setViewMode('overview')}
              className={`px-4 py-2 rounded-xl text-sm flex items-center gap-2 ${
                viewMode === 'overview' ? 'bg-blue-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <LayoutGrid size={14} /> Overview
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`px-4 py-2 rounded-xl text-sm flex items-center gap-2 ${
                viewMode === 'tree' ? 'bg-blue-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <ListTree size={14} /> Tree
            </button>
          </div>

          {viewMode === 'tree' && (
            <div className="flex bg-zinc-900 border border-zinc-700 rounded-2xl p-1">
              <button
                type="button"
                onClick={expandAll}
                className="px-4 py-2 rounded-xl text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-4 py-2 rounded-xl text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Collapse
              </button>
            </div>
          )}

          <Link
            to="/baselines"
            className="px-4 py-2 rounded-xl text-sm bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-blue-500 inline-flex items-center gap-2"
          >
            <Bookmark size={14} /> Baselines
          </Link>
          <Link
            to="/system-architecture"
            className="px-4 py-2 rounded-xl text-sm bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-blue-500"
          >
            System Architecture
          </Link>
        </div>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            viewMode === 'overview' ? 'Filter subsystems or constituents…' : 'Search tree…'
          }
          className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredSubsystems.map((sub) => (
            <SubsystemOverviewCard key={sub.id} sub={sub} onOpen={openInTree} />
          ))}
          {filteredSubsystems.length === 0 && (
            <div className="col-span-full text-center text-zinc-500 py-16">
              No subsystems match “{search}”.
            </div>
          )}
        </div>
      )}

      {viewMode === 'tree' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col min-h-[640px]">
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-2">
              <Filter size={14} className="text-zinc-500 shrink-0" />
              {(
                [
                  'all',
                  'System',
                  'Subsystem',
                  'Component',
                  'SoftwareItem',
                  'Interface',
                  'Capability',
                ] as const
              ).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`text-xs px-3 py-1.5 rounded-xl whitespace-nowrap transition ${
                    typeFilter === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-700'
                  }`}
                >
                  {t === 'all' ? 'All' : TYPE_LABEL[t]}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto pr-1 space-y-0.5">
              <TreeNode
                node={registryTree}
                depth={0}
                selectedId={selectedId}
                expanded={expanded}
                onToggle={toggleExpand}
                onSelect={handleSelect}
                search={search}
                typeFilter={typeFilter}
              />
            </div>
          </div>

          <div className="xl:col-span-8">
            {selected ? (
              <ComponentCard
                entity={selected}
                onSelectRelated={handleSelectById}
                historyTick={historyTick}
              />
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-16 text-center">
                <Eye className="mx-auto text-zinc-600 mb-4" size={40} />
                <p className="text-zinc-400">
                  Select a system, subsystem, or component to view details.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemRegistry;
