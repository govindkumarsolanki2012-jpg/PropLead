import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  ShieldCheck,
  Phone,
  Copy,
  Check,
  Send,
  User,
  MapPin,
  IndianRupee,
  Building,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import { Property, Lead, UserProfile } from '../../types';
import { generateCustomerPropertyMessage, openWhatsAppPropertyShare, getPublicGalleryUrl } from '../../utils/propertySharing';
import { formatIndianCurrency, PROPERTY_TYPE_LABELS, normalizePropertyPhotos } from '../../utils/formatters';
import { openWhatsApp, copyUnicodeTextToClipboard } from '../../utils/whatsapp';
import { savePublicPhotoShare } from '../../services/firebaseService';

interface SharePropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property;
  leads: Lead[];
  profile: UserProfile;
  preselectedLead?: Lead | null;
}

export const SharePropertyModal: React.FC<SharePropertyModalProps> = ({
  isOpen,
  onClose,
  property,
  leads,
  profile,
  preselectedLead,
}) => {
  const [selectedLeadId, setSelectedLeadId] = useState<string>(preselectedLead?.id || 'custom');
  const [customName, setCustomName] = useState<string>(preselectedLead?.name || '');
  const [customPhone, setCustomPhone] = useState<string>(preselectedLead?.phone || '');
  const [copied, setCopied] = useState<boolean>(false);
  const [editedMessage, setEditedMessage] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    async function initShare() {
      let galleryUrl = getPublicGalleryUrl(property.id);
      if (property.photos && property.photos.length > 0) {
        const validUrlPhotos = normalizePropertyPhotos(property.photos);
        if (validUrlPhotos.length > 0) {
          try {
            await savePublicPhotoShare(property.id, validUrlPhotos);
          } catch (err) {
            console.warn('Failed to save public photo share:', err);
          }
        }
      }
      if (isMounted) {
        setEditedMessage(generateCustomerPropertyMessage(property, profile, preselectedLead?.name, galleryUrl));
      }
    }
    if (isOpen) {
      initShare();
    }
    return () => { isMounted = false; };
  }, [isOpen, property, profile, preselectedLead]);

  if (!isOpen) return null;

  const handleSelectLead = async (leadId: string) => {
    setSelectedLeadId(leadId);
    let galleryUrl = getPublicGalleryUrl(property.id);
    if (property.photos && property.photos.length > 0) {
      const validUrlPhotos = normalizePropertyPhotos(property.photos);
      if (validUrlPhotos.length > 0) {
        try {
          await savePublicPhotoShare(property.id, validUrlPhotos);
        } catch (err) {
          console.warn('Failed to save public photo share:', err);
        }
      }
    }

    if (leadId === 'custom') {
      setCustomName('');
      setCustomPhone('');
      setEditedMessage(generateCustomerPropertyMessage(property, profile, '', galleryUrl));
    } else {
      const found = leads.find((l) => l.id === leadId);
      if (found) {
        setCustomName(found.name);
        setCustomPhone(found.phone);
        setEditedMessage(generateCustomerPropertyMessage(property, profile, found.name, galleryUrl));
      }
    }
  };

  const handleCopy = async () => {
    const success = await copyUnicodeTextToClipboard(editedMessage);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSendWhatsApp = async () => {
    const phoneToUse = customPhone.trim() || '';
    await openWhatsAppPropertyShare(property, phoneToUse, profile, customName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom duration-200">
        {/* Header - Sticky Top */}
        <div className="shrink-0 p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                Share Property with Customer
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Customer-safe WhatsApp card generator
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body - Scrollable */}
        <div className="p-4 overflow-y-auto overscroll-contain space-y-4 flex-1 min-h-0 pb-6">
          {/* STRICT PRIVACY BANNER */}
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 rounded-2xl flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Privacy Guaranteed & Protected
              </h4>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5 leading-relaxed">
                Owner name ({property.ownerName}), owner contact ({property.ownerPhone}), exact house number, and private notes are <span className="font-extrabold underline">strictly hidden</span>. Only general locality ({property.locality}) is displayed.
              </p>
            </div>
          </div>

          {/* Quick Recipient Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Send To Lead / Customer</span>
              <span className="text-[10px] text-emerald-600 font-semibold">
                {leads.length} leads in CRM
              </span>
            </label>

            <div className="grid grid-cols-1 gap-2">
              <select
                value={selectedLeadId}
                onChange={(e) => handleSelectLead(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="custom">✏️ Enter Custom Customer / Direct Share</option>
                <optgroup label="Your Leads in CRM">
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} • {l.phone} ({l.bhk || l.requirement})
                    </option>
                  ))}
                </optgroup>
              </select>

              {/* Customer Name & Phone Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => {
                      setCustomName(e.target.value);
                      setEditedMessage(generateCustomerPropertyMessage(property, profile, e.target.value));
                    }}
                    placeholder="Customer Name (e.g. Vikram Ji)"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <input
                    type="tel"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    placeholder="Phone / WhatsApp Number"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Property Summary Thumbnail */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
            {property.photos && property.photos.length > 0 ? (
              <img
                src={property.photos[0]}
                alt={property.title}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 flex-shrink-0">
                <Building className="w-7 h-7" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {property.title}
              </h4>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                  {property.locality}, {property.city}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatIndianCurrency(property.price)}
                </span>
                {property.bhk && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                    {property.bhk}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Editable WhatsApp Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                WhatsApp Message Preview (Editable)
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Text'}</span>
              </button>
            </div>
            <textarea
              rows={5}
              value={editedMessage}
              onChange={(e) => setEditedMessage(e.target.value)}
              className="w-full p-3 text-xs font-mono rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-emerald-500 leading-relaxed resize-none min-h-[110px]"
            />
          </div>
        </div>

        {/* Action Buttons Footer - Sticky Bottom */}
        <div className="shrink-0 p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs flex items-center gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-10">
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-4 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all shrink-0 cursor-pointer min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="py-3 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 flex-1 cursor-pointer min-h-[44px]"
          >
            <Send className="w-4 h-4 shrink-0" />
            <span className="truncate">Open WhatsApp &amp; Send</span>
          </button>
        </div>
      </div>
    </div>
  );
};
