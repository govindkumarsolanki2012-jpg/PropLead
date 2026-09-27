/**
 * Audio storage and encoding utilities for PropLead Voice Notes.
 * Supports persistent Base64 Data URLs and IndexedDB storage so recordings
 * survive closing and reopening the app without expiring blob URLs.
 * 
 * Records are strictly UID-scoped using `${uid}:${voiceNoteId}` compound keys
 * to ensure complete multi-account isolation.
 */

import { auth } from '../lib/firebase';

const DB_NAME = 'proplead_audio_db';
const DB_VERSION = 2; // Incremented version to ensure clean compound indexing
const STORE_NAME = 'voice_notes';

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open audio database'));
  });
}

function resolveAuthUid(passedUid?: string | null): string | null {
  if (passedUid && typeof passedUid === 'string' && passedUid.trim().length > 0) {
    return passedUid.trim();
  }
  return auth?.currentUser?.uid || null;
}

/**
 * Format a compound primary key for a voice note record.
 */
export function getVoiceNoteStorageKey(uid: string, voiceNoteId: string): string {
  return `${uid}:${voiceNoteId}`;
}

export async function saveAudioToIndexedDB(
  voiceNoteId: string,
  audioDataUrl: string,
  mimeType: string,
  uid?: string | null
): Promise<void> {
  const effectiveUid = resolveAuthUid(uid);
  if (!effectiveUid) {
    console.warn('[audioStorage] Cannot save audio to IndexedDB without an authenticated UID');
    return;
  }

  try {
    const db = await openAudioDb();
    const compoundId = getVoiceNoteStorageKey(effectiveUid, voiceNoteId);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        id: compoundId,
        voiceNoteId,
        uid: effectiveUid,
        audioDataUrl,
        mimeType,
        updatedAt: Date.now(),
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save audio to IndexedDB:', err);
  }
}

export async function getAudioFromIndexedDB(
  voiceNoteId: string,
  uid?: string | null
): Promise<string | null> {
  const effectiveUid = resolveAuthUid(uid);
  if (!effectiveUid) {
    return null;
  }

  try {
    const db = await openAudioDb();
    const compoundId = getVoiceNoteStorageKey(effectiveUid, voiceNoteId);

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(compoundId);
      req.onsuccess = () => {
        if (req.result && req.result.audioDataUrl) {
          // Double verify ownership if field exists
          if (!req.result.uid || req.result.uid === effectiveUid) {
            resolve(req.result.audioDataUrl);
            return;
          }
        }
        resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Failed to read audio from IndexedDB:', err);
    return null;
  }
}

export async function deleteAudioFromIndexedDB(
  voiceNoteId: string,
  uid?: string | null
): Promise<void> {
  const effectiveUid = resolveAuthUid(uid);
  if (!effectiveUid) {
    return;
  }

  try {
    const db = await openAudioDb();
    const compoundId = getVoiceNoteStorageKey(effectiveUid, voiceNoteId);

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(compoundId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('Failed to delete audio from IndexedDB:', err);
  }
}

/**
 * Clears all IndexedDB voice note cache records belonging to a specific Firebase UID.
 * Executed on logout and account deletion.
 */
export async function clearUserAudioFromIndexedDB(uid: string): Promise<void> {
  if (!uid || typeof window === 'undefined' || !window.indexedDB) return;

  try {
    const db = await openAudioDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();

      req.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const key = String(cursor.key);
          const value = cursor.value;
          if (key.startsWith(`${uid}:`) || value?.uid === uid) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      req.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('Error clearing user audio from IndexedDB:', err);
  }
}

export function getSupportedAudioMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ];
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    } catch {
      // Continue checking next
    }
  }
  return '';
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert audio blob to Data URL'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

export function isPlayableAudioUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length < 10) return false;
  if (trimmed.startsWith('data:audio/')) return true;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return true;
  if (trimmed.startsWith('blob:')) return true;
  return false;
}

export function formatAudioDuration(totalSeconds: number): string {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
