// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: UserPreferences
// Immutable user preferences for platform behaviour
// ──────────────────────────────────────────────────────────────────

export interface UserPreferencesProps {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
  reducedMotion: boolean;
  reducedTransparency: boolean;
}

export class UserPreferences {
  private readonly _theme: 'light' | 'dark' | 'system';
  private readonly _language: string;
  private readonly _notificationsEnabled: boolean;
  private readonly _emailNotifications: boolean;
  private readonly _pushNotifications: boolean;
  private readonly _weeklyDigest: boolean;
  private readonly _reducedMotion: boolean;
  private readonly _reducedTransparency: boolean;

  constructor(props: UserPreferencesProps) {
    this._theme = props.theme;
    this._language = props.language;
    this._notificationsEnabled = props.notificationsEnabled;
    this._emailNotifications = props.emailNotifications;
    this._pushNotifications = props.pushNotifications;
    this._weeklyDigest = props.weeklyDigest;
    this._reducedMotion = props.reducedMotion;
    this._reducedTransparency = props.reducedTransparency;
  }

  get theme(): 'light' | 'dark' | 'system' {
    return this._theme;
  }
  get language(): string {
    return this._language;
  }
  get notificationsEnabled(): boolean {
    return this._notificationsEnabled;
  }
  get emailNotifications(): boolean {
    return this._emailNotifications;
  }
  get pushNotifications(): boolean {
    return this._pushNotifications;
  }
  get weeklyDigest(): boolean {
    return this._weeklyDigest;
  }
  get reducedMotion(): boolean {
    return this._reducedMotion;
  }
  get reducedTransparency(): boolean {
    return this._reducedTransparency;
  }

  with(props: Partial<UserPreferencesProps>): UserPreferences {
    return new UserPreferences({
      theme: props.theme ?? this._theme,
      language: props.language ?? this._language,
      notificationsEnabled: props.notificationsEnabled ?? this._notificationsEnabled,
      emailNotifications: props.emailNotifications ?? this._emailNotifications,
      pushNotifications: props.pushNotifications ?? this._pushNotifications,
      weeklyDigest: props.weeklyDigest ?? this._weeklyDigest,
      reducedMotion: props.reducedMotion ?? this._reducedMotion,
      reducedTransparency: props.reducedTransparency ?? this._reducedTransparency,
    });
  }

  static defaults(): UserPreferences {
    return new UserPreferences({
      theme: 'system',
      language: 'en',
      notificationsEnabled: true,
      emailNotifications: true,
      pushNotifications: true,
      weeklyDigest: false,
      reducedMotion: false,
      reducedTransparency: false,
    });
  }

  toJSON(): UserPreferencesProps {
    return {
      theme: this._theme,
      language: this._language,
      notificationsEnabled: this._notificationsEnabled,
      emailNotifications: this._emailNotifications,
      pushNotifications: this._pushNotifications,
      weeklyDigest: this._weeklyDigest,
      reducedMotion: this._reducedMotion,
      reducedTransparency: this._reducedTransparency,
    };
  }
}
