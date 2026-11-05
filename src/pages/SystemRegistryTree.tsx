/**
 * Tree node for System Registry
 */
import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { applyOverlay, getMergedAllEntities } from '../lib/configStore';
import { sortChildren } from '../lib/childOrderStore';
import type { ResourceEntity } from '../data/tarSeedData';
import { isIntegratorContainer, isCompanyNode, ELEMENT_KIND_LABEL } from '../types/plm';

// Minimal icons for tree
function nodeTypeIcon(node: any, size = 16) {
  return <span className="text-zinc-400">•</span>;
}

export const TreeNode: React.FC<any> = ({ node, depth, selectedId, expanded, onToggle, onSelect, search, typeFilter }) => {
  const display = applyOverlay(node);
  const hasChildren = !!(node.children && node.children.length > 0);
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;

  const matchesSearch = !search || display.name.toLowerCase().includes(search.toLowerCase());

  if (search && !matchesSearch && !hasChildren) return null;

  const visibleChildren = sortChildren(node.id, node.children || []);

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-xl cursor-pointer ${isSelected ? 'bg-blue-600/30' : 'hover:bg-zinc-800/80'}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelect(node)}
      >
        {visibleChildren.length > 0 ? (
          <button onClick={(e) => { e.stopPropagation(); onToggle(node.id); }} className="text-zinc-500">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : <span className="w-4" />}
        <span>{nodeTypeIcon(display)}</span>
        <span className="text-sm truncate">{display.name}</span>
        <span className="flex-1" />
        <span className="text-[10px] text-zinc-600">Rev {display.revision}</span>
      </div>
      {visibleChildren.length > 0 && isExpanded && (
        <div>
          {visibleChildren.map((child: any) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} selectedId={selectedId} expanded={expanded} onToggle={onToggle} onSelect={onSelect} search={search} typeFilter={typeFilter} />
          ))}
        </div>
      )}
    </div>
  );
};
