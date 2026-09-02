import React, { useState } from 'react';
import {
  X,
  Phone,
  MessageSquare,
  Calendar,
  Clock,
  MapPin,
  Flame,
  CheckCircle2,
  AlertCircle,
  Share2,
  Edit,
  Trash2,
  Plus,
  Send,
  Building,
  FileText,
  Mic,
  Activity,
  Check,
  ChevronDown,
  Sparkles,
  ChevronRight,
  IndianRupee,
  RefreshCw,
} from 'lucide-react';
import {
  Lead,
  LeadStatus,
  LeadPriority,
  VoiceNote,
  Attachment,
  UserProfile,
  Property,
} from '../../types';
import {
  formatBudgetRange,
  formatIndianCurrency,
  formatRelativeDate,
  formatDisplayPhone,
  formatDateTime,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  REQUIREMENT_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
} from '../../utils/formatters';
import { openDialer, copyUnicodeTextToClipboard } from '../../utils/whatsapp';
import { VoiceNoteRecorder } from './VoiceNoteRecorder';
import { LeadAttachmentManager } from './LeadAttachmentManager';
import {
  getGroupedPropertyMatches,
  getLeadTargetLocation,
  isSameCity,
} from '../../utils/propertyMatching';

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
  profile?: UserProfile;
  properties?: Property[];
  onUpdateLead: (updated: Lead) => void;
  onDeleteLead: (leadId: string) => Promise<void> | void;
  onOpenWhatsApp: (lead: Lead) => void;
  onOpenSchedule: (lead: Lead) => void;
  onOpenEdit: (lead: Lead) => void;
  onSharePropertyWithLead?: (property: Property, lead: Lead) => void;
  onOpenPropertyDetail?: (property: Property) => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  isOpen,
  onClose,
  lead,
  profile,
  properties = [],
  onUpdateLead,
  onDeleteLead,
  onOpenWhatsApp,
  onOpenSchedule,
  onOpenEdit,
  onSharePropertyWithLead,
  onOpenPropertyDetail,
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'notes' | 'attachments' | 'matching_properties'>('timeline');
  const [quickNoteText, setQuickNoteText] = useState<string>('');
  const [callLogModalOpen, setCallLogModalOpen] = useState<boolean>(false);
  const [callSummary, setCallSummary] = useState<string>('');
  const [showExpandedSearch, setShowExpandedSearch] = useState<boolean>(false);
  const [viewAllCityInventory, setViewAllCityInventory] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!isOpen) return null;

  const statusInfo = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
  const priorityInfo = PRIORITY_CONFIG[lead.priority] || PRIORITY_CONFIG.warm;
  const reqInfo = REQUIREMENT_TYPE_LABELS[lead.requirement] || REQUIREMENT_TYPE_LABELS.buy;
  const followUp = formatRelativeDate(lead.nextFollowUpDate, lead.nextFollowUpTime);

  const targetLocation = getLeadTargetLocation(lead);
  const groupedMatches = getGroupedPropertyMatches(lead, properties || [], {
    allowExpandedSearch: showExpandedSearch,
  });
  const cityAllProperties = (properties || []).filter(
    (p) =>
      p.status !== 'sold_rented' &&
      p.status !== 'archived' &&
      isSameCity(p.city, targetLocation.preferredCity)
  );

  // Status Change handler
  const handleStatusChange = (newStatus: LeadStatus) => {
    const statusLabel = STATUS_CONFIG[newStatus].label;
    const updatedActivities = [
      {
        id: `act_${Date.now()}`,
        leadId: lead.id,
        type: 'status_changed' as const,
        title: `Status updated to ${statusLabel}`,
        description: `Stage changed from ${STATUS_CONFIG[lead.status].label} to ${statusLabel}`,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      },
      ...lead.activities,
    ];

    onUpdateLead({
      ...lead,
      status: newStatus,
      updatedAt: new Date().toISOString().split('T')[0],
      activities: updatedActivities,
    });
  };

  // Mark Follow-Up Complete
  const handleMarkFollowUpComplete = () => {
    const updatedActivities = [
      {
        id: `act_${Date.now()}`,
        leadId: lead.id,
        type: 'followup_completed' as const,
        title: 'Follow-Up Completed',
        description: lead.nextFollowUpNote || 'Follow-up marked as completed.',
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      },
      ...lead.activities,
    ];

    onUpdateLead({
      ...lead,
      nextFollowUpDate: undefined,
      nextFollowUpTime: undefined,
      nextFollowUpNote: undefined,
      lastContactedAt: new Date().toISOString().split('T')[0],
      activities: updatedActivities,
    });
  };

  // Add Quick Note
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNoteText.trim()) return;

    const newActivity = {
      id: `act_${Date.now()}`,
      leadId: lead.id,
      type: 'note' as const,
      title: 'Note Added',
      description: quickNoteText.trim(),
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };

    onUpdateLead({
      ...lead,
      notes: lead.notes ? `${lead.notes}\n• ${quickNoteText.trim()}` : quickNoteText.trim(),
      activities: [newActivity, ...lead.activities],
    });
    setQuickNoteText('');
  };

  // Log Call Outcome
  const handleLogCall = () => {
    openDialer(lead.phone);
    const newActivity = {
      id: `act_${Date.now()}`,
      leadId: lead.id,
      type: 'call' as const,
      title: 'Called Customer',
      description: 'Phone call initiated from app',
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
    onUpdateLead({
      ...lead,
      lastContactedAt: new Date().toISOString().split('T')[0],
      activities: [newActivity, ...lead.activities],
    });
  };

  const handleShareLead = async () => {
    const text = `📋 PropLead Client Card:
👤 Name: ${lead.name}
📞 Phone: ${lead.phone}
🏢 Requirement: ${lead.requirement.toUpperCase()} ${lead.bhk || ''} (${PROPERTY_TYPE_LABELS[lead.propertyType]})
💰 Budget: ${formatBudgetRange(lead.budgetMin, lead.budgetMax)}
📍 Target Location: ${lead.preferredLocations.join(', ') || lead.preferredCity || 'Any'}
📝 Notes: ${lead.notes || 'None'}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `${lead.name} - Property Requirement`, text });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await copyUnicodeTextToClipboard(text);
    alert('Lead summary copied to clipboard with emojis & formatting!');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[94vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Top App Bar with Close & Quick Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${priorityInfo.badge}`}>
              {priorityInfo.emoji} {priorityInfo.label}
            </span>
            <span className="text-xs text-slate-400">
              Source: <b className="text-slate-700 dark:text-slate-200">{lead.source}</b>
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleShareLead}
              className="w-8 h-8 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
              title="Share Lead"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onOpenEdit(lead)}
              className="w-8 h-8 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
              title="Edit Lead"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setShowDeleteConfirm(true);
              }}
              className="w-8 h-8 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 flex items-center justify-center transition-colors"
              title="Delete Lead"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Dossier Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Customer Main Info Card */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {lead.name}
              </h2>
              <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                {formatDisplayPhone(lead.phone)}
              </div>
              {lead.email && (
                <div className="text-xs text-slate-400">{lead.email}</div>
              )}
            </div>

            {/* Quick Status Dropdown */}
            <div className="relative">
              <select
                value={lead.status}
                onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border appearance-none pr-8 cursor-pointer outline-hidden ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
              >
                <option value="new">1. New Lead</option>
                <option value="contacted">2. Contacted</option>
                <option value="site_visit_scheduled">3. Visit Scheduled</option>
                <option value="site_visit_completed">4. Visit Completed</option>
                <option value="negotiation">5. Negotiation</option>
                <option value="advance_paid">6. Advance Paid</option>
                <option value="closed">7. Deal Closed 🎉</option>
                <option value="lost">8. Lost / Dropped</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 pointer-events-none opacity-60" />
            </div>
          </div>

          {/* Direct One-Tap Communication Action Bar */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              onClick={handleLogCall}
              className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all"
            >
              <Phone className="w-4 h-4" />
              <span>Call Client</span>
            </button>

            <button
              onClick={() => onOpenWhatsApp(lead)}
              className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={() => onOpenSchedule(lead)}
              className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all"
            >
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Follow-Up</span>
            </button>
          </div>

          {/* Next Follow-Up Banner Box */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
              followUp.isOverdue
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
                : followUp.isToday
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Clock
                  className={`w-4 h-4 ${
                    followUp.isOverdue
                      ? 'text-rose-600'
                      : followUp.isToday
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Next Follow-Up: {lead.nextFollowUpDate ? followUp.text : 'None scheduled'}
                </span>
              </div>
              {lead.nextFollowUpNote && (
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                  "{lead.nextFollowUpNote}"
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {lead.nextFollowUpDate && (
                <button
                  onClick={handleMarkFollowUpComplete}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-emerald-50 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold border border-emerald-300 dark:border-emerald-700 flex items-center gap-1 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Done</span>
                </button>
              )}
              <button
                onClick={() => onOpenSchedule(lead)}
                className="px-2.5 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold transition-colors"
              >
                {lead.nextFollowUpDate ? 'Reschedule' : 'Set Date'}
              </button>
            </div>
          </div>

          {/* Property Requirement Specifications Box */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Property Specs
              </span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${reqInfo.badge}`}>
                {reqInfo.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Configuration</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {lead.bhk || 'Not specified'} • {PROPERTY_TYPE_LABELS[lead.propertyType]}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Budget</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatBudgetRange(lead.budgetMin, lead.budgetMax)}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Preferred Property City</span>
                <div className="flex items-center gap-1 font-bold text-slate-900 dark:text-white mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span className="truncate">
                    {targetLocation.preferredCity || 'Any City'}
                  </span>
                  <span className="text-[9px] px-1 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded font-bold">
                    Hard Filter
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Preferred Locality</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block truncate mt-0.5">
                  {targetLocation.preferredLocality ||
                    (lead.preferredLocations && lead.preferredLocations.length > 0
                      ? lead.preferredLocations.join(', ')
                      : 'Any Locality')}
                </span>
              </div>

              {lead.currentCity && (
                <div className="col-span-2 py-1.5 px-2.5 bg-slate-100/90 dark:bg-slate-700/50 rounded-xl flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">
                    Customer Current City:
                  </span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {lead.currentCity}
                  </span>
                </div>
              )}

              {lead.notes && (
                <div className="col-span-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[11px] mb-0.5">Agent Notes</span>
                  <p className="text-slate-700 dark:text-slate-300 text-xs italic whitespace-pre-line leading-relaxed">
                    {lead.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Tabs: Activity Timeline, Voice Notes, Photos/Docs */}
          <div>
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-3 mb-3 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`pb-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'timeline'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Activity ({lead.activities?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('matching_properties')}
                className={`pb-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap relative ${
                  activeTab === 'matching_properties'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                <span>Matching Properties ({groupedMatches.allPrimaryMatches.length})</span>
                {groupedMatches.allPrimaryMatches.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('notes')}
                className={`pb-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'notes'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Voice Notes ({lead.voiceNotes?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('attachments')}
                className={`pb-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'attachments'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Docs ({lead.attachments?.length || 0})</span>
              </button>
            </div>

            {/* TAB 1: ACTIVITY TIMELINE & QUICK NOTE INPUT */}
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                {/* Quick Add Note Form */}
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    type="text"
                    value={quickNoteText}
                    onChange={(e) => setQuickNoteText(e.target.value)}
                    placeholder="Log discussion note (e.g. Wife liked kitchen, wants East entrance)..."
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
                  >
                    <Send className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </form>

                {/* Timeline Items */}
                <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                  {lead.activities?.map((act) => (
                    <div key={act.id} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-900" />

                      <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {act.title}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {act.timestamp}
                          </span>
                        </div>
                        {act.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                            {act.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: MATCHING PROPERTIES */}
            {activeTab === 'matching_properties' && (
              <div className="space-y-4">
                {/* Header Summary */}
                <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-950 dark:text-emerald-100">
                        Target City: {targetLocation.preferredCity || 'Any City'}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {targetLocation.preferredLocality ? `Locality: ${targetLocation.preferredLocality} • ` : ''}
                      {groupedMatches.bestMatches.length} Best Matches • {groupedMatches.nearbyMatches.length} Nearby in City
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {targetLocation.currentCity && (
                      <span className="text-[10px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                        Lives in {targetLocation.currentCity}
                      </span>
                    )}
                    <span className="text-xs font-extrabold px-2.5 py-1 bg-emerald-600 text-white rounded-xl shadow-xs">
                      {groupedMatches.allPrimaryMatches.length} Found
                    </span>
                  </div>
                </div>

                {/* BEST MATCHES */}
                {groupedMatches.bestMatches.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>✨ Best Matches in {targetLocation.preferredCity || 'Target City'}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full">
                          {groupedMatches.bestMatches.length}
                        </span>
                      </h4>
                    </div>

                    <div className="space-y-2.5">
                      {groupedMatches.bestMatches.map(({ property, score, matchReasons, budgetDiffPercentage }) => (
                        <div
                          key={property.id}
                          className="p-3.5 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-400 transition-all shadow-xs space-y-2.5"
                        >
                          <div className="flex items-start gap-3">
                            {property.photos && property.photos.length > 0 ? (
                              <img
                                src={property.photos[0]}
                                alt={property.title}
                                referrerPolicy="no-referrer"
                                className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 flex-shrink-0">
                                <Building className="w-6 h-6" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-1">
                                <div>
                                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                    {property.title}
                                  </h4>
                                  <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    <MapPin className="w-3 h-3 text-emerald-600" />
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                      {property.locality}, {property.city}
                                    </span>
                                  </div>
                                </div>

                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold rounded-full flex-shrink-0">
                                  {score}% Match 🔥
                                </span>
                              </div>

                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                                  {formatIndianCurrency(property.price)}
                                </span>
                                {property.bhk && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                                    {property.bhk}
                                  </span>
                                )}
                                <span className="text-[10px] font-medium px-1.5 py-0.2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded capitalize">
                                  {property.propertyType}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Match Reasons Badges */}
                          <div className="flex flex-wrap gap-1">
                            {matchReasons.map((r, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-medium rounded-md"
                              >
                                ✓ {r}
                              </span>
                            ))}
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between gap-2">
                            <button
                              onClick={() => {
                                if (onOpenPropertyDetail) {
                                  onOpenPropertyDetail(property);
                                }
                              }}
                              className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 flex items-center gap-1"
                            >
                              <span>View Property Specs</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>

                            <button
                              onClick={() => {
                                if (onSharePropertyWithLead) {
                                  onSharePropertyWithLead(property, lead);
                                }
                              }}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Share on WhatsApp</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* NEARBY MATCHES IN SAME CITY */}
                {groupedMatches.nearbyMatches.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    <div className="flex items-center justify-between px-1">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>📍 Nearby Matches in {targetLocation.preferredCity}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-full">
                            {groupedMatches.nearbyMatches.length}
                          </span>
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Properties in surrounding localities of {targetLocation.preferredCity}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {groupedMatches.nearbyMatches.map(({ property, score, matchReasons }) => (
                        <div
                          key={property.id}
                          className="p-3 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 transition-all shadow-xs space-y-2.5"
                        >
                          <div className="flex items-start gap-3">
                            {property.photos && property.photos.length > 0 ? (
                              <img
                                src={property.photos[0]}
                                alt={property.title}
                                referrerPolicy="no-referrer"
                                className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 flex-shrink-0">
                                <Building className="w-6 h-6" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-1">
                                <div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded">
                                      Nearby Area
                                    </span>
                                  </div>
                                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                                    {property.title}
                                  </h4>
                                  <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                                    <MapPin className="w-3 h-3 text-blue-500" />
                                    <span>{property.locality}, {property.city}</span>
                                  </div>
                                </div>

                                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold rounded-full flex-shrink-0">
                                  {score}% Match
                                </span>
                              </div>

                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                  {formatIndianCurrency(property.price)}
                                </span>
                                {property.bhk && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                                    {property.bhk}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {matchReasons.map((r, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-medium rounded-md"
                              >
                                ✓ {r}
                              </span>
                            ))}
                          </div>

                          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between gap-2">
                            <button
                              onClick={() => {
                                if (onOpenPropertyDetail) {
                                  onOpenPropertyDetail(property);
                                }
                              }}
                              className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 flex items-center gap-1"
                            >
                              <span>View Property Specs</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>

                            <button
                              onClick={() => {
                                if (onSharePropertyWithLead) {
                                  onSharePropertyWithLead(property, lead);
                                }
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Share Option</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* NO MATCHES IN PREFERRED CITY STATE */}
                {groupedMatches.allPrimaryMatches.length === 0 && (
                  <div className="p-6 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
                    <Building className="w-9 h-9 mx-auto text-slate-400 opacity-60" />
                    <div>
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        No strong matches found in {targetLocation.preferredCity || 'preferred location'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                        Currently there are no suitable properties matching this customer's requirements in{' '}
                        <strong className="text-slate-800 dark:text-slate-200">{targetLocation.preferredCity || 'the requested city'}</strong>.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                      {targetLocation.preferredCity && (
                        <button
                          type="button"
                          onClick={() => setViewAllCityInventory(!viewAllCityInventory)}
                          className="w-full sm:w-auto px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                          <Building className="w-3.5 h-3.5" />
                          <span>
                            {viewAllCityInventory ? 'Hide' : 'View Other Properties in'} {targetLocation.preferredCity} ({cityAllProperties.length})
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowExpandedSearch(!showExpandedSearch)}
                        className="w-full sm:w-auto px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{showExpandedSearch ? 'Hide Expanded Area' : 'Expand Search Area'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* VIEW ALL CITY INVENTORY EXPLORER */}
                {viewAllCityInventory && cityAllProperties.length > 0 && (
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        All Available Inventory in {targetLocation.preferredCity} ({cityAllProperties.length})
                      </span>
                      <button
                        onClick={() => setViewAllCityInventory(false)}
                        className="text-[11px] text-slate-400 hover:text-slate-600 font-bold"
                      >
                        Close
                      </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {cityAllProperties.map((prop) => (
                        <div
                          key={prop.id}
                          className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {prop.title}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {prop.locality} • {prop.bhk || prop.propertyType} • {formatIndianCurrency(prop.price)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => onOpenPropertyDetail && onOpenPropertyDetail(prop)}
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-lg hover:bg-slate-200"
                            >
                              Specs
                            </button>
                            <button
                              onClick={() => onSharePropertyWithLead && onSharePropertyWithLead(prop, lead)}
                              className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-1"
                            >
                              <Share2 className="w-3 h-3" />
                              <span>Share</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* EXPANDED CROSS-CITY MATCHES (OPTIONAL TOGGLE) */}
                {showExpandedSearch && groupedMatches.expandedMatches.length > 0 && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Expanded Search (Outside {targetLocation.preferredCity || 'Target City'})</span>
                      </span>
                      <span className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
                        {groupedMatches.expandedMatches.length} Properties
                      </span>
                    </div>

                    <div className="space-y-2">
                      {groupedMatches.expandedMatches.map(({ property, score, matchReasons }) => (
                        <div
                          key={property.id}
                          className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-amber-200/80 dark:border-amber-800/40 space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 rounded">
                                Cross-City: {property.city}
                              </span>
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                                {property.title}
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                {property.locality}, {property.city} • {formatIndianCurrency(property.price)}
                              </p>
                            </div>
                            <button
                              onClick={() => onSharePropertyWithLead && onSharePropertyWithLead(property, lead)}
                              className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1"
                            >
                              <Share2 className="w-3 h-3" />
                              <span>Share</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: VOICE NOTES */}
            {activeTab === 'notes' && (
              <VoiceNoteRecorder
                leadId={lead.id}
                voiceNotes={lead.voiceNotes || []}
                onAddVoiceNote={(newVn) => {
                  onUpdateLead({
                    ...lead,
                    voiceNotes: [newVn, ...(lead.voiceNotes || [])],
                    activities: [
                      {
                        id: `act_${Date.now()}`,
                        leadId: lead.id,
                        type: 'voice_note',
                        title: 'Voice Note Recorded',
                        description: newVn.note || `${newVn.durationSeconds}s audio memo recorded`,
                        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
                      },
                      ...lead.activities,
                    ],
                  });
                }}
                onDeleteVoiceNote={(id) => {
                  onUpdateLead({
                    ...lead,
                    voiceNotes: (lead.voiceNotes || []).filter((v) => v.id !== id),
                  });
                }}
              />
            )}

            {/* TAB 3: PHOTOS & DOCS */}
            {activeTab === 'attachments' && (
              <LeadAttachmentManager
                leadId={lead.id}
                attachments={lead.attachments || []}
                onAddAttachment={(newAtt) => {
                  onUpdateLead({
                    ...lead,
                    attachments: [newAtt, ...(lead.attachments || [])],
                    activities: [
                      {
                        id: `act_${Date.now()}`,
                        leadId: lead.id,
                        type: 'attachment_added',
                        title: `Attached ${newAtt.type === 'image' ? 'Photo' : 'Document'}`,
                        description: newAtt.name,
                        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
                      },
                      ...lead.activities,
                    ],
                  });
                }}
                onDeleteAttachment={(id) => {
                  onUpdateLead({
                    ...lead,
                    attachments: (lead.attachments || []).filter((a) => a.id !== id),
                  });
                }}
              />
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-scale-up">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Delete this lead?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[200px]">
                    {lead.name}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                This lead and its associated activity will be permanently deleted.
              </p>

              {deleteError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    if (!isDeleting) {
                      setShowDeleteConfirm(false);
                      setDeleteError(null);
                    }
                  }}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    if (isDeleting) return;
                    setIsDeleting(true);
                    setDeleteError(null);
                    try {
                      await onDeleteLead(lead.id);
                      setShowDeleteConfirm(false);
                      onClose();
                    } catch (err) {
                      console.error('Error deleting lead:', err);
                      setDeleteError('Unable to delete lead. Please try again.');
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-60"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete Lead</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
