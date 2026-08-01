// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI domain value objects unit tests
// ARC-005 — AI Orchestration
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { CostEstimate } from '../CostEstimate.js';
import { TokenUsage } from '../TokenUsage.js';
import { Capability } from '../Capability.js';
import { AIRequestId } from '../AIRequestId.js';
import { Prompt } from '../Prompt.js';
import { ProviderId } from '../ProviderId.js';

describe('CostEstimate', () => {
  it('creates a cost estimate with all fields', () => {
    const estimate = CostEstimate.create({
      estimatedInputTokens: 100,
      estimatedOutputTokens: 50,
      estimatedCost: 0.0012,
      currency: 'USD',
      providerId: 'openai',
      confidence: 'high',
    });
    expect(estimate.estimatedInputTokens).toBe(100);
    expect(estimate.estimatedOutputTokens).toBe(50);
    expect(estimate.estimatedCost).toBe(0.0012);
    expect(estimate.currency).toBe('USD');
    expect(estimate.providerId).toBe('openai');
    expect(estimate.confidence).toBe('high');
  });

  it('accepts medium and low confidence', () => {
    expect(
      CostEstimate.create({
        estimatedInputTokens: 1,
        estimatedOutputTokens: 1,
        estimatedCost: 0,
        currency: 'USD',
        providerId: 'x',
        confidence: 'medium',
      }).confidence,
    ).toBe('medium');
    expect(
      CostEstimate.create({
        estimatedInputTokens: 1,
        estimatedOutputTokens: 1,
        estimatedCost: 0,
        currency: 'USD',
        providerId: 'x',
        confidence: 'low',
      }).confidence,
    ).toBe('low');
  });

  it('throws for negative cost', () => {
    expect(() =>
      CostEstimate.create({
        estimatedInputTokens: 1,
        estimatedOutputTokens: 1,
        estimatedCost: -1,
        currency: 'USD',
        providerId: 'x',
        confidence: 'high',
      }),
    ).toThrow('Cost must be non-negative');
  });

  it('equals compares providerId and cost', () => {
    const a = CostEstimate.create({
      estimatedInputTokens: 1,
      estimatedOutputTokens: 1,
      estimatedCost: 5,
      currency: 'USD',
      providerId: 'openai',
      confidence: 'high',
    });
    const b = CostEstimate.create({
      estimatedInputTokens: 2,
      estimatedOutputTokens: 2,
      estimatedCost: 5,
      currency: 'USD',
      providerId: 'openai',
      confidence: 'low',
    });
    const c = CostEstimate.create({
      estimatedInputTokens: 1,
      estimatedOutputTokens: 1,
      estimatedCost: 9,
      currency: 'USD',
      providerId: 'openai',
      confidence: 'high',
    });
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe('TokenUsage', () => {
  it('creates usage and exposes the total', () => {
    const usage = TokenUsage.create(10, 20);
    expect(usage.input).toBe(10);
    expect(usage.output).toBe(20);
    expect(usage.total).toBe(30);
  });

  it('throws for negative input or output', () => {
    expect(() => TokenUsage.create(-1, 5)).toThrow('Input tokens must be non-negative');
    expect(() => TokenUsage.create(5, -1)).toThrow('Output tokens must be non-negative');
  });

  it('adds two usages', () => {
    const sum = TokenUsage.create(10, 20).add(TokenUsage.create(5, 5));
    expect(sum.input).toBe(15);
    expect(sum.output).toBe(25);
    expect(sum.total).toBe(40);
  });

  it('equals compares input and output', () => {
    expect(TokenUsage.create(1, 2).equals(TokenUsage.create(1, 2))).toBe(true);
    expect(TokenUsage.create(1, 2).equals(TokenUsage.create(2, 2))).toBe(false);
  });

  it('serializes to JSON with total', () => {
    expect(TokenUsage.create(3, 4).toJSON()).toEqual({ input: 3, output: 4, total: 7 });
  });
});

describe('Capability', () => {
  it('creates a capability and converts to string', () => {
    const capability = Capability.create('reasoning');
    expect(capability.type).toBe('reasoning');
    expect(capability.toString()).toBe('reasoning');
  });

  it('equals compares the type', () => {
    expect(Capability.create('coding').equals(Capability.create('coding'))).toBe(true);
    expect(Capability.create('coding').equals(Capability.create('vision'))).toBe(false);
  });
});

describe('AIRequestId', () => {
  it('creates from an explicit value', () => {
    const id = AIRequestId.create('req-123');
    expect(id.value).toBe('req-123');
    expect(id.toString()).toBe('req-123');
  });

  it('generates an id when none provided', () => {
    const id = AIRequestId.create();
    expect(id.value).toBeTruthy();
  });

  it('throws for empty or whitespace values', () => {
    expect(() => AIRequestId.create('')).toThrow('AIRequestId must not be empty');
    expect(() => AIRequestId.create('   ')).toThrow('AIRequestId must not be empty');
  });

  it('equals compares values', () => {
    expect(AIRequestId.create('a').equals(AIRequestId.create('a'))).toBe(true);
    expect(AIRequestId.create('a').equals(AIRequestId.create('b'))).toBe(false);
  });
});

describe('Prompt', () => {
  it('creates a prompt with all fields', () => {
    const prompt = Prompt.create({
      systemInstructions: 'Be concise',
      userContext: 'User likes cats',
      taskContext: 'Summarize',
      constraints: ['no markdown'],
      safetyInstructions: ['no PII'],
      userInput: 'Tell me about cats',
    });
    expect(prompt.systemInstructions).toBe('Be concise');
    expect(prompt.userContext).toBe('User likes cats');
    expect(prompt.taskContext).toBe('Summarize');
    expect(prompt.constraints).toEqual(['no markdown']);
    expect(prompt.safetyInstructions).toEqual(['no PII']);
    expect(prompt.userInput).toBe('Tell me about cats');
  });

  it('defaults optional fields to null and empty arrays', () => {
    const prompt = Prompt.create({ systemInstructions: 'x', userInput: 'y' });
    expect(prompt.userContext).toBeNull();
    expect(prompt.taskContext).toBeNull();
    expect(prompt.constraints).toEqual([]);
    expect(prompt.safetyInstructions).toEqual([]);
  });

  it('estimates tokens based on combined text length', () => {
    const prompt = Prompt.create({
      systemInstructions: 'abcd',
      userInput: 'abcd',
    });
    // Source joins [system, ctx ?? '', task ?? '', ...constraints, ...safety, input]
    // with ' ', so for two empty optional fields the text is 'abcd  abcd' (11 chars).
    expect(prompt.estimatedTokens).toBe(Math.ceil(11 / 4));
  });

  it('equals compares all fields', () => {
    const base = { systemInstructions: 'a', userInput: 'b' };
    expect(Prompt.create(base).equals(Prompt.create(base))).toBe(true);
    expect(Prompt.create({ ...base, userContext: 'u' }).equals(Prompt.create(base))).toBe(false);
    expect(Prompt.create({ ...base, constraints: ['c'] }).equals(Prompt.create(base))).toBe(false);
    expect(Prompt.create({ ...base, safetyInstructions: ['s'] }).equals(Prompt.create(base))).toBe(
      false,
    );
  });
});

describe('ProviderId', () => {
  it('creates a provider id and converts to string', () => {
    const id = ProviderId.create('openai');
    expect(id.value).toBe('openai');
    expect(id.toString()).toBe('openai');
  });

  it('throws for empty or whitespace values', () => {
    expect(() => ProviderId.create('')).toThrow('ProviderId must not be empty');
    expect(() => ProviderId.create('  ')).toThrow('ProviderId must not be empty');
  });

  it('equals compares values', () => {
    expect(ProviderId.create('a').equals(ProviderId.create('a'))).toBe(true);
    expect(ProviderId.create('a').equals(ProviderId.create('b'))).toBe(false);
  });
});
