'use client';

import React, { useState } from 'react';
import {
  Card,
  Badge,
  Loading,
  EmptyState,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@vedmoulya/ui';
import { Send, FileDown, Copy, Check, FileText } from 'lucide-react';
import { ErrorBoundary } from '../../../components/ErrorBoundary.js';
import { useContentItems, useContentExport } from '../../../lib/api-client.js';
import { SignInRedirect } from '../../../components/SignInRedirect.js';
import { useAgencyPage } from '../_components/use-agency-page.js';
import { AgencySubNav } from '../_components/AgencySubNav.js';

type DeliverTab = 'deliverable' | 'all';

export default function DeliveryPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Delivery', '/content-agency/delivery');
  const items = useContentItems(userId);
  const exportContent = useContentExport();
  const [tab, setTab] = useState<DeliverTab>('deliverable');
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<{
    title: string;
    filename: string;
    data: string;
    supported: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading delivery queue..." size="lg" />
      </div>
    );
  }
  if (!userId) return <SignInRedirect />;

  const all = items.data ?? [];
  const deliverable = all.filter((i) => i.status === 'published' || i.status === 'approved');
  const shown = tab === 'deliverable' ? deliverable : all;

  async function handleExport(
    item: { id: string; title: string },
    format: 'markdown' | 'html' | 'pdf' | 'docx',
  ): Promise<void> {
    setExporting(item.id);
    try {
      const res = await exportContent(userId, item.id, format);
      if (res) {
        setExportResult({
          title: item.title,
          filename: res.filename,
          data: res.data,
          supported: res.supported,
        });
        setCopied(false);
      }
    } finally {
      setExporting(null);
    }
  }

  function downloadExport(): void {
    if (!exportResult) return;
    const blob = new Blob([exportResult.data], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportResult.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyExport(): Promise<void> {
    if (!exportResult) return;
    await navigator.clipboard.writeText(exportResult.data);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-[28px] font-heading font-bold text-[#111827] dark:text-[#F1F5F9]">
          Delivery
        </h1>
        <Badge variant="info" size="sm">
          {deliverable.length} ready to deliver
        </Badge>
      </div>
      <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8] -mt-4">
        Export approved content as Markdown or HTML. PDF / DOCX / Google Docs are roadmap items.
      </p>

      <AgencySubNav />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as DeliverTab);
        }}
      >
        <TabsList>
          <TabsTrigger value="deliverable">Ready to deliver ({deliverable.length})</TabsTrigger>
          <TabsTrigger value="all">All content ({all.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <ErrorBoundary section="content-agency-delivery">
            {items.isLoading && !all.length ? (
              <Loading label="Loading delivery queue..." />
            ) : !shown.length ? (
              <Card variant="standard" padding="lg">
                <EmptyState
                  icon={<Send className="h-8 w-8 text-[#2B5FD9]" />}
                  title="Nothing to deliver yet"
                  description="Approve content in Review to make it available for export."
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {shown.map((item) => (
                  <Card key={item.id} variant="standard" padding="md" className="h-full">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#111827] dark:text-[#F1F5F9] truncate">
                          {item.title}
                        </p>
                        <p className="text-[12px] text-[#64748B] capitalize">{item.contentType}</p>
                      </div>
                      <Badge
                        variant={item.status === 'published' ? 'success' : 'info'}
                        size="sm"
                        className="capitalize"
                      >
                        {item.status}
                      </Badge>
                    </div>
                    {item.publishedUrl && (
                      <a
                        href={item.publishedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-[12px] text-[#2B5FD9] hover:underline truncate mb-3"
                      >
                        {item.publishedUrl}
                      </a>
                    )}
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleExport(item, 'markdown')}
                        disabled={exporting === item.id}
                      >
                        <FileDown className="h-3.5 w-3.5 mr-1" /> MD
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleExport(item, 'html')}
                        disabled={exporting === item.id}
                      >
                        <FileDown className="h-3.5 w-3.5 mr-1" /> HTML
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleExport(item, 'pdf')}
                        disabled={exporting === item.id}
                      >
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleExport(item, 'docx')}
                        disabled={exporting === item.id}
                      >
                        DOCX
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ErrorBoundary>
        </TabsContent>
      </Tabs>

      {/* Export dialog */}
      <Dialog
        open={exportResult !== null}
        onOpenChange={(open) => {
          if (!open) setExportResult(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Export — {exportResult?.title}</DialogTitle>
          </DialogHeader>
          {exportResult && (
            <div className="space-y-4">
              {exportResult.supported ? (
                <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#F1F5F9] dark:border-[#1E293B] p-4 max-h-[320px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-[#374151] dark:text-[#E2E8F0] font-sans">
                    {exportResult.data}
                  </pre>
                </div>
              ) : (
                <p className="text-[13.5px] text-[#B45309] bg-[#FFFBEB] dark:bg-[#451A03] dark:text-[#FBBF24] rounded-lg p-3">
                  <FileText className="h-4 w-4 inline mr-1.5" />
                  {exportResult.filename} export is on the roadmap. The Markdown source is shown so
                  you can paste into any tool.
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#94A3B8]">{exportResult.filename}</span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => void copyExport()}>
                    {copied ? (
                      <Check className="h-3.5 w-3.5 mr-1 text-[#22C55E]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1" />
                    )}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button variant="primary" size="sm" onClick={downloadExport}>
                    <FileDown className="h-3.5 w-3.5 mr-1" /> Download
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setExportResult(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
