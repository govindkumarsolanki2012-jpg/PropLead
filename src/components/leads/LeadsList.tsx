import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Download,
  Users,
  Clock,
  Flame,
  ArrowUpDown,
  X,
  Building,
} from 'lucide-react';
import { Lead, LeadStatus, LeadPriority, RequirementType, UserProfile } from '../../types';
import { LeadCard } from './LeadCard';
import { exportLeadsToCSV } from '../../utils/storage';
import { formatRelativeDate } from '../../utils/formatters';
import { useTranslation } from '../../context/LanguageContext';

interface LeadsListProps {
  leads: Lead[];
  profile: UserProfile;
  initialFilter?: string;
  onOpenQuickAdd: () => void;
  onOpenLeadDetail: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onOpenSchedule: (lead: Lead) => void;
}

export const LeadsList: React.FC<LeadsListProps> = ({
  leads,
  profile,
  initialFilter = 'all',
  onOpenQuickAdd,
  onOpenLeadDetail,
  onOpenWhatsApp,
  onOpenSchedule,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>(initialFilter);
  const [sortBy, setSortBy] = useState<'followup' | 'newest' | 'budget' | 'priority'>('followup');

  // Filter definitions
  const filters = [
    { id: 'all', label: t('leads_filter_all'), count: leads.length },
    {
      id: 'today',
      label: `⚡ ${t('leads_filter_today')}`,
      count: leads.filter((l) => formatRelativeDate(l.nextFollowUpDate).isToday).length,
    },
    {
      id: 'overdue',
      label: `🚨 ${t('leads_filter_overdue')}`,
      count: leads.filter((l) => formatRelativeDate(l.nextFollowUpDate).isOverdue).length,
    },
    { id: 'hot', label: `🔥 ${t('leads_filter_hot')}`, count: leads.filter((l) => l.priority === 'hot').length },
    { id: 'buy', label: t('leads_filter_buy'), count: leads.filter((l) => l.requirement === 'buy').length },
    { id: 'rent', label: t('leads_filter_rent'), count: leads.filter((l) => l.requirement === 'rent').length },
    {
      id: 'site_visit_scheduled',
      label: t('leads_filter_visits'),
      count: leads.filter(
        (l) => l.status === 'site_visit_scheduled' || l.status === 'site_visit_completed'
      ).length,
    },
    {
      id: 'negotiation',
      label: t('leads_filter_negotiation'),
      count: leads.filter((l) => l.status === 'negotiation').length,
    },
    { id: 'closed', label: t('leads_filter_closed'), count: leads.filter((l) => l.status === 'closed').length },
  ];

  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = lead.name.toLowerCase().includes(q);
          const matchPhone = lead.phone.includes(q);
          const matchLoc = lead.preferredLocations.some((loc) => loc.toLowerCase().includes(q));
          const matchBhk = lead.bhk?.toLowerCase().includes(q);
          const matchNotes = lead.notes?.toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchLoc && !matchBhk && !matchNotes) {
            return false;
          }
        }

        // Category / Stage filter
        if (activeFilter === 'all') return true;
        if (activeFilter === 'today') return formatRelativeDate(lead.nextFollowUpDate).isToday;
        if (activeFilter === 'overdue') return formatRelativeDate(lead.nextFollowUpDate).isOverdue;
        if (activeFilter === 'hot') return lead.priority === 'hot';
        if (activeFilter === 'buy') return lead.requirement === 'buy';
        if (activeFilter === 'rent') return lead.requirement === 'rent';
        if (activeFilter === 'site_visit_scheduled') {
          return lead.status === 'site_visit_scheduled' || lead.status === 'site_visit_completed';
        }
        return lead.status === activeFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'budget') {
          return (b.budgetMax || 0) - (a.budgetMax || 0);
        }
        if (sortBy === 'priority') {
          const score = { hot: 3, warm: 2, cold: 1 };
          return (score[b.priority] || 0) - (score[a.priority] || 0);
        }
        // default: earliest follow-up
        if (!a.nextFollowUpDate) return 1;
        if (!b.nextFollowUpDate) return -1;
        return new Date(a.nextFollowUpDate).getTime() - new Date(b.nextFollowUpDate).getTime();
      });
  }, [leads, searchQuery, activeFilter, sortBy]);

  return (
    <div className="flex-1 overflow-y-auto pb-20 flex flex-col">
      {/* Top Search Bar & Export Actions */}
      <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-3 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('leads_search_placeholder')}
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="w-5 h-5 rounded-full text-slate-400 hover:text-slate-600 absolute right-2.5 top-2.5 flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Export CSV Button */}
          <button
            onClick={() => exportLeadsToCSV(leads, profile.name)}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-200 dark:border-slate-700 transition-colors flex-shrink-0"
            title={t('leads_export_csv')}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>

        {/* Filter Chips Scrollbar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                activeFilter === f.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200'
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeFilter === f.id
                    ? 'bg-emerald-800 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Results Header & Sort Selector */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {t('leads_showing_count', { count: filteredLeads.length, total: leads.length })}
          </span>

          <div className="flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer outline-hidden"
            >
              <option value="followup">{t('leads_sort_followup')}</option>
              <option value="newest">{t('leads_sort_newest')}</option>
              <option value="budget">{t('leads_sort_budget')}</option>
              <option value="priority">{t('leads_sort_priority')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leads List or Empty State */}
      <div className="p-4 space-y-3 flex-1">
        {filteredLeads.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-700 my-auto">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {searchQuery ? t('leads_no_found') : t('leads_no_found')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              {searchQuery
                ? t('leads_no_found_desc')
                : t('leads_no_found_desc')}
            </p>
            <button
              onClick={onOpenQuickAdd}
              className="mt-4 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md inline-flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{t('leads_add_first')}</span>
            </button>
          </div>
        ) : (
          filteredLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onOpenDetail={onOpenLeadDetail}
              onOpenWhatsApp={onOpenWhatsApp}
              onQuickFollowUp={onOpenSchedule}
            />
          ))
        )}
      </div>
    </div>
  );
};
