/**
 * Export Deep Research runs — Markdown, Word (.docx), PDF.
 * No extra npm packages. Runs in the browser.
 */
import type { ResearchRun } from './researchStore';

function slug(s: string): string {
  return (
    (s || 'research-run')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'research-run'
  );
}

function stamp(iso?: string): string {
  try {
    return new Date(iso || Date.now()).toISOString().slice(0, 10);
  } catch {
    return '';
  }
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

export function runToMarkdown(run: ResearchRun): string {
  const lines = [
    `# ${run.title || 'Untitled run'}`,
    '',
    `- **Kind:** ${run.kind || run.kindId}`,
    `- **Model:** ${run.modelLabel || run.modelId} (${run.provider})`,
    `- **Registry:** ${run.entityName ? `${run.entityType || ''} ${run.entityName}`.trim() : 'None'}`,
    `- **Saved:** ${run.createdAt}${run.createdBy ? ` · ${run.createdBy}` : ''}`,
    '',
    '## Query',
    '',
    run.query || '',
    '',
    '## Result',
    '',
    run.resultText || '',
    '',
  ];
  return lines.join('\n');
}

export function exportRunMarkdown(run: ResearchRun): void {
  const name = `vector-research-${slug(run.title)}-${stamp(run.createdAt)}.md`;
  downloadBlob(name, new Blob([runToMarkdown(run)], { type: 'text/markdown;charset=utf-8' }));
}

export function exportRunsMarkdown(runs: ResearchRun[]): void {
  const body = runs.map((r) => runToMarkdown(r)).join('\n\n---\n\n');
  const name = `vector-research-library-${stamp()}.md`;
  downloadBlob(name, new Blob([body], { type: 'text/markdown;charset=utf-8' }));
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function docxParagraphs(text: string): string {
  const blocks = (text || '').split(/\n/);
  if (!blocks.length) return '<w:p/>';
  return blocks
    .map((line) => {
      if (!line) return '<w:p/>';
      return `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`;
    })
    .join('');
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
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
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

export function runDocxFileName(run: ResearchRun): string {
  return `vector-research-${slug(run.title)}-${stamp(run.createdAt)}.docx`;
}

export function buildRunDocxBlob(run: ResearchRun): Blob {
  const heading = (t: string) =>
    `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${xmlEscape(t)}</w:t></w:r></w:p>`;
  const h2 = (t: string) =>
    `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>${xmlEscape(t)}</w:t></w:r></w:p>`;
  const meta = [
    `Kind: ${run.kind || run.kindId}`,
    `Model: ${run.modelLabel || run.modelId} (${run.provider})`,
    `Registry: ${run.entityName ? `${run.entityType || ''} ${run.entityName}`.trim() : 'None'}`,
    `Saved: ${run.createdAt}${run.createdBy ? ` · ${run.createdBy}` : ''}`,
  ].join('\n');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${heading(run.title || 'Untitled run')}
    ${docxParagraphs(meta)}
    ${h2('Query')}
    ${docxParagraphs(run.query || '')}
    ${h2('Result')}
    ${docxParagraphs(run.resultText || '')}
  </w:body>
</w:document>`;

  const blob = zipStore([
    {
      path: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    },
    {
      path: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    },
    { path: 'word/document.xml', content: documentXml },
  ]);

  return blob;
}

export function exportRunDocx(run: ResearchRun): void {
  downloadBlob(runDocxFileName(run), buildRunDocxBlob(run));
}

export function buildRunDocxFile(run: ResearchRun): File {
  return new File([buildRunDocxBlob(run)], runDocxFileName(run), {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLine(line: string, max = 92): string[] {
  if (line.length <= max) return [line || ' '];
  const out: string[] = [];
  let rest = line;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max);
    if (cut < 20) cut = max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

export function exportRunPdf(run: ResearchRun): void {
  const header = [
    run.title || 'Untitled run',
    '',
    `Kind: ${run.kind || run.kindId}`,
    `Model: ${run.modelLabel || run.modelId} (${run.provider})`,
    `Registry: ${run.entityName ? `${run.entityType || ''} ${run.entityName}`.trim() : 'None'}`,
    `Saved: ${run.createdAt}${run.createdBy ? ` · ${run.createdBy}` : ''}`,
    '',
    'Query',
    run.query || '',
    '',
    'Result',
    run.resultText || '',
  ];
  const lines: string[] = [];
  for (const block of header) {
    const parts = String(block).split('\n');
    for (const p of parts) lines.push(...wrapLine(p));
  }

  const pageH = 792;
  const pageW = 612;
  const top = 56;
  const lineH = 12;
  const perPage = Math.floor((pageH - 96) / lineH);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (!pages.length) pages.push([' ']);

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');

  const pageIds: number[] = [];
  const contentIds: number[] = [];
  let nextId = 3;
  for (let i = 0; i < pages.length; i++) {
    const contentId = nextId++;
    const pageId = nextId++;
    contentIds.push(contentId);
    pageIds.push(pageId);
    const cmds = [
      'BT',
      '/F1 10 Tf',
      `${lineH} TL`,
      `50 ${pageH - top} Td`,
      ...pages[i].map((ln) => `(${pdfEscape(ln)}) Tj T*`),
      'ET',
    ].join('\n');
    objects[contentId - 1] = `<< /Length ${cmds.length} >>\nstream\n${cmds}\nendstream`;
    objects[pageId - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${nextId} 0 R >> >> >>`;
  }
  const fontId = nextId++;
  objects[fontId - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>';
  objects[1] =
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    if (!objects[i]) {
      objects[i] = '<< >>';
    }
    offsets[i + 1] = pdf.length;
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;

  downloadBlob(
    `vector-research-${slug(run.title)}-${stamp(run.createdAt)}.pdf`,
    new Blob([pdf], { type: 'application/pdf' })
  );
}

export function runFromCurrent(opts: {
  title?: string;
  query: string;
  resultText: string;
  kind: string;
  kindId: ResearchRun['kindId'];
  provider: ResearchRun['provider'];
  modelId: string;
  modelLabel: string;
  entityName?: string;
  entityType?: string;
}): ResearchRun {
  return {
    id: 'current',
    title: opts.title || opts.query.slice(0, 80) || 'Untitled run',
    query: opts.query,
    resultText: opts.resultText,
    kind: opts.kind,
    kindId: opts.kindId,
    provider: opts.provider,
    modelId: opts.modelId,
    modelLabel: opts.modelLabel,
    entityName: opts.entityName,
    entityType: opts.entityType,
    createdAt: new Date().toISOString(),
    status: 'Kept',
  };
}
