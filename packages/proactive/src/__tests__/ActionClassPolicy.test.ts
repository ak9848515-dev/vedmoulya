import { describe, it, expect } from 'vitest';
import { ActionClassPolicy } from '../domain/ActionClassPolicy.js';

describe('ActionClassPolicy', () => {
  const policy = new ActionClassPolicy();

  it('classifies safe analysis verbs as A', () => {
    expect(policy.classify('Summarize the report').actionClass).toBe('A');
    expect(policy.classify('classify these documents').actionClass).toBe('A');
    expect(policy.classify('Draft an email').actionClass).toBe('A');
  });

  it('classifies sensitive actions as C via the frozen SENSITIVE_ACTIONS vocabulary', () => {
    expect(policy.classify('Publish the post').actionClass).toBe('C');
    expect(policy.classify('Send the invoice').actionClass).toBe('C');
    expect(policy.classify('Delete the account').actionClass).toBe('C');
  });

  it('classifies recurring non-sensitive actions as B', () => {
    const decision = policy.classify('Generate the weekly report', { recurring: true });
    expect(decision.actionClass).toBe('B');
  });

  it('classifies never-automate actions as D', () => {
    expect(policy.classify('delete-account').actionClass).toBe('D');
    expect(policy.classify('bypass-security').actionClass).toBe('D');
    expect(policy.classify('grant-self-permission').actionClass).toBe('D');
  });

  it('refuses an empty action as D', () => {
    expect(policy.classify('').actionClass).toBe('D');
  });

  it('is proposable only for A/B/C', () => {
    expect(policy.proposable('A')).toBe(true);
    expect(policy.proposable('B')).toBe(true);
    expect(policy.proposable('C')).toBe(true);
    expect(policy.proposable('D')).toBe(false);
  });

  it('uses the injected sensitive vocabulary when provided', () => {
    const custom = new ActionClassPolicy(['rotate-secret']);
    expect(custom.classify('rotate-secret now').actionClass).toBe('C');
    expect(custom.classify('Summarize').actionClass).toBe('A');
  });
});
