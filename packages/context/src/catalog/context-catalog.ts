// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Seed Catalog
// Seed data for the Enterprise Context Registry
// EI-003 — Enterprise Context Intelligence Engine
// Provides realistic context items from all 11 sources across all
// 14 categories, covering all 5 priority levels.
// ──────────────────────────────────────────────────────────────────

import type { ContextItem } from '../types/context-types.js';

export const SEED_CONTEXT_SIZE = 30;

/**
 * Create the seed context catalog: 28 items covering all sources,
 * categories, and priorities. Used for development and test.
 */
export function createCatalogContext(): ContextItem[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return [
    // ── User Profile (conversation_memory → user_profile, critical) ─────────
    {
      contextId: 'ctx_user_profile_001',
      source: 'conversation_memory',
      category: 'user_profile',
      priority: 'critical',
      importance: 0.95,
      confidence: 0.98,
      freshness: 0.95,
      size: 850,
      estimatedTokens: 213,
      language: 'en',
      tags: ['user', 'profile', 'preferences'],
      business: ['platform', 'learning', 'career'],
      capability: ['general_conversation', 'reasoning'],
      version: '2.1.0',
      content:
        'User is a senior software engineer with 10 years of experience. ' +
        'Primary interests: AI/ML, enterprise architecture, TypeScript. ' +
        'Preferred learning style: hands-on projects with theoretical foundations. ' +
        'Communication preference: technical depth with clarity. ' +
        'Currently focused on building VedMoulya Enterprise Intelligence platform.',
      metadata: {
        userId: 'user_001',
        source: 'registration',
        lastUpdated: new Date(now - 7 * day).toISOString(),
      },
      createdAt: new Date(now - 90 * day).toISOString(),
      updatedAt: new Date(now - 7 * day).toISOString(),
      sourceId: 'registration_form',
    },

    // ── Conversation History (conversation_memory → conversation, high) ─────
    {
      contextId: 'ctx_conversation_001',
      source: 'conversation_memory',
      category: 'conversation',
      priority: 'high',
      importance: 0.85,
      confidence: 0.95,
      freshness: 0.9,
      size: 2400,
      estimatedTokens: 600,
      language: 'en',
      tags: ['conversation', 'recent', 'ai_architecture'],
      business: ['platform'],
      capability: ['reasoning', 'general_conversation'],
      version: '1.0.0',
      content:
        'Recent conversation about provider architecture: ' +
        'User asked about optimal provider selection for content generation. ' +
        'Discussed OpenAI vs Anthropic quality trade-offs, cost analysis, ' +
        'and latency requirements. User expressed interest in streaming support ' +
        'and JSON mode for structured outputs.',
      metadata: { messageCount: 12, lastMessage: new Date(now - 2 * day).toISOString() },
      createdAt: new Date(now - 2 * day).toISOString(),
      updatedAt: new Date(now - 2 * day).toISOString(),
      sourceId: 'conv_ae3f2c',
    },

    // ── Enterprise Memory: Past Decisions (enterprise_memory → memory, critical) ─
    {
      contextId: 'ctx_memory_decision_001',
      source: 'enterprise_memory',
      category: 'memory',
      priority: 'critical',
      importance: 0.92,
      confidence: 0.97,
      freshness: 0.7,
      size: 1800,
      estimatedTokens: 450,
      language: 'en',
      tags: ['decision', 'provider', 'selection'],
      business: ['platform', 'business'],
      capability: ['reasoning', 'classification'],
      version: '1.0.0',
      content:
        'Decision: Adopted OpenAI as primary provider for content generation ' +
        'after evaluating 5 providers across 12 capabilities. Key factors: ' +
        'best quality score (0.92), competitive pricing ($15/1M input tokens), ' +
        'and proven reliability (99.5% uptime over 6 months). ' +
        'Anthropic selected as fallback for reasoning-heavy tasks.',
      metadata: { decisionId: 'dec_001', evaluatedAt: new Date(now - 30 * day).toISOString() },
      createdAt: new Date(now - 30 * day).toISOString(),
      updatedAt: new Date(now - 30 * day).toISOString(),
      sourceId: 'decision_engine_001',
    },

    // ── Enterprise Memory: Learnings (enterprise_memory → memory, high) ─────
    {
      contextId: 'ctx_memory_learning_001',
      source: 'enterprise_memory',
      category: 'memory',
      priority: 'high',
      importance: 0.8,
      confidence: 0.9,
      freshness: 0.65,
      size: 1200,
      estimatedTokens: 300,
      language: 'en',
      tags: ['learning', 'embedding', 'optimization'],
      business: ['learning', 'platform'],
      capability: ['embeddings', 'reasoning'],
      version: '1.0.0',
      content:
        'Learning: Embedding-based retrieval significantly outperforms ' +
        'keyword search for context assembly. Observed 40% improvement in ' +
        'relevance scores when using vector search over BM25. ' +
        'Recommended: use text-embedding-3-small for general context, ' +
        'text-embedding-3-large for critical business queries.',
      metadata: { source: 'experiment_012', confidence: 'measured' },
      createdAt: new Date(now - 45 * day).toISOString(),
      updatedAt: new Date(now - 45 * day).toISOString(),
      sourceId: 'learning_engine_005',
    },

    // ── Knowledge Base: Architecture (knowledge_base → knowledge, critical) ─
    {
      contextId: 'ctx_knowledge_arch_001',
      source: 'knowledge_base',
      category: 'knowledge',
      priority: 'critical',
      importance: 0.96,
      confidence: 0.99,
      freshness: 0.85,
      size: 3200,
      estimatedTokens: 800,
      language: 'en',
      tags: ['architecture', 'context', 'intelligence'],
      business: ['platform'],
      capability: ['reasoning', 'general_conversation'],
      version: '3.0.0',
      content:
        'Enterprise Context Intelligence Architecture: ' +
        'The Context Intelligence Engine (EI-003) automatically determines ' +
        'WHAT information, HOW MUCH, WHICH, and IN WHAT ORDER to send to AI. ' +
        'Architecture: Context Registry → Ranking → Filtering → Compression → Assembly. ' +
        'Key metrics: original tokens, compressed tokens, reduction %, confidence. ' +
        'Supported sources: conversation memory, enterprise memory, knowledge base, ' +
        'business rules, client data, project data, capability metadata, documents, ' +
        'prompt templates, historical success, benchmark knowledge.',
      metadata: { docId: 'ARCH-003', version: '3.0.0', owner: 'arch-team' },
      createdAt: new Date(now - 60 * day).toISOString(),
      updatedAt: new Date(now - 5 * day).toISOString(),
      sourceId: 'architecture_docs_003',
    },

    // ── Knowledge Base: Provider Matrix (knowledge_base → knowledge, high) ──
    {
      contextId: 'ctx_knowledge_provider_001',
      source: 'knowledge_base',
      category: 'knowledge',
      priority: 'high',
      importance: 0.88,
      confidence: 0.95,
      freshness: 0.8,
      size: 2800,
      estimatedTokens: 700,
      language: 'en',
      tags: ['provider', 'capability', 'matrix'],
      business: ['platform', 'business'],
      capability: ['reasoning', 'classification'],
      version: '2.0.0',
      content:
        'Provider Capability Matrix: Content generation quality rankings — ' +
        '1. Anthropic Claude (0.97), 2. OpenAI GPT-4o (0.92), 3. Google Gemini (0.88). ' +
        'Reasoning: OpenAI (0.95), Anthropic (0.93), DeepSeek (0.89). ' +
        'Coding: DeepSeek (0.94), OpenAI (0.91), Anthropic (0.88). ' +
        'Embeddings: OpenAI (0.96), Google (0.90). ' +
        'Vision: OpenAI (0.93), Google (0.91), Anthropic (0.85).',
      metadata: { source: 'provider-registry', generatedAt: new Date(now - 3 * day).toISOString() },
      createdAt: new Date(now - 30 * day).toISOString(),
      updatedAt: new Date(now - 3 * day).toISOString(),
      sourceId: 'provider_matrix_latest',
    },

    // ── Business Rules: Quality (business_rules → business, critical) ───────
    {
      contextId: 'ctx_business_rules_001',
      source: 'business_rules',
      category: 'business',
      priority: 'critical',
      importance: 0.94,
      confidence: 0.99,
      freshness: 0.9,
      size: 1500,
      estimatedTokens: 375,
      language: 'en',
      tags: ['business', 'rules', 'quality'],
      business: ['business', 'platform'],
      capability: ['reasoning', 'classification'],
      version: '1.0.0',
      content:
        'Business Rule: Quality First Policy. ' +
        'For all client-facing content, always prefer the highest quality provider ' +
        '(Anthropic for content generation, OpenAI for reasoning). ' +
        'Budget rule: per-request cost must not exceed $0.50. ' +
        'Latency rule: responses must complete within 15 seconds. ' +
        'Fallback rule: if primary provider fails, retry once then switch to secondary.',
      metadata: { ruleId: 'BR-001', enforcedBy: 'policy-engine' },
      createdAt: new Date(now - 60 * day).toISOString(),
      updatedAt: new Date(now - 10 * day).toISOString(),
      sourceId: 'business_rules_001',
    },

    // ── Business Rules: Compliance (business_rules → strategy, high) ────────
    {
      contextId: 'ctx_business_rules_002',
      source: 'business_rules',
      category: 'strategy',
      priority: 'high',
      importance: 0.85,
      confidence: 0.98,
      freshness: 0.75,
      size: 900,
      estimatedTokens: 225,
      language: 'en',
      tags: ['compliance', 'data', 'privacy'],
      business: ['platform'],
      capability: ['classification'],
      version: '1.0.0',
      content:
        'Compliance Rule: Customer data must never be sent to providers ' +
        'hosted outside the data residency region. All prompts containing PII ' +
        'must be anonymized before sending to external providers. ' +
        'OpenRouter and Ollama are exempt from this rule (self-hosted).',
      metadata: { ruleId: 'BR-005', region: 'us-east' },
      createdAt: new Date(now - 60 * day).toISOString(),
      updatedAt: new Date(now - 15 * day).toISOString(),
      sourceId: 'compliance_manual_001',
    },

    // ── Client Data (client_data → client, high) ────────────────────────────
    {
      contextId: 'ctx_client_001',
      source: 'client_data',
      category: 'client',
      priority: 'high',
      importance: 0.9,
      confidence: 0.95,
      freshness: 0.8,
      size: 2000,
      estimatedTokens: 500,
      language: 'en',
      tags: ['client', 'acme-corp', 'contract'],
      business: ['content-agency'],
      capability: ['content_generation', 'summarization'],
      version: '1.0.0',
      content:
        'Client: Acme Corporation. Industry: Enterprise SaaS. ' +
        'Engagement: Content marketing for developer tools. ' +
        'Brand voice: Technical, authoritative, approachable. ' +
        'Target audience: Senior developers and engineering managers. ' +
        'Current project: Blog series on microservices architecture. ' +
        'Key contacts: Jane Doe (CTO), John Smith (Marketing Lead).',
      metadata: { clientId: 'cli_001', projectCount: 3, lifetimeValue: 120000 },
      createdAt: new Date(now - 45 * day).toISOString(),
      updatedAt: new Date(now - 7 * day).toISOString(),
      sourceId: 'crm_001',
    },

    // ── Project Data (project_data → project, medium) ───────────────────────
    {
      contextId: 'ctx_project_001',
      source: 'project_data',
      category: 'project',
      priority: 'medium',
      importance: 0.75,
      confidence: 0.9,
      freshness: 0.7,
      size: 1600,
      estimatedTokens: 400,
      language: 'en',
      tags: ['project', 'ei-003', 'context'],
      business: ['platform'],
      capability: ['reasoning', 'general_conversation'],
      version: '1.0.0',
      content:
        'Project: EI-003 Context Intelligence Engine. ' +
        'Status: In development. Sprint goal: Implement context ranking, ' +
        'filtering, compression, and assembly services. ' +
        'Team: 3 engineers. Timeline: 2 weeks. ' +
        'Dependencies: EI-001 (Capability Registry), EI-002 (Provider Registry). ' +
        'Key milestone: Context Assembly MVP with 11 source types.',
      metadata: { projectId: 'proj_003', sprint: 'EI-003', priority: 'high' },
      createdAt: new Date(now - 14 * day).toISOString(),
      updatedAt: new Date(now - 1 * day).toISOString(),
      sourceId: 'project_tracker_003',
    },

    // ── Capability Metadata (capability_metadata → capability, medium) ──────
    {
      contextId: 'ctx_capability_001',
      source: 'capability_metadata',
      category: 'capability',
      priority: 'medium',
      importance: 0.7,
      confidence: 0.92,
      freshness: 0.85,
      size: 1100,
      estimatedTokens: 275,
      language: 'en',
      tags: ['capability', 'content_generation'],
      business: ['platform', 'content-agency'],
      capability: ['content_generation'],
      version: '1.0.0',
      content:
        'Capability: Content Generation. ' +
        'Definition: Generate human-quality text content for various formats ' +
        '(blog posts, social media, email, website copy, ad copy). ' +
        'Input: topic, tone, target audience, format requirements. ' +
        'Output: formatted content with optional metadata. ' +
        'Best for: marketing content, educational material, documentation.',
      metadata: { capabilityId: 'cap_001', category: 'content' },
      createdAt: new Date(now - 30 * day).toISOString(),
      updatedAt: new Date(now - 30 * day).toISOString(),
      sourceId: 'capability_registry_001',
    },

    // ── Documents: Architecture (documents → document, medium) ──────────────
    {
      contextId: 'ctx_document_001',
      source: 'documents',
      category: 'document',
      priority: 'medium',
      importance: 0.65,
      confidence: 0.95,
      freshness: 0.6,
      size: 4500,
      estimatedTokens: 1125,
      language: 'en',
      tags: ['document', 'architecture', 'specification'],
      business: ['platform'],
      capability: ['reasoning', 'general_conversation'],
      version: '1.0.0',
      content:
        'Architecture Specification: Enterprise Intelligence Platform. ' +
        'The platform consists of 5 layers: (1) Data Layer - Postgres, Redis, Vector DB, ' +
        '(2) Registry Layer - Capability, Provider, Context registries, ' +
        '(3) Intelligence Layer - Ranking, Filtering, Compression, Assembly, ' +
        '(4) Execution Layer - Provider routing, AI orchestration, ' +
        '(5) Economy Layer - Token optimization, cost management, quality scoring.',
      metadata: { docId: 'SPEC-001', format: 'markdown', pages: 12 },
      createdAt: new Date(now - 60 * day).toISOString(),
      updatedAt: new Date(now - 20 * day).toISOString(),
      sourceId: 'document_store_001',
    },

    // ── Prompt Templates (prompt_templates → prompt, medium) ────────────────
    {
      contextId: 'ctx_prompt_001',
      source: 'prompt_templates',
      category: 'prompt',
      priority: 'medium',
      importance: 0.75,
      confidence: 0.93,
      freshness: 0.8,
      size: 800,
      estimatedTokens: 200,
      language: 'en',
      tags: ['prompt', 'template', 'content_generation'],
      business: ['content-agency'],
      capability: ['content_generation'],
      version: '2.0.0',
      content:
        'Prompt Template: Blog Post Generation. ' +
        'System: You are a professional content writer specializing in technical topics. ' +
        'Write in a clear, authoritative tone. Use examples and code snippets. ' +
        'Format: Markdown with headings, bullet points, and code blocks. ' +
        'Target length: 1500-2000 words. Include a compelling introduction and conclusion.',
      metadata: { templateId: 'tpl_001', usageCount: 145 },
      createdAt: new Date(now - 90 * day).toISOString(),
      updatedAt: new Date(now - 15 * day).toISOString(),
      sourceId: 'prompt_library_001',
    },

    // ── Historical Success (historical_success → knowledge, high) ───────────
    {
      contextId: 'ctx_historical_001',
      source: 'historical_success',
      category: 'knowledge',
      priority: 'high',
      importance: 0.82,
      confidence: 0.94,
      freshness: 0.55,
      size: 1000,
      estimatedTokens: 250,
      language: 'en',
      tags: ['historical', 'success', 'content_generation'],
      business: ['content-agency', 'business'],
      capability: ['content_generation', 'summarization'],
      version: '1.0.0',
      content:
        'Historical Success: Content Generation. ' +
        'Anthropic Claude consistently achieves highest quality scores (0.97) ' +
        'for long-form content. OpenAI GPT-4o best for structured output (JSON mode). ' +
        'Success rate: 96% of content generated with Claude requires no revisions. ' +
        'Recommendation: Use Claude for creative/editorial, GPT-4o for structured.',
      metadata: { sampleSize: 500, period: 'Q1-2026', confidence: 'statistically_significant' },
      createdAt: new Date(now - 60 * day).toISOString(),
      updatedAt: new Date(now - 60 * day).toISOString(),
      sourceId: 'analytics_engine_001',
    },

    // ── Benchmark Knowledge (benchmark_knowledge → knowledge, medium) ───────
    {
      contextId: 'ctx_benchmark_001',
      source: 'benchmark_knowledge',
      category: 'knowledge',
      priority: 'medium',
      importance: 0.72,
      confidence: 0.88,
      freshness: 0.5,
      size: 1400,
      estimatedTokens: 350,
      language: 'en',
      tags: ['benchmark', 'evaluation', 'quality'],
      business: ['platform'],
      capability: ['reasoning', 'classification'],
      version: '1.0.0',
      content:
        'Benchmark Knowledge: Provider Capability Evaluation. ' +
        'Standard benchmarks: MMLU (knowledge), HumanEval (coding), ' +
        'GSM8K (math), Hellaswag (reasoning). ' +
        'Enterprise benchmarks: Custom scenarios for content quality, ' +
        'instruction following, tool use, and long context handling. ' +
        '12 defined benchmark datasets across 11 categories and 4 difficulty levels.',
      metadata: { source: 'provider-benchmark-engine', definitionCount: 12 },
      createdAt: new Date(now - 45 * day).toISOString(),
      updatedAt: new Date(now - 45 * day).toISOString(),
      sourceId: 'benchmark_definitions_001',
    },

    // ── Market Intelligence (knowledge_base → market, low) ──────────────────
    {
      contextId: 'ctx_market_001',
      source: 'knowledge_base',
      category: 'market',
      priority: 'low',
      importance: 0.45,
      confidence: 0.75,
      freshness: 0.4,
      size: 2200,
      estimatedTokens: 550,
      language: 'en',
      tags: ['market', 'trends', 'ai'],
      business: ['business'],
      capability: ['reasoning', 'general_conversation'],
      version: '1.0.0',
      content:
        'Market Intelligence: AI Provider Landscape Q2 2026. ' +
        'Key trends: (1) Open-source models closing the gap with proprietary, ' +
        '(2) Multi-modal becoming standard, (3) Price competition driving ' +
        '50% cost reduction YoY, (4) Enterprise adoption of AI agents accelerating. ' +
        'Notable: DeepSeek emerging as strong competitor in coding/reasoning.',
      metadata: { reportDate: new Date(now - 30 * day).toISOString(), analyst: 'market-intel' },
      createdAt: new Date(now - 30 * day).toISOString(),
      updatedAt: new Date(now - 30 * day).toISOString(),
      sourceId: 'market_intel_002',
    },

    // ── Brand Guidelines (enterprise_memory → brand, low) ───────────────────
    {
      contextId: 'ctx_brand_001',
      source: 'enterprise_memory',
      category: 'brand',
      priority: 'low',
      importance: 0.5,
      confidence: 0.96,
      freshness: 0.7,
      size: 1800,
      estimatedTokens: 450,
      language: 'en',
      tags: ['brand', 'guidelines', 'voice'],
      business: ['content-agency', 'business'],
      capability: ['content_generation'],
      version: '1.0.0',
      content:
        'Brand Guidelines: VedMoulya. ' +
        'Voice: Confident, visionary, accessible. ' +
        'Tone: Professional but not corporate. Use "we" and "you". ' +
        'Key messages: "Life Operating System", "Enterprise Intelligence", ' +
        '"Empower every determined individual". ' +
        'Avoid: hype, unrealistic claims, negative competitor comparisons.',
      metadata: { brandId: 'brand_001', version: '2.0' },
      createdAt: new Date(now - 60 * day).toISOString(),
      updatedAt: new Date(now - 10 * day).toISOString(),
      sourceId: 'brand_guidelines_001',
    },

    // ── System Configuration (conversation_memory → system, low) ────────────
    {
      contextId: 'ctx_system_001',
      source: 'conversation_memory',
      category: 'system',
      priority: 'low',
      importance: 0.4,
      confidence: 0.99,
      freshness: 0.85,
      size: 600,
      estimatedTokens: 150,
      language: 'en',
      tags: ['system', 'config', 'settings'],
      business: ['platform'],
      capability: ['reasoning'],
      version: '1.0.0',
      content:
        'System Configuration: Default AI request settings. ' +
        'Model: gpt-4o (primary), claude-3-opus (fallback). ' +
        'Max tokens: 4096. Temperature: 0.7. ' +
        'Context window: 128K tokens. Streaming: enabled. ' +
        'Rate limit: 100 requests/minute. Cost budget: $0.50/request.',
      metadata: { configId: 'default', environment: 'production' },
      createdAt: new Date(now - 30 * day).toISOString(),
      updatedAt: new Date(now - 5 * day).toISOString(),
      sourceId: 'system_config_001',
    },

    // ── Additional items for richer coverage ────────────────────────────────

    // Conversation Memory: recent chat
    {
      contextId: 'ctx_conversation_002',
      source: 'conversation_memory',
      category: 'conversation',
      priority: 'medium',
      importance: 0.6,
      confidence: 0.88,
      freshness: 0.95,
      size: 800,
      estimatedTokens: 200,
      language: 'en',
      tags: ['conversation', 'recent', 'help'],
      business: ['platform'],
      capability: ['general_conversation'],
      version: '1.0.0',
      content:
        'User: "Can you help me understand the context compression pipeline?" ' +
        'Assistant: "The pipeline has 5 steps: chunk selection, ranking, merge, ' +
        'strategy application, and minimal context assembly. Each step reduces ' +
        'token count while preserving semantic meaning."',
      metadata: { messageCount: 4, topic: 'context_compression' },
      createdAt: new Date(now - 1 * day).toISOString(),
      updatedAt: new Date(now - 1 * day).toISOString(),
      sourceId: 'conv_b7f4d1',
    },

    // Enterprise Memory: failed approach
    {
      contextId: 'ctx_memory_failure_001',
      source: 'enterprise_memory',
      category: 'memory',
      priority: 'high',
      importance: 0.78,
      confidence: 0.91,
      freshness: 0.45,
      size: 1000,
      estimatedTokens: 250,
      language: 'en',
      tags: ['failure', 'learned', 'cache'],
      business: ['platform'],
      capability: ['reasoning'],
      version: '1.0.0',
      content:
        'Failure: Full-context approach caused excessive token usage. ' +
        'Sending all available context items resulted in 45K+ tokens per request, ' +
        'increasing cost by 300% and latency by 200%. ' +
        'Lesson: Always compress context to under 8K tokens. ' +
        'Solution: Implemented the Context Compression Pipeline.',
      metadata: { failureId: 'fail_001', costImpact: '$1,200/month' },
      createdAt: new Date(now - 50 * day).toISOString(),
      updatedAt: new Date(now - 50 * day).toISOString(),
      sourceId: 'postmortem_001',
    },

    // Knowledge Base: embedding strategy
    {
      contextId: 'ctx_knowledge_embed_001',
      source: 'knowledge_base',
      category: 'knowledge',
      priority: 'high',
      importance: 0.84,
      confidence: 0.93,
      freshness: 0.75,
      size: 1600,
      estimatedTokens: 400,
      language: 'en',
      tags: ['embedding', 'vector', 'search'],
      business: ['platform', 'learning'],
      capability: ['embeddings', 'classification'],
      version: '1.0.0',
      content:
        'Embedding Strategy: Use multi-vector retrieval with hybrid search. ' +
        'Combine dense embeddings (text-embedding-3-large, 3072 dimensions) ' +
        'with sparse BM25 for optimal recall. ' +
        'Chunking strategy: 512 tokens with 128 token overlap. ' +
        'This achieves 92% recall on enterprise knowledge base queries.',
      metadata: { source: 'experiment_018', recall: 0.92 },
      createdAt: new Date(now - 25 * day).toISOString(),
      updatedAt: new Date(now - 25 * day).toISOString(),
      sourceId: 'vector_strategy_001',
    },

    // Client Data: project brief
    {
      contextId: 'ctx_client_002',
      source: 'client_data',
      category: 'client',
      priority: 'medium',
      importance: 0.68,
      confidence: 0.85,
      freshness: 0.65,
      size: 1200,
      estimatedTokens: 300,
      language: 'en',
      tags: ['client', 'project', 'brief'],
      business: ['content-agency'],
      capability: ['content_generation', 'summarization'],
      version: '1.0.0',
      content:
        'Client Project Brief: Microservices Blog Series. ' +
        'Goal: 6-part blog series on microservices best practices. ' +
        'Target audience: Senior developers with 5+ years experience. ' +
        'Topics: (1) When to use microservices, (2) Service boundaries, ' +
        '(3) Communication patterns, (4) Data management, (5) Deployment, ' +
        '(6) Monitoring and observability. Deadline: 6 weeks.',
      metadata: { clientId: 'cli_001', projectId: 'proj_001', budget: '$15,000' },
      createdAt: new Date(now - 20 * day).toISOString(),
      updatedAt: new Date(now - 10 * day).toISOString(),
      sourceId: 'project_brief_001',
    },

    // Project Data: sprint backlog
    {
      contextId: 'ctx_project_002',
      source: 'project_data',
      category: 'project',
      priority: 'medium',
      importance: 0.62,
      confidence: 0.88,
      freshness: 0.9,
      size: 700,
      estimatedTokens: 175,
      language: 'en',
      tags: ['project', 'sprint', 'backlog'],
      business: ['platform'],
      capability: ['reasoning'],
      version: '1.0.0',
      content:
        'Sprint Backlog: EI-003 Context Intelligence. ' +
        'Completed: Ranking service, filtering service, compression pipeline. ' +
        'In progress: Assembly service, discovery API, context explorer UI. ' +
        'Next: Postgres repository, benchmark integration, performance optimization.',
      metadata: { projectId: 'proj_003', sprintId: 'sprint_007', velocity: '85%' },
      createdAt: new Date(now - 7 * day).toISOString(),
      updatedAt: new Date(now - 1 * day).toISOString(),
      sourceId: 'jira_sprint_007',
    },

    // Business Rules: cost optimization
    {
      contextId: 'ctx_business_rules_003',
      source: 'business_rules',
      category: 'business',
      priority: 'high',
      importance: 0.86,
      confidence: 0.97,
      freshness: 0.8,
      size: 600,
      estimatedTokens: 150,
      language: 'en',
      tags: ['cost', 'optimization', 'budget'],
      business: ['business', 'platform'],
      capability: ['classification'],
      version: '1.0.0',
      content:
        'Cost Optimization Rule: Use economy tier for non-critical requests. ' +
        'For training and experimentation, prefer OpenRouter or Ollama (free). ' +
        'Budget allocation: 60% premium (client-facing), 30% standard (internal), ' +
        '10% economy (experimental). Monthly AI cost cap: $5,000.',
      metadata: { ruleId: 'BR-003', effectiveFrom: new Date(now - 30 * day).toISOString() },
      createdAt: new Date(now - 30 * day).toISOString(),
      updatedAt: new Date(now - 30 * day).toISOString(),
      sourceId: 'cost_optimization_001',
    },

    // Documents: API reference
    {
      contextId: 'ctx_document_002',
      source: 'documents',
      category: 'document',
      priority: 'low',
      importance: 0.35,
      confidence: 0.9,
      freshness: 0.5,
      size: 3000,
      estimatedTokens: 750,
      language: 'en',
      tags: ['document', 'api', 'reference'],
      business: ['platform'],
      capability: ['reasoning'],
      version: '1.0.0',
      content:
        'API Reference: Context Intelligence Service. ' +
        'POST /api/context/rank — rank context items by relevance. ' +
        'POST /api/context/filter — filter context items. ' +
        'POST /api/context/compress — compress context to token budget. ' +
        'POST /api/context/assemble — build enterprise context package. ' +
        'GET /api/context/discover — discover and preview context. ' +
        'All endpoints require authentication and rate limiting.',
      metadata: { docId: 'API-REF-003', format: 'openapi', version: '1.0.0' },
      createdAt: new Date(now - 40 * day).toISOString(),
      updatedAt: new Date(now - 40 * day).toISOString(),
      sourceId: 'api_docs_003',
    },

    // Prompt Templates: social media
    {
      contextId: 'ctx_prompt_002',
      source: 'prompt_templates',
      category: 'prompt',
      priority: 'low',
      importance: 0.3,
      confidence: 0.88,
      freshness: 0.7,
      size: 500,
      estimatedTokens: 125,
      language: 'en',
      tags: ['prompt', 'template', 'social'],
      business: ['content-agency'],
      capability: ['content_generation'],
      version: '1.0.0',
      content:
        'Prompt Template: LinkedIn Post. ' +
        'Write a professional LinkedIn post about [topic]. ' +
        'Tone: Thought leadership, engaging. Include a question to encourage comments. ' +
        'Length: 150-200 words. Use 3-5 relevant hashtags.',
      metadata: { templateId: 'tpl_002', usageCount: 89 },
      createdAt: new Date(now - 60 * day).toISOString(),
      updatedAt: new Date(now - 20 * day).toISOString(),
      sourceId: 'prompt_library_002',
    },

    // Historical Success: summarization
    {
      contextId: 'ctx_historical_002',
      source: 'historical_success',
      category: 'knowledge',
      priority: 'medium',
      importance: 0.55,
      confidence: 0.85,
      freshness: 0.5,
      size: 700,
      estimatedTokens: 175,
      language: 'en',
      tags: ['historical', 'success', 'summarization'],
      business: ['platform', 'learning'],
      capability: ['summarization'],
      version: '1.0.0',
      content:
        'Historical Success: Summarization. ' +
        'OpenAI GPT-4o achieves best summarization results (0.91 quality). ' +
        'Gemini 1.5 Pro competitive for very long documents (2M tokens context). ' +
        'Recommended: GPT-4o for standard summaries, Gemini for long documents.',
      metadata: { sampleSize: 200, period: 'Q1-2026' },
      createdAt: new Date(now - 60 * day).toISOString(),
      updatedAt: new Date(now - 60 * day).toISOString(),
      sourceId: 'analytics_engine_002',
    },

    // Benchmark Knowledge: coding
    {
      contextId: 'ctx_benchmark_002',
      source: 'benchmark_knowledge',
      category: 'knowledge',
      priority: 'medium',
      importance: 0.6,
      confidence: 0.82,
      freshness: 0.45,
      size: 900,
      estimatedTokens: 225,
      language: 'en',
      tags: ['benchmark', 'coding', 'evaluation'],
      business: ['platform'],
      capability: ['coding'],
      version: '1.0.0',
      content:
        'Benchmark Knowledge: Coding. ' +
        'HumanEval pass@1: DeepSeek (85%), OpenAI (82%), Anthropic (79%). ' +
        'SWE-bench: DeepSeek (48%), OpenAI (45%), Anthropic (42%). ' +
        'DeepSeek leads in coding benchmarks, especially for complex tasks.',
      metadata: { source: 'benchmark-run-2026-03', benchmark: 'humaneval' },
      createdAt: new Date(now - 50 * day).toISOString(),
      updatedAt: new Date(now - 50 * day).toISOString(),
      sourceId: 'coding_benchmarks_001',
    },

    // Background: market analysis
    {
      contextId: 'ctx_market_002',
      source: 'knowledge_base',
      category: 'market',
      priority: 'background',
      importance: 0.2,
      confidence: 0.6,
      freshness: 0.3,
      size: 1500,
      estimatedTokens: 375,
      language: 'en',
      tags: ['market', 'analysis', 'pricing'],
      business: ['business'],
      capability: ['reasoning'],
      version: '1.0.0',
      content:
        'Market Analysis: AI Provider Pricing Trends. ' +
        'Average cost per 1M tokens dropped from $20 (2024) to $8 (2026). ' +
        'OpenAI reduced prices 40% in 18 months. ' +
        'Google following with competitive pricing for Gemini. ' +
        'DeepSeek offering significantly lower prices with competitive quality.',
      metadata: { reportDate: new Date(now - 45 * day).toISOString(), confidence: 'medium' },
      createdAt: new Date(now - 45 * day).toISOString(),
      updatedAt: new Date(now - 45 * day).toISOString(),
      sourceId: 'market_intel_003',
    },

    // Background: system health
    {
      contextId: 'ctx_system_002',
      source: 'conversation_memory',
      category: 'system',
      priority: 'background',
      importance: 0.15,
      confidence: 0.95,
      freshness: 0.92,
      size: 300,
      estimatedTokens: 75,
      language: 'en',
      tags: ['system', 'health', 'status'],
      business: ['platform'],
      capability: ['reasoning'],
      version: '1.0.0',
      content:
        'System Health: All services operational. ' +
        'API Gateway: 200ms avg latency. Provider Registry: healthy. ' +
        'Context Registry: 28 items indexed. Memory: 95% cache hit rate. ' +
        'Last maintenance: 2 days ago.',
      metadata: { checkedAt: new Date().toISOString() },
      createdAt: new Date(now - 2 * day).toISOString(),
      updatedAt: new Date(now - 2 * day).toISOString(),
      sourceId: 'health_check_001',
    },
  ];
}
