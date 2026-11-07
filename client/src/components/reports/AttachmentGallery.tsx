import { useState } from 'react';
import { FileImage, ImageOff } from 'lucide-react';
import type { Attachment } from '../../types';
import { formatBytes, formatDate } from '../../utils/format';
import { Badge } from '../ui/base';

export function AttachmentGallery({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) {
    return (
      <p className="text-xs text-ink-muted">No attachments have been added to this report.</p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {attachments.map((attachment) => (
        <AttachmentCard key={attachment.id} attachment={attachment} />
      ))}
    </ul>
  );
}

function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const [failed, setFailed] = useState(false);
  return (
    <li className="overflow-hidden border border-line bg-surface">
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="group block bg-paper-deep"
        aria-label={`Open ${attachment.originalName} in a new tab`}
      >
        {failed ? (
          <div className="flex h-32 items-center justify-center gap-2 text-[11px] text-ink-muted">
            <ImageOff aria-hidden="true" className="size-4" />
            Preview unavailable — open file
          </div>
        ) : (
          <img
            src={attachment.url}
            alt={attachment.originalName}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-32 w-full object-cover transition-opacity group-hover:opacity-90"
          />
        )}
      </a>
      <div className="flex items-start justify-between gap-2 px-2.5 py-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-ink">{attachment.originalName}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-muted">
            <FileImage aria-hidden="true" className="size-3" />
            {formatBytes(attachment.size)} · {formatDate(attachment.createdAt)}
          </p>
        </div>
        <Badge tone={attachment.visibility === 'internal' ? 'warn' : 'neutral'}>
          {attachment.visibility === 'internal' ? 'Internal' : 'Citizen'}
        </Badge>
      </div>
    </li>
  );
}
