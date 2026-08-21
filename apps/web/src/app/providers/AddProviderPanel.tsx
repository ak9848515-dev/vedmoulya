// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Add AI Provider Panel
// SPRINT-049 — UI for registering an AI provider in the gateway provider
// registry. The gateway `providers.registerProvider` accepts a supported
// family + a non-empty model list (metadata), and `providers.testConnection`
// performs a server-side reachability/auth probe. Per-provider endpoint
// credentials are NOT persisted by the registry and are NOT wired into the AI
// runtime at this layer — the runtime registers providers from environment
// keys (AI_*_API_KEY) via registerPlatformProviders. This panel records honest
// registry metadata aligned to the real gateway contract.
//
// SECURITY: an API key is sent to the server only for the connection test and
// never stored in localStorage, logs, or the browser bundle.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useCallback } from 'react';
import { Card, Button, Switch } from '@vedmoulya/ui';
import { Plus, X, Loader2, CheckCircle2, XCircle, Server, Key, Globe, Zap } from 'lucide-react';
import { api } from '../../lib/trpc.js';
import { useAuthStore } from '../../stores/auth-store.js';

// ── Types ──────────────────────────────────────────────────────────────────

interface CustomProviderForm {
  name: string;
  category: 'Cloud AI' | 'Local AI' | 'Enterprise AI' | 'OpenAI-compatible' | 'Custom';
  protocol: 'openai-compatible' | 'anthropic-compatible' | 'google-gemini' | 'ollama' | 'custom';
  endpointUrl: string;
  apiKey: string;
  defaultModelId: string;
  deployment: 'cloud' | 'local' | 'enterprise';
  enabled: boolean;
  primaryEligible: boolean;
}

const EMPTY_FORM: CustomProviderForm = {
  name: '',
  category: 'OpenAI-compatible',
  protocol: 'openai-compatible',
  endpointUrl: '',
  apiKey: '',
  defaultModelId: '',
  deployment: 'cloud',
  enabled: true,
  primaryEligible: false,
};

const CATEGORIES = [
  'Cloud AI',
  'Local AI',
  'Enterprise AI',
  'OpenAI-compatible',
  'Custom',
] as const;

const PROTOCOLS = [
  {
    value: 'openai-compatible',
    label: 'OpenAI-compatible',
    description: 'Uses the OpenAI Chat Completions API format',
  },
  {
    value: 'anthropic-compatible',
    label: 'Anthropic-compatible',
    description: 'Uses the Anthropic Messages API format',
  },
  {
    value: 'google-gemini',
    label: 'Google Gemini',
    description: 'Uses the Google generativelanguage API',
  },
  { value: 'ollama', label: 'Ollama (Local)', description: 'Uses the Ollama local API' },
  { value: 'custom', label: 'Custom', description: 'Custom protocol (future extension)' },
] as const;

const DEPLOYMENTS = [
  { value: 'cloud', label: 'Cloud', description: 'Hosted API endpoint' },
  { value: 'local', label: 'Local', description: 'Self-hosted / on-premise' },
  { value: 'enterprise', label: 'Enterprise', description: 'Enterprise / private deployment' },
] as const;

// The gateway `providers.registerProvider` procedure accepts a provider family
// from the registry enum (openai/anthropic/google/deepseek/openrouter/ollama/
// mock) and a non-empty model list. It does NOT accept an arbitrary custom
// family or persist per-provider endpoint credentials — so this UI maps the
// user-chosen protocol to the closest supported registry family and never
// claims a custom endpoint is wired into the AI runtime.
const PROTOCOL_TO_FAMILY: Record<string, 'openai' | 'anthropic' | 'google' | 'ollama'> = {
  'openai-compatible': 'openai',
  'anthropic-compatible': 'anthropic',
  'google-gemini': 'google',
  ollama: 'ollama',
};
const SUPPORTED_REGISTRY_PROTOCOLS = Object.keys(PROTOCOL_TO_FAMILY);

// ── Component ──────────────────────────────────────────────────────────────

