/**
 * Deep Research — same pattern as PID Design Lab
 * Claude → Lambda action "bedrockChat" (AWS Bedrock)
 * Grok   → Lambda action "grokChat"
 * Keys stay on the Lambda; browser only calls FUNCTION_URL.
 */

export type RunResearchInput = {
  /** Research model option id from researchModels.ts */
  modelId: string;
  provider: 'grok' | 'claude';
  kind: string;
  query: string;
  entityContext?: {
    id: string;
    name: string;
    type: string;
    description?: string;
    tags?: string[];
  } | null;
};

/** Same Function URL as PID DesignLab.tsx */
const FUNCTION_URL =
  (import.meta.env.VITE_RESEARCH_FUNCTION_URL as string | undefined) ||
  'https://s3ffjht3dmkdohvyj26dd4iaeq0ikawh.lambda-url.us-west-2.on.aws/';

async function callFunction(payload: Record<string, any>) {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error || `Function error ${response.status}`);
  }
  return data;
}

function buildSystemPrompt(kind: string, entity: RunResearchInput['entityContext']) {
  const entityBlock = entity
    ? `\nRegistry context:\n- ${entity.type}: ${entity.name} (${entity.id})\n- ${entity.description || 'No description'}\n- Tags: ${(entity.tags || []).join(', ') || 'none'}\n`
    : '';

  return [
    'You are a research assistant for Advanced Weapons Systems Vector PLM (TAR platform development).',
    'Be concrete, structured, and source-aware when possible. Use bullet points and clear headings.',
    'Flag uncertainty. Do not invent part numbers or prices as facts.',
    `Research focus: ${kind}.`,
    'Respect ITAR/CUI: avoid requesting or elaborating controlled technical data the user did not provide.',
    entityBlock,
  ].join('\n');
}

function resolveApiModel(modelId: string, provider: 'grok' | 'claude'): string {
  if (provider === 'grok') {
    if (modelId === 'grok-4' || modelId === 'grok-3' || modelId === 'grok-3-mini') {
      return 'grok-4.5';
    }
    return modelId || 'grok-4.5';
  }
  // Bedrock modelKey values used by PID
  if (modelId.includes('opus')) return 'claude-opus';
  if (modelId.includes('haiku')) return 'claude-sonnet'; // proxy may not expose haiku; use sonnet
  if (modelId.includes('sonnet')) return 'claude-sonnet';
  return modelId === 'claude-opus' || modelId === 'claude-sonnet' ? modelId : 'claude-sonnet';
}

export async function runResearch(input: RunResearchInput): Promise<string> {
  const system = buildSystemPrompt(input.kind, input.entityContext);
  const user = input.query.trim();
  if (!user) throw new Error('Query is empty');

  const apiModel = resolveApiModel(input.modelId, input.provider);

  if (input.provider === 'grok') {
    const data = await callFunction({
      action: 'grokChat',
      model: apiModel,
      temperature: 0.3,
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const text = data.text || data.content || '';
    if (!text) throw new Error('Grok proxy returned empty text');
    return typeof text === 'string' ? text : JSON.stringify(text);
  }

  // Claude via Bedrock — same action as PID Design Lab
  const data = await callFunction({
    action: 'bedrockChat',
    modelKey: apiModel, // "claude-opus" | "claude-sonnet"
    prompt: `${system}\n\n---\n\nUser query:\n${user}`,
    max_tokens: 4000,
    temperature: 0.2,
  });
  const text = data.text || data.content || '';
  if (!text) throw new Error('Bedrock proxy returned empty text');
  return typeof text === 'string' ? text : JSON.stringify(text);
}