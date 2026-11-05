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
  Cog,
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
  Image,
  Plus,
  History,
  ArrowUpCircle,
  Bookmark,
  Factory,
  Building2,
  ChevronUp,
  Trash2,
  Download,
  X,
} from 'lucide-react';
import { moveChild, sortChildren, subscribeChildOrderStore } from '../lib/childOrderStore';
import {
  getSuppliersForEntity,
  getSuppliers,
  getSupplierById,
  subscribeSuppliersStore,
  ensureSupplierForPart,
  unlinkSupplierFromEntity,
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
  attachDocumentsToEntity,
  openAttachedDocument,
  previewAttachedDocument,
  type DocumentPreview,
  unlinkDocumentFromEntity,
  deleteDocument,
  hydrateDocumentsStoreFromCloud,
  getDocumentsError,
  getDocumentDownloadUrl,
  referenceImageFor,
  REFERENCE_IMAGE_MARKER,
} from '../lib/documentsStore';
import type { Document, ReleaseStatus, RevisionRecord, ElementKind } from '../types/plm';
import {
  ELEMENT_KIND_LABEL,
  canAttachIntegrators,
  isCompanyNode,
  isIntegratorContainer,
  isSourcingNode,
} from '../types/plm';
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
  getEntityById,
  type AddableChildType,
} from '../lib/configStore';
import { nextRevision } from '../lib/revisionUtils';
import { PlatformSelector } from '../components/PlatformSelector';
import { getActiveSystem, subscribePlatform } from '../lib/platformStore';
import { ComponentCard } from './SystemRegistryCard';

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

function normalizeTags(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function parseTagInput(raw: string): string[] {
  return normalizeTags(raw.split(/[,;\n]+/));
}

const KIND_ORDER: ElementKind[] = [
  'hardware',
  'software',
  'interface',
  'integrator',
  'company',
  'product',
  'other',
];

function elementKindOf(node: { type: string; kind?: string }): ElementKind | null {
  if (node.type === 'Element') return (node.kind as ElementKind) || 'other';
  if (node.type === 'SoftwareItem') return 'software';
  if (node.type === 'Interface') return 'interface';
  if (node.type === 'Capability') return 'integrator';
  return null;
}

/** True element kind only — Component is an assembly, not hardware. */
function displayKindOf(node: { type: string; kind?: string }): ElementKind | null {
  return elementKindOf(node);
}

function kindIcon(kind: ElementKind, size = 14): React.ReactNode {
  switch (kind) {
    case 'hardware':
      return <Cog size={size} className="text-orange-300" />;
    case 'software':
      return <Cpu size={size} className="text-emerald-400" />;
    case 'interface':
      return <GitBranch size={size} className="text-sky-400" />;
    case 'integrator':
      return <Factory size={size} className="text-amber-400" />;
    case 'company':
      return <Building2 size={size} className="text-amber-300" />;
    case 'product':
      return <Box size={size} className="text-amber-200" />;
    default:
      return <Zap size={size} className="text-zinc-500" />;
  }
}

/** Type icon for rows. Elements use kind; Components stay Package. */
function nodeTypeIcon(node: { type: string; kind?: string }, size = 16): React.ReactNode {
  const kind = elementKindOf(node);
  if (kind) return kindIcon(kind, size);
  return TYPE_ICON[node.type] || <Package size={size} className="text-zinc-400" />;
}

/** Unique element kinds under a node (not the node itself if it is a Component). */
function collectChildElementKinds(node: ResourceEntity): ElementKind[] {
  const found = new Set<ElementKind>();
  const walk = (n: ResourceEntity) => {
    const k = elementKindOf(n);
    if (k) found.add(k);
    (n.children || []).forEach(walk);
  };
  (node.children || []).forEach(walk);
  return KIND_ORDER.filter((k) => found.has(k));
}

function countElementKind(node: ResourceEntity, kind: ElementKind): number {
  let n = elementKindOf(node) === kind ? 1 : 0;
  for (const c of node.children || []) n += countElementKind(c, kind);
  return n;
}

function sourcingChildrenOf(node: ResourceEntity): ResourceEntity[] {
  return sortChildren(
    node.id,
    (node.children || []).filter((c) => isSourcingNode(applyOverlay(c)))
  );
}

/** Integrator groups for a subsystem card, in constituent order (component then its elements). */
function findSubsystemId(start: ResourceEntity): string | undefined {
  const all = getMergedAllEntities();
  let cur: ResourceEntity | undefined = start;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (cur.type === 'Subsystem') return cur.id;
    cur = all.find((e) => e.id === cur.parentId);
  }
  return undefined;
}

