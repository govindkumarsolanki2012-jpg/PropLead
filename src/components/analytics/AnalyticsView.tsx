import React from 'react';
import {
  TrendingUp,
  PieChart as PieIcon,
  Award,
  CheckCircle2,
  Users,
  Target,
  ArrowUpRight,
  Flame,
  Clock,
  Sparkles,
  IndianRupee,
} from 'lucide-react';
import { Lead, UserProfile } from '../../types';
import { formatIndianCurrency, formatRelativeDate } from '../../utils/formatters';
import { useTranslation } from '../../context/LanguageContext';

interface AnalyticsViewProps {
  leads: Lead[];
  profile: UserProfile;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ leads, profile }) => {
  const { t, translateStatus } = useTranslation();
  const totalLeads = leads.length;
  const closedLeads = leads.filter((l) => l.status === 'closed');
  const lostLeads = leads.filter((l) => l.status === 'lost');
  const activeLeads = leads.filter((l) => l.status !== 'closed' && l.status !== 'lost');

  // Conversion rate
  const conversionRate =
    totalLeads > 0 ? Math.round((closedLeads.length / totalLeads) * 100) : 0;

  // Total closed deal volume & estimated 2% commission
  const totalClosedDealVolume = closedLeads.reduce(
    (acc, l) => acc + (l.budgetMax || l.budgetMin || 0),
    0
  );
  const estimatedBrokerageWon = Math.round(totalClosedDealVolume * 0.02);

  // Follow-up compliance
  const overdueCount = leads.filter(
    (l) => l.nextFollowUpDate && formatRelativeDate(l.nextFollowUpDate).isOverdue
  ).length;
  const completedFollowUpsCount = leads.reduce((acc, l) => {
    return acc + (l.activities?.filter((a) => a.type === 'followup_completed').length || 0);
  }, 4);

  // Group by lead source
  const sourceMap: Record<string, number> = {};
  leads.forEach((l) => {
    sourceMap[l.source] = (sourceMap[l.source] || 0) + 1;
  });
  const sourceList = Object.entries(sourceMap)
    .map(([source, count]) => ({
      source,
      count,
      percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Pipeline stage breakdown
  const stageBreakdown = [
    { label: translateStatus('new'), count: leads.filter((l) => l.status === 'new').length, color: 'bg-sky-500' },
    { label: translateStatus('contacted'), count: leads.filter((l) => l.status === 'contacted').length, color: 'bg-indigo-500' },
    {
      label: translateStatus('site_visit_scheduled'),
      count: leads.filter(
        (l) => l.status === 'site_visit_scheduled' || l.status === 'site_visit_completed'
      ).length,
      color: 'bg-amber-500',
    },
    { label: translateStatus('negotiation'), count: leads.filter((l) => l.status === 'negotiation').length, color: 'bg-purple-500' },
    { label: translateStatus('advance_paid'), count: leads.filter((l) => l.status === 'advance_paid').length, color: 'bg-teal-500' },
    { label: translateStatus('closed'), count: closedLeads.length, color: 'bg-emerald-500' },
    { label: translateStatus('lost'), count: lostLeads.length, color: 'bg-slate-400' },
  ];

  return (
    <div className="flex-1 overflow-y-auto pb-20 p-4 space-y-4">
      {/* Top Banner */}
      <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl text-white shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
              {t('analytics_agency_perf')}
            </span>
          </div>
          <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-white/20">
            {profile.agencyName}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="text-[11px] text-emerald-100 font-medium">{t('analytics_deal_volume')}</div>
            <div className="text-xl font-black">{formatIndianCurrency(totalClosedDealVolume)}</div>
          </div>
          <div>
            <div className="text-[11px] text-emerald-100 font-medium">{t('analytics_brokerage_est')}</div>
            <div className="text-xl font-black text-amber-300">
              {formatIndianCurrency(estimatedBrokerageWon)}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 font-bold uppercase block">{t('analytics_conversion_rate')}</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {conversionRate}%
          </div>
          <span className="text-[10px] text-slate-500">{t('analytics_won_of_total', { count: closedLeads.length, total: totalLeads })}</span>
        </div>

        <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 font-bold uppercase block">{t('analytics_active_pipeline')}</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            {activeLeads.length}
          </div>
          <span className="text-[10px] text-slate-500">{t('analytics_in_progress')}</span>
        </div>

        <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 font-bold uppercase block">{t('analytics_followups_met')}</span>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
            {completedFollowUpsCount}
          </div>
          <span className="text-[10px] text-slate-500">{t('analytics_completed_actions')}</span>
        </div>

        <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 font-bold uppercase block">{t('analytics_overdue')}</span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
            {overdueCount}
          </div>
          <span className="text-[10px] text-slate-500">{t('analytics_immediate_call')}</span>
        </div>
      </div>

      {/* Leads by Source Breakdown */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <PieIcon className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t('analytics_top_sources')}
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">{sourceList.length} {t('leads_source')}</span>
        </div>

        <div className="space-y-2.5">
          {sourceList.map((item) => (
            <div key={item.source} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {item.source}
                </span>
                <span className="font-bold text-slate-600 dark:text-slate-400">
                  {item.count} ({item.percentage}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(item.percentage, 5)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Stages Breakdown */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-2xs">
        <div className="flex items-center gap-1.5">
          <Target className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {t('analytics_pipeline_stages')}
          </h3>
        </div>

        <div className="space-y-2">
          {stageBreakdown.map((stage) => {
            const pct = totalLeads > 0 ? Math.round((stage.count / totalLeads) * 100) : 0;
            return (
              <div key={stage.label} className="flex items-center justify-between text-xs py-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {stage.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">{stage.count}</span>
                  <span className="text-slate-400 text-[11px] w-8 text-right">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
