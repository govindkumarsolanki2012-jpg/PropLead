import React from 'react';
import {
  Plus,
  Phone,
  MessageSquare,
  Clock,
  AlertTriangle,
  Calendar,
  Sparkles,
  Users,
  CheckCircle2,
  TrendingUp,
  Building,
  ChevronRight,
  Flame,
  ArrowUpRight,
  Car,
  UserPlus,
} from 'lucide-react';
import { Lead, UserProfile, LeadStatus, TabType } from '../../types';
import {
  formatRelativeDate,
  formatBudgetRange,
  formatDisplayPhone,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
} from '../../utils/formatters';
import { openDialer } from '../../utils/whatsapp';
import { TrialBanner } from '../common/TrialBanner';
import { useTranslation } from '../../context/LanguageContext';

interface DashboardProps {
  leads: Lead[];
  profile: UserProfile;
  onOpenQuickAdd: () => void;
  onOpenLeadDetail: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onOpenSchedule: (lead: Lead) => void;
  onOpenSubscription: () => void;
  onNavigateToLeadsWithFilter: (filter: string) => void;
  onNavigateToTab: (tab: TabType) => void;
  onOpenImportContacts: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  leads,
  profile,
  onOpenQuickAdd,
  onOpenLeadDetail,
  onOpenWhatsApp,
  onOpenSchedule,
  onOpenSubscription,
  onNavigateToLeadsWithFilter,
  onNavigateToTab,
  onOpenImportContacts,
}) => {
  const { t, translateStatus } = useTranslation();
  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate follow-ups
  const todayFollowUps = leads.filter((l) => {
    if (!l.nextFollowUpDate || l.status === 'closed' || l.status === 'lost') return false;
    const rel = formatRelativeDate(l.nextFollowUpDate);
    return rel.isToday;
  });

  const overdueFollowUps = leads.filter((l) => {
    if (!l.nextFollowUpDate || l.status === 'closed' || l.status === 'lost') return false;
    const rel = formatRelativeDate(l.nextFollowUpDate);
    return rel.isOverdue;
  });

  const upcomingFollowUps = leads.filter((l) => {
    if (!l.nextFollowUpDate || l.status === 'closed' || l.status === 'lost') return false;
    const rel = formatRelativeDate(l.nextFollowUpDate);
    return !rel.isToday && !rel.isOverdue;
  });

  const closedDeals = leads.filter((l) => l.status === 'closed');
  const activeLeads = leads.filter((l) => l.status !== 'closed' && l.status !== 'lost');

  // Pipeline stage counts
  const pipelineStages: { key: LeadStatus; label: string; count: number; color: string }[] = [
    { key: 'new', label: translateStatus('new'), count: leads.filter((l) => l.status === 'new').length, color: 'bg-sky-500' },
    { key: 'contacted', label: translateStatus('contacted'), count: leads.filter((l) => l.status === 'contacted').length, color: 'bg-indigo-500' },
    {
      key: 'site_visit_scheduled',
      label: translateStatus('site_visit_scheduled'),
      count: leads.filter((l) => l.status === 'site_visit_scheduled' || l.status === 'site_visit_completed').length,
      color: 'bg-amber-500',
    },
    { key: 'negotiation', label: translateStatus('negotiation'), count: leads.filter((l) => l.status === 'negotiation').length, color: 'bg-purple-500' },
    { key: 'advance_paid', label: translateStatus('advance_paid'), count: leads.filter((l) => l.status === 'advance_paid').length, color: 'bg-teal-500' },
    { key: 'closed', label: translateStatus('closed'), count: closedDeals.length, color: 'bg-emerald-500' },
  ];

  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  return (
    <div className="flex-1 overflow-y-auto pb-20 space-y-4">
      {/* Trial Reminders Banner */}
      <TrialBanner profile={profile} onOpenSubscription={onOpenSubscription} />

      {/* Hero Welcome & Quick Stats */}
      <div className="px-4 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              {t('dash_namaste')}, {profile?.name ? profile.name.split(' ')[0] : 'Agent'} 🙏
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('dash_daily_focus')}
            </p>
          </div>
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('dash_add_lead')}</span>
          </button>
        </div>
      </div>

      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 px-4">
        {/* Today's Follow-Ups */}
        <div
          onClick={() => onNavigateToLeadsWithFilter('today')}
          className="p-3.5 bg-amber-500/10 dark:bg-amber-950/40 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 cursor-pointer hover:bg-amber-500/15 transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
              {t('dash_today_action')}
            </span>
            <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {todayFollowUps.length}
          </div>
          <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-0.5 mt-0.5">
            <span>{t('dash_followups_today')}</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>

        {/* Upcoming */}
        <div
          onClick={() => onNavigateToTab('calendar')}
          className="p-3.5 bg-blue-500/10 dark:bg-blue-950/40 rounded-2xl border border-blue-200/80 dark:border-blue-800/60 cursor-pointer hover:bg-blue-500/15 transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300">
              {t('nav_calendar')}
            </span>
            <div className="w-6 h-6 rounded-lg bg-blue-500 text-white flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {upcomingFollowUps.length}
          </div>
          <span className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-0.5 mt-0.5">
            <span>{t('dash_view_schedule')}</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>

        {/* Total Active Leads */}
        <div
          onClick={() => onNavigateToLeadsWithFilter('all')}
          className="p-3.5 bg-slate-500/10 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-500/15 transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              {t('dash_active_leads')}
            </span>
            <div className="w-6 h-6 rounded-lg bg-slate-700 text-white flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {leads.length}
          </div>
          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold flex items-center gap-0.5 mt-0.5">
            <span>{t('dash_all_leads')}</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>

        {/* Closed Deals */}
        <div
          onClick={() => onNavigateToLeadsWithFilter('closed')}
          className="p-3.5 bg-emerald-500/10 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 cursor-pointer hover:bg-emerald-500/15 transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
              {t('dash_closed_deals')}
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {closedDeals.length}
          </div>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-0.5 mt-0.5">
            <span>{t('dash_closed_deals')} 🎉</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>

      {/* OVERDUE FOLLOW-UPS ALERT SECTION (If any exist) */}
      {overdueFollowUps.length > 0 && (
        <div className="mx-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-rose-800 dark:text-rose-300 uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{t('dash_overdue_reminders')} ({overdueFollowUps.length})</span>
            </div>
            <button
              onClick={() => onNavigateToLeadsWithFilter('overdue')}
              className="text-[11px] font-bold text-rose-700 hover:underline"
            >
              {t('dash_view_all')}
            </button>
          </div>

          <div className="space-y-2">
            {overdueFollowUps.slice(0, 2).map((lead) => (
              <div
                key={lead.id}
                onClick={() => onOpenLeadDetail(lead)}
                className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-rose-100 dark:border-rose-900 flex items-center justify-between gap-2 cursor-pointer hover:shadow-xs transition-all"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {lead.name} • {formatDisplayPhone(lead.phone)}
                  </div>
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium truncate mt-0.5">
                    {formatRelativeDate(lead.nextFollowUpDate).text}: {lead.nextFollowUpNote || 'Missed call reminder'}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openDialer(lead.phone)}
                    className="p-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 rounded-lg text-xs font-bold hover:bg-emerald-100"
                    title="Call"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onOpenWhatsApp(lead)}
                    className="p-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                    title="WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TODAY'S FOCUS: Actionable Follow-Up Cards */}
      <div className="px-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {t('dash_followups_today')} ({todayFollowUps.length})
            </h3>
          </div>
          <button
            onClick={() => onNavigateToLeadsWithFilter('today')}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
          >
            {t('dash_view_all')}
          </button>
        </div>

        {todayFollowUps.length === 0 ? (
          <div className="p-5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('dash_no_followups_today')}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {t('dash_all_caught_up')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayFollowUps.map((lead) => (
              <div
                key={lead.id}
                onClick={() => onOpenLeadDetail(lead)}
                className="p-3 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {lead.name}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                      {lead.nextFollowUpTime || 'Today'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {lead.bhk || lead.propertyType} • {formatBudgetRange(lead.budgetMin, lead.budgetMax)}
                  </div>

                  {lead.nextFollowUpNote && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium truncate mt-0.5">
                      👉 {lead.nextFollowUpNote}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openDialer(lead.phone)}
                    className="p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition-all"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onOpenWhatsApp(lead)}
                    className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PIPELINE FUNNEL OVERVIEW */}
      <div className="px-4">
        <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {t('dash_deal_pipeline')}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">{activeLeads.length} {t('dash_active_leads')}</span>
          </div>

          <div className="grid grid-cols-6 gap-1">
            {pipelineStages.map((stage) => (
              <button
                key={stage.key}
                onClick={() => onNavigateToLeadsWithFilter(stage.key)}
                className="flex flex-col items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors text-center"
              >
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {stage.count}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {stage.label}
                </span>
                <div className={`w-full h-1 rounded-full mt-1.5 ${stage.color}`} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS BAR */}
      <div className="px-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={onOpenQuickAdd}
            className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>{t('dash_add_lead')}</span>
          </button>

          <button
            onClick={() => onNavigateToTab('properties')}
            className="p-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all"
          >
            <Building className="w-5 h-5 text-emerald-600" />
            <span>{t('nav_properties')}</span>
          </button>

          <button
            onClick={() => onNavigateToTab('calendar')}
            className="p-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all"
          >
            <Calendar className="w-5 h-5 text-emerald-600" />
            <span>{t('nav_calendar')}</span>
          </button>

          <button
            onClick={onOpenImportContacts}
            className="p-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all"
          >
            <UserPlus className="w-5 h-5 text-blue-600" />
            <span>{t('dash_import_contacts')}</span>
          </button>
        </div>
      </div>

      {/* RECENT LEADS LIST */}
      <div className="px-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
            {t('dash_recent_leads')}
          </h3>
          <button
            onClick={() => onNavigateToLeadsWithFilter('all')}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
          >
            {t('dash_view_all')}
          </button>
        </div>

        <div className="space-y-2">
          {recentLeads.map((lead) => {
            const statusConfig = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
            return (
              <div
                key={lead.id}
                onClick={() => onOpenLeadDetail(lead)}
                className="p-3 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-400 transition-all cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {lead.name}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                      {translateStatus(lead.status)}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {lead.bhk || lead.propertyType} • {formatBudgetRange(lead.budgetMin, lead.budgetMax)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openDialer(lead.phone)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
                    title={t('dash_call')}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onOpenWhatsApp(lead)}
                    className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs"
                    title={t('dash_whatsapp')}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
