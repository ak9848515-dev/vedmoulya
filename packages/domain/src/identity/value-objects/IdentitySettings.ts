// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: IdentitySettings
// Security, privacy, and session settings
// ──────────────────────────────────────────────────────────────────

export interface IdentitySettingsProps {
  twoFactorEnabled: boolean;
  sessionTimeoutMinutes: number;
  loginNotifications: boolean;
  profileVisibility: 'public' | 'private' | 'connections';
  showOnlineStatus: boolean;
  allowDataSharing: boolean;
  preferredAuthMethod: 'email' | 'google' | 'any';
}

export class IdentitySettings {
  private readonly _twoFactorEnabled: boolean;
  private readonly _sessionTimeoutMinutes: number;
  private readonly _loginNotifications: boolean;
  private readonly _profileVisibility: 'public' | 'private' | 'connections';
  private readonly _showOnlineStatus: boolean;
  private readonly _allowDataSharing: boolean;
  private readonly _preferredAuthMethod: 'email' | 'google' | 'any';

  constructor(props: IdentitySettingsProps) {
    this._twoFactorEnabled = props.twoFactorEnabled;
    this._sessionTimeoutMinutes = props.sessionTimeoutMinutes;
    this._loginNotifications = props.loginNotifications;
    this._profileVisibility = props.profileVisibility;
    this._showOnlineStatus = props.showOnlineStatus;
    this._allowDataSharing = props.allowDataSharing;
    this._preferredAuthMethod = props.preferredAuthMethod;
  }

  get twoFactorEnabled(): boolean {
    return this._twoFactorEnabled;
  }
  get sessionTimeoutMinutes(): number {
    return this._sessionTimeoutMinutes;
  }
  get loginNotifications(): boolean {
    return this._loginNotifications;
  }
  get profileVisibility(): 'public' | 'private' | 'connections' {
    return this._profileVisibility;
  }
  get showOnlineStatus(): boolean {
    return this._showOnlineStatus;
  }
  get allowDataSharing(): boolean {
    return this._allowDataSharing;
  }
  get preferredAuthMethod(): 'email' | 'google' | 'any' {
    return this._preferredAuthMethod;
  }

  with(props: Partial<IdentitySettingsProps>): IdentitySettings {
    return new IdentitySettings({
      twoFactorEnabled: props.twoFactorEnabled ?? this._twoFactorEnabled,
      sessionTimeoutMinutes: props.sessionTimeoutMinutes ?? this._sessionTimeoutMinutes,
      loginNotifications: props.loginNotifications ?? this._loginNotifications,
      profileVisibility: props.profileVisibility ?? this._profileVisibility,
      showOnlineStatus: props.showOnlineStatus ?? this._showOnlineStatus,
      allowDataSharing: props.allowDataSharing ?? this._allowDataSharing,
      preferredAuthMethod: props.preferredAuthMethod ?? this._preferredAuthMethod,
    });
  }

  static defaults(): IdentitySettings {
    return new IdentitySettings({
      twoFactorEnabled: false,
      sessionTimeoutMinutes: 60,
      loginNotifications: true,
      profileVisibility: 'private',
      showOnlineStatus: true,
      allowDataSharing: false,
      preferredAuthMethod: 'any',
    });
  }

  toJSON(): IdentitySettingsProps {
    return {
      twoFactorEnabled: this._twoFactorEnabled,
      sessionTimeoutMinutes: this._sessionTimeoutMinutes,
      loginNotifications: this._loginNotifications,
      profileVisibility: this._profileVisibility,
      showOnlineStatus: this._showOnlineStatus,
      allowDataSharing: this._allowDataSharing,
      preferredAuthMethod: this._preferredAuthMethod,
    };
  }
}
