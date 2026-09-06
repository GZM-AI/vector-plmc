import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Box,
  Crosshair,
  Sparkles,
  Building2,
  Package,
  DollarSign,
  Factory,
  MessageSquare,
  AlertTriangle,
  Bookmark,
  Trash2,
} from 'lucide-react';
import { TAR_TREE, ALL_ENTITIES, ResourceEntity } from '../data/tarSeedData';
import {
  ResearchProvider,
  modelsForProvider,
  RESEARCH_MODELS,
} from '../lib/researchModels';
import { runResearch } from '../lib/runResearch';
import {
  getResearchRuns,
  getResearchStoreError,
  saveResearchRun,
  deleteResearchRun,
  subscribeResearchStore,
  hydrateResearchStoreFromCloud,
  type ResearchRun,
} from '../lib/researchStore';

type ResearchKind = 'company' | 'product' | 'cost' | 'manufacturing' | 'open';

const KIND_META: Record<
  ResearchKind,
  { label: string; icon: React.ReactNode; hint: string }
> = {
  company: {
    label: 'Company',
    icon: <Building2 size={14} />,
    hint: 'Vendors, OEMs, design houses, competitive landscape',
  },
  product: {
    label: 'Product',
    icon: <Package size={14} />,
    hint: 'COTS parts, modules, comparable products',
  },
  cost: {
    label: 'Cost',
    icon: <DollarSign size={14} />,
    hint: 'Ballpark unit cost, NRE, tooling, volume bands',
  },
  manufacturing: {
    label: 'Manufacturing',
    icon: <Factory size={14} />,
    hint: 'Processes, materials, tolerances, make-vs-buy',
  },
  open: {
    label: 'Open',
    icon: <MessageSquare size={14} />,
    hint: 'Free-form research prompt',
  },
};