function collectIntegratorGroups(
  sub: ResourceEntity
): { owner: ResourceEntity; integrators: ResourceEntity[] }[] {
  const groups: { owner: ResourceEntity; integrators: ResourceEntity[] }[] = [];
  const kids = sortChildren(sub.id, sub.children || []);
  let folderGroup: { owner: ResourceEntity; integrators: ResourceEntity[] } | null = null;

  const consider = (node: ResourceEntity) => {
    const integrators = sourcingChildrenOf(node);
    if (integrators.length) groups.push({ owner: node, integrators });
  };

  for (const child of kids) {
    const c = applyOverlay(child);
    if (isIntegratorContainer(c)) {
      const integrators = sourcingChildrenOf(c);
      if (integrators.length) folderGroup = { owner: c, integrators };
      continue;
    }
    consider(c);
    for (const grand of sortChildren(c.id, c.children || [])) {
      const g = applyOverlay(grand);
      if (isSourcingNode(g)) continue;
      consider(g);
    }
  }
  if (folderGroup) groups.push(folderGroup);
  return groups;
}

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

function nodeSelfMatchesTypeFilter(
  node: ResourceEntity,
  typeFilter: EntityType | 'Element' | 'all'
): boolean {
  if (typeFilter === 'all') return true;
  if (node.type === typeFilter) return true;
  if (typeFilter === 'Element' && node.type === 'Element') return true;
  if (typeFilter === 'Capability') {
    const k = elementKindOf(node);
    return (
      node.type === 'Capability' ||
      k === 'integrator' ||
      k === 'company' ||
      k === 'product'
    );
  }
  return false;
}

function nodeMatchesTypeFilter(
  node: ResourceEntity,
  typeFilter: EntityType | 'Element' | 'all'
): boolean {
  if (typeFilter === 'all') return true;
  if (nodeSelfMatchesTypeFilter(node, typeFilter)) return true;
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
  typeFilter: EntityType | 'Element' | 'all';
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

  const isTypeHit = nodeSelfMatchesTypeFilter(node, typeFilter);
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
        <span className="shrink-0">{nodeTypeIcon(display)}</span>
        <span
          className={`text-sm truncate ${
            isSelected ? 'text-white font-medium' : 'text-zinc-300 group-hover:text-white'
          }`}
        >
          {display.name}
        </span>
        {(node.type === 'Component' ||
          node.type === 'Subsystem' ||
          isIntegratorContainer(node) ||
          isCompanyNode(node)) &&
          collectChildElementKinds(node).length > 0 && (
            <span className="inline-flex items-center gap-0.5 shrink-0 ml-1">
              {collectChildElementKinds(node).map((k) => (
                <span key={k} title={ELEMENT_KIND_LABEL[k]} className="opacity-90">
                  {kindIcon(k, 12)}
                </span>
              ))}
            </span>
          )}
        <span className="flex-1" />
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

function SubsystemIntegratorRollup({
  sub,
  onOpen,
}: {
  sub: ResourceEntity;
  onOpen: (id: string) => void;
}) {
  const integratorGroups = collectIntegratorGroups(sub);
  const integratorCount = integratorGroups.reduce((n, g) => n + g.integrators.length, 0);
  return (
    <div className="mt-4 pt-3 border-t border-amber-900/30">
      <div className="flex items-center gap-2 mb-2">
        <Factory size={13} className="text-amber-400 shrink-0" />
        <h4 className="text-[11px] font-medium uppercase tracking-wider text-amber-300/90">
          Vertical Integrators
        </h4>
        <span className="text-[10px] text-zinc-600">
          {integratorCount === 0
            ? 'none yet'
            : `${integratorCount} across ${integratorGroups.length} part${
                integratorGroups.length === 1 ? '' : 's'
              }`}
        </span>
        <Link
          to="/suppliers"
          className="ml-auto text-[10px] text-zinc-500 hover:text-amber-200"
        >
          Suppliers
        </Link>
      </div>
      {integratorGroups.length === 0 ? (
        <p className="text-[11px] text-zinc-600">No vertical integrators yet.</p>
      ) : (
        <div className="space-y-2">
          {integratorGroups.map((g) => (
            <div key={g.owner.id} className="text-xs">
              <button
                type="button"
                onClick={() => onOpen(g.owner.id)}
                className="text-amber-200 hover:text-amber-100"
              >
                {g.owner.name}
              </button>
              <span className="text-zinc-500">
                {' '}
                ({g.integrators.length})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SystemRegistry: React.FC = () => {
  // ... rest of the component uses <ComponentCard ... />
  return null; // placeholder - full content is in the local slim file
};

export default SystemRegistry;
