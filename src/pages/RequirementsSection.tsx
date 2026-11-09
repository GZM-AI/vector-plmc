/**
 * Requirements section for Registry cards (under Notes)
 */
import React, { useState, useEffect } from 'react';
import { updateEntityFields, subscribeConfigStore } from '../lib/configStore';
import type { ResourceEntity } from '../data/tarSeedData';
import MarkdownEditor from '../components/MarkdownEditor';
import MarkdownView from '../components/MarkdownView';

export const RequirementsSection: React.FC<{ entity: ResourceEntity }> = ({ entity }) => {
  const [draft, setDraft] = useState(entity.requirements || '');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setDraft(entity.requirements || '');
  }, [entity.requirements, entity.id]);

  const save = () => {
    updateEntityFields(entity.id, { requirements: draft });
    setEditing(false);
  };

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-1">
        <h4 className="text-sm font-medium text-blue-400">Requirements</h4>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-[11px] text-zinc-500 hover:text-zinc-300">Edit</button>
        )}
      </div>
      {editing ? (
        <div>
          <MarkdownEditor
            value={draft}
            onChange={setDraft}
            placeholder="Requirements for this part…"
            minHeight="min-h-[100px]"
            rows={4}
          />
          <div className="flex gap-2 mt-1">
            <button onClick={save} className="text-xs px-2 py-1 bg-blue-600 rounded text-white">Save</button>
            <button onClick={() => { setEditing(false); setDraft(entity.requirements || ''); }} className="text-xs px-2 py-1 text-zinc-400">Cancel</button>
          </div>
        </div>
      ) : (
        <MarkdownView text={entity.requirements || 'No requirements yet.'} className="text-zinc-300 text-[15px]" />
      )}
    </div>
  );
};
