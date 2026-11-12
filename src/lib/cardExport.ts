/**
 * Export one System Registry card as a Word-compatible document (RTF).
 * Includes identity, description, notes, requirements, tags,
 * reference images, constituents, vertical integrators, vendors,
 * attachments, and revision history.
 */
import type { Document, ResourceEntity, RevisionRecord } from '../types/plm';

type CardEntity = ResourceEntity & { notes?: string; requirements?: string };

export type CardExportInput = {
  entity: CardEntity;
  history: RevisionRecord[];
  documents: Document[];
  vendors: { name: string; kind?: string }[];
  integrators: { name: string; description?: string }[];
  children: { name: string; type: string }[];
  referenceImages?: { slot: string; name?: string; caption?: string }[];
};

function slug(s: string): string {
  return (
    (s || 'card')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'card'
  );
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function rtfEscape(s: string): string {
  return (s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r\n|\r|\n/g, '\\par ')
    .replace(/[^\x00-\x7F]/g, (ch) => {
      const code = ch.charCodeAt(0);
      return `\\u${code}?`;
    });
}

function heading(text: string): string {
  return `\\par\\b\\fs28 ${rtfEscape(text)}\\b0\\fs22\\par `;
}

function body(text?: string): string {
  const raw = (text || '').trim();
  if (!raw) return 'None\\par ';
  return `${rtfEscape(raw)}\\par `;
}

function bullets(items: string[]): string {
  if (!items.length) return 'None\\par ';
  return items.map((item) => `\\bullet\\tab ${rtfEscape(item)}\\par `).join('');
}

function cardToRtf(input: CardExportInput): string {
  const e = input.entity;
  const identity = [
    `Type: ${e.type}${e.kind ? ` · ${e.kind}` : ''}`,
    `Status: ${e.status}`,
    `Revision: ${e.revision || 'Unversioned'}`,
    e.classification ? `Classification: ${e.classification}` : '',
    `ID: ${e.id}`,
    e.parentId ? `Parent: ${e.parentId}` : '',
    e.modifiedBy ? `Modified by: ${e.modifiedBy}` : '',
    e.lastModified ? `Last modified: ${e.lastModified}` : '',
  ].filter(Boolean);

  const images = (input.referenceImages || []).map((img) => {
    const name = img.name || img.slot;
    return img.caption ? `${img.slot}: ${name} — ${img.caption}` : `${img.slot}: ${name}`;
  });

  const history = input.history.length
    ? input.history.map(
        (r) =>
          `Rev ${r.revision} · ${r.status} · ${r.changedAt}${r.changedBy ? ` · ${r.changedBy}` : ''}${
            r.comment ? ` — ${r.comment}` : ''
          }`
      )
    : [];

  return [
    '{\\rtf1\\ansi\\deff0',
    '{\\fonttbl{\\f0 Calibri;}}',
    '\\f0\\fs22',
    `\\b\\fs36 ${rtfEscape(e.name || 'Untitled')}\\b0\\fs22\\par `,
    ...identity.map((line) => `${rtfEscape(line)}\\par `),
    heading('Description'),
    body(e.description),
    heading('Notes'),
    body(e.notes),
    heading('Requirements'),
    body(e.requirements),
    heading('Reference images'),
    bullets(images),
    heading('Tags'),
    bullets(e.tags || []),
    heading('Constituents'),
    bullets(input.children.map((c) => `${c.name} (${c.type})`)),
    heading('Vertical Integrators'),
    bullets(input.integrators.map((c) => (c.description ? `${c.name} — ${c.description}` : c.name))),
    heading('Vendors'),
    bullets(input.vendors.map((v) => (v.kind ? `${v.name} (${v.kind})` : v.name))),
    heading('Attachments'),
    bullets(input.documents.map((d) => `${d.name}${d.kind ? ` · ${d.kind}` : ''}`)),
    heading('Revision history'),
    history.length ? bullets(history) : 'No formal versions yet.\\par ',
    '}',
  ].join('');
}

export function exportCardWord(input: CardExportInput): void {
  const name = `vector-card-${slug(input.entity.name)}.doc`;
  const rtf = cardToRtf(input);
  downloadBlob(name, new Blob([rtf], { type: 'application/rtf' }));
}
