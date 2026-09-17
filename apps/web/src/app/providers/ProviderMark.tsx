// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Mark (logo tile)
// AI PROVIDER UX SIMPLIFICATION
//
// One consistent, calm mark per provider: the REAL Google "G" for the google
// family (the same asset the sign-in screen uses) and a brand-tinted monogram
// tile for every other family. No invented or counterfeit brand artwork — the
// mark is decorative (aria-hidden); the provider name is always rendered as
// text next to it, so the mark is never the only signal.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { GoogleIcon } from '../login/GoogleIcon.js';
import { providerIdentity } from './provider-ux.js';

export type ProviderMarkSize = 'sm' | 'md' | 'lg';

/* eslint-disable security/detect-object-injection -- indexed by the closed
   ProviderMarkSize union (a literal prop), never by attacker-controlled input;
   the rule is a false positive on these presentational maps (same convention as
   apps/web/src/app/providers/ModelSelector.tsx). */

const TILE_SIZES: Record<ProviderMarkSize, string> = {
  sm: 'h-8 w-8 rounded-lg text-[13px]',
  md: 'h-10 w-10 rounded-xl text-[15px]',
  lg: 'h-12 w-12 rounded-2xl text-[18px]',
};

const GLYPH_SIZES: Record<ProviderMarkSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export function ProviderMark({
  family,
  name,
  size = 'md',
  className = '',
}: {
  family: string;
  /** Registry name for the provider (used for the fallback monogram). */
  name?: string;
  size?: ProviderMarkSize;
  className?: string;
}): React.JSX.Element {
  const identity = providerIdentity(family, name);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center ${TILE_SIZES[size]} ${identity.tile} ${className}`}
    >
      {family === 'google' ? (
        <GoogleIcon className={GLYPH_SIZES[size]} />
      ) : (
        <span className="font-semibold">{identity.monogram}</span>
      )}
    </span>
  );
}
