'use client';

import React, { useEffect } from 'react';
import {
  Card,
  Badge,
  Tabs as TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  TextField,
  Switch,
  Button,
} from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { Settings, User, Bell, Palette, Key, Shield, Save } from 'lucide-react';
import { useNavigationStore } from '../../stores/navigation-store.js';

export default function SettingsPage(): React.JSX.Element {
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = React.useState('profile');
  const [notifications, setNotifications] = React.useState({
    email: true,
    push: true,
    weeklyDigest: false,
  });

  useEffect(() => {
    setActiveSection('dashboard');
    setBreadcrumbs([{ label: 'Settings' }]);
  }, [setActiveSection, setBreadcrumbs]);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827]">Settings</h1>
            <Badge variant="info" size="sm">
              Preferences
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B]">
            Manage your profile, preferences, and application configuration
          </p>
        </div>
      </div>

      <TabsRoot value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-1.5" /> Profile
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-1.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4 mr-1.5" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="api">
            <Key className="h-4 w-4 mr-1.5" /> API & Integrations
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-1.5" /> Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ErrorBoundary section="settings-profile">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827] mb-6">Profile Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextField
                  label="Display Name"
                  placeholder="Enter your name"
                  defaultValue="User"
                  size="md"
                />
                <TextField
                  label="Email"
                  placeholder="email@example.com"
                  type="email"
                  defaultValue="user@vedmoulya.com"
                  size="md"
                />
                <TextField
                  label="Role / Title"
                  placeholder="Your role"
                  defaultValue="Product Engineer"
                  size="md"
                />
                <TextField
                  label="Timezone"
                  placeholder="UTC"
                  defaultValue="America/New_York"
                  size="md"
                />
              </div>
              <div className="mt-6 pt-6 border-t border-[#E2E8F0]">
                <Button variant="primary" size="md" className="flex items-center gap-2">
                  <Save className="h-4 w-4" /> Save Changes
                </Button>
              </div>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="notifications">
          <ErrorBoundary section="settings-notifications">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827] mb-6">
                Notification Preferences
              </h3>
              <div className="space-y-6">
                {[
                  {
                    key: 'email' as const,
                    label: 'Email Notifications',
                    desc: 'Receive daily digest and important alerts via email',
                  },
                  {
                    key: 'push' as const,
                    label: 'Push Notifications',
                    desc: 'Get real-time notifications in your browser',
                  },
                  {
                    key: 'weeklyDigest' as const,
                    label: 'Weekly Digest',
                    desc: 'Receive a weekly summary of your activity and progress',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-3 border-b border-[#F1F5F9] last:border-0"
                  >
                    <div>
                      <p className="text-[14px] font-medium text-[#374151]">{item.label}</p>
                      <p className="text-[13px] text-[#64748B]">{item.desc}</p>
                    </div>
                    <Switch
                      checked={notifications[item.key]}
                      onCheckedChange={(checked) => {
                        setNotifications((prev) => ({ ...prev, [item.key]: checked }));
                      }}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="appearance">
          <ErrorBoundary section="settings-appearance">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827] mb-6">Appearance</h3>
              <div className="space-y-6">
                <div>
                  <p className="text-[14px] font-medium text-[#374151] mb-3">Theme</p>
                  <div className="flex gap-3">
                    {[
                      { id: 'light', label: 'Light', icon: <Palette className="h-5 w-5" /> },
                      { id: 'dark', label: 'Dark', icon: <Palette className="h-5 w-5" /> },
                      { id: 'system', label: 'System', icon: <Settings className="h-5 w-5" /> },
                    ].map((theme) => (
                      <button
                        key={theme.id}
                        className="flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border border-[#E2E8F0] hover:border-[#2B5FD9] hover:bg-[#EFF4FE] transition-colors"
                      >
                        {theme.icon}
                        <span className="text-[13px] font-medium text-[#374151]">
                          {theme.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-4 border-t border-[#E2E8F0]">
                  <p className="text-[14px] font-medium text-[#374151] mb-2">Content Density</p>
                  <div className="flex gap-3">
                    {['Spacious', 'Comfortable', 'Compact'].map((density) => (
                      <button
                        key={density}
                        className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-[13px] font-medium text-[#374151] hover:border-[#2B5FD9] transition-colors"
                      >
                        {density}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="api">
          <ErrorBoundary section="settings-api">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827] mb-2">API & Integrations</h3>
              <p className="text-[14px] text-[#64748B] mb-6">
                Manage API keys and third-party integrations
              </p>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div>
                    <p className="text-[14px] font-medium text-[#374151]">API Access</p>
                    <p className="text-[12px] text-[#94A3B8]">Connected via tRPC</p>
                  </div>
                  <Badge variant="success" size="md">
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div>
                    <p className="text-[14px] font-medium text-[#374151]">AI Providers</p>
                    <p className="text-[12px] text-[#94A3B8]">3 providers configured</p>
                  </div>
                  <Badge variant="info" size="md">
                    Configured
                  </Badge>
                </div>
              </div>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="security">
          <ErrorBoundary section="settings-security">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827] mb-2">Security</h3>
              <p className="text-[14px] text-[#64748B] mb-6">
                Manage your security preferences and authentication
              </p>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-[#22C55E]" />
                    <div>
                      <p className="text-[14px] font-medium text-[#374151]">
                        Two-Factor Authentication
                      </p>
                      <p className="text-[12px] text-[#94A3B8]">Add an extra layer of security</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm">
                    Enable
                  </Button>
                </div>
              </div>
            </Card>
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
