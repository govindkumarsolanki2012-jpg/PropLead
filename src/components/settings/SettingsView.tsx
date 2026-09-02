import React, { useState } from 'react';
import {
  User,
  Shield,
  CreditCard,
  Download,
  Moon,
  Sun,
  MessageSquare,
  Sparkles,
  Phone,
  HelpCircle,
  RotateCcw,
  RefreshCw,
  Save,
  Check,
  Building,
  Mail,
  Share2,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Cloud,
  LogOut,
} from 'lucide-react';
import { UserProfile, Lead, WhatsAppTemplate } from '../../types';
import { exportLeadsToCSV } from '../../utils/storage';
import { openWhatsAppDirect } from '../../utils/whatsapp';
import {
  getEffectiveSubscriptionStatus,
  openGooglePlayManageSubscriptions,
  restoreGooglePlayPurchases,
} from '../../utils/billing';
import { useLanguage } from '../../context/LanguageContext';

interface SettingsViewProps {
  profile: UserProfile;
  leads: Lead[];
  templates: WhatsAppTemplate[];
  darkMode: boolean;
  currentUserEmail?: string | null;
  isCloudSynced?: boolean;
  onGoogleSignIn?: () => void;
  onSignOut?: () => void;
  onToggleDarkMode: () => void;
  onUpdateProfile: (profile: UserProfile) => void;
  onUpdateTemplates: (templates: WhatsAppTemplate[]) => void;
  onOpenSubscription: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  leads,
  templates,
  darkMode,
  currentUserEmail,
  isCloudSynced,
  onGoogleSignIn,
  onSignOut,
  onToggleDarkMode,
  onUpdateProfile,
  onUpdateTemplates,
  onOpenSubscription,
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState<string>(profile?.name || '');
  const [agencyName, setAgencyName] = useState<string>(profile?.agencyName || '');
  const [phone, setPhone] = useState<string>(profile?.phone || '');
  const [city, setCity] = useState<string>(profile?.city || '');
  const [reraNumber, setReraNumber] = useState<string>(profile?.reraNumber || '');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreFeedback, setRestoreFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...profile,
      name: name.trim(),
      agencyName: agencyName.trim(),
      phone: phone.trim(),
      city: city.trim(),
      reraNumber: reraNumber.trim() || undefined,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSupportWhatsApp = () => {
    const text = `Hi PropLead Support, I am ${profile.name} (${profile.agencyName}, ${profile.city}). I need assistance with the app.`;
    openWhatsAppDirect('919876543210', text);
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20 p-4 space-y-4">
      {/* Profile Card & Form */}
      <form
        onSubmit={handleSaveProfile}
        className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3.5 shadow-2xs"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('settings_agent_profile')}
            </h2>
          </div>

          {savedSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> {t('settings_profile_saved')}
            </span>
          )}
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('settings_broker_name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('settings_agency_name')}
            </label>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('settings_mobile')}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('settings_primary_city')}
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('settings_rera_no')}
            </label>
            <input
              type="text"
              value={reraNumber}
              onChange={(e) => setReraNumber(e.target.value)}
              placeholder="e.g. A51900012345"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium uppercase"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{t('settings_save_profile')}</span>
        </button>
      </form>

      {/* Subscription & Billing Section */}
      {(() => {
        const { status, daysRemaining, expiryFormatted } = getEffectiveSubscriptionStatus(profile);

        const handleRestoreClick = async () => {
          setIsRestoring(true);
          setRestoreFeedback(null);
          try {
            const res = await restoreGooglePlayPurchases(profile.id);
            if (res.success && res.restored && res.profileUpdates) {
              onUpdateProfile({ ...profile, ...res.profileUpdates });
              setRestoreFeedback({
                type: 'success',
                message: res.message,
              });
            } else {
              setRestoreFeedback({
                type: res.billingUnavailable ? 'error' : 'info',
                message: res.message,
              });
            }
          } catch (err) {
            setRestoreFeedback({
              type: 'error',
              message: 'Google Play billing is currently unavailable. Please try again.',
            });
          } finally {
            setIsRestoring(false);
          }
        };

        return (
          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Subscription
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Google Play In-App Billing
                  </span>
                </div>
              </div>

              {status === 'ACTIVE' && (
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  Pro Active
                </span>
              )}
              {status === 'CANCELED_BUT_ACTIVE' && (
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  Active (Cancelled)
                </span>
              )}
              {status === 'TRIAL' && (
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                  {daysRemaining}d Trial Left
                </span>
              )}
              {status === 'PAYMENT_ISSUE' && (
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  Payment Issue
                </span>
              )}
              {status === 'EXPIRED' && (
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                  Expired
                </span>
              )}
            </div>

            {/* Current Plan & Details */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl space-y-1.5 border border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Current Plan:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Property Agent Pro</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Price:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">₹49/month</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  {status === 'TRIAL' ? 'Trial Expiry:' : 'Renewal / Expiry:'}
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {status === 'TRIAL'
                    ? `${daysRemaining} days remaining`
                    : expiryFormatted || 'Auto-renews monthly'}
                </span>
              </div>
            </div>

            {/* Restore Feedback Status Banner */}
            {restoreFeedback && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-start gap-2 border font-medium ${
                  restoreFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                    : restoreFeedback.type === 'info'
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
                }`}
              >
                {restoreFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                <div className="flex-1 leading-snug">{restoreFeedback.message}</div>
                <button
                  type="button"
                  onClick={() => setRestoreFeedback(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Actions Grid: Manage Subscription, Restore Purchase */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={openGooglePlayManageSubscriptions}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Manage Subscription</span>
              </button>

              <button
                type="button"
                disabled={isRestoring}
                onClick={handleRestoreClick}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
              >
                {isRestoring ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>{isRestoring ? 'Checking Google Play...' : 'Restore Purchase'}</span>
              </button>
            </div>

            {status !== 'ACTIVE' && (
              <button
                type="button"
                onClick={onOpenSubscription}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {status === 'TRIAL' ? 'View Pro Benefits (₹49/mo)' : 'Subscribe to Pro (₹49/mo)'}
                </span>
              </button>
            )}
          </div>
        );
      })()}

      {/* App Preferences (Theme) */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-2xs">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          {t('settings_preferences')}
        </h3>

        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            {darkMode ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <span>{t('settings_dark_mode')}</span>
          </div>
          <button
            onClick={onToggleDarkMode}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
          >
            {darkMode ? `🌙 ${t('settings_dark_mode')}` : `☀️ ${t('settings_light_mode')}`}
          </button>
        </div>
      </div>

      {/* Firebase Cloud Sync & Security */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {t('settings_cloud_sync')}
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Firebase Firestore • Multi-Device
              </span>
            </div>
          </div>
          <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{t('settings_synced')}</span>
          </span>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl space-y-1.5 border border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">{t('settings_account')}:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
              {currentUserEmail || profile.email || 'Agent Cloud Account'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">{t('settings_leads_backed_up')}</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Safe & Secure
            </span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          {onGoogleSignIn && (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Switch Google Account</span>
            </button>
          )}

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="py-2 px-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-950/50 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Data Backup & Export */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-2xs">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          {t('settings_export_backup')}
        </h3>

        <button
          onClick={() => exportLeadsToCSV(leads, profile.name)}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-600 transition-all"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span>{t('settings_download_csv')} ({leads.length})</span>
        </button>
      </div>

      {/* Direct Agent Help & WhatsApp Support */}
      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white">
            {t('settings_support')}
          </h3>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-300">
          Our team is available on WhatsApp to support Indian real estate brokers and agents anytime.
        </p>
        <button
          onClick={handleSupportWhatsApp}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{t('settings_contact_whatsapp')}</span>
        </button>
      </div>
    </div>
  );
};
