// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: UserProfile
// Immutable user profile information
// ──────────────────────────────────────────────────────────────────

export interface UserProfileProps {
  displayName: string;
  givenName?: string;
  familyName?: string;
  avatarUrl?: string;
  bio?: string;
  timezone?: string;
  locale?: string;
}

export class UserProfile {
  private readonly _displayName: string;
  private readonly _givenName?: string;
  private readonly _familyName?: string;
  private readonly _avatarUrl?: string;
  private readonly _bio?: string;
  private readonly _timezone?: string;
  private readonly _locale?: string;

  constructor(props: UserProfileProps) {
    this._displayName = props.displayName;
    this._givenName = props.givenName;
    this._familyName = props.familyName;
    this._avatarUrl = props.avatarUrl;
    this._bio = props.bio;
    this._timezone = props.timezone;
    this._locale = props.locale;
  }

  get displayName(): string {
    return this._displayName;
  }
  get givenName(): string | undefined {
    return this._givenName;
  }
  get familyName(): string | undefined {
    return this._familyName;
  }
  get avatarUrl(): string | undefined {
    return this._avatarUrl;
  }
  get bio(): string | undefined {
    return this._bio;
  }
  get timezone(): string | undefined {
    return this._timezone;
  }
  get locale(): string | undefined {
    return this._locale;
  }

  /** Create an updated profile with new values */
  with(props: Partial<UserProfileProps>): UserProfile {
    return new UserProfile({
      displayName: props.displayName ?? this._displayName,
      givenName: props.givenName ?? this._givenName,
      familyName: props.familyName ?? this._familyName,
      avatarUrl: props.avatarUrl ?? this._avatarUrl,
      bio: props.bio ?? this._bio,
      timezone: props.timezone ?? this._timezone,
      locale: props.locale ?? this._locale,
    });
  }

  toJSON(): UserProfileProps {
    return {
      displayName: this._displayName,
      givenName: this._givenName,
      familyName: this._familyName,
      avatarUrl: this._avatarUrl,
      bio: this._bio,
      timezone: this._timezone,
      locale: this._locale,
    };
  }
}
