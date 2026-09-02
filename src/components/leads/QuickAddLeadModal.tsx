import React, { useState } from 'react';
import {
  X,
  Plus,
  Phone,
  MessageSquare,
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
  MapPin,
  Flame,
  Building,
  User,
  IndianRupee,
  Car,
  CalendarDays,
} from 'lucide-react';
import {
  Lead,
  RequirementType,
  PropertyType,
  LeadSource,
  LeadPriority,
  UserProfile,
  FollowUpType,
} from '../../types';
import { BudgetCustomizer } from './BudgetCustomizer';
import { formatIndianCurrency, cleanIndianPhone } from '../../utils/formatters';
import { openDialer, openWhatsApp, WHATSAPP_TEMPLATES } from '../../utils/whatsapp';
import { getEffectiveSubscriptionStatus } from '../../utils/billing';
import { useTranslation } from '../../context/LanguageContext';

interface QuickAddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveLead: (lead: Lead) => void;
  profile: UserProfile;
  onOpenSubscription: () => void;
}

export const QuickAddLeadModal: React.FC<QuickAddLeadModalProps> = ({
  isOpen,
  onClose,
  onSaveLead,
  profile,
  onOpenSubscription,
}) => {
  const { t, translateRequirement, translatePriority, language } = useTranslation();
  const { isLocked } = getEffectiveSubscriptionStatus(profile);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const tmrw = new Date(today);
  tmrw.setDate(tmrw.getDate() + 1);
  const tmrwStr = tmrw.toISOString().split('T')[0];

  const in3Days = new Date(today);
  in3Days.setDate(in3Days.getDate() + 3);
  const in3DaysStr = in3Days.toISOString().split('T')[0];

  // Form states
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [requirement, setRequirement] = useState<RequirementType>('buy');
  const [propertyType, setPropertyType] = useState<PropertyType>('flat');
  const [bhk, setBhk] = useState<string>('2 BHK');
  const [budgetMin, setBudgetMin] = useState<number | undefined>(undefined);
  const [budgetMax, setBudgetMax] = useState<number>(6500000);
  const [preferredCity, setPreferredCity] = useState<string>(
    profile?.city ? profile.city.split('/')[0].trim() : 'Gurgaon'
  );
  const [preferredLocality, setPreferredLocality] = useState<string>('');
  const [currentCity, setCurrentCity] = useState<string>('');
  const [source, setSource] = useState<LeadSource>('WhatsApp');
  const [priority, setPriority] = useState<LeadPriority>('hot');
  const [notes, setNotes] = useState<string>('');

  // Follow-up scheduling states
  const [followUpPreset, setFollowUpPreset] = useState<'today' | 'tomorrow' | 'in3days' | 'weekend' | 'custom' | 'none'>('today');
  const [customFollowUpDate, setCustomFollowUpDate] = useState<string>(todayStr);
  const [followUpTime, setFollowUpTime] = useState<string>('11:30');
  const [followUpType, setFollowUpType] = useState<FollowUpType>('call');
  const [showCustomCalendar, setShowCustomCalendar] = useState<boolean>(false);

  // Success screen state
  const [createdLead, setCreatedLead] = useState<Lead | null>(null);

  if (!isOpen) return null;

  if (isLocked) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto shadow-xs">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {t('trial_ended')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('trial_desc')}
            </p>
          </div>
          <div className="py-3 px-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-500/30">
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
              ₹49<span className="text-sm font-semibold text-slate-500 dark:text-slate-400">/month</span>
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <button
              onClick={() => {
                onClose();
                onOpenSubscription();
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-600/30 transition-all"
            >
              {t('unlock_unlimited')}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold"
            >
              {t('btn_cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quick budget presets
  const buyBudgetPresets = [
    { label: '₹35L', val: 3500000 },
    { label: '₹50L', val: 5000000 },
    { label: '₹75L', val: 7500000 },
    { label: '₹1.2Cr', val: 12000000 },
    { label: '₹2Cr', val: 20000000 },
    { label: '₹3Cr+', val: 30000000 },
  ];

  const rentBudgetPresets = [
    { label: '₹15k', val: 15000 },
    { label: '₹25k', val: 25000 },
    { label: '₹40k', val: 40000 },
    { label: '₹60k', val: 60000 },
    { label: '₹1L+', val: 100000 },
  ];

  const currentBudgetPresets = requirement === 'rent' ? rentBudgetPresets : buyBudgetPresets;

  const handlePresetSelect = (preset: 'today' | 'tomorrow' | 'in3days' | 'weekend' | 'custom' | 'none') => {
    setFollowUpPreset(preset);
    if (preset === 'today') {
      setCustomFollowUpDate(todayStr);
      setShowCustomCalendar(false);
    } else if (preset === 'tomorrow') {
      setCustomFollowUpDate(tmrwStr);
      setShowCustomCalendar(false);
    } else if (preset === 'in3days') {
      setCustomFollowUpDate(in3DaysStr);
      setShowCustomCalendar(false);
    } else if (preset === 'weekend') {
      const sat = new Date(today);
      const day = today.getDay();
      const diff = day <= 6 ? 6 - day : 0;
      sat.setDate(sat.getDate() + (diff === 0 ? 7 : diff));
      setCustomFollowUpDate(sat.toISOString().split('T')[0]);
      setShowCustomCalendar(false);
    } else if (preset === 'custom') {
      setShowCustomCalendar(true);
    } else if (preset === 'none') {
      setShowCustomCalendar(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert('Please enter at least Customer Name and Phone Number');
      return;
    }

    let followUpDate: string | undefined = undefined;
    if (followUpPreset === 'today') {
      followUpDate = todayStr;
    } else if (followUpPreset === 'tomorrow') {
      followUpDate = tmrwStr;
    } else if (followUpPreset === 'in3days') {
      followUpDate = in3DaysStr;
    } else if (followUpPreset === 'weekend') {
      const sat = new Date(today);
      const day = today.getDay();
      const diff = day <= 6 ? 6 - day : 0;
      sat.setDate(sat.getDate() + (diff === 0 ? 7 : diff));
      followUpDate = sat.toISOString().split('T')[0];
    } else if (followUpPreset === 'custom') {
      followUpDate = customFollowUpDate || todayStr;
    }

    const preferredLocationsList = [
      ...(preferredLocality.trim() ? [preferredLocality.trim()] : []),
      ...(preferredCity.trim() ? [preferredCity.trim()] : []),
    ];

    const newLead: Lead = {
      id: `lead_${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      whatsapp: phone.trim(),
      requirement,
      propertyType,
      bhk: requirement === 'sell' && propertyType === 'plot' ? 'Plot/Land' : bhk,
      budgetMin: budgetMin || Math.round(budgetMax * 0.8),
      budgetMax: budgetMax,
      currentCity: currentCity.trim() || undefined,
      preferredCity: preferredCity.trim() || undefined,
      preferredLocality: preferredLocality.trim() || undefined,
      preferredLocations: preferredLocationsList,
      source,
      priority,
      status: followUpType === 'site_visit' ? 'site_visit_scheduled' : 'new',
      notes: notes.trim(),
      nextFollowUpDate: followUpDate,
      nextFollowUpTime: followUpDate ? followUpTime : undefined,
      nextFollowUpNote: followUpDate
        ? `${followUpType === 'site_visit' ? 'Site visit' : followUpType === 'whatsapp' ? 'WhatsApp discussion' : 'Follow-up call'} with ${name.trim()}`
        : undefined,
      lastContactedAt: undefined,
      createdAt: todayStr,
      updatedAt: todayStr,
      voiceNotes: [],
      attachments: [],
      activities: [
        {
          id: `act_${Date.now()}`,
          leadId: `lead_${Date.now()}`,
          type: 'created',
          title: 'Lead Created',
          description: `Captured from ${source} • ${requirement.toUpperCase()} ${bhk}${
            preferredCity ? ` in ${preferredCity}` : ''
          }${followUpDate ? ` • Reminder on ${followUpDate} at ${followUpTime}` : ''}`,
          timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        },
      ],
    };

    onSaveLead(newLead);
    setCreatedLead(newLead);
  };

  const handleResetAndClose = () => {
    setCreatedLead(null);
    setName('');
    setPhone('');
    setPreferredLocality('');
    setCurrentCity('');
    setNotes('');
    setFollowUpPreset('today');
    setCustomFollowUpDate(todayStr);
    setFollowUpTime('11:30');
    setShowCustomCalendar(false);
    onClose();
  };

  // Helper for human readable date formatting
  const formatFriendlyDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    } catch {
      // fallback
    }
    return dateStr;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col overflow-hidden animate-slide-up">
        {/* SUCCESS POST-SAVE VIEW */}
        {createdLead ? (
          <div className="p-6 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-md border-2 border-emerald-300 dark:border-emerald-700">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                {t('modal_quick_add_title')}
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {t('modal_saved_success')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {createdLead.name} • {createdLead.phone} • {formatIndianCurrency(createdLead.budgetMax)}
              </p>
            </div>

            {/* Quick Next Actions */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5 text-left">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('modal_immediate_action')}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => openDialer(createdLead.phone)}
                  className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
                >
                  <Phone className="w-4 h-4" />
                  <span>{t('modal_call_lead')} {createdLead.name.split(' ')[0]}</span>
                </button>

                <button
                  onClick={() => {
                    const template = WHATSAPP_TEMPLATES[0].getMessage(
                      createdLead,
                      profile.name,
                      profile.agencyName
                    );
                    openWhatsApp(createdLead.phone, template);
                  }}
                  className="p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{t('modal_whatsapp_intro')}</span>
                </button>
              </div>
            </div>

            <button
              onClick={handleResetAndClose}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-sm shadow-sm transition-all"
            >
              {t('modal_done_return')}
            </button>
          </div>
        ) : (
          /* QUICK CAPTURE FORM */
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {t('modal_quick_add_title')}
                  </h2>
                  <span className="text-[11px] text-slate-400">{t('modal_save_in_10s')}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Mandatory Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('modal_customer_name')} *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
                      autoFocus
                    />
                    <User className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('modal_phone_whatsapp')} *
                  </label>
                  <div className="flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
                    <span className="px-2.5 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-700/50 py-2.5 border-r border-slate-300 dark:border-slate-700">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="98201 23456"
                      maxLength={10}
                      className="w-full px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-hidden bg-transparent font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Requirement Type Chips (Buy / Sell / Rent / Lease) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('modal_requirement_type')}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['buy', 'rent', 'sell', 'lease'] as RequirementType[]).map((req) => (
                    <button
                      key={req}
                      type="button"
                      onClick={() => {
                        setRequirement(req);
                        if (req === 'rent' || req === 'lease') {
                          if (budgetMax > 500000) {
                            setBudgetMax(25000);
                            setBudgetMin(20000);
                          }
                        } else {
                          if (budgetMax < 500000) {
                            setBudgetMax(6500000);
                            setBudgetMin(5500000);
                          }
                        }
                      }}
                      className={`py-2 px-1 rounded-xl text-xs font-bold capitalize transition-all text-center border ${
                        requirement === req
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {req === 'buy'
                        ? `🏡 ${translateRequirement('buy')}`
                        : req === 'rent'
                        ? `🔑 ${translateRequirement('rent')}`
                        : req === 'sell'
                        ? `💰 ${translateRequirement('sell')}`
                        : `🏢 ${translateRequirement('lease')}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* BHK & Configuration Quick Chips */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('prop_bhk')}
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">{bhk}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['1 BHK', '2 BHK', '3 BHK', '4+ BHK', 'Studio', 'Plot/Land', 'Commercial Shop'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setBhk(item)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        bhk === item
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-500 font-bold'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customizable Target Budget */}
              <BudgetCustomizer
                requirement={requirement}
                budgetMin={budgetMin}
                budgetMax={budgetMax}
                onChange={(min, max) => {
                  setBudgetMin(min);
                  setBudgetMax(max);
                }}
              />

              {/* Preferred Property City & Locality (Hard Filter Priority) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t('modal_target_location')}</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold rounded">
                    City is Hard Filter
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {t('modal_preferred_city')} <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={preferredCity}
                      onChange={(e) => setPreferredCity(e.target.value)}
                      placeholder="e.g. Gurgaon, Bangalore, Mumbai..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {t('modal_preferred_locality')}
                    </label>
                    <input
                      type="text"
                      value={preferredLocality}
                      onChange={(e) => setPreferredLocality(e.target.value)}
                      placeholder="e.g. Sector 57, Golf Course Road..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    {t('modal_current_city_residence')}
                  </label>
                  <input
                    type="text"
                    value={currentCity}
                    onChange={(e) => setCurrentCity(e.target.value)}
                    placeholder="e.g. Mumbai (if customer lives elsewhere)"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {t('modal_current_city_note')}
                  </p>
                </div>
              </div>

              {/* Lead Source & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('leads_source')}
                  </label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as LeadSource)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="99acres">99acres</option>
                    <option value="MagicBricks">MagicBricks</option>
                    <option value="Housing.com">Housing.com</option>
                    <option value="Referral">Referral</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Phone Call">Phone Call</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook Ads</option>
                    <option value="Google">Google Search</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('modal_priority')}
                  </label>
                  <div className="flex gap-1">
                    {(['hot', 'warm', 'cold'] as LeadPriority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                          priority === p
                            ? p === 'hot'
                              ? 'bg-rose-500 text-white border-rose-500'
                              : p === 'warm'
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {p === 'hot'
                          ? `🔥 ${translatePriority('hot')}`
                          : p === 'warm'
                          ? `☀️ ${translatePriority('warm')}`
                          : `❄️ ${translatePriority('cold')}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Follow-Up Schedule with Interactive Calendar & Custom Date Picker */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{t('modal_schedule_followup')}</span>
                  </div>
                  {followUpPreset !== 'none' && (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                      {formatFriendlyDate(customFollowUpDate)} • {followUpTime}
                    </span>
                  )}
                </div>

                {/* Follow-Up Action Type Chips */}
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFollowUpType('call')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      followUpType === 'call'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Phone className="w-3 h-3" />
                    <span>{t('cal_legend_call')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowUpType('whatsapp')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      followUpType === 'whatsapp'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowUpType('site_visit')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      followUpType === 'site_visit'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Car className="w-3 h-3" />
                    <span>{t('cal_legend_visit')}</span>
                  </button>
                </div>

                {/* Quick Date Presets */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('today')}
                    className={`py-1.5 px-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      followUpPreset === 'today'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {t('modal_date_today')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('tomorrow')}
                    className={`py-1.5 px-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      followUpPreset === 'tomorrow'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {t('modal_date_tomorrow')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('in3days')}
                    className={`py-1.5 px-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      followUpPreset === 'in3days'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {t('modal_date_in_3_days')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('weekend')}
                    className={`py-1.5 px-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      followUpPreset === 'weekend'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {t('modal_date_weekend')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('custom')}
                    className={`py-1.5 px-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1 ${
                      followUpPreset === 'custom' || showCustomCalendar
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    <CalendarDays className="w-3 h-3" />
                    <span>{t('modal_date_custom')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('none')}
                    className={`py-1.5 px-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      followUpPreset === 'none'
                        ? 'bg-slate-600 text-white border-slate-600'
                        : 'bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-400 border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {t('modal_date_none')}
                  </button>
                </div>

                {/* Calendar Date & Time Picker */}
                {followUpPreset !== 'none' && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
                    {/* Date Input with Calendar Icon */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                        <span>{t('modal_select_date_cal')}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {formatFriendlyDate(customFollowUpDate)}
                        </span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="date"
                          min={todayStr}
                          value={customFollowUpDate}
                          onChange={(e) => {
                            setCustomFollowUpDate(e.target.value);
                            setFollowUpPreset('custom');
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden pr-9"
                        />
                        <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute right-3 pointer-events-none" />
                      </div>
                    </div>

                    {/* Time Picker & Preset Chips */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          {t('modal_followup_time')}
                        </label>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {followUpTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['10:00', '11:30', '16:00', '18:30'].map((timeStr) => (
                          <button
                            key={timeStr}
                            type="button"
                            onClick={() => setFollowUpTime(timeStr)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                              followUpTime === timeStr
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-500 font-bold'
                                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                            }`}
                          >
                            {timeStr === '10:00'
                              ? '10:00 AM'
                              : timeStr === '11:30'
                              ? '11:30 AM'
                              : timeStr === '16:00'
                              ? '04:00 PM'
                              : '06:30 PM'}
                          </button>
                        ))}
                        <div className="relative flex-1 min-w-[90px]">
                          <input
                            type="time"
                            value={followUpTime}
                            onChange={(e) => setFollowUpTime(e.target.value)}
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:ring-1 focus:ring-emerald-500 outline-hidden"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('modal_quick_note')}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('modal_quick_note_placeholder')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('modal_save_lead_btn')}</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
