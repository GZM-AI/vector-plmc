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
