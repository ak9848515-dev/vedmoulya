// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · InMemoryConversationStore
// SPRINT-027 — Phase 5 · deterministic dev/test conversation store.
//
// Owner-scoped + bounded (FIFO eviction) with EXACTLY the same bounds as the
// Postgres store — the in-memory double is the contract reference.
// ─────────────────────────────────────────────────────────────────────────────

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

export class InMemoryConversationStore implements ConversationStore {
  private readonly byOwner = new Map<string, Map<string, Conversation>>();

  private ownerMap(userId: string): Map<string, Conversation> {
    let map = this.byOwner.get(userId);
    if (!map) {
      map = new Map<string, Conversation>();
      this.byOwner.set(userId, map);
    }
    return map;
  }

  private evict(ownerMap: Map<string, Conversation>): void {
    while (ownerMap.size > MAX_CONVERSATIONS_PER_OWNER) {
      // FIFO by updatedAt: the oldest conversation is evicted.
      const oldest = [...ownerMap.values()].sort(byUpdatedAt)[0];
      if (!oldest) return;
      ownerMap.delete(oldest.id);
    }
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
    const map = this.ownerMap(userId);
    map.set(id, conversation);
    this.evict(map);
    return conversation;
  }

  get(userId: string, conversationId: string): Conversation | undefined {
    return this.ownerMap(userId).get(conversationId);
  }

  list(userId: string): Conversation[] {
    return [...this.ownerMap(userId).values()].sort(byUpdatedAt).reverse();
  }

  append(
    userId: string,
    conversationId: string,
    turn: { role: 'user' | 'assistant'; text: string; createdAt: string },
  ): ConversationTurn | undefined {
    const conversation = this.ownerMap(userId).get(conversationId);
    if (!conversation) return undefined;
    // Bounded history: drop the oldest turn when at the cap (never unbounded).
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
    return record;
  }

  turns(
    userId: string,
    conversationId: string,
    limit = MAX_TURNS_PER_CONVERSATION,
  ): ConversationTurn[] {
    const conversation = this.ownerMap(userId).get(conversationId);
    if (!conversation) return [];
    return conversation.turns.slice(-Math.max(0, limit));
  }

  clear(userId: string, conversationId: string): void {
    this.ownerMap(userId).delete(conversationId);
  }
}
