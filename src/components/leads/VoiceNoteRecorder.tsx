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

interface VoiceNoteRecorderProps {
  leadId: string;
  voiceNotes: VoiceNote[];
  onAddVoiceNote: (voiceNote: VoiceNote) => void;
  onDeleteVoiceNote: (id: string) => void;
}

export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({
  leadId,
  voiceNotes,
  onAddVoiceNote,
  onDeleteVoiceNote,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceTextNote, setVoiceTextNote] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

    // Pause any currently playing voice note
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setPlayingId(null);
      setPlaybackProgress(null);
    }

    if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage(
        'Audio recording is not supported in this browser. Please use Chrome or the PropLead Android app.'
      );
      return;
    }

    try {
      // Request microphone stream with audio enhancements
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const selectedMime = getSupportedAudioMimeType();
      const options = selectedMime ? { mimeType: selectedMime } : undefined;

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (mimeErr) {
        console.warn('Could not initialize MediaRecorder with options, using default', mimeErr);
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
          setIsSaving(false);
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
          setErrorMessage('No audio data was captured. Please check microphone permissions and speak clearly.');
          setIsRecording(false);
          setIsSaving(false);
          setRecordingSeconds(0);
          return;
        }

        try {
          // Convert blob to persistent Base64 Data URL (playable across sessions)
          const dataUrl = await blobToDataUrl(audioBlob);

          const noteId = `vn_${Date.now()}`;

          // Also persist into IndexedDB for safety
          await saveAudioToIndexedDB(noteId, dataUrl, finalMime);

          const newNote: VoiceNote = {
            id: noteId,
            leadId,
            audioUrl: dataUrl,
            durationSeconds: elapsedSeconds,
            createdAt: new Date().toISOString(),
            note: voiceTextNote.trim() || `Voice Memo (${formatAudioDuration(elapsedSeconds)})`,
            mimeType: finalMime,
          };

          onAddVoiceNote(newNote);
          setVoiceTextNote('');
        } catch (saveErr) {
          console.error('Failed to encode/save voice note:', saveErr);
          setErrorMessage('Failed to save audio recording. Please try again.');
        } finally {
          setIsRecording(false);
          setIsSaving(false);
          setRecordingSeconds(0);
        }
      };

      // Start recording with 250ms chunks to capture short notes accurately
      recorder.start(250);
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        const currentElapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        setRecordingSeconds(currentElapsed);
      }, 1000);
    } catch (err: any) {
      console.error('Error starting audio recording:', err);
      stopActiveStream();
      clearTimer();
      setIsRecording(false);
      setIsSaving(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Microphone permission was denied. Please allow microphone access in your browser or device settings to record audio notes.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No microphone detected on this device. Please connect a microphone or use mobile.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setErrorMessage('Microphone is in use by another application. Please free the audio device and try again.');
      } else {
        setErrorMessage(
          `Unable to access microphone: ${err.message || 'Check audio permissions and try again.'}`
        );
      }
    }
  };

  const stopAndSaveRecording = () => {
    if (!isRecording) return;
    setIsSaving(true);
    clearTimer();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Error stopping MediaRecorder:', err);
        setErrorMessage('Failed to finalize audio recording.');
        setIsRecording(false);
        setIsSaving(false);
        stopActiveStream();
      }
    } else {
      setIsRecording(false);
      setIsSaving(false);
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
    setIsSaving(false);
    setRecordingSeconds(0);
  };

  const togglePlay = useCallback(
    async (note: VoiceNote) => {
      setErrorMessage(null);

      // If tapping on currently playing note -> toggle pause
      if (playingId === note.id) {
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

      let playableUrl = note.audioUrl;

      // If audioUrl is invalid or expired blob, check IndexedDB
      if (!isPlayableAudioUrl(playableUrl)) {
        const storedUrl = await getAudioFromIndexedDB(note.id);
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
          console.error('Audio element playback error:', e);
          setErrorMessage('Playback error: audio format not supported or data corrupted.');
          setPlayingId(null);
          setPlaybackProgress(null);
        };

        setPlayingId(note.id);
        setPlaybackProgress({
          currentTime: 0,
          duration: note.durationSeconds,
        });

        await audio.play();
      } catch (playErr: any) {
        console.error('Failed to play audio note:', playErr);
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
    <div className="space-y-3">
      {/* Error Message Alert */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start justify-between gap-2.5 text-xs text-rose-800 dark:text-rose-200 animate-in fade-in">
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
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
      <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <Mic className="w-4 h-4 text-emerald-600" />
            <span>Voice Memo (Driving / Site Visit Notes)</span>
          </div>
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[11px] font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              <span>Recording {formatAudioDuration(recordingSeconds)}</span>
            </div>
          )}
        </div>

        {isRecording ? (
          <div className="space-y-2.5 p-3.5 bg-rose-50/80 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                <span className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                  Recording audio... ({formatAudioDuration(recordingSeconds)})
                </span>
              </div>

              {/* Animated sound wave indicators */}
              <div className="flex items-center gap-1">
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
                disabled={isSaving}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={stopAndSaveRecording}
                disabled={isSaving}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Audio...</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop & Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={voiceTextNote}
                onChange={(e) => setVoiceTextNote(e.target.value)}
                placeholder="Optional label (e.g. Budget discussed, wife liked floor plan)..."
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={startRecording}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all flex-shrink-0 cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Record Voice Note</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1">
              Audio is saved locally and synced with this lead profile for playback anytime.
            </p>
          </div>
        )}
      </div>

      {/* Voice Notes List */}
      {voiceNotes.length === 0 ? (
        <div className="text-center py-6 px-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
          <Volume2 className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">No voice notes recorded yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Tap 'Record Voice Note' above to dictate client remarks while driving or on-site.
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
                      onClick={() => togglePlay(vn)}
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
