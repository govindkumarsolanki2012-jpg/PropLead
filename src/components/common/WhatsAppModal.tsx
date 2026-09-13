import React, { useState } from 'react';
import { X, MessageSquare, Send, Copy, Check, Sparkles } from 'lucide-react';
import { Lead, UserProfile, WhatsAppTemplateCategory } from '../../types';
import { WHATSAPP_TEMPLATES, openWhatsApp, copyUnicodeTextToClipboard } from '../../utils/whatsapp';
import { useTranslation } from '../../context/LanguageContext';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
  profile: UserProfile;
  onLogActivity?: (leadId: string, message: string) => void;
}

type ModalCategoryFilter = 'All' | WhatsAppTemplateCategory;

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  lead,
  profile,
  onLogActivity,
}) => {
  const { t } = useTranslation();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(WHATSAPP_TEMPLATES[0].id);
  const [customText, setCustomText] = useState<string>(
    WHATSAPP_TEMPLATES[0].getMessage(lead, profile.name, profile.agencyName)
  );
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<ModalCategoryFilter>('All');

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

  const filteredTemplates = WHATSAPP_TEMPLATES.filter((tmpl) => {
    if (categoryFilter === 'All') return true;
    return tmpl.category === categoryFilter;
  });

  const categories: { key: ModalCategoryFilter; label: string }[] = [
    { key: 'All', label: `${t('wa_filter_all')} (${WHATSAPP_TEMPLATES.length})` },
    { key: 'Property Details', label: t('wa_filter_property') },
    { key: 'Greeting', label: t('wa_filter_greeting') },
    { key: 'Follow-up', label: t('wa_filter_followup') },
    { key: 'Site Visit', label: t('wa_filter_sitevisit') },
    { key: 'Closing', label: t('wa_filter_closing') },
  ];

  return (
    <div
      id="whatsapp-modal-backdrop"
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        id="whatsapp-modal-container"
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden animate-slide-up safe-bottom"
      >
        {/* Header */}
        <div
          id="whatsapp-modal-header"
          className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-emerald-600 text-white"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <div>
              <h2 className="text-sm font-bold leading-tight">
                {t('wa_title')} {lead.name}
              </h2>
              <span className="text-[11px] text-emerald-100">+91 {lead.phone}</span>
            </div>
          </div>
          <button
            id="whatsapp-modal-close-btn"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-emerald-700/60 hover:bg-emerald-700 flex items-center justify-center text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
          {/* Unicode & Encoding Guarantee Notice */}
          <div
            id="whatsapp-unicode-notice"
            className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-[11px]"
          >
            <span className="text-emerald-800 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{t('wa_unicode_notice')}</span>
            </span>
          </div>

          {/* Template Filter Pills */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t('wa_choose_template')}
              </label>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1 text-[11px]">
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategoryFilter(cat.key)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    categoryFilter === cat.key
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Template Selector Chips */}
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1 pt-1">
              {filteredTemplates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  id={`whatsapp-template-btn-${tmpl.id}`}
                  onClick={() => handleSelectTemplate(tmpl.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                    selectedTemplateId === tmpl.id
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-500 font-bold shadow-xs ring-1 ring-emerald-400'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  {tmpl.title}
                </button>
              ))}
            </div>
          </div>

          {/* Editable Preview Box */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                {t('wa_preview_title')}
              </label>
              <button
                id="whatsapp-copy-text-btn"
                type="button"
                onClick={handleCopy}
                className="text-[11px] text-emerald-600 hover:underline flex items-center gap-1 font-bold"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? t('wa_copied') : t('wa_copy_text')}</span>
              </button>
            </div>
            <textarea
              id="whatsapp-message-textarea"
              rows={9}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full p-3.5 rounded-2xl border border-slate-300 bg-slate-50 text-slate-900 text-xs leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-hidden font-sans resize-none"
              placeholder="Edit your WhatsApp message before sending..."
            />
          </div>
        </div>

        {/* Footer */}
        <div
          id="whatsapp-modal-footer"
          className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2"
        >
          <button
            id="whatsapp-modal-cancel-btn"
            onClick={onClose}
            className="px-4 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {t('wa_cancel')}
          </button>
          <button
            id="whatsapp-modal-send-btn"
            onClick={handleSend}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-2 transition-all"
          >
            <Send className="w-4 h-4" />
            <span>{t('wa_send')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
