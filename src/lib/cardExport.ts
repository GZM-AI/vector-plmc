/**
 * Export one System Registry card as Word.
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

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

function p(text: string, opts?: { bold?: boolean; size?: number }): string {
  const rPr =
    opts?.bold || opts?.size
      ? `<w:rPr>${opts.bold ? '<w:b/>' : ''}${opts.size ? `<w:sz w:val="${opts.size}"/>` : ''}</w:rPr>`
      : '';
  return `<w:p><w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

function heading(text: string): string {
  return p(text, { bold: true, size: 28 });
}

function bodyLines(text?: string): string {
  const raw = (text || '').trim();
  if (!raw) return p('None');
  return raw
    .split(/\r?\n/)
    .map((line) => p(line || ' '))
    .join('');
}

function bulletList(items: string[]): string {
  if (!items.length) return p('None');
  return items.map((item) => p(`• ${item}`)).join('');
}

function cardBody(input: CardExportInput): string {
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

  return [
    p(e.name || 'Untitled', { bold: true, size: 36 }),
    ...identity.map((line) => p(line)),
    heading('Description'),
    bodyLines(e.description),
    heading('Notes'),
    bodyLines(e.notes),
    heading('Requirements'),
    bodyLines(e.requirements),
    heading('Reference images'),
    bulletList(images),
    heading('Tags'),
    bulletList(e.tags || []),
    heading('Constituents'),
    bulletList(input.children.map((c) => `${c.name} (${c.type})`)),
    heading('Vertical Integrators'),
    bulletList(input.integrators.map((c) => (c.description ? `${c.name} — ${c.description}` : c.name))),
    heading('Vendors'),
    bulletList(input.vendors.map((v) => (v.kind ? `${v.name} (${v.kind})` : v.name))),
    heading('Attachments'),
    bulletList(input.documents.map((d) => `${d.name}${d.kind ? ` · ${d.kind}` : ''}`)),
    heading('Revision history'),
    input.history.length
      ? input.history
          .map(
            (r) =>
              p(
                `Rev ${r.revision} · ${r.status} · ${r.changedAt}${r.changedBy ? ` · ${r.changedBy}` : ''}${
                  r.comment ? ` — ${r.comment}` : ''
                }`
              )
          )
          .join('')
      : p('No formal versions yet.'),
  ].join('');
}

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(files: { path: string; content: string }[]): Blob {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const u16 = (n: number) => {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  };
  const u32 = (n: number) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return b;
  };
  const concat = (parts: Uint8Array[]) => {
    const len = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const part of parts) {
      out.set(part, o);
      o += part.length;
    }
    return out;
  };
  for (const f of files) {
    const name = enc.encode(f.path);
    const data = enc.encode(f.content);
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ]);
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralDir = concat(centrals);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);
  return new Blob([concat([...locals, centralDir, end])], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

function buildDocx(input: CardExportInput): Blob {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${cardBody(input)}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  return zipStore([
    { path: '[Content_Types].xml', content: contentTypes },
    { path: '_rels/.rels', content: rels },
    { path: 'word/document.xml', content: documentXml },
    { path: 'word/_rels/document.xml.rels', content: docRels },
  ]);
}

export function exportCardWord(input: CardExportInput): void {
  const name = `vector-card-${slug(input.entity.name)}.docx`;
  downloadBlob(name, buildDocx(input));
}
