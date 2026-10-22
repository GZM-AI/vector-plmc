/**
 * Platform selector bar — drop into Architecture, Planning, Baselines, Change Control.
 * Scopes those views to the active System while Registry Tree shows the full family.
 */
import React, { useEffect, useState } from 'react';
import {
  getActivePlatformId,
  getPlatformOptions,
  setActivePlatform,
  subscribePlatform,
  type PlatformId,
} from '../lib/platformStore';

export const PlatformSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [active, setActive] = useState<PlatformId>(getActivePlatformId());

  useEffect(() => subscribePlatform(() => setActive(getActivePlatformId())), []);

  const options = getPlatformOptions();

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-[11px] uppercase tracking-wider text-zinc-500 mr-1">Platform</span>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setActivePlatform(opt.id)}
          className={
            'px-3 py-1.5 rounded-xl text-sm border font-medium transition ' +
            (active === opt.id
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white')
          }
        >
          {opt.name}
        </button>
      ))}
    </div>
  );
};

export default PlatformSelector;
