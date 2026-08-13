// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Document Management (EPIC-003 / AC-002, Module 8)
// Uploads with version history, metadata, search and preview (MVP storage
// is data-URL based with a 2 MB cap — upgradable to object storage).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useRef, useState } from 'react';
import {
  Upload,
  Search,
  FolderOpen,
  FileText,
  ImageIcon,
  Trash2,
  History,
  Download,
} from 'lucide-react';
import {
  Card,
  Badge,
  Loading,
  ErrorState,
  Button,
  TextField,
  Select,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@vedmoulya/ui';
import { AgencySubNav } from '../../_components/AgencySubNav.js';
import { useAgencyPage } from '../../_components/use-agency-page.js';
import { SignInRedirect } from '../../../../components/SignInRedirect.js';
import {
  useOpsDocuments,
  useOpsSearchDocuments,
  useOpsDocument,
  useUploadDocument,
  useDeleteDocument,
  useContentClients,
} from '../../../../lib/api-client.js';
import { api } from '../../../../lib/trpc.js';

const KIND_LABEL: Record<string, string> = {
  brand_guidelines: 'Brand guidelines',
  logo: 'Logo',
  reference: 'Reference',
  research: 'Research',
  contract: 'Contract',
  image: 'Image',
  other: 'Other',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Documents', '/content-agency/ops/documents');
  const utils = api.useUtils();
  const [query, setQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const documents = useOpsDocuments(userId);
  const search = useOpsSearchDocuments(userId, query);
  const detail = useOpsDocument(userId, selectedId ?? '');
  const clients = useContentClients(userId);
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();

  const invalidate = async (): Promise<void> => {
    await utils.clientOps.listDocuments.invalidate();
    await utils.clientOps.searchDocuments.invalidate();
  };

  if (!ready) return <Loading label="Loading documents…" />;
  if (!userId) return <SignInRedirect />;

  const visible = query.trim().length >= 2 ? (search.data ?? []) : (documents.data ?? []);

  return (
    <div className="space-y-5">
      <AgencySubNav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold font-heading text-[#111827] dark:text-white">
            Documents
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            Brand guidelines, logos, references, contracts and more.
          </p>
        </div>
        <Button
          onClick={() => {
            setUploadOpen(true);
          }}
        >
          <Upload className="h-4 w-4" /> Upload
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="Search documents…"
          className="w-full rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] pl-9 pr-4 py-2.5 text-[13px] text-[#111827] dark:text-white placeholder:text-[#94A3B8] outline-none focus:border-[#2B5FD9] transition-colors"
        />
      </div>

      {documents.isError ? (
        <ErrorState
          title="Could not load documents"
          onRetry={() => {
            void documents.refetch();
          }}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((document) => (
            <Card key={document.id} variant="elevated" className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#2B5FD9]/10 dark:bg-[#2B5FD9]/25 flex items-center justify-center text-[#2B5FD9] shrink-0">
                  {document.kind === 'image' || document.kind === 'logo' ? (
                    <ImageIcon className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => {
                      setSelectedId(document.id);
                    }}
                    className="text-left text-[13.5px] font-semibold text-[#111827] dark:text-white truncate block w-full hover:text-[#2B5FD9] transition-colors"
                  >
                    {document.name}
                  </button>
                  <div className="mt-0.5 text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
                    {KIND_LABEL[document.kind] ?? document.kind} · {formatSize(document.size)}
                  </div>
                </div>
                <Badge className="bg-[#64748B]/10 text-[#64748B]">v{document.currentVersion}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-[#94A3B8]">
                  Updated {new Date(document.updatedAt).toLocaleDateString()}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="!text-[#EF4444]"
                  onClick={() =>
                    void deleteDocument
                      .mutateAsync({ userId, documentId: document.id })
                      .then(async () => invalidate())
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {visible.length === 0 && !documents.isLoading && (
        <div className="text-center py-14 text-[13px] text-[#94A3B8]">
          {query.trim().length >= 2
            ? 'No documents match your search.'
            : 'No documents yet — upload brand guidelines, logos or references.'}
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
        }}
        clients={clients.data ?? []}
        onSubmit={async (input) => {
          await uploadDocument.mutateAsync({ userId, ...input });
          setUploadOpen(false);
          await invalidate();
        }}
      />

      {selectedId && (
        <DocumentDetailDialog
          document={detail.data}
          loading={detail.isLoading}
          onClose={() => {
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}

function UploadDialog(props: {
  open: boolean;
  onClose: () => void;
  clients: Array<{ id: string; company: string }>;
  onSubmit: (input: {
    clientId: string;
    name: string;
    kind: 'brand_guidelines' | 'logo' | 'reference' | 'research' | 'contract' | 'image' | 'other';
    mime: string;
    contentBase64: string;
  }) => Promise<void>;
}): React.JSX.Element {
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('other');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const readAsBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (): void => {
        const result = reader.result as string;
        resolve(result.split(',')[1] ?? '');
      };
      reader.onerror = (): void => {
        reject(new Error('Could not read file'));
      };
      reader.readAsDataURL(f);
    });

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Select
            label="Client *"
            options={props.clients.map((c) => ({ value: c.id, label: c.company }))}
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
            }}
            placeholder="Select client"
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Name *"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              placeholder="Brand Guidelines 2026"
            />
            <Select
              label="Kind"
              options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
              }}
            />
          </div>
          <button
            onClick={() => fileInput.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-[#CBD5E1] dark:border-[#334155] p-6 text-center hover:border-[#2B5FD9]/60 transition-colors"
          >
            <Upload className="h-6 w-6 mx-auto text-[#94A3B8]" />
            <div className="mt-2 text-[13px] text-[#374151] dark:text-[#E2E8F0]">
              {file ? file.name : 'Choose a file'}
            </div>
            <div className="text-[11px] text-[#94A3B8] mt-1">
              {file ? formatSize(file.size) : 'Up to 2 MB (MVP storage)'}
            </div>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
              }}
            />
          </button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            disabled={!clientId || !name.trim() || !file || busy}
            onClick={() =>
              void (async (): Promise<void> => {
                if (!file) return;
                setBusy(true);
                try {
                  const contentBase64 = await readAsBase64(file);
                  await props.onSubmit({
                    clientId,
                    name,
                    kind: kind as
                      | 'brand_guidelines'
                      | 'logo'
                      | 'reference'
                      | 'research'
                      | 'contract'
                      | 'image'
                      | 'other',
                    mime: file.type || 'application/octet-stream',
                    contentBase64,
                  });
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            {busy ? 'Uploading…' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentDetailDialog(props: {
  document?: {
    name: string;
    kind: string;
    mime: string;
    size: number;
    storageKey: string;
    versions: Array<{ version: number; size: number; note?: string; createdAt: string }>;
  };
  loading: boolean;
  onClose: () => void;
}): React.JSX.Element {
  if (props.loading || !props.document) {
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) props.onClose();
        }}
      >
        <DialogContent>
          <Loading label="Loading document…" />
        </DialogContent>
      </Dialog>
    );
  }
  const doc = props.document;
  const isImage = doc.mime.startsWith('image/');

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-[#2B5FD9]" />
            <DialogTitle>{doc.name}</DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-3">
          {isImage ? (
            <img
              src={doc.storageKey}
              alt={doc.name}
              className="w-full rounded-xl border border-[#E2E8F0] dark:border-[#334155]"
            />
          ) : (
            <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] p-4 text-[12.5px] text-[#475569] dark:text-[#CBD5E1] break-all max-h-64 overflow-y-auto">
              {doc.storageKey.length > 0
                ? 'Binary file — preview not available for this type. Download to open.'
                : 'Empty file.'}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <a
              href={doc.storageKey}
              download={doc.name}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2B5FD9] text-white px-4 py-2 text-[13px] font-medium hover:bg-[#3B6FE3] transition-colors"
            >
              <Download className="h-4 w-4" /> Download
            </a>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide mb-2">
              <History className="h-3.5 w-3.5" /> Version history ({doc.versions.length})
            </div>
            <div className="space-y-1.5">
              {doc.versions.map((v) => (
                <div
                  key={v.version}
                  className="flex items-center justify-between rounded-lg bg-[#F8FAFC] dark:bg-[#1E293B] px-3 py-2 text-[12.5px]"
                >
                  <span className="font-medium text-[#374151] dark:text-[#E2E8F0]">
                    v{v.version}
                  </span>
                  <span className="text-[#94A3B8]">
                    {v.note ?? 'version'} · {formatSize(v.size)} ·{' '}
                    {new Date(v.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
