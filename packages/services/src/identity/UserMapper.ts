// ──────────────────────────────────────────────────────────────────
// VedMoulya — User Mapper
// Maps between User entity and UserDTO
// ──────────────────────────────────────────────────────────────────

import type { User } from '@vedmoulya/domain';
import type { UserDTO, RegisterUserDTO, UpdateProfileDTO } from './UserDTO.js';
import type { UserReconstructionParams } from '@vedmoulya/domain';

export const UserMapper = {
  /** Map a User entity to a full UserDTO */
  toDTO(user: User): UserDTO {
    return {
      id: user.id,
      email: user.email.toString(),
      displayName: user.profile.displayName,
      givenName: user.profile.givenName,
      familyName: user.profile.familyName,
      avatarUrl: user.profile.avatarUrl,
      bio: user.profile.bio,
      timezone: user.profile.timezone,
      locale: user.profile.locale,
      age: user.profile.age,
      gender: user.profile.gender,
      purpose: user.profile.purpose,
      primaryGoal: user.profile.primaryGoal,
      profileComplete: user.profile.isComplete(),
      theme: user.preferences.theme,
      language: user.preferences.language,
      statusState: user.status.state,
      emailVerified: user.status.emailVerified,
      twoFactorEnabled: user.settings.twoFactorEnabled,
      profileVisibility: user.settings.profileVisibility,
      entityStatus: user.entityStatus,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  },

  /** Map a User entity to a lightweight registration DTO */
  toRegisterDTO(user: User): RegisterUserDTO {
    return {
      id: user.id,
      email: user.email.toString(),
      displayName: user.profile.displayName,
      status: user.status.state,
      createdAt: user.createdAt.toISOString(),
    };
  },

  /** Map a User entity to a profile update DTO */
  toUpdateProfileDTO(user: User): UpdateProfileDTO {
    return {
      id: user.id,
      displayName: user.profile.displayName,
      email: user.email.toString(),
      avatarUrl: user.profile.avatarUrl,
      bio: user.profile.bio,
      age: user.profile.age,
      gender: user.profile.gender,
      purpose: user.profile.purpose,
      primaryGoal: user.profile.primaryGoal,
      profileComplete: user.profile.isComplete(),
      updatedAt: user.updatedAt.toISOString(),
    };
  },

  /** Create reconstruction params from raw database row */
  toReconstructionParams(row: Record<string, unknown>): UserReconstructionParams {
    return {
      id: row.id as string,
      email: row.email as string,
      displayName: row.display_name as string,
      givenName: row.given_name as string | undefined,
      familyName: row.family_name as string | undefined,
      avatarUrl: row.avatar_url as string | undefined,
      bio: row.bio as string | undefined,
      timezone: row.timezone as string | undefined,
      locale: row.locale as string | undefined,
      age: row.age as number | undefined,
      gender: row.gender as string | undefined,
      purpose: row.purpose as string | undefined,
      primaryGoal: row.primary_goal as string | undefined,
      theme: (row.theme as 'light' | 'dark' | 'system' | undefined) ?? 'system',
      language: (row.language as string | undefined) ?? 'en',
      notificationsEnabled: (row.notifications_enabled as boolean | undefined) ?? true,
      emailNotifications: (row.email_notifications as boolean | undefined) ?? true,
      pushNotifications: (row.push_notifications as boolean | undefined) ?? true,
      weeklyDigest: (row.weekly_digest as boolean | undefined) ?? false,
      reducedMotion: (row.reduced_motion as boolean | undefined) ?? false,
      reducedTransparency: (row.reduced_transparency as boolean | undefined) ?? false,
      twoFactorEnabled: (row.two_factor_enabled as boolean | undefined) ?? false,
      sessionTimeoutMinutes: (row.session_timeout_minutes as number | undefined) ?? 60,
      loginNotifications: (row.login_notifications as boolean | undefined) ?? true,
      profileVisibility:
        (row.profile_visibility as 'public' | 'private' | 'connections' | undefined) ?? 'private',
      showOnlineStatus: (row.show_online_status as boolean | undefined) ?? true,
      allowDataSharing: (row.allow_data_sharing as boolean | undefined) ?? false,
      preferredAuthMethod:
        (row.preferred_auth_method as 'email' | 'google' | 'any' | undefined) ?? 'any',
      statusState: row.status_state as 'pending' | 'active' | 'suspended' | 'deleted' | 'locked',
      emailVerified: (row.email_verified as boolean | undefined) ?? false,
      statusReason: row.status_reason as string | undefined,
      statusChangedAt: row.status_changed_at
        ? new Date(row.status_changed_at as string)
        : undefined,
      entityStatus:
        (row.entity_status as 'active' | 'inactive' | 'archived' | 'deleted' | undefined) ??
        'active',
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  },
};
