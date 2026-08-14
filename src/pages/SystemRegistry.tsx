/**
 * System Registry — TAR™ product structure
 * Overview | Tree (type filter) | Deep-link ?id=
 * Display labels: SoftwareItem → Software, Capability → Integrator
 */
import React, { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import {
  TAR_TREE,
  ResourceEntity,
  EntityType,
  EntityStatus,
  SUBSYSTEM_COLORS,
  ALL_ENTITIES,
} from '../data/tarSeedData';
import { documentsForEntity } from '../data/documentsSeed';
import type { Document } from '../types/plm';

type ViewMode = 'overview' | 'tree';

const TYPE_ICON: Record<EntityType, React.ReactNode> = {
  System: <Crosshair size={16} className="text-blue-400" />,
  Subsystem: <Layers size={16} className="text-violet-400" />,
  Component: <Package size={16} className="text-zinc-300" />,
  SoftwareItem: <Cpu size={16} className="text-emerald-400" />,
  Interface: <GitBranch size={16} className="text-sky-400" />,
  Capability: <Zap size={16} className="text-amber-400" />,
};

const TYPE_LABEL: Record<EntityType, string> = {
  System: 'System',
  Subsystem: 'Subsystem',
  Component: 'Component',
  SoftwareItem: 'Software',
  Interface: 'Interface',
  Capability: 'Integrator',
};

/** Phase 0 release status styles (Draft | In Review | Released | Obsolete) */
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
  const hasChildren = !!(node.children && node.children.length > 0);
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;

  const matchesSearch =
    !search ||
    node.name.toLowerCase().includes(search.toLowerCase()) ||
    (node.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (node.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));

  const matchesType = nodeMatchesTypeFilter(node, typeFilter);

  if (!matchesType) return null;
  if (search && !matchesSearch && !hasChildren) return null;

  const isTypeHit = typeFilter === 'all' || node.type === typeFilter;
  const visibleChildren = (node.children || []).filter((c) => nodeMatchesTypeFilter(c, typeFilter));

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
          {node.name}
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

interface ComponentCardProps {
  entity: ResourceEntity;
  onSelectRelated?: (id: string) => void;
}

const ComponentCard: React.FC<ComponentCardProps> = ({ entity, onSelectRelated }) => {
  const accent =
    entity.type === 'Subsystem'
      ? SUBSYSTEM_ACCENT[SUBSYSTEM_COLORS[entity.id] || 'sky'] || 'border-zinc-700'
      : 'border-zinc-700';

  const linkedDocs: Document[] = useMemo(
    () => documentsForEntity(entity.id),
    [entity.id]
  );

  return (
    <div className={`bg-zinc-900 border ${accent} rounded-3xl p-8 space-y-6`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-700 flex items-center justify-center shrink-0">
            {TYPE_ICON[entity.type]}
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-white">{entity.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                {TYPE_LABEL[entity.type]}
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
          </div>
        </div>
        <div className="text-xs text-zinc-500 text-right shrink-0">
          <div>ID: {entity.id}</div>
          {entity.modifiedBy && <div className="mt-1">By: {entity.modifiedBy}</div>}
        </div>
      </div>

      {entity.description && (
        <div>
          <h4 className="text-sm font-medium text-blue-400 mb-2">Description</h4>
          <p className="text-zinc-300 leading-relaxed text-[15px]">{entity.description}</p>
        </div>
      )}

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

      {/* Phase 0 — Attachments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-blue-400 flex items-center gap-2">
            <Paperclip size={14} />
            Attachments ({linkedDocs.length})
          </h4>
          <button
            type="button"
            disabled
            title="Upload wiring comes with Amplify Storage (Phase 0 UI shell)"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-500 cursor-not-allowed"
          >
            <Plus size={12} />
            Attach document
          </button>
        </div>
        {linkedDocs.length === 0 ? (
          <p className="text-xs text-zinc-600 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl px-4 py-3">
            No documents linked yet. Attachments preserve the hierarchy as navigation spine —
            open any component to see revision + linked docs.
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
                  </div>
                  {d.description && (
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{d.description}</p>
                  )}
                  <div className="text-[10px] text-zinc-600 mt-1.5 flex flex-wrap gap-3">
                    {d.fileName && <span>{d.fileName}</span>}
                    {d.sizeBytes != null && (
                      <span>{(d.sizeBytes / 1024).toFixed(0)} KB</span>
                    )}
                    <span>
                      Updated {new Date(d.lastModified).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {entity.children && entity.children.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-blue-400 mb-3">
            Contained Elements ({entity.children.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {entity.children.map((child) => (
              <button
                key={child.id}
                onClick={() => onSelectRelated?.(child.id)}
                className="text-left bg-zinc-950 border border-zinc-800 hover:border-blue-600 rounded-2xl p-4 transition group"
              >
                <div className="flex items-center gap-2 mb-1">
                  {TYPE_ICON[child.type]}
                  <span className="text-sm font-medium text-white group-hover:text-blue-300 truncate">
                    {child.name}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 line-clamp-2">
                  {child.description || TYPE_LABEL[child.type]}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-zinc-800 flex flex-wrap gap-4 text-xs text-zinc-500">
        {entity.createdAt && (
          <span>Created: {new Date(entity.createdAt).toLocaleDateString()}</span>
        )}
        {entity.lastModified && (
          <span>Last modified: {new Date(entity.lastModified).toLocaleDateString()}</span>
        )}
        {entity.modifiedBy && <span>By: {entity.modifiedBy}</span>}
      </div>
    </div>
  );
};

const SubsystemOverviewCard: React.FC<{
  sub: ResourceEntity;
  onOpen: (id: string) => void;
}> = ({ sub, onOpen }) => {
  const accent = SUBSYSTEM_ACCENT[SUBSYSTEM_COLORS[sub.id] || 'sky'] || 'border-zinc-700 bg-zinc-900';
  const children = sub.children || [];
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
        {children.map((child) => (
          <button
            key={child.id}
            type="button"
            onClick={() => onOpen(child.id)}
            className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl bg-zinc-950/80 border border-zinc-800/80 hover:border-blue-600 transition group"
          >
            <span className="shrink-0 opacity-80">{TYPE_ICON[child.type]}</span>
            <span className="text-xs text-zinc-300 group-hover:text-white truncate flex-1">
              {child.name}
            </span>
            <span className="text-[10px] text-zinc-600 shrink-0 hidden sm:inline">
              {TYPE_LABEL[child.type]}
            </span>
            <ChevronRight size={12} className="text-zinc-600 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};

const SystemRegistry: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedId, setSelectedId] = useState<string | null>(TAR_TREE.id);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([TAR_TREE.id]));
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<EntityType | 'all'>('all');

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;

    const entity = ALL_ENTITIES.find((e) => e.id === id);
    if (!entity) return;

    setViewMode('tree');
    setSelectedId(id);

    const path: string[] = [];
    let current: ResourceEntity | undefined = entity;
    while (current?.parentId) {
      path.push(current.parentId);
      current = ALL_ENTITIES.find((e) => e.id === current!.parentId);
    }
    setExpanded((prev) => new Set([...prev, id, ...path, TAR_TREE.id]));
  }, [searchParams]);

  useEffect(() => {
    if (typeFilter === 'all' || viewMode !== 'tree') return;
    const parents = new Set<string>([TAR_TREE.id]);
    ALL_ENTITIES.forEach((e) => {
      if (e.type === typeFilter && e.parentId) parents.add(e.parentId);
    });
    setExpanded((prev) => new Set([...prev, ...parents]));
  }, [typeFilter, viewMode]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return ALL_ENTITIES.find((e) => e.id === selectedId) || null;
  }, [selectedId]);

  const subsystems = useMemo(
    () => (TAR_TREE.children || []).filter((c) => c.type === 'Subsystem'),
    []
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
    const entity = ALL_ENTITIES.find((e) => e.id === id);
    const path: string[] = [TAR_TREE.id];
    let current: ResourceEntity | undefined = entity;
    while (current?.parentId) {
      path.push(current.parentId);
      current = ALL_ENTITIES.find((e) => e.id === current!.parentId);
    }
    if (entity) path.push(entity.id);
    setExpanded((prev) => new Set([...prev, ...path]));
  };

  const handleSelectById = (id: string) => {
    setSelectedId(id);
    const entity = ALL_ENTITIES.find((e) => e.id === id);
    if (entity?.parentId) {
      setExpanded((prev) => new Set([...prev, entity.parentId!]));
    }
  };

  const expandAll = () => setExpanded(new Set(ALL_ENTITIES.map((e) => e.id)));
  const collapseAll = () => setExpanded(new Set([TAR_TREE.id]));

  return (
    <div className="p-8 max-w-[1600px] mx-auto bg-zinc-950 text-white min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Box className="text-blue-400" /> System Registry
          </h1>
          <p className="text-zinc-400 mt-2">
            Digital Thread · TAR™ · {subsystems.length} subsystems · {ALL_ENTITIES.length} entities
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
                node={TAR_TREE}
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
              <ComponentCard entity={selected} onSelectRelated={handleSelectById} />
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