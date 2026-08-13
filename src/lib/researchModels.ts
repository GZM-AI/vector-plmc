export type ResearchProvider = 'grok' | 'claude';

export type ResearchModelOption = {
  id: string;
  provider: ResearchProvider;
  /** Value sent to the Lambda (Grok model id or Bedrock modelKey) */
  apiModel: string;
  label: string;
  description: string;
};

export const RESEARCH_MODELS: ResearchModelOption[] = [
  {
    id: 'grok-4.5',
    provider: 'grok',
    apiModel: 'grok-4.5',
    label: 'Grok 4.5',
    description: 'Via PID research proxy (xAI)',
  },
  {
    id: 'claude-opus',
    provider: 'claude',
    apiModel: 'claude-opus',
    label: 'Claude Opus 4.1',
    description: 'Via PID research proxy (AWS Bedrock)',
  },
  {
    id: 'claude-sonnet',
    provider: 'claude',
    apiModel: 'claude-sonnet',
    label: 'Claude Sonnet 4',
    description: 'Via PID research proxy (AWS Bedrock)',
  },
];

export function modelsForProvider(provider: ResearchProvider) {
  return RESEARCH_MODELS.filter((m) => m.provider === provider);
}