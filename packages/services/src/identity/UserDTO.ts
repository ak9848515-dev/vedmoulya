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
  updatedAt: string;
}

export interface UserListDTO {
  users: UserDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
