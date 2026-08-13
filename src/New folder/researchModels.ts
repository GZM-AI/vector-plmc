export type ResearchProvider = 'grok' | 'claude';

export type ResearchModelOption = {
  id: string;
  provider: ResearchProvider;
  label: string;
  description: string;
};

/** Catalog — adjust ids to match what your PID / accounts support */
export const RESEARCH_MODELS: ResearchModelOption[] = [
  // xAI Grok
  {
    id: 'grok-4',
    provider: 'grok',
    label: 'Grok 4',
    description: 'Flagship reasoning (xAI)',
  },
  {
    id: 'grok-3',
    provider: 'grok',
    label: 'Grok 3',
    description: 'Strong general research',
  },
  {
    id: 'grok-3-mini',
    provider: 'grok',
    label: 'Grok 3 Mini',
    description: 'Faster / lighter',
  },
  // Anthropic Claude
  {
    id: 'claude-opus-4-20250514',
    provider: 'claude',
    label: 'Claude Opus 4',
    description: 'Highest capability',
  },
  {
    id: 'claude-sonnet-4-20250514',
    provider: 'claude',
    label: 'Claude Sonnet 4',
    description: 'Balanced speed / quality',
  },
  {
    id: 'claude-3-5-haiku-20241022',
    provider: 'claude',
    label: 'Claude 3.5 Haiku',
    description: 'Fast drafts',
  },
];

export function modelsForProvider(provider: ResearchProvider) {
  return RESEARCH_MODELS.filter((m) => m.provider === provider);
}