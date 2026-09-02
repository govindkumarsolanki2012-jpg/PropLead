import React from 'react';
import {
  Phone,
  MessageSquare,
  Clock,
  MapPin,
  Flame,
  Calendar,
  Building,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { Lead } from '../../types';
import {
  formatBudgetRange,
  formatRelativeDate,
  formatDisplayPhone,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  REQUIREMENT_TYPE_LABELS,
} from '../../utils/formatters';
import { openDialer } from '../../utils/whatsapp';
import { useTranslation } from '../../context/LanguageContext';

interface LeadCardProps {
  lead: Lead;
  onOpenDetail: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onQuickFollowUp?: (lead: Lead) => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  onOpenDetail,
  onOpenWhatsApp,
  onQuickFollowUp,
}) => {
  const { t, translateStatus, translatePriority, translateRequirement } = useTranslation();
  const statusInfo = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
  const priorityInfo = PRIORITY_CONFIG[lead.priority] || PRIORITY_CONFIG.warm;
  const reqInfo = REQUIREMENT_TYPE_LABELS[lead.requirement] || REQUIREMENT_TYPE_LABELS.buy;
  const followUp = formatRelativeDate(lead.nextFollowUpDate, lead.nextFollowUpTime);

  // Avatar initials
  const initials = lead.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'LE';

  return (
    <div
      onClick={() => onOpenDetail(lead)}
      className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer relative group"
    >
      {/* Top Row: Avatar, Name, Priority, Status */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-600">
            {initials}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {lead.name}
              </h3>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border flex items-center gap-0.5 ${priorityInfo.badge}`}>
                <span>{priorityInfo.emoji}</span>
                <span className="hidden xs:inline">{translatePriority(lead.priority)}</span>
              </span>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
              {formatDisplayPhone(lead.phone)}
            </div>
          </div>
        </div>

        {/* Status Pill */}
        <span
          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex-shrink-0 flex items-center gap-1 ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: statusInfo.iconColor }}
          />
          <span>{translateStatus(lead.status)}</span>
        </span>
      </div>

      {/* Requirement & Budget Row */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${reqInfo.badge}`}>
          {translateRequirement(lead.requirement)}
        </span>

        {lead.bhk && (
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
            {lead.bhk}
          </span>
        )}

        <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-xs">
          {formatBudgetRange(lead.budgetMin, lead.budgetMax)}
        </span>

        {lead.preferredLocations.length > 0 && (
          <span className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[160px]">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{lead.preferredLocations[0]}</span>
          </span>
        )}
      </div>

      {/* Next Follow-Up Banner */}
      <div
        className={`mt-3 px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
          followUp.isOverdue
            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            : followUp.isToday
            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            : 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${followUp.isOverdue ? 'text-rose-600' : followUp.isToday ? 'text-amber-600' : 'text-slate-400'}`} />
          <span className="font-semibold truncate">
            {lead.nextFollowUpDate ? followUp.text : t('dash_no_followups_today')}
          </span>
        </div>

        {lead.nextFollowUpNote && (
          <span className="text-[11px] opacity-75 truncate max-w-[120px] hidden sm:inline">
            {lead.nextFollowUpNote}
          </span>
        )}
      </div>

      {/* Bottom 1-Tap Action Bar (Call & WhatsApp) */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between gap-2">
        <div className="text-[11px] text-slate-400 font-medium">
          {t('leads_source')}: <span className="text-slate-600 dark:text-slate-300 font-semibold">{lead.source}</span>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Quick Call */}
          <button
            onClick={() => openDialer(lead.phone)}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all active:scale-95 border border-emerald-200 dark:border-emerald-800"
            title={t('dash_call')}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>{t('dash_call')}</span>
          </button>

          {/* Quick WhatsApp */}
          <button
            onClick={() => onOpenWhatsApp(lead)}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs"
            title={t('dash_whatsapp')}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{t('dash_whatsapp')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
