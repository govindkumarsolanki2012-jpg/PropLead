import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, runTransaction } from 'firebase/firestore';
import { auth, db, storage } from '../lib/firebase';
import { Lead, VoiceNote } from '../types';

function requireUid(expected?: string): string {
  const uid = auth.currentUser?.uid;
  if (!uid || (expected && expected !== uid)) throw new Error('Your account changed. Please reopen this lead.');
  return uid;
}

function safeId(value: string): string {
  if (!value || value.includes('/') || value === '.' || value === '..') throw new Error('Invalid voice note location.');
  return value;
}

export async function saveVoiceNoteToCloud(
  leadId: string, id: string, blob: Blob, durationSeconds: number, note: string
): Promise<Lead> {
  const uid = requireUid();
  safeId(leadId); safeId(id);
  if (!(blob instanceof Blob) || !blob.size) throw new Error('The recording is empty.');
  const mimeType = blob.type || 'audio/webm';
  if (!mimeType.startsWith('audio/')) throw new Error('Please select an audio recording.');
  const mime = mimeType.split(';')[0];
  const extension = ({ 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg',
    'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/aac': 'aac' } as Record<string, string>)[mime] || 'webm';
  const storagePath = `users/${uid}/leads/${leadId}/voice-notes/${id}.${extension}`;
  const objectRef = ref(storage, storagePath);
  await uploadBytes(objectRef, blob, { contentType: mimeType });
  let metadataCommitted = false;
  try {
    const audioUrl = await getDownloadURL(objectRef);
    if (!/^https:\/\//i.test(audioUrl)) throw new Error('Storage did not return a valid audio URL.');
    requireUid(uid);
    const voiceNote: VoiceNote = { id, leadId, audioUrl, storagePath,
      durationSeconds: Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0,
      createdAt: new Date().toISOString(), note, mimeType };
    const leadRef = doc(db, 'users', uid, 'leads', leadId);
    const updated = await runTransaction(db, async transaction => {
      requireUid(uid);
      const snapshot = await transaction.get(leadRef);
      if (!snapshot.exists()) throw new Error('This lead no longer exists.');
      const lead = snapshot.data() as Lead;
      const voiceNotes = [voiceNote, ...(lead.voiceNotes || []).filter(item => item.id !== id)];
      const activity = { id: `voice_${id}`, leadId, type: 'voice_note' as const,
        title: 'Voice Note Recorded', description: note || 'Audio memo recorded',
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) };
      const activities = [activity, ...(lead.activities || []).filter(item => item.id !== activity.id)];
      const updatedAt = new Date().toISOString();
      transaction.update(leadRef, { voiceNotes, activities, updatedAt });
      return { ...lead, id: leadId, voiceNotes, activities, updatedAt };
    });
    metadataCommitted = true;
    requireUid(uid);
    return updated;
  } catch (error) {
    // Only remove this new upload if its metadata was never committed.
    if (!metadataCommitted) await deleteObject(objectRef).catch(() => {
      console.warn('[VoiceNote] Uncommitted audio cleanup failed.');
    });
    throw error;
  }
}

export async function deleteVoiceNoteFile(note: VoiceNote): Promise<void> {
  if (!note.storagePath) return; // Legacy Base64 recordings have no Storage object.
  const uid = requireUid();
  safeId(note.leadId); safeId(note.id);
  const prefix = `users/${uid}/leads/${note.leadId}/voice-notes/${note.id}.`;
  if (!note.storagePath.startsWith(prefix) || !/^[a-z0-9]+$/i.test(note.storagePath.slice(prefix.length))) {
    throw new Error('The voice recording does not belong to this lead and account.');
  }
  try { await deleteObject(ref(storage, note.storagePath)); }
  catch (error: any) { if (error?.code !== 'storage/object-not-found') throw error; }
}

export async function deleteVoiceNoteFromCloud(leadId: string, note: VoiceNote): Promise<{
  lead: Lead | null; cleanupPending: boolean;
}> {
  const uid = requireUid();
  safeId(leadId);
  if (note.leadId !== leadId) throw new Error('Voice note does not belong to this lead.');
  // Validate the path before changing any metadata.
  if (note.storagePath) {
    const prefix = `users/${uid}/leads/${leadId}/voice-notes/${safeId(note.id)}.`;
    if (!note.storagePath.startsWith(prefix) || !/^[a-z0-9]+$/i.test(note.storagePath.slice(prefix.length))) {
      throw new Error('Invalid voice recording path.');
    }
  }
  const leadRef = doc(db, 'users', uid, 'leads', leadId);
  const updated = await runTransaction(db, async transaction => {
    requireUid(uid);
    const snapshot = await transaction.get(leadRef);
    if (!snapshot.exists()) return null;
    const lead = snapshot.data() as Lead;
    const voiceNotes = (lead.voiceNotes || []).filter(item => item.id !== note.id);
    const updatedAt = new Date().toISOString();
    transaction.update(leadRef, { voiceNotes, updatedAt });
    return { ...lead, id: leadId, voiceNotes, updatedAt };
  });
  requireUid(uid);
  try { await deleteVoiceNoteFile(note); return { lead: updated, cleanupPending: false }; }
  catch (error) {
    console.error('[VoiceNote] Audio file cleanup failed.', error);
    return { lead: updated, cleanupPending: true };
  }
}
