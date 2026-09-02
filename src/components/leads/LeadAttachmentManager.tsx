import React, { useState } from 'react';
import { FileText, Image as ImageIcon, Plus, Trash2, ExternalLink, UploadCloud, Check } from 'lucide-react';
import { Attachment } from '../../types';

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
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
    };
    reader.readAsDataURL(file);
  };

  const handleSampleAdd = () => {
    const sampleImages = [
      {
        name: 'Master_Bedroom_View.jpg',
        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80',
        size: '1.8 MB',
        type: 'image' as const,
      },
      {
        name: 'Draft_Allotment_Letter.pdf',
        url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
        size: '540 KB',
        type: 'document' as const,
      },
    ];
    const item = sampleImages[Math.floor(Math.random() * sampleImages.length)];
    const newAtt: Attachment = {
      id: `att_${Date.now()}`,
      leadId,
      name: item.name,
      type: item.type,
      url: item.url,
      size: item.size,
      createdAt: new Date().toISOString().split('T')[0],
    };
    onAddAttachment(newAtt);
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-center">
        <UploadCloud className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
          Upload Property Photos & Client Documents
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Floor plans, sample flat photos, KYC documents, allotment letters
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-xs transition-all">
            <Plus className="w-3.5 h-3.5" />
            <span>Select File from Phone</span>
            <input
              type="file"
              onChange={handleFileUpload}
              accept="image/*,.pdf,.doc,.docx"
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleSampleAdd}
            className="px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs border border-slate-300 dark:border-slate-600 hover:bg-slate-50 transition-all"
          >
            + Add Sample Photo / Doc
          </button>
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
              className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shadow-2xs group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {att.type === 'image' && att.url ? (
                  <img
                    src={att.url}
                    alt={att.name}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-200 dark:border-slate-700"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                )}

                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {att.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {att.size || '1.2 MB'} • {att.createdAt}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {att.url && (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-center transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => onDeleteAttachment(att.id)}
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
