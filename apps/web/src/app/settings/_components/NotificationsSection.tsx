// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Settings → Notifications (UX-07)
//
// HONEST status: there is no notification DELIVERY service in the estate yet
// (no email sender, no web-push subscription). The choices below are real
// per-device preferences (localStorage 'vedmoulya-notifications') that will be
// honoured once delivery exists — and the section says exactly that. It does
// not claim notifications are being sent.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useCallback, useState } from 'react';
import { Card, Switch } from '@vedmoulya/ui';
import { BellRing } from 'lucide-react';
import { SettingsNotice } from './SettingsNotice.js';

const NOTIFICATION_PREF_KEY = 'vedmoulya-notifications';

type NotificationChannel = 'email' | 'push' | 'weeklyDigest';

const CHANNELS: ReadonlyArray<{
  key: NotificationChannel;
  label: string;
  description: string;
}> = [
  {
    key: 'email',
    label: 'Email notifications',
    description: 'Important alerts about your missions and goals.',
  },
  {
    key: 'push',
    label: 'Push notifications',
    description: 'Real-time notifications in your browser or on this device.',
  },
  {
    key: 'weeklyDigest',
    label: 'Weekly digest',
    description: 'A weekly summary of your activity and progress.',
  },
];

const DEFAULT_PREFERENCES: Record<NotificationChannel, boolean> = {
  email: true,
  push: true,
  weeklyDigest: false,
};

function readPreferences(): Record<NotificationChannel, boolean> {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_PREF_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFERENCES;
    const record = parsed as Record<string, unknown>;
    return {
      email: typeof record.email === 'boolean' ? record.email : DEFAULT_PREFERENCES.email,
      push: typeof record.push === 'boolean' ? record.push : DEFAULT_PREFERENCES.push,
      weeklyDigest:
        typeof record.weeklyDigest === 'boolean'
          ? record.weeklyDigest
          : DEFAULT_PREFERENCES.weeklyDigest,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function NotificationsSection(): React.JSX.Element {
  const [preferences, setPreferences] = useState(readPreferences);

  const persist = useCallback((next: Record<NotificationChannel, boolean>): void => {
    try {
      window.localStorage.setItem(NOTIFICATION_PREF_KEY, JSON.stringify(next));
    } catch {
      // best-effort persistence — the in-memory preference still applies
    }
  }, []);

  return (
    <Card variant="standard" padding="lg" data-testid="settings-notifications">
      <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
        Notifications
      </h3>
      <p className="mt-1 mb-5 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
        Which updates you want VedMoulya to send you.
      </p>

      <div className="space-y-0 mb-5">
        {CHANNELS.map((channel) => (
          <div
            key={channel.key}
            className="flex items-center justify-between gap-4 py-3 border-b border-[#F1F5F9] dark:border-[#334155] last:border-0"
          >
            <div className="flex items-center gap-3">
              <BellRing
                className="h-4 w-4 shrink-0 text-[#64748B] dark:text-[#94A3B8]"
                aria-hidden="true"
              />
              <div>
                <p className="text-[14px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                  {channel.label}
                </p>
                <p className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
                  {channel.description}
                </p>
              </div>
            </div>
            <Switch
              checked={preferences[channel.key]}
              label={channel.label}
              id={`notification-${channel.key}`}
              onCheckedChange={(checked) => {
                setPreferences((prev) => {
                  const next = { ...prev, [channel.key]: checked };
                  persist(next);
                  return next;
                });
              }}
            />
          </div>
        ))}
      </div>

      <SettingsNotice
        title="Delivery is not live yet"
        description="These preferences are saved on this device, but no email or push delivery service is implemented yet — nothing is being sent today. Your choices will be honoured once delivery ships."
        tone="future"
      />
    </Card>
  );
}
