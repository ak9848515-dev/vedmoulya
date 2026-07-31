'use client';

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Signed Out Card
// Shown on pages when no authenticated session is available (BLD-016C).
// Authentication is strictly enforced: signed-out users see this instead of
// any protected content.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Card } from '@vedmoulya/ui';
import { AlertTriangle } from 'lucide-react';

export function SignedOutCard(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <Card variant="standard" padding="lg" className="max-w-md text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-full bg-[#FEF2F2]">
            <AlertTriangle className="h-6 w-6 text-[#EF4444]" />
          </div>
          <h2 className="text-[18px] font-heading font-semibold text-[#111827]">
            Sign In Required
          </h2>
          <p className="text-[14px] text-[#64748B]">
            Authentication is required to view this page. Sign in to continue.
          </p>
        </div>
      </Card>
    </div>
  );
}
