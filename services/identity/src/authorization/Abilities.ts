// ──────────────────────────────────────────────────────────────────
// VedMoulya — Authorization: CASL Ability Definitions
// Defines user abilities based on roles, permissions, and ownership
// ──────────────────────────────────────────────────────────────────

import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import type { MongoAbility } from '@casl/ability';
import type { UserRole } from '@vedmoulya/domain';

// ── Actions & Subjects ─────────────────────────────────────────────────────

export type Action =
  'manage' | 'create' | 'read' | 'update' | 'delete' | 'archive' | 'invite' | 'approve';

export type Subject =
  | 'User'
  | 'Profile'
  | 'Settings'
  | 'Content'
  | 'Article'
  | 'Project'
  | 'Opportunity'
  | 'Marketplace'
  | 'Analytics'
  | 'Billing'
  | 'Team'
  | 'Role'
  | 'Permission'
  | 'Session'
  | 'Event'
  | 'all';

export type AppAbility = MongoAbility<[Action, Subject]>;

// ── Ability Factory ────────────────────────────────────────────────────────

export interface AbilityContext {
  userId: string;
  role: UserRole;
}

/** Create CASL abilities for a user based on their role */
export function defineAbilitiesFor(context: AbilityContext): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  const { role, userId } = context;
  void userId;

  switch (role) {
    case 'admin':
      // Admins can manage everything
      can('manage', 'all');
      break;

    case 'moderator':
      // Moderators: content management, user moderation
      can('manage', 'Content');
      can('manage', 'Article');
      can('read', 'Analytics');
      can('read', 'User');
      can('update', 'User');
      can('read', 'Profile');
      can('read', 'Team');
      can('invite', 'Team');
      can('approve', 'Content');
      cannot('delete', 'User');
      cannot('manage', 'Billing');
      cannot('manage', 'Role');
      cannot('manage', 'Permission');
      can('read', 'Event');
      break;

    case 'premium':
      // Premium users: own content, analytics
      can('create', 'Content');
      can('read', 'Content');
      can('update', 'Content');
      can('delete', 'Content');
      can('create', 'Article');
      can('read', 'Article');
      can('update', 'Article');
      can('delete', 'Article');
      can('read', 'Analytics');
      can('read', 'Marketplace');
      can('create', 'Opportunity');
      can('update', 'Profile');
      can('read', 'Settings');
      cannot('manage', 'User');
      cannot('manage', 'Team');
      cannot('manage', 'Billing');
      break;

    case 'user':
      // Standard users: own content, no admin
      can('create', 'Content');
      can('read', 'Content');
      can('update', 'Content');
      can('delete', 'Content');
      can('create', 'Article');
      can('read', 'Article');
      can('update', 'Article');
      can('read', 'Marketplace');
      can('create', 'Opportunity');
      can('update', 'Profile');
      can('read', 'Settings');
      cannot('read', 'Analytics');
      cannot('manage', 'User');
      cannot('manage', 'Team');
      cannot('manage', 'Billing');
      cannot('delete', 'Article');
      break;

    case 'guest':
      // Guests: read-only public content
      can('read', 'Content');
      can('read', 'Article');
      can('read', 'Marketplace');
      cannot('manage', 'all');
      break;
  }

  return build();
}
