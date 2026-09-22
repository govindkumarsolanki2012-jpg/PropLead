import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { Attachment } from '../types';

export const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15MB limit

const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'apk', 'bin', 'com', 'msi', 'vbs', 'scr', 'jar'
]);

/**
 * Validates file size and file type safety.
 */
export function validateAttachmentFile(
  file: File,
  maxSizeBytes: number = MAX_ATTACHMENT_SIZE_BYTES
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File type (.${ext}) is not supported for security reasons. Please upload images, PDFs, or office documents.`,
    };
  }

  if (file.size > maxSizeBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const limitMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds the ${limitMb} MB limit. Please select a smaller file.`,
    };
  }

  return { valid: true };
}

/**
 * Compresses an image file client-side to save storage bandwidth and speed up uploads.
 * Preserves aspect ratio, capping max dimension at 1600px and JPEG quality at 0.82.
 */
export async function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.82
): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

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
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(blob);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Uploads a lead attachment to Firebase Storage, scoped strictly to the authenticated user's UID.
 * Path: users/{userId}/leads/{leadId}/attachments/{timestamp}_{sanitizedFileName}
 */
export async function uploadLeadAttachmentToStorage({
  userId,
  leadId,
  file,
  displayName,
}: {
  userId: string;
  leadId: string;
  file: File;
  displayName?: string;
}): Promise<Attachment> {
  const validation = validateAttachmentFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file');
  }

  const isImage = file.type.startsWith('image/');
  const uploadBlob = isImage ? await compressImage(file) : file;

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `users/${userId}/leads/${leadId}/attachments/${timestamp}_${sanitizedName}`;
  const storageRef = ref(storage, storagePath);

  const snapshot = await uploadBytes(storageRef, uploadBlob, {
    contentType: isImage ? 'image/jpeg' : file.type || 'application/octet-stream',
    customMetadata: {
      userId,
      leadId,
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
    },
  });

  const downloadUrl = await getDownloadURL(snapshot.ref);
  const sizeFormatted = `${(uploadBlob.size / (1024 * 1024)).toFixed(2)} MB`;

  const attachment: Attachment = {
    id: `att_${timestamp}`,
    leadId,
    name: displayName?.trim() || file.name,
    type: isImage ? 'image' : 'document',
    url: downloadUrl,
    storagePath,
    size: sizeFormatted,
    createdAt: new Date().toISOString().split('T')[0],
  };

  return attachment;
}

/**
 * Uploads a property photo to Firebase Storage, scoped strictly to the authenticated user's UID.
 * Path: users/{userId}/properties/{propertyId}/photos/{timestamp}_{sanitizedFileName}
 */
export async function uploadPropertyPhotoToStorage({
  userId,
  propertyId,
  file,
}: {
  userId: string;
  propertyId: string;
  file: File;
}): Promise<{ downloadUrl: string; storagePath: string }> {
  const validation = validateAttachmentFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid photo file');
  }

  const compressedBlob = await compressImage(file, 1600, 0.85);
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `users/${userId}/properties/${propertyId}/photos/${timestamp}_${sanitizedName}`;
  const storageRef = ref(storage, storagePath);

  const snapshot = await uploadBytes(storageRef, compressedBlob, {
    contentType: 'image/jpeg',
    customMetadata: {
      userId,
      propertyId,
      uploadedAt: new Date().toISOString(),
    },
  });

  const downloadUrl = await getDownloadURL(snapshot.ref);
  return { downloadUrl, storagePath };
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
    // If already deleted or missing, treat as safe no-op
    if (err?.code === 'storage/object-not-found') {
      return true;
    }
    console.warn('[Firebase Storage] Failed to delete file at path:', storagePath, err);
    return false;
  }
}

/**
 * Recursively deletes all files under users/{userId} in Firebase Storage during account deletion.
 */
export async function deleteAllUserStorageFiles(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const userFolderRef = ref(storage, `users/${userId}`);
    await deleteFolderRecursively(userFolderRef);
  } catch (err) {
    console.warn(`[Firebase Storage] Error cleaning user folder for ${userId}:`, err);
  }
}

async function deleteFolderRecursively(folderRef: any): Promise<void> {
  try {
    const res = await listAll(folderRef);
    const itemDeletions = res.items.map((item: any) => deleteObject(item).catch(() => {}));
    const prefixDeletions = res.prefixes.map((prefix: any) => deleteFolderRecursively(prefix));
    await Promise.all([...itemDeletions, ...prefixDeletions]);
  } catch {
    // If folder doesn't exist, ignore
  }
}
