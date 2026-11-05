/**
 * Vendors section for Registry cards (after Vertical Integrators)
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Factory, Plus, X } from 'lucide-react';
import { getSuppliersForEntity, getSuppliers, ensureSupplierForPart, unlinkSupplierFromEntity, subscribeSuppliersStore } from '../lib/suppliersStore';
import type { ResourceEntity } from '../data/tarSeedData';

export const VendorsSection: React.FC<{ entity: ResourceEntity }> = ({ entity }) => {
  const [, setTick] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => subscribeSuppliersStore(() => setTick((t) => t + 1)), []);

  const vendors = getSuppliersForEntity(entity.id).filter((s) => s.kind !== 'Integrator');

  const add = () => {
    if (!newName.trim()) return;
    ensureSupplierForPart(newName.trim(), entity.id, 'Vendor');
    setNewName('');
    setShowAdd(false);
  };

  return (
    <div className="mt-6 pt-4 border-t border-zinc-800">
      <div className="flex items-center gap-2 mb-2">
        <Factory size={14} className="text-sky-400" />
        <h4 className="text-sm font-medium text-sky-300">Vendors ({vendors.length})</h4>
        <button onClick={() => setShowAdd(true)} className="ml-auto text-[11px] text-zinc-500 hover:text-sky-300 flex items-center gap-1">
          <Plus size={12} /> Add
        </button>
      </div>
      {vendors.length === 0 && !showAdd && <p className="text-xs text-zinc-600">No vendors linked.</p>}
      <div className="space-y-1">
        {vendors.map((v) => (
          <div key={v.id} className="flex items-center gap-2 text-sm">
            <Link to={`/suppliers?id=${v.id}`} className="text-sky-200 hover:underline">{v.name}</Link>
            <button onClick={() => unlinkSupplierFromEntity(v.id, entity.id)} className="text-zinc-600 hover:text-red-400"><X size={12} /></button>
          </div>
        ))}
      </div>
      {showAdd && (
        <div className="mt-2 flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Vendor name" className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm" />
          <button onClick={add} className="text-xs px-2 py-1 bg-sky-700 rounded text-white">Add</button>
          <button onClick={() => setShowAdd(false)} className="text-xs px-2 py-1 text-zinc-400">Cancel</button>
        </div>
      )}
    </div>
  );
};