export function AddProviderPanel({
  onProviderAdded,
}: {
  onProviderAdded?: () => void;
}): React.JSX.Element {
  const { user } = useAuthStore();
  const userId = user?.userId ?? '';
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<CustomProviderForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    status: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // tRPC mutations (the gateway `providers.testConnection` / `registerProvider`
  // procedures). The app never calls a nonexistent raw `api.providers.*` decorator
  // — it uses the established `useMutation()` hook pattern used across the app.
  const testConnection = api.providers.testConnection.useMutation();
  const registerProvider = api.providers.registerProvider.useMutation();

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setTestResult(null);
    setError(null);
  }, []);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    resetForm();
  }, [resetForm]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    resetForm();
  }, [resetForm]);

  const handleTest = useCallback(async () => {
    if (!form.endpointUrl || !form.apiKey) {
      setError('Endpoint URL and API key are required for connection test');
      return;
    }
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const result = await testConnection.mutateAsync({
        userId,
        endpointUrl: form.endpointUrl,
        apiKey: form.apiKey,
        protocol: form.protocol,
      });
      // Unwrap the gateway ApiResponse envelope ({ success, data, error }).
      if (!result.success) {
        const msg = (result as { error?: { message?: string } }).error?.message;
        setTestResult({
          connected: false,
          status: 'failed',
          message: msg ?? 'Connection test failed',
        });
        return;
      }
      const payload = (result.data ?? {}) as {
        connected?: boolean;
        status?: string;
        message?: string;
        testedAt?: string;
      };
      setTestResult({
        connected: Boolean(payload.connected),
        status: payload.status ?? 'unknown',
        message: payload.message ?? 'Connected',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  }, [form.endpointUrl, form.apiKey, form.protocol, userId, testConnection]);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      setError('Provider name is required');
      return;
    }
    if (!form.endpointUrl.trim()) {
      setError('Endpoint URL is required');
      return;
    }
    if (!form.defaultModelId.trim()) {
      setError('Default model ID is required — a provider must expose at least one model');
      return;
    }
    const family = PROTOCOL_TO_FAMILY[form.protocol];
    if (family === undefined) {
      setError(
        `Custom / custom-endpoint protocols are not supported by the gateway provider registry — choose one of: ${SUPPORTED_REGISTRY_PROTOCOLS.join(', ')}.`,
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const providerId = `custom-${form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
      const created = await registerProvider.mutateAsync({
        userId,
        id: providerId,
        family,
        name: form.name.trim(),
        description: `${form.category} provider via ${form.protocol}`,
        owner: userId,
        models: [
          {
            id: form.defaultModelId.trim(),
            name: form.defaultModelId.trim(),
            contextLength: 128000,
            maxOutputTokens: 4096,
            streaming: true,
            vision: false,
            functionCalling: true,
            embeddings: false,
            reasoning: true,
            coding: true,
            creativeWriting: true,
            translation: true,
            image: false,
            audio: false,
            video: false,
            modalities: ['text-in', 'text-out'],
            capabilities: ['reasoning', 'coding', 'general_conversation', 'content_generation'],
          },
        ],
        tags: ['custom', form.category.toLowerCase(), form.deployment],
      });
      if (!created.success) {
        const msg = (created as { error?: { message?: string } }).error?.message;
        throw new Error(msg ?? 'Failed to save provider');
      }
      handleClose();
      onProviderAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  }, [form, userId, registerProvider, handleClose, onProviderAdded]);

  // ── Add Button (always visible) ──────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="w-full rounded-xl border-2 border-dashed border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-6 hover:border-[#2B5FD9] dark:hover:border-[#6B8FEF] hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] transition-all duration-200 group"
      >
        <div className="flex items-center justify-center gap-3">
          <div className="p-2 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 group-hover:bg-[#2B5FD9]/10 transition-colors">
            <Plus className="h-5 w-5 text-[#2B5FD9] dark:text-[#6B8FEF]" />
          </div>
          <span className="text-[15px] font-semibold text-[#374151] dark:text-[#E2E8F0] group-hover:text-[#2B5FD9] dark:group-hover:text-[#6B8FEF] transition-colors">
            ADD AI PROVIDER
          </span>
        </div>
        <p className="mt-2 text-[13px] text-[#94A3B8]">Connect a custom AI provider endpoint</p>
      </button>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────
  return (
    <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/40">
            <Server className="h-5 w-5 text-[#2B5FD9]" />
          </div>
          <div>
            <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
              Add AI Provider
            </h2>
            <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
              Configure a custom AI provider endpoint
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-2 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-[#94A3B8]" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-[13px] text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Provider Name */}
      <div className="space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] mb-1.5">
            Provider Name *
          </label>
          <input
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setForm({ ...form, name: e.target.value });
            }}
            placeholder="e.g., My Company AI"
            className="w-full"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] mb-1.5">
            Category
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setForm({ ...form, category: cat });
                }}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                  form.category === cat
                    ? 'bg-[#2B5FD9] text-white'
                    : 'bg-[#F1F5F9] dark:bg-[#334155] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#E2E8F0] dark:hover:bg-[#475569]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Protocol */}
        <div>
          <label className="block text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] mb-1.5">
            Protocol
          </label>
          <select
            value={form.protocol}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setForm({ ...form, protocol: e.target.value as typeof form.protocol });
            }}
            className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[14px] text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#2B5FD9]/50"
          >
            {PROTOCOLS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label} — {p.description}
              </option>
            ))}
          </select>
        </div>

        {/* Endpoint URL */}
        <div>
          <label className="block text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] mb-1.5">
            <Globe className="inline h-3.5 w-3.5 mr-1" />
            Endpoint URL *
          </label>
          <input
            value={form.endpointUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setForm({ ...form, endpointUrl: e.target.value });
            }}
            placeholder="https://api.example.com/v1"
            className="w-full"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] mb-1.5">
            <Key className="inline h-3.5 w-3.5 mr-1" />
            API Key / Credential
          </label>
          <input
            type="password"
            value={form.apiKey}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setForm({ ...form, apiKey: e.target.value });
            }}
            placeholder="sk-..."
            className="w-full"
          />
          <p className="mt-1 text-[11px] text-[#94A3B8]">
            Used for the connection test only — the provider registry does not persist credentials
          </p>
        </div>

        {/* Default Model */}
        <div>
          <label className="block text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] mb-1.5">
            <Zap className="inline h-3.5 w-3.5 mr-1" />
            Default Model ID
          </label>
          <input
            value={form.defaultModelId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setForm({ ...form, defaultModelId: e.target.value });
            }}
            placeholder="e.g., gpt-4o, claude-3-sonnet, custom-model"
            className="w-full"
          />
        </div>

        {/* Deployment */}
        <div>
          <label className="block text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] mb-1.5">
            Deployment Type
          </label>
          <div className="flex gap-2">
            {DEPLOYMENTS.map((d) => (
              <button
                key={d.value}
                onClick={() => {
                  setForm({ ...form, deployment: d.value });
                }}
                className={`flex-1 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  form.deployment === d.value
                    ? 'bg-[#2B5FD9] text-white'
                    : 'bg-[#F1F5F9] dark:bg-[#334155] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#E2E8F0] dark:hover:bg-[#475569]'
                }`}
              >
                <div>{d.label}</div>
                <div className="text-[11px] opacity-75">{d.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.enabled}
              onCheckedChange={(checked) => {
                setForm({ ...form, enabled: checked });
              }}
            />
            <span className="text-[13px] text-[#374151] dark:text-[#E2E8F0]">Enabled</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.primaryEligible}
              onCheckedChange={(checked) => {
                setForm({ ...form, primaryEligible: checked });
              }}
            />
            <span className="text-[13px] text-[#374151] dark:text-[#E2E8F0]">Primary eligible</span>
          </div>
        </div>

        {/* Connection Test Result */}
        {testResult && (
          <div
            className={`p-3 rounded-lg border ${
              testResult.connected
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {testResult.connected ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
              <span
                className={`text-[13px] font-medium ${
                  testResult.connected
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-700 dark:text-red-400'
                }`}
              >
                {testResult.connected ? 'Connected' : 'Failed'}
              </span>
            </div>
            <p
              className={`mt-1 text-[12px] ${
                testResult.connected
                  ? 'text-green-600 dark:text-green-500'
                  : 'text-red-600 dark:text-red-500'
              }`}
            >
              {testResult.message}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={() => {
              void handleTest();
            }}
            disabled={testing || !form.endpointUrl || !form.apiKey}
            className="flex items-center gap-2"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Test Connection
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              void handleSave();
            }}
            disabled={
              saving || !form.name.trim() || !form.endpointUrl.trim() || !form.defaultModelId.trim()
            }
            className="flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save Provider
          </Button>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
