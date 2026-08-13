'use client';

import React, { useState } from 'react';
import {
  Card,
  Badge,
  Loading,
  EmptyState,
  Button,
  TextField,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
} from '@vedmoulya/ui';
import { FolderKanban, Plus } from 'lucide-react';
import { ErrorBoundary } from '../../../components/ErrorBoundary.js';
import {
  useContentProjects,
  useContentClients,
  useCreateContentProject,
} from '../../../lib/api-client.js';
import { SignInRedirect } from '../../../components/SignInRedirect.js';
import { useAgencyPage } from '../_components/use-agency-page.js';
import { AgencySubNav } from '../_components/AgencySubNav.js';

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-[#EFF4FE] text-[#1D4ED8]' },
  paused: { label: 'Paused', className: 'bg-[#FFFBEB] text-[#B45309]' },
  completed: { label: 'Completed', className: 'bg-[#F0FDF4] text-[#15803D]' },
  cancelled: { label: 'Cancelled', className: 'bg-[#F1F5F9] text-[#64748B]' },
};
const DEFAULT_STATUS_STYLE = { label: 'Active', className: 'bg-[#EFF4FE] text-[#1D4ED8]' };

export default function ProjectsPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Projects', '/content-agency/projects');
  const projects = useContentProjects(userId);
  const clients = useContentClients(userId);
  const create = useCreateContentProject();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: '', name: '', description: '' });

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading projects..." size="lg" />
      </div>
    );
  }
  if (!userId) return <SignInRedirect />;

  const data = projects.data ?? [];
  const clientOptions = (clients.data ?? []).map((c) => ({ value: c.id, label: c.company }));
  const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.company]));

  async function handleCreate(): Promise<void> {
    if (!form.name.trim() || !form.clientId) return;
    await create.mutateAsync({
      userId,
      clientId: form.clientId,
      name: form.name,
      description: form.description,
    });
    setForm({ clientId: '', name: '', description: '' });
    setOpen(false);
    void projects.refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827] dark:text-[#F1F5F9]">
              Projects
            </h1>
            <Badge variant="info" size="sm">
              {data.length} total
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8]">
            Content sprints and retainers, organized per client.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Project
        </Button>
      </div>

      <AgencySubNav />

      <ErrorBoundary section="content-agency-projects">
        {projects.isLoading && !data.length ? (
          <Loading label="Loading projects..." />
        ) : !data.length ? (
          <Card variant="standard" padding="lg">
            <EmptyState
              icon={<FolderKanban className="h-8 w-8 text-[#F59E0B]" />}
              title="No projects yet"
              description="Group content work into projects for a client."
              action={{
                label: 'Create your first project',
                onClick: () => {
                  setOpen(true);
                },
              }}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.map((project) => {
              const style = STATUS_STYLES[project.status] ?? DEFAULT_STATUS_STYLE;
              return (
                <Card key={project.id} variant="standard" padding="md" className="h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#FFFBEB]">
                        <FolderKanban className="h-5 w-5 text-[#F59E0B]" />
                      </div>
                      <div>
                        <p className="text-[14.5px] font-semibold text-[#111827] dark:text-[#F1F5F9]">
                          {project.name}
                        </p>
                        <p className="text-[12px] text-[#64748B]">
                          {clientName.get(project.clientId) ?? 'Unknown client'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.className}`}
                    >
                      {style.label}
                    </span>
                  </div>
                  {project.description && (
                    <p className="mt-3 text-[12.5px] text-[#64748B] dark:text-[#94A3B8] line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="mt-4 pt-3 border-t border-[#F1F5F9] dark:border-[#1E293B] flex items-center justify-between text-[11.5px] text-[#94A3B8]">
                    <span>
                      Started{' '}
                      {new Date(project.startDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span>{project.status === 'active' ? 'In progress' : project.status}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </ErrorBoundary>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              label="Client"
              options={clientOptions}
              placeholder="Select a client"
              value={form.clientId}
              onChange={(e) => {
                setForm({ ...form, clientId: e.target.value });
              }}
            />
            <TextField
              label="Project name"
              placeholder="Q3 Content Sprint"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
              }}
            />
            <Textarea
              label="Description"
              placeholder="What is this project about?"
              value={form.description}
              onChange={(e) => {
                setForm({ ...form, description: e.target.value });
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!form.name.trim() || !form.clientId || create.isPending}
              onClick={() => void handleCreate()}
            >
              {create.isPending ? 'Creating…' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
