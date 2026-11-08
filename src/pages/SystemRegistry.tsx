/**
 * System Registry — TAR™ product structure
 * Page shell only. Card lives in SystemRegistryCard.tsx
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package } from 'lucide-react';
import { getRegistryTree, getEntityById, subscribeConfigStore } from '../lib/configStore';
import { PlatformSelector } from '../components/PlatformSelector';
import { getActiveSystem, subscribePlatform } from '../lib/platformStore';
<<<<<<< Updated upstream
import { ComponentCard } from './SystemRegistryCard';
import { TreeNode } from './SystemRegistryTree';
=======
import { RequirementsSection } from './RequirementsSection';
import { VendorsSection } from './VendorsSection';
>>>>>>> Stashed changes

type ViewMode = 'overview' | 'tree';

const SystemRegistry: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<ViewMode>('overview');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<any>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const u1 = subscribeConfigStore(() => setTick((t) => t + 1));
    const u2 = subscribePlatform(() => setTick((t) => t + 1));
    return () => { u1?.(); u2?.(); };
  }, []);

  const tree = useMemo(() => getRegistryTree(), [tick]);

  const onSelect = (node: any) => {
    setSelected(node);
    setSearchParams({ id: node.id });
  };

  const onToggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <PlatformSelector />
          <h1 className="text-lg font-semibold">System Registry</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('overview')} className={`px-3 py-1.5 text-xs rounded-lg ${view === 'overview' ? 'bg-blue-600 text-white' : 'text-zinc-400'}`}>Overview</button>
          <button onClick={() => setView('tree')} className={`px-3 py-1.5 text-xs rounded-lg ${view === 'tree' ? 'bg-blue-600 text-white' : 'text-zinc-400'}`}>Tree</button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        {view === 'tree' && (
          <div className="w-80 border-r border-zinc-800 overflow-y-auto p-4">
            <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm mb-3" />
            {tree.map((node: any) => (
              <TreeNode key={node.id} node={node} depth={0} selectedId={selected?.id || null} expanded={expanded} onToggle={onToggle} onSelect={onSelect} search={search} typeFilter="all" />
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">
          {selected ? (
            <ComponentCard entity={selected} onSelectRelated={(id) => { const f = getEntityById(id); if (f) onSelect(f); }} historyTick={tick} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Package size={40} className="text-zinc-600 mb-3" />
              <p className="text-zinc-400">Select a system, subsystem, component, or integrator to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemRegistry;
