/**
 * System Registry detail card
 * Requirements and Vendors sections are in separate files.
 */
import React from 'react';
import { applyOverlay } from '../lib/configStore';
import type { ResourceEntity } from '../data/tarSeedData';
import { RequirementsSection } from './RequirementsSection';
import { VendorsSection } from './VendorsSection';

interface ComponentCardProps {
  entity: ResourceEntity;
  onSelectRelated?: (id: string) => void;
  historyTick?: number;
}

export const ComponentCard: React.FC<ComponentCardProps> = ({ entity: rawEntity, onSelectRelated, historyTick = 0 }) => {
  const entity = applyOverlay(rawEntity);

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-2">{entity.name}</h2>
      <p className="text-sm text-zinc-400 mb-4">{entity.description}</p>
      
      {/* Notes placeholder */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-zinc-300 mb-1">Notes</h4>
        <p className="text-sm text-zinc-400 whitespace-pre-wrap">{entity.notes || 'No notes'}</p>
      </div>

      <RequirementsSection entity={entity} />

      <div className="mt-6 pt-4 border-t border-zinc-800">
        <h4 className="text-sm font-medium text-amber-300 mb-2">Vertical Integrators</h4>
        <p className="text-xs text-zinc-500">Integrator rollup goes here</p>
      </div>

      <VendorsSection entity={entity} />
    </div>
  );
};
