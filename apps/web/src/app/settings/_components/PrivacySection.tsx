// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Settings → Privacy (UX-07)
//
// STATUS: not implemented on the web surface. The identity domain models
// privacy preferences (visibility, data sharing, login notifications), but no
// authenticated endpoint exposes them to the client yet, so this section must
// not render switches that would silently do nothing.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card } from '@vedmoulya/ui';
import { Lock } from 'lucide-react';
import { SettingsNotice } from './SettingsNotice.js';

export function PrivacySection(): React.JSX.Element {
  return (
    <div className="space-y-4" data-testid="settings-privacy">
      <Card variant="standard" padding="lg">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" aria-hidden="true" />
          <div>
            <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
              Privacy
            </h3>
            <p className="mt-1 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
              Privacy preferences are not editable from VedMoulya yet. Your data is not shared with
              third parties, and AI provider calls only receive the context a mission needs.
            </p>
          </div>
        </div>
      </Card>

      <SettingsNotice
        title="Privacy controls are not available yet"
        description="Visibility, data-sharing and login-notification preferences are not exposed to this screen today, so no switches are shown for them."
        planned={[
          'Profile visibility (public · connections · private)',
          'Whether activity may be used for product improvement',
          'Login notifications for new devices',
        ]}
        tone="future"
      />
    </div>
  );
}
