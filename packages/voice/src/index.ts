// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · barrel
// SPRINT-027 — Speech capability foundation + conversation store +
// VOICE ≠ AUTHORIZATION contract. NOT a voice engine: no planning, execution,
// verification, approval, budget, scheduler, notification or memory logic
// lives here — the Brain remains the orchestrator.
// ─────────────────────────────────────────────────────────────────────────────

// Types
export type {
  BrainTaskPort,
  CommandCenterPresentationPort,
  CommandCenterQuestion,
  Conversation,
  ConversationTurn,
  SpeechCapabilityStatus,
  SpeechCapabilityStatusValue,
  SpeechIntentAssessment,
  SpeechIntentKind,
  SpeechServiceResult,
  SpeechToTextResult,
  TextToSpeechResult,
  VoiceActionDecision,
  VoiceAnswerPort,
  VoiceTurnResult,
  VoiceTurnState,
} from './types/voice-types.js';

// Contracts
export type {
  ConversationStore,
  SpeechToTextPort,
  TextToSpeechPort,
} from './contracts/voice-ports.js';

// Domain
export {
  MAX_AUDIO_BYTES,
  MAX_CONVERSATIONS_PER_OWNER,
  MAX_SYNTHESIS_TEXT_LENGTH,
  MAX_TURN_TEXT_LENGTH,
  MAX_TURNS_PER_CONVERSATION,
  MAX_TURNS_RETURNED,
  atTurnCap,
  truncateText,
} from './domain/ConversationPolicy.js';
export {
  MIN_STT_CONFIDENCE,
  VoiceIntentGate,
  sensitiveActionsMentioned,
} from './domain/VoiceIntentGate.js';
export type { AssessOptions, VoiceIntentInput } from './domain/VoiceIntentGate.js';
export { routeCommandCenterQuestion } from './domain/CommandCenterQuestionRouter.js';

// Infrastructure
export { InMemoryConversationStore } from './infrastructure/InMemoryConversationStore.js';
export { PostgresConversationStore } from './infrastructure/PostgresConversationStore.js';
export {
  MockSpeechFailureError,
  MockSpeechToTextAdapter,
} from './infrastructure/MockSpeechToTextAdapter.js';
export type { MockSpeechToTextOptions } from './infrastructure/MockSpeechToTextAdapter.js';
export { MockTextToSpeechAdapter } from './infrastructure/MockTextToSpeechAdapter.js';
export type { MockTextToSpeechOptions } from './infrastructure/MockTextToSpeechAdapter.js';
export {
  MAX_SYNTHESIS_RESPONSE_BYTES,
  RuntimeTextToSpeechAdapter,
} from './infrastructure/RuntimeTextToSpeechAdapter.js';
export type { RuntimeTextToSpeechAdapterOptions } from './infrastructure/RuntimeTextToSpeechAdapter.js';
export {
  RuntimeSpeechToTextAdapter,
  SpeechProviderError,
} from './infrastructure/RuntimeSpeechToTextAdapter.js';
export type { RuntimeSpeechToTextAdapterOptions } from './infrastructure/RuntimeSpeechToTextAdapter.js';

// Application
export { SpeechApplicationService } from './application/SpeechApplicationService.js';
export type { SpeechApplicationServiceOptions } from './application/SpeechApplicationService.js';
export { VoiceAssistantService } from './application/VoiceAssistantService.js';
export type { VoiceAssistantServiceOptions } from './application/VoiceAssistantService.js';