const DeepResearch: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [provider, setProvider] = useState<ResearchProvider>('grok');
  const [modelId, setModelId] = useState(modelsForProvider('grok')[0]?.id || 'grok-4.5');
  const [kind, setKind] = useState<ResearchKind>('company');
  const [entityId, setEntityId] = useState('');
  const [query, setQuery] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [runsTick, setRunsTick] = useState(0);
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const providerModels = useMemo(() => modelsForProvider(provider), [provider]);
  const runs = useMemo(() => getResearchRuns(), [runsTick]);
  const storeError = getResearchStoreError();

  useEffect(() => {
    const unsub = subscribeResearchStore(() => setRunsTick((t) => t + 1));
    void hydrateResearchStoreFromCloud();
    return unsub;
  }, []);

  useEffect(() => {
    const first = modelsForProvider(provider)[0];
    if (first) setModelId(first.id);
  }, [provider]);

  const subsystems = useMemo(
    () => (TAR_TREE.children || []).filter((c) => c.type === 'Subsystem'),
    []
  );

  const entityOptions: ResourceEntity[] = useMemo(() => {
    const list: ResourceEntity[] = [TAR_TREE, ...subsystems];
    subsystems.forEach((s) => {
      (s.children || []).forEach((ch) => list.push(ch));
    });
    return list;
  }, [subsystems]);

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;
    if (ALL_ENTITIES.some((e) => e.id === id)) setEntityId(id);
  }, [searchParams]);

  const selectedEntity = entityId
    ? ALL_ENTITIES.find((e) => e.id === entityId) || null
    : null;

  const activeModelLabel =
    RESEARCH_MODELS.find((m) => m.id === modelId)?.label || modelId;

  const handleRun = async () => {
    if (!query.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setSaveMsg(null);
    setOpenRunId(null);
    try {
      const text = await runResearch({
        modelId,
        provider,
        kind: KIND_META[kind].label,
        query: query.trim(),
        entityContext: selectedEntity
          ? {
              id: selectedEntity.id,
              name: selectedEntity.name,
              type: selectedEntity.type,
              description: selectedEntity.description,
              tags: selectedEntity.tags,
            }
          : null,
      });
      setResult(text);
      setSaveTitle(query.trim().slice(0, 120));
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setRunning(false);
    }
  };

  const handleSave = async () => {
    if (!result || !query.trim()) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const run = await saveResearchRun({
        title: saveTitle || query.trim(),
        query: query.trim(),
        resultText: result,
        kind: KIND_META[kind].label,
        kindId: kind,
        provider,
        modelId,
        modelLabel: activeModelLabel,
        entityId: selectedEntity?.id,
        entityName: selectedEntity?.name,
        entityType: selectedEntity?.type,
      });
      setOpenRunId(run.id);
      setSaveMsg(storeError || 'Saved. Tagged with model, type, and Registry context.');
    } catch (e: any) {
      setSaveMsg(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const openRun = (run: ResearchRun) => {
    setOpenRunId(run.id);
    setQuery(run.query);
    setResult(run.resultText);
    setSaveTitle(run.title);
    setProvider(run.provider);
    setModelId(run.modelId);
    if (['company', 'product', 'cost', 'manufacturing', 'open'].includes(run.kindId)) {
      setKind(run.kindId);
    }
    setEntityId(run.entityId || '');
    setError(null);
    setSaveMsg(`Opened “${run.title}”`);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto bg-zinc-950 text-white min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Search className="text-blue-400" /> Deep Research
          </h1>
          <p className="text-zinc-400 mt-2">
            Same proxy as PID · Grok · Claude (Bedrock) · Registry context · Saved runs
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/system-registry"
            className="px-4 py-2 rounded-xl text-sm bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-blue-500 flex items-center gap-2"
          >
            <Box size={16} /> System Registry
          </Link>
          <Link
            to="/suppliers"
            className="px-4 py-2 rounded-xl text-sm bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-blue-500"
          >
            Suppliers
          </Link>
          <Link
            to="/system-architecture"
            className="px-4 py-2 rounded-xl text-sm bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-blue-500 flex items-center gap-2"
          >
            <Crosshair size={16} /> Architecture
          </Link>
        </div>
      </div>

      <div className="mb-6 px-4 py-3 rounded-2xl bg-blue-950/30 border border-blue-900/40 text-blue-200 text-sm flex gap-3 items-start">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <div>
          Calls the <strong>same Lambda</strong> as PID Design Lab (
          <code className="text-blue-100">bedrockChat</code> /{' '}
          <code className="text-blue-100">grokChat</code>). Vendor API keys stay on the server.
          Saved runs keep model, research type, and Registry context. Until{' '}
          <code className="text-blue-100">ResearchRecord</code> is deployed on Amplify, the
          library lives in this browser cache and uploads when the model exists.
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 space-y-5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-blue-400 flex items-center gap-2">
              <Sparkles size={14} /> Provider
            </h3>
            <div className="flex bg-zinc-950 border border-zinc-700 rounded-2xl p-1">
              {(
                [
                  { id: 'grok' as const, label: 'Grok' },
                  { id: 'claude' as const, label: 'Claude' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setProvider(m.id)}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm ${
                    provider === m.id ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <h3 className="text-sm font-medium text-blue-400 pt-1">Model</h3>
            <div className="space-y-2">
              {providerModels.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModelId(m.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm ${
                    modelId === m.id
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  <div className="font-medium">{m.label}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{m.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-blue-400">Research type</h3>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(KIND_META) as ResearchKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`text-left px-3 py-2.5 rounded-xl border text-sm flex items-center gap-2 ${
                    kind === k
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {KIND_META[k].icon}
                  <span className="flex-1">{KIND_META[k].label}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500">{KIND_META[kind].hint}</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-blue-400">Registry context (optional)</h3>
            <select
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">None — general research</option>
              {entityOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.type}: {e.name}
                </option>
              ))}
            </select>
            {selectedEntity && (
              <p className="text-xs text-zinc-500 line-clamp-3">
                {selectedEntity.description || selectedEntity.id}
              </p>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-blue-400 flex items-center gap-2">
              <Bookmark size={14} /> Saved runs
              <span className="text-[10px] text-zinc-500 font-normal ml-auto">
                {runs.length}
              </span>
            </h3>
            {runs.length === 0 && (
              <p className="text-xs text-zinc-600">
                After a run, use Save this run. Each card stores model, type, and Registry
                context.
              </p>
            )}
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className={`rounded-2xl border px-3 py-2.5 ${
                    openRunId === run.id
                      ? 'border-blue-500 bg-blue-600/15'
                      : 'border-zinc-800 bg-zinc-950'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openRun(run)}
                    className="w-full text-left"
                  >
                    <div className="text-sm text-zinc-200 truncate">{run.title}</div>
                    <div className="text-[10px] text-zinc-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                      <span>{run.modelLabel}</span>
                      <span>· {run.kind}</span>
                      <span>
                        · {run.entityName ? run.entityName : 'No Registry context'}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">
                      {new Date(run.createdAt).toLocaleString()}
                      {run.createdBy ? ` · ${run.createdBy}` : ''}
                    </div>
                  </button>
                  <button
                    type="button"
                    title="Delete saved run"
                    onClick={() => {
                      if (window.confirm(`Delete “${run.title}”?`)) {
                        void deleteResearchRun(run.id);
                        if (openRunId === run.id) setOpenRunId(null);
                      }
                    }}
                    className="mt-2 text-[11px] text-zinc-600 hover:text-red-300 inline-flex items-center gap-1"
                  >
                    <Trash2 size={11} /> Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-8 space-y-5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-blue-400">Query</h3>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={5}
              placeholder="Describe what you need researched…"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 resize-y min-h-[120px]"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleRun}
                disabled={running || !query.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Sparkles size={16} />
                {running ? 'Running…' : 'Run research'}
              </button>
              <span className="text-xs text-zinc-500">
                {activeModelLabel} · {KIND_META[kind].label}
                {selectedEntity ? ` · ${selectedEntity.name}` : ' · No Registry context'}
              </span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 min-h-[280px]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-medium text-blue-400">Output</h3>
              {result && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    placeholder="Title for this run"
                    className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs w-56 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 inline-flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Bookmark size={12} />
                    {saving ? 'Saving…' : 'Save this run'}
                  </button>
                </div>
              )}
            </div>
            {saveMsg && (
              <div className="mb-3 text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-900/40 rounded-xl px-3 py-2">
                {saveMsg}
              </div>
            )}
            {error && (
              <div className="mb-4 text-sm text-red-300 bg-red-950/40 border border-red-900/50 rounded-2xl px-4 py-3 whitespace-pre-wrap">
                {error}
              </div>
            )}
            {!result && !running && !error && (
              <p className="text-zinc-500 text-sm">
                Results appear here after Run. Save keeps the answer plus model, type, and
                Registry context.
              </p>
            )}
            {running && (
              <p className="text-zinc-400 text-sm animate-pulse">
                Calling {activeModelLabel} via research proxy…
              </p>
            )}
            {result && (
              <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                {result}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeepResearch;
