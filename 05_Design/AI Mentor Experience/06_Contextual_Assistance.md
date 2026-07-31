# Contextual Assistance

> **Document:** DES-005-D06 — AI Mentor Experience & Conversation System  
> **Status:** 🔒 **LOCKED** — Part of DES-005 AI Mentor Constitution v1.0  
> **Design Constitution:** DES-001 v1.0 · DES-002A v1.0 · DES-003A v1.1 · DES-004 v1.0

---

## Purpose

Contextual Assistance means the Mentor understands what the user is doing, where they are in the platform, and what they need — without the user having to explain from scratch every time.

**Why it exists:** Every context switch costs cognitive energy. Contextual assistance removes the need for the user to re-establish context.

---

## Context Sources

| Source               | What It Provides                                                      |
| -------------------- | --------------------------------------------------------------------- |
| **Current screen**   | Which section the user is viewing (dashboard, timeline, garden, etc.) |
| **Recent activity**  | Last 5 actions taken on the platform                                  |
| **Active goal**      | Current focus goal and its progress                                   |
| **Open item**        | If user opened Mentor from a specific item (memory, decision, card)   |
| **Time of day**      | Morning/afternoon/evening/night                                       |
| **Session depth**    | How long the user has been active today                               |
| **Mood (if shared)** | User's self-reported or inferred energy level                         |

---

## Context-Aware Entry Messages

| Context                 | Mentor Opening                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard → Mentor**  | "I noticed you've been making great progress on your ML course. What's on your mind?"                                                 |
| **Memory → Mentor**     | "I see you're looking at your memory from last month's career conversation. Would you like to reflect on how things have progressed?" |
| **Goal → Mentor**       | "You're working toward completing your certification. How can I support you?"                                                         |
| **Decision → Mentor**   | "You're considering a career move. Let's explore the options together."                                                               |
| **Reflection → Mentor** | "It's been a productive week. Would you like to reflect on what you've learned?"                                                      |
| **General → Mentor**    | "How are you doing today?" (warm, open, never transactional)                                                                          |

---

## Cross-References

| Reference     | Relationship                                            |
| ------------- | ------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — colors, typography, spacing       |
| DES-003A v1.1 | Dashboard — Coach context awareness                     |
| DES-004 v1.0  | Memory & Knowledge — context from user's knowledge      |
| DES-005/D00   | AI Mentor Constitution — context awareness rules        |
| DES-005/D02   | Conversation Experience — context shown in sidebar      |
| DES-005/D05   | Coaching Methodology — context informs mode selection   |
| ARC-003       | Knowledge Graph — context from knowledge graph          |
| ARC-004       | Execution Intelligence — context from execution engine  |
| ARC-005       | AI Orchestration — context pipeline                     |
| PRD-002       | User DNA — context personalization                      |
| ENG-001       | Domain Model — context entities                         |
| ENG-002       | Implementation Standards — context integration patterns |
| ENG-003       | AI Development Guidelines — context privacy             |
