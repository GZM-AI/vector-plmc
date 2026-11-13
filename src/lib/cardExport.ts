/**
 * Export one System Registry card as a Word-compatible RTF document.
 * Preserves the same markup the card renders: bold, italic, underline,
 * headings, bullet lists, and numbered lists.
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
  referenceImages?: { slot: string; name?: string; caption?: string; dataUrl?: string }[];
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
    .replace(/[^\x00-\x7F]/g, (ch) => `\\u${ch.charCodeAt(0)}?`);
}

/** Convert card inline markup to RTF. Supports **bold**, *italic*, ++underline++, `code`, and [text](url). */
function inlineToRtf(src: string): string {
  let s = src || '';
  s = s.replace(/\*\*<u>\*\*([\s\S]+?)\*\*<\/u>\*\*/gi, '**++$1++**');
  s = s.replace(/<u>\*\*([\s\S]+?)\*\*<\/u>/gi, '**++$1++**');
  s = s.replace(/\*\*<u>([\s\S]+?)<\/u>\*\*/gi, '**++$1++**');
  s = s.replace(/<u>([\s\S]+?)<\/u>/gi, '++$1++');
  s = s.replace(/<\/?u>/gi, '');

  const specs: { kind: string; re: RegExp }[] = [
    { kind: 'u', re: /\+\+([\s\S]+?)\+\+/ },
    { kind: 'b', re: /\*\*([\s\S]+?)\*\*/ },
    { kind: 'b', re: /__([\s\S]+?)__/ },
    { kind: 'i', re: /\*([^*\n]+)\*/ },
    { kind: 'c', re: /`([^`]+)`/ },
    { kind: 'a', re: /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/ },
  ];

  function walk(text: string): string {
    let best: { index: number; len: number; kind: string; inner: string; href?: string } | null = null;
    for (const spec of specs) {
      const m = spec.re.exec(text);
      if (!m) continue;
      if (!best || m.index < best.index) {
        best = { index: m.index, len: m[0].length, kind: spec.kind, inner: m[1], href: m[2] };
      }
    }
    if (!best) return rtfEscape(text);
    const before = text.slice(0, best.index);
    const after = text.slice(best.index + best.len);
    const inner = walk(best.inner);
    let mid = inner;
    if (best.kind === 'b') mid = `\\b ${inner}\\b0 `;
    else if (best.kind === 'i') mid = `\\i ${inner}\\i0 `;
    else if (best.kind === 'u') mid = `\\ul ${inner}\\ul0 `;
    else if (best.kind === 'c') mid = `{\\f1 ${rtfEscape(best.inner)}}`;
    else if (best.kind === 'a') mid = `{\\ul\\cf1 ${rtfEscape(best.inner)}}`;
    return walk(before) + mid + walk(after);
  }

  return walk(s);
}

function heading(text: string): string {
  return `\\par\\pard\\sa120\\sb200\\b\\fs28 ${rtfEscape(text)}\\b0\\fs22\\par `;
}

function paragraph(text: string): string {
  const line = (text || '').trim();
  if (!line) return '\\par ';
  return `\\pard\\sa60 ${inlineToRtf(line)}\\par `;
}

function markdownBlock(src?: string): string {
  const raw = (src || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return '\\pard\\sa60 None\\par ';
  const lines = raw.split('\n');
  const out: string[] = [];
  let bullets: string[] = [];
  let numbers: string[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    bullets.forEach((item) => {
      out.push(`\\pard\\li360\\fi-180\\sa40 \\bullet\\tab ${inlineToRtf(item)}\\par `);
    });
    bullets = [];
  };
  const flushNumbers = () => {
    if (!numbers.length) return;
    numbers.forEach((item, i) => {
      out.push(`\\pard\\li360\\fi-180\\sa40 ${i + 1}.\\tab ${inlineToRtf(item)}\\par `);
    });
    numbers = [];
  };

  for (const line of lines) {
    const h1 = /^#\s+(.*)/.exec(line);
    const h2 = /^##\s+(.*)/.exec(line);
    const h3 = /^###\s+(.*)/.exec(line);
    const bullet = /^[-*]\s+(.*)/.exec(line);
    const numbered = /^\d+\.\s+(.*)/.exec(line);
    if (h1) {
      flushBullets();
      flushNumbers();
      out.push(`\\par\\pard\\sa80\\sb160\\b\\fs32 ${inlineToRtf(h1[1])}\\b0\\fs22\\par `);
    } else if (h2) {
      flushBullets();
      flushNumbers();
      out.push(`\\par\\pard\\sa60\\sb120\\b\\fs28 ${inlineToRtf(h2[1])}\\b0\\fs22\\par `);
    } else if (h3) {
      flushBullets();
      flushNumbers();
      out.push(`\\par\\pard\\sa40\\sb80\\b\\fs24 ${inlineToRtf(h3[1])}\\b0\\fs22\\par `);
    } else if (bullet) {
      flushNumbers();
      bullets.push(bullet[1]);
    } else if (numbered) {
      flushBullets();
      numbers.push(numbered[1]);
    } else {
      flushBullets();
      flushNumbers();
      out.push(paragraph(line));
    }
  }
  flushBullets();
  flushNumbers();
  return out.join('');
}


function imageBlock(dataUrl?: string, caption?: string, fallback?: string): string {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return `\\pard\\sa60 ${rtfEscape(fallback || 'Image unavailable')}\\par `;
  }
  const comma = dataUrl.indexOf(',');
  const meta = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
  const isPng = /png/i.test(meta);
  const isJpeg = /jpe?g/i.test(meta);
  if (!b64 || (!isPng && !isJpeg)) {
    return `\\pard\\sa60 ${rtfEscape(fallback || 'Image unavailable')}\\par `;
  }
  let binary = '';
  try {
    binary = atob(b64);
  } catch {
    return `\\pard\\sa60 ${rtfEscape(fallback || 'Image unavailable')}\\par `;
  }
  let hex = '';
  for (let i = 0; i < binary.length; i++) hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
  const blip = isPng ? '\\pngblip' : '\\jpegblip';
  const pict = `{\\pict${blip}\\picwgoal5400\\pichgoal3600 ${hex}}`;
  const cap = caption ? `\\pard\\sa120\\qc\\i ${rtfEscape(caption)}\\i0\\par ` : '\\par ';
  return `\\pard\\qc ${pict}\\par ${cap}`;
}

function plainList(items: string[]): string {
  if (!items.length) return '\\pard\\sa60 None\\par ';
  return items.map((item) => `\\pard\\li360\\fi-180\\sa40 \\bullet\\tab ${rtfEscape(item)}\\par `).join('');
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

  const images = input.referenceImages || [];

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
    '{\\fonttbl{\\f0 Calibri;}{\\f1 Consolas;}}',
    '{\\colortbl;\\red37\\green99\\blue235;}',
    '\\f0\\fs22\\sa60',
    `\\pard\\sa120\\b\\fs40 ${rtfEscape(e.name || 'Untitled')}\\b0\\fs22\\par `,
    ...identity.map((line) => `\\pard\\sa20 ${rtfEscape(line)}\\par `),
    heading('Description'),
    markdownBlock(e.description),
    heading('Notes'),
    markdownBlock(e.notes),
    heading('Requirements'),
    markdownBlock(e.requirements),
    heading('Reference images'),
    images.length
      ? images.map((img) => imageBlock(img.dataUrl, img.caption, img.name || img.slot)).join('')
      : '\\pard\\sa60 None\\par ',
    heading('Tags'),
    plainList(e.tags || []),
    heading('Constituents'),
    plainList(input.children.map((c) => `${c.name} (${c.type})`)),
    heading('Vertical Integrators'),
    plainList(input.integrators.map((c) => (c.description ? `${c.name} — ${c.description}` : c.name))),
    heading('Vendors'),
    plainList(input.vendors.map((v) => (v.kind ? `${v.name} (${v.kind})` : v.name))),
    heading('Attachments'),
    plainList(input.documents.map((d) => `${d.name}${d.kind ? ` · ${d.kind}` : ''}`)),
    heading('Revision history'),
    history.length ? plainList(history) : '\\pard\\sa60 No formal versions yet.\\par ',
    '}',
  ].join('');
}

export function exportCardWord(input: CardExportInput): void {
  const name = `vector-card-${slug(input.entity.name)}.doc`;
  downloadBlob(name, new Blob([cardToRtf(input)], { type: 'application/rtf' }));
}
