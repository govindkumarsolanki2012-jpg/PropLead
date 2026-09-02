import React, { useState, useRef } from 'react';
import { Mic, Square, Play, Pause, Trash2, Clock, Volume2, AlertCircle } from 'lucide-react';
import { VoiceNote } from '../../types';

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
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceTextNote, setVoiceTextNote] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          saveVoiceNote(audioUrl, recordingSeconds || 12);
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingSeconds(0);
        timerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      } else {
        // Fallback simulation for devices without mic permissions
        simulateRecording();
      }
    } catch (err) {
      console.warn('Microphone permission not granted or unavailable, fallback to simulated recording', err);
      simulateRecording();
    }
  };

  const simulateRecording = () => {
    setIsRecording(true);
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      // simulated save
      saveVoiceNote('', recordingSeconds || 8);
    }
    setIsRecording(false);
  };

  const saveVoiceNote = (url: string, duration: number) => {
    const newNote: VoiceNote = {
      id: `vn_${Date.now()}`,
      leadId,
      audioUrl: url,
      durationSeconds: Math.max(duration, 3),
      createdAt: new Date().toISOString(),
      note: voiceTextNote.trim() || 'Quick client audio memo',
    };
    onAddVoiceNote(newNote);
    setVoiceTextNote('');
  };

  const togglePlay = (id: string, url: string) => {
    if (playingId === id) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      setPlayingId(null);
    } else {
      setPlayingId(id);
      if (url) {
        if (!audioElementRef.current) {
          audioElementRef.current = new Audio(url);
        } else {
          audioElementRef.current.src = url;
        }
        audioElementRef.current.play();
        audioElementRef.current.onended = () => setPlayingId(null);
      } else {
        // Simulation playback auto finish after 5s
        setTimeout(() => {
          setPlayingId(null);
        }, 4000);
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Recorder Action Box */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <Mic className="w-4 h-4 text-emerald-600" />
            <span>Voice Memo (For Driving / Fast Notes)</span>
          </div>
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              <span>Recording {recordingSeconds}s</span>
            </div>
          )}
        </div>

        {isRecording ? (
          <div className="flex items-center justify-between gap-3 p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
              <span className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                Listening... Speak details ({recordingSeconds}s)
              </span>
            </div>
            <button
              onClick={stopRecording}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop & Save</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={voiceTextNote}
              onChange={(e) => setVoiceTextNote(e.target.value)}
              placeholder="Audio title (e.g. Discussed loan & spot booking)..."
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={startRecording}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all flex-shrink-0"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Record Voice Note</span>
            </button>
          </div>
        )}
      </div>

      {/* Voice Notes List */}
      {voiceNotes.length === 0 ? (
        <div className="text-center py-4 text-xs text-slate-400">
          No voice notes recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {voiceNotes.map((vn) => (
            <div
              key={vn.id}
              className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() => togglePlay(vn.id, vn.audioUrl)}
                  className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center flex-shrink-0 hover:bg-emerald-200 transition-colors"
                >
                  {playingId === vn.id ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {vn.note || 'Voice Memo'}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {vn.durationSeconds}s
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(vn.createdAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {playingId === vn.id && (
                  <div className="flex items-center gap-0.5">
                    <span className="w-1 h-3 bg-emerald-500 rounded-full animate-bounce" />
                    <span className="w-1 h-4 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}
                <button
                  onClick={() => onDeleteVoiceNote(vn.id)}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
