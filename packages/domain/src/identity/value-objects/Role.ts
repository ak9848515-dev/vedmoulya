// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: Role
// User role for authorization — immutable value object
// ──────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'user' | 'moderator' | 'premium' | 'guest';

export interface RolePermissions {
  canManageUsers: boolean;
  canManageContent: boolean;
  canViewAnalytics: boolean;
  canManageBilling: boolean;
  canAccessAdmin: boolean;
}

const roleHierarchy: Record<UserRole, number> = {
  guest: 0,
  user: 10,
  premium: 20,
  moderator: 30,
  admin: 100,
};

const rolePermissions: Record<UserRole, RolePermissions> = {
  guest: {
    canManageUsers: false,
    canManageContent: false,
    canViewAnalytics: false,
    canManageBilling: false,
    canAccessAdmin: false,
  },
  user: {
    canManageUsers: false,
    canManageContent: true,
    canViewAnalytics: false,
    canManageBilling: false,
    canAccessAdmin: false,
  },
  premium: {
    canManageUsers: false,
    canManageContent: true,
    canViewAnalytics: true,
    canManageBilling: false,
    canAccessAdmin: false,
  },
  moderator: {
    canManageUsers: true,
    canManageContent: true,
    canViewAnalytics: true,
    canManageBilling: false,
    canAccessAdmin: true,
  },
  admin: {
    canManageUsers: true,
    canManageContent: true,
    canViewAnalytics: true,
    canManageBilling: true,
    canAccessAdmin: true,
  },
};

export class Role {
  private readonly _role: UserRole;

  constructor(role: UserRole) {
    this._role = role;
  }

  get role(): UserRole {
    return this._role;
  }
  get permissions(): RolePermissions {
    return rolePermissions[this._role];
  }
  get level(): number {
    return roleHierarchy[this._role];
  }

  /** Check if this role has sufficient hierarchy level */
  hasLevel(minimumRole: UserRole): boolean {
    return this.level >= roleHierarchy[minimumRole];
  }

  /** Check if this role has a specific permission */
  can(permission: keyof RolePermissions): boolean {
    return this.permissions[permission];
  }

  /** Check if this role is at least as permissive as another */
  isAtLeast(role: UserRole): boolean {
    return this.level >= roleHierarchy[role];
  }

  /** Create from a string (for persistence reconstruction) */
  static from(value: string): Role {
    const roles: UserRole[] = ['admin', 'user', 'moderator', 'premium', 'guest'];
    const role = roles.find((r) => r === value) ?? 'user';
    return new Role(role);
  }

  static readonly ADMIN = new Role('admin');
  static readonly MODERATOR = new Role('moderator');
  static readonly PREMIUM = new Role('premium');
  static readonly USER = new Role('user');
  static readonly GUEST = new Role('guest');

  toString(): string {
    return this._role;
  }
  toJSON(): string {
    return this._role;
  }
}
