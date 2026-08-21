// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · PostgresConversationStore
// SPRINT-027 — Phase 5 · durable owner-scoped conversation store.
//
// Same synchronous port as the in-memory store; backed by the shared
// @vedmoulya/core WriteThroughDocumentStore base (sync mirror + async
// idempotent write-through + boot hydrate + shutdown flush). Bounds match the
// in-memory store exactly. Owner isolation by query construction
// (PRIMARY KEY (owner, key)) — a foreign owner can never address another
// user's rows. Transcripts are interaction artifacts only — never secrets,
// never promoted to facts/preferences/learning.
// ─────────────────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import { WriteThroughDocumentStore } from '@vedmoulya/core';
import type { Conversation, ConversationTurn } from '../types/voice-types.js';
import type { ConversationStore } from '../contracts/voice-ports.js';
import {
  MAX_CONVERSATIONS_PER_OWNER,
  MAX_TURNS_PER_CONVERSATION,
  atTurnCap,
  truncateText,
} from '../domain/ConversationPolicy.js';

function byUpdatedAt(a: Conversation, b: Conversation): number {
  return Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
}

/** Owner-scoped conversation store — keyed (userId, conversationId). */
export class PostgresConversationStore
  extends WriteThroughDocumentStore<Conversation>
  implements ConversationStore
{
  constructor(sql: postgres.Sql, table = 'conversations') {
    super(sql, table);
  }

  private persist(conversation: Conversation): void {
    this.write(conversation.userId, conversation.id, conversation);
    this.prune(
      conversation.userId,
      MAX_CONVERSATIONS_PER_OWNER,
      (c) => c.updatedAt,
      (c) => c.id,
    );
  }

  create(userId: string, title = ''): Conversation {
    const id = `conv-${Math.random().toString(36).slice(2, 10)}`;
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id,
      userId,
      title: title.slice(0, 120),
      turns: [],
      createdAt: now,
      updatedAt: now,
    };
    this.persist(conversation);
    return conversation;
  }

  get(userId: string, conversationId: string): Conversation | undefined {
    // Owner-scoped key — a foreign conversation is indistinguishable from absent.
    return this.read(userId, conversationId);
  }

  list(userId: string): Conversation[] {
    return this.all(userId).sort(byUpdatedAt).reverse();
  }

  append(
    userId: string,
    conversationId: string,
    turn: { role: 'user' | 'assistant'; text: string; createdAt: string },
  ): ConversationTurn | undefined {
    const conversation = this.read(userId, conversationId);
    if (!conversation) return undefined;
    if (atTurnCap(conversation.turns.length)) {
      conversation.turns.shift();
    }
    const record: ConversationTurn = {
      id: `turn-${Math.random().toString(36).slice(2, 10)}`,
      userId,
      conversationId,
      role: turn.role,
      text: truncateText(turn.text),
      createdAt: turn.createdAt,
    };
    conversation.turns.push(record);
    conversation.updatedAt = turn.createdAt;
    this.persist(conversation);
    return record;
  }

  turns(
    userId: string,
    conversationId: string,
    limit = MAX_TURNS_PER_CONVERSATION,
  ): ConversationTurn[] {
    const conversation = this.read(userId, conversationId);
    if (!conversation) return [];
    return conversation.turns.slice(-Math.max(0, limit));
  }

  clear(userId: string, conversationId: string): void {
    this.remove(userId, conversationId);
  }
}
