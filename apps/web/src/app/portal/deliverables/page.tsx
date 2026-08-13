// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Client Portal: Deliverables (EPIC-003 / AC-002, Module 7)
// Download approved / scheduled / published content as Markdown or HTML.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Card, Badge, Loading, ErrorState, Button } from '@vedmoulya/ui';
import { PortalShell } from '../_components/PortalShell.js';
import { getPortalToken } from '../../../lib/portal-session.js';
import { usePortalContent, usePortalDeliverable } from '../../../lib/api-client.js';

const READY = new Set(['approved', 'scheduled', 'published']);

export default function PortalDeliverablesPage(): React.JSX.Element | null {
  const [token, setToken] = useState('');
  useEffect(() => {
    setToken(getPortalToken());
  }, []);
  const content = usePortalContent(token);
  const portalDeliverable = usePortalDeliverable();

  if (!token) return null;

  const download = (data: string, filename: string, mime: string): void => {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async (contentId: string, format: 'markdown' | 'html'): Promise<void> => {
    const result = await portalDeliverable(token, contentId, format);
    if (result) {
      download(result.data, result.filename, format === 'html' ? 'text/html' : 'text/markdown');
    }
  };

  const ready = (content.data ?? []).filter((c) => READY.has(c.status));

  return (
    <PortalShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold font-heading text-[#111827] dark:text-white">
            Deliverables
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            Approved and published content ready to download.
          </p>
        </div>

        {content.isError ? (
          <ErrorState
            title="Could not load deliverables"
            onRetry={() => {
              void content.refetch();
            }}
          />
        ) : content.isLoading ? (
          <Loading label="Loading deliverables…" />
        ) : ready.length === 0 ? (
          <Card variant="elevated" className="p-10 text-center text-[13px] text-[#94A3B8]">
            No deliverables are available yet. Approved content will appear here.
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {ready.map((item) => (
              <Card key={item.id} variant="elevated" className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-[#10B981]/10 dark:bg-[#10B981]/25 flex items-center justify-center text-[#10B981] shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold text-[#111827] dark:text-white truncate">
                      {item.title}
                    </div>
                    <div className="text-[11.5px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                      {item.contentType} · {new Date(item.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge className="bg-[#10B981]/10 text-[#10B981] capitalize">{item.status}</Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleDownload(item.id, 'markdown')}
                  >
                    <Download className="h-3.5 w-3.5" /> Markdown
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleDownload(item.id, 'html')}
                  >
                    <Download className="h-3.5 w-3.5" /> HTML
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
