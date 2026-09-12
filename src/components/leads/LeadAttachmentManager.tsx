import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  ExternalLink,
  UploadCloud,
  Check,
  Loader2,
  Play,
  Pause,
  FileSpreadsheet,
} from 'lucide-react';
import { Attachment } from '../../types';
import { openLeadDocument, isAudioAttachment } from '../../utils/documentOpener';

interface LeadAttachmentManagerProps {
  leadId: string;
  attachments: Attachment[];
  onAddAttachment: (attachment: Attachment) => void;
  onDeleteAttachment: (id: string) => void;
}

export const LeadAttachmentManager: React.FC<LeadAttachmentManagerProps> = ({
  leadId,
  attachments,
  onAddAttachment,
  onDeleteAttachment,
}) => {
  const [docName, setDocName] = useState<string>('');
  const [docType, setDocType] = useState<'image' | 'document'>('image');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showSaveButton, setShowSaveButton] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const [isOpeningId, setIsOpeningId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setSavedSuccess(false);
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const newAtt: Attachment = {
        id: `att_${Date.now()}`,
        leadId,
        name: docName.trim() || file.name,
        type: file.type.startsWith('image/') ? 'image' : 'document',
        url: url,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        createdAt: new Date().toISOString().split('T')[0],
      };
      onAddAttachment(newAtt);
      setDocName('');
      setIsUploading(false);
      setShowSaveButton(true);
    };
    reader.readAsDataURL(file);
    // Reset file input so user can pick same file or another file cleanly
    e.target.value = '';
  };

  const handleConfirmSave = () => {
    setShowSaveButton(false);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 4000);
  };

  const handleToggleAudio = (att: Attachment) => {
    if (playingAudioId === att.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingAudioId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      const audio = new Audio(att.url);
      audioRef.current = audio;
      setPlayingAudioId(att.id);

      audio.onended = () => {
        setPlayingAudioId(null);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setPlayingAudioId(null);
        audioRef.current = null;
        showToast('No app available to open this file.');
      };

      audio.play().catch((err) => {
        console.warn('[LeadAttachmentManager] Audio play error:', err);
        setPlayingAudioId(null);
        showToast('No app available to open this file.');
      });
    } catch (err) {
      showToast('No app available to open this file.');
    }
  };

  const handleFileClick = async (att: Attachment) => {
    if (!att.url) {
      showToast('No app available to open this file.');
      return;
    }

    // Audio files / Voice Notes -> continue playing inside PropLead
    if (isAudioAttachment(att)) {
      handleToggleAudio(att);
      return;
    }

    // Documents & Photos: PDF, JPG/JPEG/PNG/WEBP, DOC/DOCX, XLS/XLSX, PPT/PPTX
    setIsOpeningId(att.id);
    try {
      const res = await openLeadDocument(att, {
        onPlayAudio: () => handleToggleAudio(att),
      });

      if (!res.success) {
        showToast(res.message || 'No app available to open this file.');
      }
    } catch (err) {
      showToast('No app available to open this file.');
    } finally {
      setIsOpeningId(null);
    }
  };

  const renderFileIcon = (att: Attachment) => {
    if (att.type === 'image' && att.url) {
      return (
        <img
          src={att.url}
          alt={att.name}
          className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-200 dark:border-slate-700"
          referrerPolicy="no-referrer"
        />
      );
    }

    const ext = att.name.split('.').pop()?.toLowerCase() || '';
    const isAudio = isAudioAttachment(att);

    if (isAudio) {
      const isPlaying = playingAudioId === att.id;
      return (
        <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
          {isPlaying ? <Pause className="w-5 h-5 animate-pulse" /> : <Play className="w-5 h-5" />}
        </div>
      );
    }

    if (ext === 'pdf') {
      return (
        <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5" />
        </div>
      );
    }

    if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') {
      return (
        <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
      );
    }

    if (ext === 'ppt' || ext === 'pptx') {
      return (
        <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5" />
        </div>
      );
    }

    return (
      <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5" />
      </div>
    );
  };

  return (
    <div className="space-y-4 relative">
      {/* Toast Notification for File Opening Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-90 max-w-xs w-full px-4 text-center pointer-events-none animate-fade-in">
          <div className="bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700/60 backdrop-blur-xs">
            {toastMessage}
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-center">
        <UploadCloud className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
          Upload Property Photos & Client Documents
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Floor plans, flat photos, KYC documents, allotment letters
        </p>

        <div className="mt-3 flex flex-col items-center justify-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-xs transition-all">
              <Plus className="w-3.5 h-3.5" />
              <span>Select File from Phone</span>
              <input
                type="file"
                onChange={handleFileUpload}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,audio/*"
                className="hidden"
              />
            </label>
          </div>

          {isUploading && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>Uploading...</span>
            </div>
          )}

          {/* Simple Save button shown when upload completes */}
          {showSaveButton && !isUploading && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleConfirmSave}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-sm inline-flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          )}

          {/* Simple Saved successfully message */}
          {savedSuccess && (
            <div className="pt-1">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Saved successfully</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attachments List */}
      {attachments.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400">
          No files attached to this lead yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              onClick={() => handleFileClick(att)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleFileClick(att);
                }
              }}
              className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shadow-2xs group cursor-pointer hover:border-emerald-500/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/80 active:scale-[0.99] transition-all text-left"
              title={`Tap to open ${att.name}`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {renderFileIcon(att)}

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {att.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <span>{att.size || '1.2 MB'} • {att.createdAt}</span>
                    {playingAudioId === att.id && (
                      <span className="text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                        • Playing in PropLead
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="flex items-center gap-1 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {isOpeningId === att.id ? (
                  <div className="w-7 h-7 flex items-center justify-center text-emerald-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  </div>
                ) : (
                  att.url && (
                    <button
                      type="button"
                      onClick={() => handleFileClick(att)}
                      title="Open file"
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => onDeleteAttachment(att.id)}
                  title="Delete file"
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
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

