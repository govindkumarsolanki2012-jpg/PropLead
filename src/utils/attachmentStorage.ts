import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { storage, auth, db } from '../lib/firebase';
import { cleanFirestorePayload } from '../services/firebaseService';
import { Attachment, Lead, ActivityLog } from '../types';
import { Capacitor } from '@capacitor/core';

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'apk', 'bin', 'com', 'msi', 'vbs', 'scr', 'jar',
]);

export interface UploadProgress {
  percent: number;
  statusText: string;
}

/**
 * Format bytes to readable string (e.g. 1.25 MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Validates file size (max 10 MB) and file type safety.
 */
export function validateAttachmentFile(
  file: File | Blob,
  fileName?: string,
  maxSizeBytes: number = MAX_ATTACHMENT_SIZE_BYTES
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const name = fileName || (file as File).name || '';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File type (.${ext}) is not supported for security reasons. Please upload images, PDFs, or office documents.`,
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: 'Selected file is empty (0 bytes).',
    };
  }

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: 'File is too large. Maximum size is 10 MB.',
    };
  }

  return { valid: true };
}

/**
 * Resolves standard File, Blob, or native content:// / file:// URI to a valid binary Blob.
 */
export async function resolveFileBlob(
  fileInput: File | Blob | string,
  fallbackName?: string
): Promise<{ blob: Blob; fileName: string; fileType: string; size: number }> {
  if (typeof fileInput === 'string') {
    const uri = fileInput;

    if (uri.startsWith('data:')) {
      const mime = uri.substring(5, uri.indexOf(';')) || 'application/octet-stream';
      const res = await fetch(uri);
      const blob = await res.blob();
      const fileName = fallbackName || `file_${Date.now()}`;
      return { blob, fileName, fileType: mime, size: blob.size };
    }

    if (uri.startsWith('content://') || uri.startsWith('file://') || uri.startsWith('http')) {
      try {
        const res = await fetch(uri);
        const blob = await res.blob();
        const guessedName = uri.split('/').pop()?.split('?')[0] || fallbackName || `file_${Date.now()}`;
        return {
          blob,
          fileName: fallbackName || guessedName,
          fileType: blob.type || 'application/octet-stream',
          size: blob.size,
        };
      } catch (fetchErr) {
        if (Capacitor.isNativePlatform()) {
          try {
            const { Filesystem } = await import('@capacitor/filesystem');
            const fileData = await Filesystem.readFile({ path: uri });
            const base64Data = typeof fileData.data === 'string' ? fileData.data : '';
            const binaryStr = atob(base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/octet-stream' });
            return {
              blob,
              fileName: fallbackName || `file_${Date.now()}`,
              fileType: 'application/octet-stream',
              size: blob.size,
            };
          } catch (fsErr) {
            console.error('[attachmentStorage] Capacitor Filesystem read error:', fsErr);
          }
        }
        throw new Error(`Could not read file from URI: ${uri}`);
      }
    }
  }

  const binaryBlob = fileInput as File | Blob;
  const fileName = (fileInput as File).name || fallbackName || `file_${Date.now()}`;
  const fileType = binaryBlob.type || 'application/octet-stream';

  return {
    blob: binaryBlob,
    fileName,
    fileType,
    size: binaryBlob.size,
  };
}

/**
 * Compresses an image file client-side before upload.
 * Preserves aspect ratio, max dimension ~1600px, quality ~80% (0.80), JPEG output.
 * Does NOT compress PDFs, documents, audio, SVG, or GIF.
 */
export async function compressImage(
  blob: Blob,
  fileName: string = 'image.jpg',
  maxDimension = 1600,
  quality = 0.80
): Promise<Blob> {
  const type = blob.type || '';
  if (
    !type.startsWith('image/') ||
    type === 'image/svg+xml' ||
    type === 'image/gif'
  ) {
    return blob;
  }

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (result: Blob) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    // Safety timeout: If canvas/image processing stalls, fall back to raw blob
    const timeout = setTimeout(() => {
      finish(blob);
    }, 2500);

    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          clearTimeout(timeout);
          finish(blob);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (resultBlob) => {
            clearTimeout(timeout);
            if (resultBlob && resultBlob.size > 0 && resultBlob.size < blob.size) {
              finish(resultBlob);
            } else {
              finish(blob);
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(objectUrl);
        finish(blob);
      };

      img.src = objectUrl;
    } catch (err) {
      clearTimeout(timeout);
      finish(blob);
    }
  });
}

/**
 * Saves lead attachment metadata to Firestore.
 */
export async function saveLeadAttachmentMetadataToFirestore(
  userId: string,
  leadId: string,
  attachment: Attachment
): Promise<void> {
  const leadRef = doc(db, 'users', userId, 'leads', leadId);
  const snap = await getDoc(leadRef);

  const newActivity: ActivityLog = {
    id: `act_${Date.now()}`,
    leadId,
    type: 'attachment_added',
    title: `Attached ${attachment.type === 'image' ? 'Photo' : 'Document'}`,
    description: attachment.name,
    timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };

  if (snap.exists()) {
    const data = snap.data() as Lead;
    const existingAttachments = data.attachments || [];
    const updatedAttachments = [attachment, ...existingAttachments.filter((a) => a.id !== attachment.id)];
    const existingActivities = data.activities || [];
    const updatedActivities = [newActivity, ...existingActivities];

    await setDoc(
      leadRef,
      cleanFirestorePayload({
        ...data,
        attachments: updatedAttachments,
        activities: updatedActivities,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } else {
    await setDoc(
      leadRef,
      cleanFirestorePayload({
        id: leadId,
        attachments: [attachment],
        activities: [newActivity],
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  }
}

/**
 * DIRECT FIREBASE STORAGE UPLOAD PIPELINE:
 * Uses direct Firebase Storage SDK uploadBytes (no uploadBytesResumable).
 * Uploads strictly inside: users/{currentUserUid}/leads/{leadId}/attachments/{uniqueFileName}
 * On success, retrieves real getDownloadURL and saves metadata to Firestore.
 */
export async function uploadLeadAttachmentToStorage({
  userId,
  leadId,
  file,
  displayName,
  onProgress,
}: {
  userId: string;
  leadId: string;
  file: File | Blob | string;
  displayName?: string;
  onProgress?: (progress: UploadProgress) => void;
}): Promise<{
  attachment: Attachment;
  startTime: number;
}> {
  const startTime = Date.now();

  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.uid) {
    throw new Error('User is not signed in. Please log in to upload attachments.');
  }

  const currentUid = currentUser.uid;
  if (currentUid !== userId) {
    throw new Error('Authentication mismatch: active user UID does not match upload path.');
  }

  onProgress?.({ percent: 10, statusText: 'Preparing…' });

  // 1. Resolve binary file & validate size / extension
  const resolved = await resolveFileBlob(file, displayName);

  if (resolved.size <= 0) {
    throw new Error('Selected file is empty (0 bytes).');
  }

  const validation = validateAttachmentFile(resolved.blob, resolved.fileName);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file');
  }

  // 2. Compress images client-side if applicable
  const isImage = resolved.fileType.startsWith('image/');
  const uploadBlob = isImage
    ? await compressImage(resolved.blob, resolved.fileName, 1600, 0.80)
    : resolved.blob;

  // 3. Storage path strictly inside users/{currentUserUid}/leads/{leadId}/attachments/{uniqueFileName}
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const sanitizedName = (resolved.fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileId = `${timestamp}_${randomSuffix}_${sanitizedName}`;
  const storagePath = `users/${currentUid}/leads/${leadId}/attachments/${fileId}`;

  const contentType = isImage
    ? 'image/jpeg'
    : resolved.fileType || 'application/octet-stream';

  const metadata = {
    contentType,
    customMetadata: {
      userId: currentUid,
      leadId,
      originalName: resolved.fileName,
      uploadedAt: new Date().toISOString(),
    },
  };

  onProgress?.({ percent: 35, statusText: 'Uploading…' });

  // 4. Direct upload with uploadBytes
  const storageRef = ref(storage, storagePath);
  let downloadUrl = '';

  try {
    const uploadResult = await uploadBytes(storageRef, uploadBlob, metadata);
    console.log('[Firebase Storage] Direct upload succeeded:', uploadResult.ref.fullPath);
  } catch (uploadErr: any) {
    console.error('[Firebase Storage Error] Direct uploadBytes failed:', uploadErr);
    throw new Error(uploadErr?.message || 'Upload failed. Please retry.');
  }

  onProgress?.({ percent: 70, statusText: 'Finalizing…' });

  // 5. Get real download URL from Firebase Storage
  try {
    downloadUrl = await getDownloadURL(storageRef);
    if (!downloadUrl || !downloadUrl.startsWith('http')) {
      throw new Error('Invalid download URL returned by Firebase Storage.');
    }
  } catch (urlErr: any) {
    console.error('[Firebase Storage Error] getDownloadURL failed:', urlErr);
    throw new Error(urlErr?.message || 'Failed to retrieve download URL.');
  }

  onProgress?.({ percent: 85, statusText: 'Saving…' });

  // 6. Construct Attachment record
  const nowIso = new Date().toISOString();
  const attachmentMetadata: Attachment = {
    id: `att_${timestamp}_${randomSuffix}`,
    leadId,
    name: displayName?.trim() || resolved.fileName,
    fileName: resolved.fileName,
    fileType: contentType,
    fileSize: uploadBlob.size,
    type: isImage ? 'image' : 'document',
    url: downloadUrl,
    downloadUrl: downloadUrl,
    storagePath: storagePath,
    size: formatBytes(uploadBlob.size),
    createdAt: nowIso.split('T')[0],
    uploadedAt: nowIso,
  };

  // 7. Persist document metadata to Firestore only after verified storage upload
  try {
    await saveLeadAttachmentMetadataToFirestore(currentUid, leadId, attachmentMetadata);
  } catch (firestoreErr: any) {
    console.error('[Firestore Error] Failed to save attachment metadata:', firestoreErr);
    throw new Error(firestoreErr?.message || 'Failed to save document metadata.');
  }

  onProgress?.({ percent: 100, statusText: 'Upload complete' });

  return {
    attachment: attachmentMetadata,
    startTime,
  };
}

/**
 * DIRECT FIREBASE STORAGE UPLOAD PIPELINE:
 * Uploads a property photo directly to Firebase Storage using uploadBytes.
 * Target path: users/{currentUserUid}/properties/{propertyId}/photos/{uniqueFileName}
 */
export async function uploadPropertyPhotoToStorage({
  userId,
  propertyId,
  file,
  onProgress,
}: {
  userId: string;
  propertyId: string;
  file: File | Blob | string;
  onProgress?: (progress: UploadProgress) => void;
}): Promise<{
  downloadUrl: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  startTime: number;
}> {
  const startTime = Date.now();

  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.uid) {
    throw new Error('User is not signed in. Please log in to upload photos.');
  }

  const currentUid = currentUser.uid;
  if (currentUid !== userId) {
    throw new Error('Authentication mismatch: active user UID does not match upload path.');
  }

  onProgress?.({ percent: 10, statusText: 'Preparing…' });

  // 1. Resolve binary file & validate
  const resolved = await resolveFileBlob(file, 'property_photo.jpg');

  if (resolved.size <= 0) {
    throw new Error('Selected photo is empty (0 bytes).');
  }

  const validation = validateAttachmentFile(resolved.blob, resolved.fileName);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid photo file');
  }

  // 2. Compress image client-side
  const compressedBlob = await compressImage(resolved.blob, resolved.fileName, 1600, 0.80);

  // 3. Storage path strictly inside users/{currentUserUid}/properties/{propertyId}/photos/{uniqueFileName}
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const sanitizedName = (resolved.fileName || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileId = `${timestamp}_${randomSuffix}_${sanitizedName}`;
  const storagePath = `users/${currentUid}/properties/${propertyId}/photos/${fileId}`;

  const metadata = {
    contentType: 'image/jpeg',
    customMetadata: {
      userId: currentUid,
      propertyId,
      originalName: resolved.fileName,
      uploadedAt: new Date().toISOString(),
    },
  };

  onProgress?.({ percent: 35, statusText: 'Uploading…' });

  // 4. Direct upload with uploadBytes
  const storageRef = ref(storage, storagePath);
  let downloadUrl = '';

  try {
    const uploadResult = await uploadBytes(storageRef, compressedBlob, metadata);
    console.log('[Firebase Storage] Photo uploaded successfully:', uploadResult.ref.fullPath);
  } catch (uploadErr: any) {
    console.error('[Firebase Storage Error] Photo uploadBytes failed:', uploadErr);
    throw new Error(uploadErr?.message || 'Photo upload failed. Please retry.');
  }

  onProgress?.({ percent: 70, statusText: 'Finalizing…' });

  // 5. Get real download URL
  try {
    downloadUrl = await getDownloadURL(storageRef);
    if (!downloadUrl || !downloadUrl.startsWith('http')) {
      throw new Error('Invalid download URL returned by Firebase Storage.');
    }
  } catch (urlErr: any) {
    console.error('[Firebase Storage Error] Photo getDownloadURL failed:', urlErr);
    throw new Error(urlErr?.message || 'Failed to retrieve photo download URL.');
  }

  onProgress?.({ percent: 100, statusText: 'Upload complete' });

  return {
    downloadUrl,
    storagePath,
    fileName: resolved.fileName,
    fileSize: compressedBlob.size,
    uploadedAt: new Date().toISOString(),
    startTime,
  };
}

/**
 * Safely deletes a file from Firebase Storage.
 */
export async function deleteStorageFile(storagePath?: string): Promise<boolean> {
  if (!storagePath) return false;
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    return true;
  } catch (err: any) {
    if (err?.code === 'storage/object-not-found') {
      return true;
    }
    console.warn('[Firebase Storage Error] Failed to delete file at path:', storagePath, err);
    return false;
  }
}
