import { Capacitor, registerPlugin } from '@capacitor/core';
import { Attachment } from '../types';

/**
 * Interface for native Android DocumentOpener Capacitor Plugin
 */
export interface DocumentOpenerPlugin {
  openDocument(options: {
    dataUrl: string;
    fileName: string;
    mimeType: string;
  }): Promise<{ success: boolean }>;
}

export const DocumentOpener = registerPlugin<DocumentOpenerPlugin>('DocumentOpener');

/**
 * Resolves standard Android MIME type for lead documents and photos.
 */
export function getAndroidMimeType(fileName: string, dataUrl?: string): string {
  // 1. Check data URL header if available
  if (dataUrl && dataUrl.startsWith('data:')) {
    const headerMatch = dataUrl.match(/^data:([^;]+);/);
    if (headerMatch && headerMatch[1] && headerMatch[1] !== 'application/octet-stream') {
      return headerMatch[1];
    }
  }

  // 2. Derive strictly from file extension
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    // PDF -> Android's default PDF viewer/app
    case 'pdf':
      return 'application/pdf';

    // JPG/JPEG/PNG/WEBP -> Android's default image viewer
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'svg':
      return 'image/svg+xml';

    // DOC/DOCX -> compatible installed document app
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // XLS/XLSX -> compatible spreadsheet app
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'csv':
      return 'text/csv';

    // PPT/PPTX -> compatible presentation app
    case 'ppt':
      return 'application/vnd.ms-powerpoint';
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    // Audio files -> continue playing inside PropLead
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'm4a':
      return 'audio/mp4';
    case 'ogg':
      return 'audio/ogg';
    case 'aac':
      return 'audio/aac';
    case 'webm':
      return 'audio/webm';
    case 'amr':
      return 'audio/amr';

    default:
      return 'application/octet-stream';
  }
}

/**
 * Identifies if a file is an audio file or voice recording
 */
export function isAudioAttachment(attachment: Attachment): boolean {
  if (attachment.url && attachment.url.startsWith('data:audio/')) return true;
  const ext = attachment.name.split('.').pop()?.toLowerCase() || '';
  return ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'webm', 'amr', 'opus', 'flac'].includes(ext);
}

/**
 * Converts a base64 or Data URL into a standard Blob object with the specified MIME type.
 */
function dataUrlToBlob(dataUrl: string, mimeType: string): Blob {
  try {
    if (dataUrl.startsWith('data:')) {
      const parts = dataUrl.split(',');
      const byteCharacters = atob(parts[1]);
      const byteArrays = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArrays[i] = byteCharacters.charCodeAt(i);
      }
      return new Blob([byteArrays], { type: mimeType });
    }
  } catch (err) {
    console.warn('[DocumentOpener] Base64 conversion warning:', err);
  }
  return new Blob([], { type: mimeType });
}

export interface OpenDocumentResult {
  success: boolean;
  isAudio?: boolean;
  message?: string;
}

/**
 * Opens a lead document using Android native ACTION_VIEW and correct MIME type,
 * or handles playback inside PropLead if it's an audio file.
 */
export async function openLeadDocument(
  attachment: Attachment,
  handlers?: {
    onPlayAudio?: (url: string) => void;
  }
): Promise<OpenDocumentResult> {
  // 1. Audio files & Voice Notes -> continue playing inside PropLead
  if (isAudioAttachment(attachment)) {
    if (handlers?.onPlayAudio && attachment.url) {
      handlers.onPlayAudio(attachment.url);
      return { success: true, isAudio: true };
    }
    return { success: true, isAudio: true };
  }

  if (!attachment.url) {
    return {
      success: false,
      message: 'No app available to open this file.',
    };
  }

  const mimeType = getAndroidMimeType(attachment.name, attachment.url);

  // 2. Native Android via Capacitor
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await DocumentOpener.openDocument({
        dataUrl: attachment.url,
        fileName: attachment.name,
        mimeType,
      });
      if (res && res.success) {
        return { success: true };
      }
    } catch (err: any) {
      console.warn('[DocumentOpener] Native openDocument failed:', err);
      const errMsg = err?.message || String(err || '');
      if (
        errMsg.includes('NO_APP') ||
        errMsg.includes('No app available') ||
        errMsg.includes('ActivityNotFoundException')
      ) {
        return {
          success: false,
          message: 'No app available to open this file.',
        };
      }
      // Return the required user-facing message if native open failed
      return {
        success: false,
        message: 'No app available to open this file.',
      };
    }
  }

  // 3. Web / Mobile Chrome fallback:
  try {
    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';

    if (attachment.url.startsWith('data:')) {
      const blob = dataUrlToBlob(attachment.url, mimeType);
      const blobUrl = URL.createObjectURL(blob);

      if (isImage || isPdf) {
        const openedWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
        if (!openedWindow) {
          // Popup blocked or not handled: trigger link
          const link = document.createElement('a');
          link.href = blobUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        // Office documents: DOC/DOCX, XLS/XLSX, PPT/PPTX
        // Download/open intent via Blob link so device's office viewer handles it
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = attachment.name;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Revoke after delay to allow browser to open
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 30000);

      return { success: true };
    } else {
      // Remote URL
      const opened = window.open(attachment.url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        const link = document.createElement('a');
        link.href = attachment.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      return { success: true };
    }
  } catch (webErr) {
    console.error('[DocumentOpener] Fallback open failed:', webErr);
    return {
      success: false,
      message: 'No app available to open this file.',
    };
  }
}
