// ──────────────────────────────────────────────────────────────────
// VedMoulya — Information Module
// Module registration for the Information bounded context
// ──────────────────────────────────────────────────────────────────

import { moduleRegistry } from '@vedmoulya/core';
import type { ModuleDefinition } from '@vedmoulya/core';

/** Information module definition */
export const informationModule: ModuleDefinition = {
  name: 'information',
  description:
    'Information architecture — data classification, lifecycle management, lineage tracking, and governance',
  version: '0.1.0',
  dependencies: ['core'],
  register: () => {
    // Information module has no runtime services to register
    // All types are passive data structures
  },
  initialize: async () => {
    // No initialization needed
  },
  shutdown: async () => {
    // No shutdown needed
  },
};

/** Self-register the module */
moduleRegistry.register(informationModule);
