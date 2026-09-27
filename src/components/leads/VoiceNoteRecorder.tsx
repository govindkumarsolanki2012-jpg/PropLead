import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Clock,
  Volume2,
  AlertCircle,
  X,
  Check,
  Loader2,
  RotateCcw,
  UploadCloud,
  Settings,
} from 'lucide-react';
import { VoiceNote } from '../../types';
import {
  blobToDataUrl,
  formatAudioDuration,
  getAudioFromIndexedDB,
  getSupportedAudioMimeType,
  isPlayableAudioUrl,
  saveAudioToIndexedDB,
  deleteAudioFromIndexedDB,
} from '../../utils/audioStorage';
import {
  checkMicrophonePermission,
  requestMicrophonePermission,
  openNativeAppSettings,
  registerAppResumeListener,
} from '../../utils/nativePermissions';

interface VoiceNoteRecorderProps {
  leadId: string;
  voiceNotes: VoiceNote[];
  onAddVoiceNote: (voiceNote: VoiceNote) => void;
  onDeleteVoiceNote: (id: string) => void;
}

interface PendingRecording {
  id: string;
  dataUrl: string;
  mimeType: string;
  durationSeconds: number;
}

export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({
  leadId,
  voiceNotes,
  onAddVoiceNote,
  onDeleteVoiceNote,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isStopping, setIsStopping] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceTextNote, setVoiceTextNote] = useState<string>('');
  const [pendingRecording, setPendingRecording] = useState<PendingRecording | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMicPermanentlyDenied, setIsMicPermanentlyDenied] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<{
    currentTime: number;
    duration: number;
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const canceledRef = useRef<boolean>(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Check live microphone permission on mount and on app resume
  const refreshMicPermission = useCallback(async () => {
    try {
      const res = await checkMicrophonePermission();
      console.log(`[VoiceNoteRecorder] refreshMicPermission result: state=${res.state} permanentlyDenied=${res.isPermanentlyDenied}`);
      if (res.state === 'granted') {
        setIsMicPermanentlyDenied(false);
        setErrorMessage((prev) =>
          prev && (prev.toLowerCase().includes('microphone') || prev.toLowerCase().includes('audio')) && prev.toLowerCase().includes('denied')
            ? null
            : prev
        );
      } else if (res.state === 'denied' && res.isPermanentlyDenied) {
        setIsMicPermanentlyDenied(true);
      } else {
        setIsMicPermanentlyDenied(false);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshMicPermission();
    const unsubscribe = registerAppResumeListener(() => {
      refreshMicPermission();
    });
    return () => unsubscribe();
  }, [refreshMicPermission]);

  useEffect(() => {
    console.log('[VoiceNoteRecorder] MIC_UI_STATE:', {
      isRecording,
      isMicPermanentlyDenied,
      hasErrorMessage: Boolean(errorMessage),
      errorMessage,
      pendingRecording: Boolean(pendingRecording),
    });
  }, [isRecording, isMicPermanentlyDenied, errorMessage, pendingRecording]);

  // Stop playback and stream cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = '';
        audioElementRef.current = null;
      }
    };
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopActiveStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const startRecording = async () => {
    setErrorMessage(null);
    canceledRef.current = false;
    setPendingRecording(null);
    setSavedSuccess(false);

    // Pause any currently playing voice note
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setPlayingId(null);
      setPlaybackProgress(null);
    }

    // 1. Check & request live native microphone permission before attempting capture
    try {
      let livePerm = await checkMicrophonePermission();
      if (livePerm.state === 'denied' && livePerm.isPermanentlyDenied) {
        setIsMicPermanentlyDenied(true);
        setErrorMessage(
          'Microphone permission is permanently denied. Please tap "Open Settings" to enable microphone access.'
        );
        return;
      }

      if (livePerm.state !== 'granted') {
        const reqPerm = await requestMicrophonePermission();
        if (reqPerm.state !== 'granted') {
          setIsMicPermanentlyDenied(reqPerm.isPermanentlyDenied || false);
          setErrorMessage(
            reqPerm.isPermanentlyDenied
              ? 'Microphone permission is permanently denied. Please tap "Open Settings" to enable microphone access.'
              : 'Microphone permission was denied. PropLead needs microphone access to record voice memos.'
          );
          return;
        }
      }
    } catch (permErr) {
      console.warn('[VoiceNoteRecorder] Notice checking microphone permission:', permErr);
    }

    if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage(
        'Audio recording is not supported in this browser. Please use Chrome or the PropLead Android app.'
      );
      return;
    }

    try {
      // 2. Request microphone stream with progressive fallback for device constraints
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (basicErr) {
        console.warn('[VoiceNoteRecorder] Basic getUserMedia failed, trying with audio constraints:', basicErr);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      }

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const selectedMime = getSupportedAudioMimeType();
      const options = selectedMime ? { mimeType: selectedMime } : undefined;

      let recorder: MediaRecorder;
      try {
        recorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      } catch (mimeErr) {
        console.warn('[VoiceNoteRecorder] Could not initialize MediaRecorder with options, using default', mimeErr);
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        clearTimer();
        stopActiveStream();

        // If recording was cancelled, discard
        if (canceledRef.current) {
          setIsRecording(false);
          setIsStopping(false);
          setRecordingSeconds(0);
          return;
        }

        const elapsedSeconds = Math.max(
          1,
          Math.round((Date.now() - (startTimeRef.current || Date.now())) / 1000)
        );

        const finalMime = recorder.mimeType || selectedMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });

        if (audioBlob.size === 0) {
          setErrorMessage('No audio data was captured. Please speak clearly into your microphone.');
          setIsRecording(false);
          setIsStopping(false);
          setRecordingSeconds(0);
          return;
        }

        try {
          // Convert blob to persistent Base64 Data URL (playable across sessions)
          const dataUrl = await blobToDataUrl(audioBlob);
          const noteId = `vn_${Date.now()}`;

          // Set pending recording so user can play and preview before saving
          setPendingRecording({
            id: noteId,
            dataUrl,
            mimeType: finalMime,
            durationSeconds: elapsedSeconds,
          });
        } catch (saveErr) {
          console.error('[VoiceNoteRecorder] Error encoding audio recording:', saveErr);
          setErrorMessage('Failed to process audio recording. Please try again.');
        } finally {
          setIsRecording(false);
          setIsStopping(false);
          setRecordingSeconds(0);
        }
      };

      // Start recording with 250ms timeslice to ensure continuous chunk delivery
      recorder.start(250);
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        const currentElapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        setRecordingSeconds(currentElapsed);
      }, 1000);
    } catch (err: any) {
      stopActiveStream();
      clearTimer();
      setIsRecording(false);
      setIsStopping(false);

      const errName = err?.name || '';
      const errMsg = typeof err?.message === 'string' ? err.message : '';
      console.error('[VoiceNoteRecorder] Recording start failed:', { errName, errMsg, err });

      const isNotFound =
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError' ||
        errName === 'OverconstrainedError' ||
        errMsg.toLowerCase().includes('requested device not found') ||
        errMsg.toLowerCase().includes('device not found');

      const isPermissionDenied =
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errMsg.toLowerCase().includes('permission') ||
        errMsg.toLowerCase().includes('allowed');

      if (isPermissionDenied) {
        console.warn('[VoiceNoteRecorder] Microphone permission was denied:', errMsg || err);
        const permCheck = await checkMicrophonePermission();
        const permanentlyDenied = permCheck.isPermanentlyDenied || false;
        setIsMicPermanentlyDenied(permanentlyDenied);
        setErrorMessage(
          permanentlyDenied
            ? 'Microphone permission is permanently denied. Please tap "Open Settings" to enable microphone access.'
            : 'Microphone permission was denied. Please allow microphone access in your browser or device settings to record audio notes.'
        );
      } else if (isNotFound) {
        setErrorMessage(
          'No microphone detected on this device. You can upload an audio file or voice memo directly using the upload button next to Record.'
        );
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setErrorMessage('Microphone is in use by another application. Please free the audio device and try again.');
      } else {
        setErrorMessage(
          `Unable to access microphone: ${errMsg || 'Check audio permissions and try again.'}`
        );
      }
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsStopping(true);
    clearTimer();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('[VoiceNoteRecorder] Error stopping MediaRecorder:', err);
        setErrorMessage('Failed to finalize audio recording.');
        setIsRecording(false);
        setIsStopping(false);
        stopActiveStream();
      }
    } else {
      setIsRecording(false);
      setIsStopping(false);
      stopActiveStream();
    }
  };

  const cancelRecording = () => {
    canceledRef.current = true;
    clearTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    stopActiveStream();
    audioChunksRef.current = [];
    setIsRecording(false);
    setIsStopping(false);
    setRecordingSeconds(0);
  };

  const discardPendingRecording = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
    }
    setPlayingId(null);
    setPlaybackProgress(null);
    setPendingRecording(null);
  };

  const savePendingRecording = async () => {
    if (!pendingRecording || !pendingRecording.dataUrl) return;

    try {
      // 1. Save to IndexedDB for offline reliability
      await saveAudioToIndexedDB(
        pendingRecording.id,
        pendingRecording.dataUrl,
        pendingRecording.mimeType
      );

      // 2. Create VoiceNote attached to this lead
      const newNote: VoiceNote = {
        id: pendingRecording.id,
        leadId,
        audioUrl: pendingRecording.dataUrl,
        durationSeconds: pendingRecording.durationSeconds,
        createdAt: new Date().toISOString(),
        note: voiceTextNote.trim() || `Voice Memo (${formatAudioDuration(pendingRecording.durationSeconds)})`,
        mimeType: pendingRecording.mimeType,
      };

      onAddVoiceNote(newNote);
      setVoiceTextNote('');
      setPendingRecording(null);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
      }, 4000);
    } catch (err) {
      console.error('[VoiceNoteRecorder] Error saving pending voice note:', err);
      setErrorMessage('Failed to save voice note. Please try again.');
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await blobToDataUrl(file);
      const noteId = `vn_${Date.now()}`;
      const finalMime = file.type || 'audio/webm';

      setPendingRecording({
        id: noteId,
        dataUrl,
        mimeType: finalMime,
        durationSeconds: 0,
      });
      setVoiceTextNote(file.name.replace(/\.[^/.]+$/, ''));
    } catch (err) {
      console.error('[VoiceNoteRecorder] Notice processing uploaded audio file:', err);
      setErrorMessage('Failed to process audio file.');
    } finally {
      e.target.value = '';
    }
  };

  const togglePlay = useCallback(
    async (noteId: string, audioUrl: string, durationSeconds: number) => {
      setErrorMessage(null);

      // If tapping on currently playing note -> toggle pause
      if (playingId === noteId) {
        if (audioElementRef.current) {
          audioElementRef.current.pause();
        }
        setPlayingId(null);
        setPlaybackProgress(null);
        return;
      }

      // Stop any existing audio
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = '';
        audioElementRef.current = null;
      }

      let playableUrl = audioUrl;

      // If audioUrl is invalid or expired blob, check IndexedDB
      if (!isPlayableAudioUrl(playableUrl)) {
        const storedUrl = await getAudioFromIndexedDB(noteId);
        if (storedUrl && isPlayableAudioUrl(storedUrl)) {
          playableUrl = storedUrl;
        }
      }

      if (!isPlayableAudioUrl(playableUrl)) {
        setErrorMessage('Audio recording file is unavailable or expired for this voice memo.');
        setPlayingId(null);
        setPlaybackProgress(null);
        return;
      }

      try {
        const audio = new Audio();
        audioElementRef.current = audio;
        audio.src = playableUrl;
        audio.preload = 'auto';

        audio.ontimeupdate = () => {
          if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
            setPlaybackProgress({
              currentTime: audio.currentTime,
              duration: audio.duration,
            });
          }
        };

        audio.onended = () => {
          setPlayingId(null);
          setPlaybackProgress(null);
        };

        audio.onerror = (e) => {
          console.warn('[VoiceNoteRecorder] Audio element playback notice:', e);
          setErrorMessage('Playback error: audio format not supported or data corrupted.');
          setPlayingId(null);
          setPlaybackProgress(null);
        };

        setPlayingId(noteId);
        setPlaybackProgress({
          currentTime: 0,
          duration: durationSeconds,
        });

        await audio.play();
      } catch (playErr: any) {
        console.warn('[VoiceNoteRecorder] Playback notice for audio note:', playErr);
        setErrorMessage(`Playback failed: ${playErr.message || 'Please check device volume and audio permissions.'}`);
        setPlayingId(null);
        setPlaybackProgress(null);
      }
    },
    [playingId]
  );

  const handleDelete = async (noteId: string) => {
    if (playingId === noteId) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      setPlayingId(null);
      setPlaybackProgress(null);
    }
    await deleteAudioFromIndexedDB(noteId);
    onDeleteVoiceNote(noteId);
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-3">
      {/* Error Message Alert */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start justify-between gap-2.5 text-xs text-rose-800 dark:text-rose-200 animate-in fade-in">
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
            {isMicPermanentlyDenied && (
              <div className="pl-6">
                <button
                  type="button"
                  onClick={() => openNativeAppSettings()}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-lg text-xs inline-flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                >
                  <Settings className="w-3 h-3" />
                  <span>Open Settings</span>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700 p-0.5 rounded-md flex-shrink-0 cursor-pointer"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Recorder Action Box */}
      <div className="w-full max-w-full min-w-0 p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3 min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 min-w-0">
            <Mic className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">Voice Memo (Driving / Site Visit Notes)</span>
          </div>
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[11px] font-bold animate-pulse shrink-0">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              <span>Recording {formatAudioDuration(recordingSeconds)}</span>
            </div>
          )}
        </div>

        {/* STATE 1: RECORDING IN PROGRESS */}
        {isRecording ? (
          <div className="space-y-2.5 p-3.5 bg-rose-50/80 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 w-full max-w-full min-w-0">
            <div className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-3 h-3 rounded-full bg-rose-600 animate-ping shrink-0" />
                <span className="text-xs font-semibold text-rose-900 dark:text-rose-200 truncate">
                  Recording audio... ({formatAudioDuration(recordingSeconds)})
                </span>
              </div>

              {/* Animated sound wave indicators */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="w-1 h-3 bg-rose-500 rounded-full animate-bounce" />
                <span className="w-1 h-5 bg-rose-600 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-1 h-2.5 bg-rose-500 rounded-full animate-bounce [animation-delay:0.3s]" />
                <span className="w-1 h-4 bg-rose-600 rounded-full animate-bounce [animation-delay:0.45s]" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={cancelRecording}
                disabled={isStopping}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={stopRecording}
                disabled={isStopping}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isStopping ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Recording</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : pendingRecording ? (
          /* STATE 2: PENDING RECORDING PREVIEW (Allow playback before saving!) */
          <div className="space-y-3 p-3.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 w-full max-w-full min-w-0 animate-in fade-in">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() =>
                    togglePlay(
                      pendingRecording.id,
                      pendingRecording.dataUrl,
                      pendingRecording.durationSeconds
                    )
                  }
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                    playingId === pendingRecording.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-300'
                  }`}
                  aria-label={playingId === pendingRecording.id ? 'Pause preview' : 'Play preview'}
                >
                  {playingId === pendingRecording.id ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-emerald-950 dark:text-emerald-100 truncate">
                    Ready to Save • {formatAudioDuration(pendingRecording.durationSeconds)}
                  </div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-300">
                    Tap play to review audio before attaching to lead
                  </div>
                </div>
              </div>

              {/* Progress or Wave */}
              {playingId === pendingRecording.id && (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold shrink-0">
                  <span className="w-1 h-3 bg-emerald-600 rounded-full animate-bounce" />
                  <span className="w-1 h-4 bg-emerald-600 rounded-full animate-bounce [animation-delay:0.15s]" />
                  <span className="w-1 h-2 bg-emerald-600 rounded-full animate-bounce [animation-delay:0.3s]" />
                </div>
              )}
            </div>

            {/* Optional label input */}
            <input
              type="text"
              value={voiceTextNote}
              onChange={(e) => setVoiceTextNote(e.target.value)}
              placeholder="Optional label (e.g. Budget discussed, wife liked floor plan)..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
            />

            {/* Action buttons: Discard / Save */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
              <button
                type="button"
                onClick={discardPendingRecording}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake</span>
              </button>
              <button
                type="button"
                onClick={savePendingRecording}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Voice Note</span>
              </button>
            </div>
          </div>
        ) : (
          /* STATE 3: IDLE / READY TO RECORD */
          <div className="space-y-2.5 w-full max-w-full min-w-0">
            <div className="w-full max-w-full min-w-0 flex flex-col sm:flex-row sm:items-center gap-2">
              {/* Row 1 on mobile: Full width label input */}
              <input
                type="text"
                value={voiceTextNote}
                onChange={(e) => setVoiceTextNote(e.target.value)}
                placeholder="Optional label (e.g. Budget discussed, wife liked floor plan)..."
                className="w-full sm:flex-1 min-w-0 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
              />

              {/* Row 2 on mobile / Inline on tablet/desktop: Upload + Record Voice Button */}
              <div className="w-full sm:w-auto flex items-center gap-2 min-w-0">
                <label
                  className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer flex items-center justify-center transition-colors shrink-0"
                  title="Upload audio file from phone"
                >
                  <UploadCloud className="w-4 h-4" />
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex-1 sm:flex-none min-w-0 justify-center px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Record Voice</span>
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1 leading-relaxed">
              Audio is saved locally and synced with this lead profile for playback anytime.
            </p>

            {/* Simple Saved successfully message */}
            {savedSuccess && (
              <div className="pt-2 animate-in fade-in">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Saved successfully</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Voice Notes List */}
      {voiceNotes.length === 0 ? (
        <div className="text-center py-6 px-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
          <Volume2 className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">No voice notes recorded yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Tap 'Record Voice' above to dictate client remarks while driving or on-site.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {voiceNotes.map((vn) => {
            const isCurrentPlaying = playingId === vn.id;
            const hasValidAudio = isPlayableAudioUrl(vn.audioUrl);
            const progressPercent =
              isCurrentPlaying && playbackProgress && playbackProgress.duration > 0
                ? Math.min(100, (playbackProgress.currentTime / playbackProgress.duration) * 100)
                : 0;

            return (
              <div
                key={vn.id}
                className={`p-3 rounded-xl border transition-all ${
                  isCurrentPlaying
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 shadow-xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => togglePlay(vn.id, vn.audioUrl, vn.durationSeconds)}
                      disabled={!hasValidAudio}
                      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                        !hasValidAudio
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          : isCurrentPlaying
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900'
                      }`}
                      aria-label={isCurrentPlaying ? 'Pause voice note' : 'Play voice note'}
                    >
                      {isCurrentPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {vn.note || 'Voice Memo'}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3" />
                          {isCurrentPlaying && playbackProgress
                            ? `${formatAudioDuration(playbackProgress.currentTime)} / ${formatAudioDuration(
                                vn.durationSeconds
                              )}`
                            : formatAudioDuration(vn.durationSeconds)}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(vn.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}{' '}
                          {new Date(vn.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </span>
                        {!hasValidAudio && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              (No audio data)
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isCurrentPlaying && (
                      <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                        <span className="w-1 h-3 bg-emerald-600 rounded-full animate-bounce" />
                        <span className="w-1 h-4 bg-emerald-600 rounded-full animate-bounce [animation-delay:0.15s]" />
                        <span className="w-1 h-2 bg-emerald-600 rounded-full animate-bounce [animation-delay:0.3s]" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(vn.id)}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                      title="Delete voice note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Playback progress bar */}
                {isCurrentPlaying && (
                  <div className="mt-2.5 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                    <div className="w-full bg-emerald-100 dark:bg-emerald-900/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-1.5 rounded-full transition-all duration-150"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
