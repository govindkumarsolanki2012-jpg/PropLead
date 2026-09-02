import React, { useState } from 'react';
import { X, MessageSquare, Send, Copy, Check, Sparkles, Languages } from 'lucide-react';
import { Lead, UserProfile } from '../../types';
import { WHATSAPP_TEMPLATES, openWhatsApp, copyUnicodeTextToClipboard } from '../../utils/whatsapp';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
  profile: UserProfile;
  onLogActivity?: (leadId: string, message: string) => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  lead,
  profile,
  onLogActivity,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(WHATSAPP_TEMPLATES[0].id);
  const [customText, setCustomText] = useState<string>(
    WHATSAPP_TEMPLATES[0].getMessage(lead, profile.name, profile.agencyName)
  );
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Test Presets' | 'Standard' | 'Hindi'>('All');

  if (!isOpen) return null;

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = WHATSAPP_TEMPLATES.find((t) => t.id === templateId);
    if (tmpl) {
      setCustomText(tmpl.getMessage(lead, profile.name, profile.agencyName));
    }
  };

  const handleSend = () => {
    openWhatsApp(lead.phone, customText);
    if (onLogActivity) {
      onLogActivity(
        lead.id,
        `WhatsApp sent to ${lead.name}`
      );
    }
    onClose();
  };

  const handleCopy = async () => {
    const success = await copyUnicodeTextToClipboard(customText);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const filteredTemplates = WHATSAPP_TEMPLATES.filter((t) => {
    if (categoryFilter === 'Test Presets') return t.category === 'Test Presets';
    if (categoryFilter === 'Standard') return t.category !== 'Test Presets';
    if (categoryFilter === 'Hindi') return t.id === 'test_2_hindi' || t.id === 'test_3_hinglish';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-emerald-600 text-white">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <div>
              <h2 className="text-sm font-bold leading-tight">
                WhatsApp to {lead.name}
              </h2>
              <span className="text-[11px] text-emerald-100">+91 {lead.phone}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-emerald-700/60 hover:bg-emerald-700 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
          {/* Unicode & Encoding Guarantee Notice */}
          <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between text-[11px]">
            <span className="text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>UTF-8 Unicode Safe: Emojis, ₹ Rupee, Hindi & Line breaks preserved</span>
            </span>
          </div>

          {/* Template Filter Pills */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Choose Template / Presets:
              </label>
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('All')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                    categoryFilter === 'All'
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  All ({WHATSAPP_TEMPLATES.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('Test Presets')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                    categoryFilter === 'Test Presets'
                      ? 'bg-emerald-600 text-white'
                      : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950'
                  }`}
                >
                  🔥 Test Presets
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('Hindi')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                    categoryFilter === 'Hindi'
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950'
                  }`}
                >
                  🇮🇳 हिन्दी / Hinglish
                </button>
              </div>
            </div>

            {/* Template Selector Chips */}
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {filteredTemplates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleSelectTemplate(tmpl.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all text-left ${
                    selectedTemplateId === tmpl.id
                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-500 font-bold shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tmpl.title}
                </button>
              ))}
            </div>
          </div>

          {/* Editable Preview Box */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Message Preview & Edit (Unicode Preserved)
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-bold"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Copied with Emojis & ₹!' : 'Copy Text'}</span>
              </button>
            </div>
            <textarea
              rows={9}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs leading-relaxed focus:ring-2 focus:ring-emerald-500 outline-hidden font-mono"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-2 transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Open WhatsApp & Send</span>
          </button>
        </div>
      </div>
    </div>
  );
};
