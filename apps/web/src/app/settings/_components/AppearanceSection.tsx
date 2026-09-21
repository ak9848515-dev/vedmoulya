// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Settings → Appearance (UX-07)
//
// REAL, persisted preferences only:
//   • Theme — owned by the design-system ThemeProvider (localStorage
//     'vedmoulya-theme'), applied to <html> immediately.
//   • Haptic feedback — owned by lib/haptics (localStorage 'vedmoulya-haptics'),
//     read at module load so it survives restarts.
//
// The previous "Content Density" selector was removed: it had no persistence,
// no tokens behind it and affected nothing. UX-07 forbids controls that look
// wired but are not.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Switch, useTheme } from '@vedmoulya/ui';
import { Monitor, Moon, Sun, Vibrate } from 'lucide-react';
import { hapticTap, setHapticsEnabled } from '../../../lib/haptics.js';

const HAPTICS_KEY = 'vedmoulya-haptics';

function readHapticsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(HAPTICS_KEY) !== 'off';
  } catch {
    return true;
  }
}

const THEME_OPTIONS = [
  { id: 'light' as const, label: 'Light', icon: <Sun className="h-5 w-5" aria-hidden="true" /> },
  { id: 'dark' as const, label: 'Dark', icon: <Moon className="h-5 w-5" aria-hidden="true" /> },
  {
    id: 'system' as const,
    label: 'System',
    icon: <Monitor className="h-5 w-5" aria-hidden="true" />,
  },
];

export function AppearanceSection(): React.JSX.Element {
  const { theme, setTheme } = useTheme();
  const [haptics, setHaptics] = useState(readHapticsEnabled);

  return (
    <Card variant="standard" padding="lg" data-testid="settings-appearance">
      <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F8FAFC]">Appearance</h3>
      <p className="mt-1 mb-6 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
        How VedMoulya looks and feels on this device.
      </p>

      <div className="space-y-6">
        <div>
          <p className="text-[14px] font-medium text-[#374151] dark:text-[#E2E8F0] mb-3">Theme</p>
          <div className="flex gap-3" role="group" aria-label="Theme" data-testid="theme-options">
            {THEME_OPTIONS.map((option) => {
              const isActive = theme === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    setTheme(option.id);
                  }}
                  aria-pressed={isActive}
                  data-testid={`theme-${option.id}`}
                  className={`
                    flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors
                    ${
                      isActive
                        ? 'border-[#2B5FD9] bg-[#EFF4FE] dark:bg-[#1E3A5F]'
                        : 'border-[#E2E8F0] dark:border-[#334155] hover:border-[#2B5FD9] hover:bg-[#EFF4FE] dark:hover:bg-[#1E293B]'
                    }
                  `}
                >
                  <span
                    className={
                      isActive
                        ? 'text-[#2B5FD9] dark:text-[#6B8FEF]'
                        : 'text-[#64748B] dark:text-[#94A3B8]'
                    }
                  >
                    {option.icon}
                  </span>
                  <span className="text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-[#94A3B8]" data-testid="theme-current">
            Current preference: {theme}
          </p>
        </div>

        <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#334155]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Vibrate className="h-5 w-5 text-[#64748B] dark:text-[#94A3B8]" aria-hidden="true" />
              <div>
                <p className="text-[14px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                  Haptic feedback
                </p>
                <p className="text-[12px] text-[#94A3B8]">
                  Subtle vibration on taps and refreshes (Android).
                </p>
              </div>
            </div>
            <Switch
              checked={haptics}
              label="Haptic feedback"
              id="settings-haptics"
              onCheckedChange={(checked) => {
                setHaptics(checked);
                setHapticsEnabled(checked);
                try {
                  window.localStorage.setItem(HAPTICS_KEY, checked ? 'on' : 'off');
                } catch {
                  // best-effort persistence — the in-memory preference still applies
                }
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
