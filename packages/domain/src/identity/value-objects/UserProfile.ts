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
  /** SPRINT-041B — first-login profile setup fields (age/gender/purpose/primary
   *  goal). All optional at the domain level; a profile is "complete" for
   *  first-login purposes when the four onboarding fields are all present
   *  (displayName is already mandatory at registration). */
  age?: number;
  gender?: string;
  purpose?: string;
  primaryGoal?: string;
}

export class UserProfile {
  private readonly _displayName: string;
  private readonly _givenName?: string;
  private readonly _familyName?: string;
  private readonly _avatarUrl?: string;
  private readonly _bio?: string;
  private readonly _timezone?: string;
  private readonly _locale?: string;
  private readonly _age?: number;
  private readonly _gender?: string;
  private readonly _purpose?: string;
  private readonly _primaryGoal?: string;

  constructor(props: UserProfileProps) {
    this._displayName = props.displayName;
    this._givenName = props.givenName;
    this._familyName = props.familyName;
    this._avatarUrl = props.avatarUrl;
    this._bio = props.bio;
    this._timezone = props.timezone;
    this._locale = props.locale;
    this._age = props.age;
    this._gender = props.gender;
    this._purpose = props.purpose;
    this._primaryGoal = props.primaryGoal;
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
  get age(): number | undefined {
    return this._age;
  }
  get gender(): string | undefined {
    return this._gender;
  }
  get purpose(): string | undefined {
    return this._purpose;
  }
  get primaryGoal(): string | undefined {
    return this._primaryGoal;
  }

  /** True once the first-login profile is complete: the four onboarding fields
   *  are all present (displayName is mandatory at registration). Deterministic —
   *  the server derives first-login state from this, never from client flags. */
  isComplete(): boolean {
    return (
      this._age !== undefined &&
      this._gender !== undefined &&
      this._gender.trim().length > 0 &&
      this._purpose !== undefined &&
      this._purpose.trim().length > 0 &&
      this._primaryGoal !== undefined &&
      this._primaryGoal.trim().length > 0
    );
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
      age: props.age ?? this._age,
      gender: props.gender ?? this._gender,
      purpose: props.purpose ?? this._purpose,
      primaryGoal: props.primaryGoal ?? this._primaryGoal,
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
      age: this._age,
      gender: this._gender,
      purpose: this._purpose,
      primaryGoal: this._primaryGoal,
    };
  }
}
