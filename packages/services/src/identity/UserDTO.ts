// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Application DTOs
// Data Transfer Objects for identity service API
// ──────────────────────────────────────────────────────────────────

export interface UserDTO {
  id: string;
  email: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  avatarUrl?: string;
  bio?: string;
  timezone?: string;
  locale?: string;
  age?: number;
  gender?: string;
  purpose?: string;
  primaryGoal?: string;
  /** First-login profile completion (derived: all onboarding fields present).
   *  Optional — set by UserMapper for real users; guest/partial assemblers
   *  that build a UserDTO without profile data omit it. */
  profileComplete?: boolean;
  theme: 'light' | 'dark' | 'system';
  language: string;
  statusState: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  profileVisibility: string;
  entityStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterUserDTO {
  id: string;
  email: string;
  displayName: string;
  status: string;
  createdAt: string;
}

export interface UpdateProfileDTO {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  age?: number;
  gender?: string;
  purpose?: string;
  primaryGoal?: string;
  /** First-login profile completion (derived: all onboarding fields present). */
  profileComplete: boolean;
  updatedAt: string;
}

export interface UserListDTO {
  users: UserDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
