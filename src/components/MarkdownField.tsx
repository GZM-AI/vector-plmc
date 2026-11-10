import React, { useRef } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Heading2, Link2, Code } from 'lucide-react';

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\+\+(.+?)\+\+|<u>(.+?)<\/u>|(\*\*|__)(.+?)\3|(\*|_)(.+?)\5|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] || m[2]) parts.push(<u key={`${keyPrefix}-u-${i}`} className="underline">{m[1] || m[2]}</u>);
    else if (m[4]) parts.push(<strong key={`${keyPrefix}-b-${i}`}>{m[4]}</strong>);
    else if (m[6]) parts.push(<em key={`${keyPrefix}-i-${i}`}>{m[6]}</em>);
    else if (m[7]) parts.push(<code key={`${keyPrefix}-c-${i}`} className="px-1 py-0.5 rounded bg-zinc-900 text-zinc-200 text-[0.9em]">{m[7]}</code>);
    else if (m[8] && m[9]) parts.push(<a key={`${keyPrefix}-a-${i}`} href={m[9]} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">{m[8]}</a>);
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MarkdownView({ source }: { source: string }) {
  const lines = (source || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i += 1;
      }
      blocks.push(
        <pre key={key++} className="my-2 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 overflow-x-auto">
          <code>{buf.join('\n')}</code>
        </pre>
      );
      i += 1;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const cls = level === 1 ? 'text-base font-semibold text-zinc-100 mt-3 mb-1' : level === 2 ? 'text-sm font-semibold text-zinc-100 mt-3 mb-1' : 'text-sm font-medium text-zinc-200 mt-2 mb-1';
      blocks.push(<div key={key++} className={cls}>{renderInline(h[2], `h${key}`)}</div>);
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 my-1 space-y-0.5">
          {items.map((item, idx) => <li key={idx}>{renderInline(item, `ul${key}-${idx}`)}</li>)}
        </ul>
      );
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={key++} className="list-decimal pl-5 my-1 space-y-0.5">
          {items.map((item, idx) => <li key={idx}>{renderInline(item, `ol${key}-${idx}`)}</li>)}
        </ol>
      );
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const para: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(<p key={key++} className="my-1">{renderInline(para.join(' '), `p${key}`)}</p>);
  }
  return <div className="text-zinc-300 leading-relaxed text-sm break-words">{blocks}</div>;
}

function applyWrap(value: string, start: number, end: number, before: string, after: string): { value: string; sel: number } {
  const selected = value.slice(start, end) || 'text';
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  return { value: next, sel: start + before.length + selected.length + after.length };
}

function applyLinePrefix(value: string, start: number, end: number, prefix: string): { value: string; sel: number } {
  const from = value.lastIndexOf('\n', start - 1) + 1;
  const block = value.slice(from, end);
  const lines = block.split('\n');
  const nextBlock = lines.map((l) => (l.startsWith(prefix) ? l : prefix + l)).join('\n');
  const next = value.slice(0, from) + nextBlock + value.slice(end);
  return { value: next, sel: from + nextBlock.length };
}

export function MarkdownField({
  value,
  onChange,
  rows,
  minHeight,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows: number;
  minHeight: string;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const run = (fn: (v: string, s: number, e: number) => { value: string; sel: number }) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const result = fn(value, start, end);
    onChange(result.value);
    requestAnimationFrame(() => {
      if (!ref.current) return;
      ref.current.focus();
      ref.current.setSelectionRange(result.sel, result.sel);
    });
  };
  const btn = 'p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800';
  return (
    <div className="rounded-2xl border border-zinc-600 bg-zinc-950 overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-zinc-800 bg-zinc-900/60">
        <button type="button" title="Bold" className={btn} onClick={() => run((v, s, e) => applyWrap(v, s, e, '**', '**'))}><Bold size={14} /></button>
        <button type="button" title="Italic" className={btn} onClick={() => run((v, s, e) => applyWrap(v, s, e, '*', '*'))}><Italic size={14} /></button>
        <button type="button" title="Underline" className={btn} onClick={() => run((v, s, e) => applyWrap(v, s, e, '++', '++'))}><Underline size={14} /></button>
        <span className="w-px h-4 bg-zinc-700 mx-1" />
        <button type="button" title="Heading" className={btn} onClick={() => run((v, s, e) => applyLinePrefix(v, s, e, '## '))}><Heading2 size={14} /></button>
        <button type="button" title="Bullet list" className={btn} onClick={() => run((v, s, e) => applyLinePrefix(v, s, e, '- '))}><List size={14} /></button>
        <button type="button" title="Numbered list" className={btn} onClick={() => run((v, s, e) => applyLinePrefix(v, s, e, '1. '))}><ListOrdered size={14} /></button>
        <span className="w-px h-4 bg-zinc-700 mx-1" />
        <button type="button" title="Link" className={btn} onClick={() => run((v, s, e) => applyWrap(v, s, e, '[', '](https://)'))}><Link2 size={14} /></button>
        <button type="button" title="Code" className={btn} onClick={() => run((v, s, e) => applyWrap(v, s, e, '`', '`'))}><Code size={14} /></button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={`w-full bg-transparent px-4 py-3 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap focus:outline-none resize-y ${minHeight}`}
      />
    </div>
  );
}
