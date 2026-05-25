import { createSignal, createMemo } from "solid-js";
import type { FilePartInput } from "@srdcloud/codefree-o-sdk/v2/client";

export interface SelectionAttachment {
  id: string;
  filePath: string;
  fileUrl: string;
  startLine?: number;
  endLine?: number;
}

export interface ImageAttachment {
  id: string;
  dataUrl: string; // base64 data URL
  filename: string;
  mimeType: string; // e.g. "image/png"
}

export interface AttachmentChip {
  id: string;
  label: string;
  title: string;
  imageUrl?: string;
}

export function useAttachments(
  sessionKey: () => string,
  workspaceRoot: () => string | undefined,
): {
  selectionAttachments: () => SelectionAttachment[];
  setSelectionAttachments: (value: SelectionAttachment[] | ((prev: SelectionAttachment[]) => SelectionAttachment[])) => void;
  setSelectionAttachmentsForKey: (key: string, value: SelectionAttachment[] | ((prev: SelectionAttachment[]) => SelectionAttachment[])) => void;
  imageAttachments: () => ImageAttachment[];
  setImageAttachmentsBySession: (fn: (prev: Map<string, ImageAttachment[]>) => Map<string, ImageAttachment[]>) => void;
  handleImagePaste: (dataUrl: string, filename: string) => void;
  attachmentChips: () => AttachmentChip[];
  handleRemoveAttachment: (id: string) => void;
  buildSelectionParts: (attachments: SelectionAttachment[]) => FilePartInput[];
  buildImageParts: (images: ImageAttachment[]) => FilePartInput[];
  buildWorkspaceFileUrl: (workspaceRoot: string, relativePath: string) => string;
  getFilename: (filePath: string) => string;
  formatSelectionLabel: (attachment: SelectionAttachment) => string;
} {
  const [selectionAttachmentsBySession, setSelectionAttachmentsBySession] = createSignal<
    Map<string, SelectionAttachment[]>
  >(new Map());
  const [imageAttachmentsBySession, setImageAttachmentsBySession] = createSignal<
    Map<string, ImageAttachment[]>
  >(new Map());

  const selectionAttachments = () => selectionAttachmentsBySession().get(sessionKey()) || [];
  const setSelectionAttachmentsForKey = (
    key: string,
    value: SelectionAttachment[] | ((prev: SelectionAttachment[]) => SelectionAttachment[])
  ) => {
    setSelectionAttachmentsBySession((prev) => {
      const next = new Map(prev);
      const current = next.get(key) || [];
      const updated = typeof value === "function" ? value(current) : value;
      next.set(key, updated);
      return next;
    });
  };
  const setSelectionAttachments = (
    value: SelectionAttachment[] | ((prev: SelectionAttachment[]) => SelectionAttachment[])
  ) => {
    setSelectionAttachmentsForKey(sessionKey(), value);
  };

  const imageAttachments = () => imageAttachmentsBySession().get(sessionKey()) || [];

  const handleImagePaste = (dataUrl: string, filename: string) => {
    const key = sessionKey();
    const mimeType = dataUrl.match(/^data:(image\/\w+);/)?.[1] || "image/png";
    const attachment: ImageAttachment = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dataUrl,
      filename,
      mimeType,
    };
    setImageAttachmentsBySession((prev) => {
      const next = new Map(prev);
      const current = next.get(key) || [];
      next.set(key, [...current, attachment]);
      return next;
    });
  };

  const getFilename = (filePath: string) => {
    const normalized = filePath.replace(/\\/g, "/");
    const parts = normalized.split("/");
    return parts[parts.length - 1] || filePath;
  };

  const buildWorkspaceFileUrl = (workspaceRoot: string, relativePath: string) => {
    const normalizedRoot = workspaceRoot.replace(/\\/g, "/").replace(/\/+$/, "");
    const normalizedPath = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const base = `file://${normalizedRoot}/`;
    return new URL(normalizedPath, base).toString();
  };

  const formatSelectionLabel = (attachment: SelectionAttachment) => {
    const filename = getFilename(attachment.filePath);
    if (attachment.startLine && attachment.endLine && attachment.startLine !== attachment.endLine) {
      return `${filename} L${attachment.startLine}-${attachment.endLine}`;
    }
    if (attachment.startLine) {
      return `${filename} L${attachment.startLine}`;
    }
    return filename;
  };

  const buildSelectionParts = (attachments: SelectionAttachment[]): FilePartInput[] => {
    return attachments.map((attachment) => {
      const url = new URL(attachment.fileUrl);
      
      if (attachment.startLine !== undefined) {
        const start = attachment.endLine
          ? Math.min(attachment.startLine, attachment.endLine)
          : attachment.startLine;
        const end = attachment.endLine
          ? Math.max(attachment.startLine, attachment.endLine)
          : attachment.startLine;
        url.searchParams.set("start", String(start));
        url.searchParams.set("end", String(end));
      }
      
      return {
        type: "file" as const,
        mime: "text/plain",
        url: url.toString(),
        filename: getFilename(attachment.filePath),
        source: {
          type: "file" as const,
          path: attachment.filePath,
          text: {
            value: "",
            start: 0,
            end: 0,
          },
        },
      };
    });
  };

  const buildImageParts = (images: ImageAttachment[]): FilePartInput[] => {
    return images.map((img) => ({
      type: "file" as const,
      mime: img.mimeType,
      url: img.dataUrl,
      filename: img.filename,
      source: {
        type: "file" as const,
        path: "",
        text: {
          value: "",
          start: 0,
          end: 0,
        },
      },
    }));
  };

  const attachmentChips = createMemo(() => {
    const selectionChips = selectionAttachments().map((attachment) => ({
      id: attachment.id,
      label: formatSelectionLabel(attachment),
      title: attachment.filePath,
    }));
    const imageChips = imageAttachments().map((img) => ({
      id: img.id,
      label: img.filename,
      title: img.filename,
      imageUrl: img.dataUrl,
    }));
    return [...selectionChips, ...imageChips];
  });

  const handleRemoveAttachment = (id: string) => {
    setSelectionAttachments((prev) => prev.filter((item) => item.id !== id));
    // Also check image attachments
    const key = sessionKey();
    setImageAttachmentsBySession((prev) => {
      const current = prev.get(key);
      if (!current) return prev;
      const filtered = current.filter((img) => img.id !== id);
      if (filtered.length === current.length) return prev;
      const next = new Map(prev);
      next.set(key, filtered);
      return next;
    });
  };

  return {
    selectionAttachments,
    setSelectionAttachments,
    setSelectionAttachmentsForKey,
    imageAttachments,
    setImageAttachmentsBySession,
    handleImagePaste,
    attachmentChips,
    handleRemoveAttachment,
    buildSelectionParts,
    buildImageParts,
    buildWorkspaceFileUrl,
    getFilename,
    formatSelectionLabel,
  };
}
