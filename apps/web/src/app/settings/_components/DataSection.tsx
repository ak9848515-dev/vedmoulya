// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Settings → Data (UX-07)
//
// STATUS: not implemented. There is no export, no account-deletion or
// retention API exposed to the web client, so this section states that instead
// of shipping buttons that do nothing. It also does NOT re-own Memory/Knowledge
// (they have their own sections and their own screens).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card } from '@vedmoulya/ui';
import { Database } from 'lucide-react';
import { SettingsNotice } from './SettingsNotice.js';

export function DataSection(): React.JSX.Element {
  return (
    <div className="space-y-4" data-testid="settings-data">
      <Card variant="standard" padding="lg">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" aria-hidden="true" />
          <div>
            <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F8FAFC]">Data</h3>
            <p className="mt-1 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
              Everything VedMoulya stores for you lives in your own account and is scoped to your
              user ID at the API boundary.
            </p>
          </div>
        </div>
      </Card>

      <SettingsNotice
        title="Data controls are not available yet"
        description="Export, retention and account deletion are not exposed to this screen today, so no controls are shown for them."
        planned={[
          'Export your workspace as a portable archive',
          'See retention per data type',
          'Delete your account and its data',
        ]}
        tone="future"
      />
    </div>
  );
}
