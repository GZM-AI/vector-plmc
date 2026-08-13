export type RunResearchInput = {
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

function buildSystemPrompt(kind: string, entity: RunResearchInput['entityContext']) {
  const entityBlock = entity
    ? `\nRegistry context:\n- ${entity.type}: ${entity.name} (${entity.id})\n- ${entity.description || 'No description'}\n- Tags: ${(entity.tags || []).join(', ') || 'none'}\n`
    : '';

  return [
    'You are a research assistant for Advanced Weapons Systems Vector PLM (TAR™ platform development).',
    'Be concrete, structured, and source-aware when possible. Use bullet points.',
    'Flag uncertainty. Do not invent part numbers or prices as facts.',
    `Research focus: ${kind}.`,
    'Respect ITAR/CUI: avoid requesting or elaborating controlled technical data the user did not provide.',
    entityBlock,
  ].join('\n');
}

export async function runResearch(input: RunResearchInput): Promise<string> {
  const system = buildSystemPrompt(input.kind, input.entityContext);
  const user = input.query.trim();

  if (input.provider === 'grok') {
    return callGrok(input.modelId, system, user);
  }
  return callClaude(input.modelId, system, user);
}

async function callGrok(model: string, system: string, user: string): Promise<string> {
  const key = import.meta.env.VITE_XAI_API_KEY as string | undefined;
  if (!key) {
    throw new Error('Missing VITE_XAI_API_KEY in .env.local');
  }

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok API ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Grok returned empty content');
  return typeof content === 'string' ? content : JSON.stringify(content);
}

async function callClaude(model: string, system: string, user: string): Promise<string> {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (!key) {
    throw new Error('Missing VITE_ANTHROPIC_API_KEY in .env.local');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // Browser calls may still fail CORS; prefer a backend proxy in production
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = await res.json();
  const parts = data?.content || [];
  const text = parts
    .filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join('\n');
  if (!text) throw new Error('Claude returned empty content');
  return text;
}