/**
 * Requirements section for Registry cards (placed under Notes)
 * Stored in ProductOverlay notes meta as rq via updateEntityFields.
 * Uses the same markdown toolbar and renderer as Description / Notes.
 */
import React, { useState, useEffect } from 'react';
import { updateEntityFields } from '../lib/configStore';
import type { ResourceEntity } from '../data/tarSeedData';
import { MarkdownField, MarkdownView } from '../components/MarkdownField';

type WithRequirements = ResourceEntity & { requirements?: string };

export const RequirementsSection: React.FC<{ entity: ResourceEntity }> = ({ entity }) => {
  const current = (entity as WithRequirements).requirements || '';
  const [draft, setDraft] = useState(current);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setDraft((entity as WithRequirements).requirements || '');
    setEditing(false);
  }, [entity.id, (entity as WithRequirements).requirements]);

  const save = () => {
    updateEntityFields(entity.id, { requirements: draft });
    setEditing(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-sm font-medium text-blue-400">Requirements</h4>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <MarkdownField
            value={draft}
            onChange={setDraft}
            rows={14}
            minHeight="min-h-[280px]"
            placeholder="Requirements for this part. Use the toolbar for bold, underline, lists, and links."
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={save}
              className="text-xs px-3 py-1.5 bg-blue-600 rounded-xl text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(current);
              }}
              className="text-xs px-3 py-1.5 text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : current ? (
        <MarkdownView source={current} />
      ) : (
        <p className="text-xs text-zinc-600">No requirements yet.</p>
      )}
    </div>
  );
};
