import React from 'react';
import { X, Shield, ExternalLink, Lock, CheckCircle2, Mail } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  policyUrl?: string;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
  policyUrl = window.location.origin + '/privacy-policy',
}) => {
  if (!isOpen) return null;

  const handleOpenExternal = () => {
    window.open(policyUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[88vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                PropLead Privacy Policy
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Last updated: September 2026 • Effective immediately
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenExternal}
              title="Open full policy in web browser"
              className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Web Version</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {/* Key Privacy Guarantee */}
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/80 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Broker Data Confidentiality Pledge</span>
            </div>
            <p className="text-xs text-emerald-900/90 dark:text-emerald-200/90">
              PropLead is purpose-built for Indian real estate agents, brokers, and consultants. We strictly guarantee that <strong>your client contacts, lead requirements, property inventory, private owner details, and notes are 100% private to you</strong>. We NEVER sell, rent, or share your business data with property portals, telemarketers, or third-party advertisers.
            </p>
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              1. Information We Collect
            </h3>
            <p>
              When you use PropLead, we collect and store only the information required to deliver CRM, follow-up reminders, and property matching capabilities:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Agent Profile:</strong> Your name, agency name, phone number, city, RERA registration number, and Google account email address.</li>
              <li><strong>Lead & Client Records:</strong> Client names, phone numbers, WhatsApp numbers, property requirements (budget, BHK, localities), and interaction notes created by you.</li>
              <li><strong>Property Inventory:</strong> Listings, pricing, photos, and confidential owner contact details entered by you.</li>
              <li><strong>Voice Notes & Documents:</strong> Audio memos and document attachments uploaded to lead files.</li>
              <li><strong>Subscription Details:</strong> Google Play purchase status, plan identifiers, and expiry dates to manage Pro access.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              2. How We Use Your Information
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>To organize your real estate leads and generate timely follow-up reminders.</li>
              <li>To perform on-device matching between buyer requirements and your property listings.</li>
              <li>To synchronize your data securely across your devices via Google Cloud / Firebase Firestore.</li>
              <li>To verify Google Play subscription status and grant Pro features.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              3. Device Permissions & Purpose
            </h3>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong>Read Contacts:</strong> Used exclusively when you explicitly choose to import phone contacts as leads. We never access your contacts in the background or upload them elsewhere.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong>Microphone / Record Audio:</strong> Used solely when you record voice notes on a specific lead. Recordings are saved only inside that lead's record.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong>Notifications:</strong> Used solely to alert you of scheduled follow-ups and site visits at the times you set.</span>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              4. Data Storage & Security
            </h3>
            <p>
              Your data is stored securely using Google Cloud Infrastructure and Firebase Firestore. Each user account is strictly isolated using Firestore security rules so that only your verified Google authentication credentials can read or write your business records. All network traffic is encrypted using industry-standard TLS/HTTPS protocols.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              5. Your Rights: Export & Permanent Deletion
            </h3>
            <p>
              You own your data. You have the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Export:</strong> Download all your leads to CSV at any time from Settings.</li>
              <li><strong>Permanent Account & Data Deletion:</strong> You can delete your account and permanently erase all leads, properties, attachments, and profile records directly in the app via <em>Settings &gt; Account &gt; Delete Account &amp; Data</em>, or via our web portal.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              6. Google Play Subscriptions Notice
            </h3>
            <p>
              PropLead Pro subscriptions are billed through Google Play. Deleting your PropLead account or uninstalling the app does not automatically cancel active recurring subscriptions in Google Play. Users can manage or cancel their subscription at any time at:
              <br />
              <a
                href="https://play.google.com/store/account/subscriptions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 dark:text-emerald-400 font-semibold underline"
              >
                https://play.google.com/store/account/subscriptions
              </a>
            </p>
          </section>

          <section className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              7. Contact Us
            </h3>
            <p>
              If you have any questions or privacy concerns, please contact the PropLead data protection team:
            </p>
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium mt-1">
              <Mail className="w-4 h-4 text-emerald-600" />
              <span>jyothigehlot2025@gmail.com</span>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            PropLead CRM for Real Estate Agents
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
