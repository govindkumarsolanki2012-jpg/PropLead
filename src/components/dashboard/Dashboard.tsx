import React, { useRef, useMemo } from 'react';
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
  ChevronLeft,
  Flame,
  ArrowUpRight,
  Car,
  UserPlus,
  Search,
  X,
  MapPin,
} from 'lucide-react';
import { Lead, Property, UserProfile, LeadStatus, TabType } from '../../types';
import {
  formatRelativeDate,
  formatBudgetRange,
  formatDisplayPhone,
  formatIndianCurrency,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  PROPERTY_STATUS_CONFIG,
  PROPERTY_TYPE_LABELS,
} from '../../utils/formatters';
import { openDialer } from '../../utils/whatsapp';
import { TrialBanner } from '../common/TrialBanner';
import { useTranslation } from '../../context/LanguageContext';
import { LeadCard } from '../leads/LeadCard';
import { matchPropertyWithCityAliases, matchLeadWithCityAliases } from '../../utils/cityAliases';

interface DashboardProps {
  leads: Lead[];
  properties?: Property[];
  profile: UserProfile;
  searchQuery?: string;
  onClearSearch?: () => void;
  onOpenQuickAdd: () => void;
  onOpenLeadDetail: (lead: Lead) => void;
  onOpenPropertyDetail?: (property: Property) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onOpenSchedule: (lead: Lead) => void;
  onOpenSubscription: () => void;
  onNavigateToLeadsWithFilter: (filter: string) => void;
  onNavigateToTab: (tab: TabType) => void;
  onOpenImportContacts: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  leads,
  properties = [],
  profile,
  searchQuery = '',
  onClearSearch,
  onOpenQuickAdd,
  onOpenLeadDetail,
  onOpenPropertyDetail,
  onOpenWhatsApp,
  onOpenSchedule,
  onOpenSubscription,
  onNavigateToLeadsWithFilter,
  onNavigateToTab,
  onOpenImportContacts,
}) => {
  const { t, translateStatus } = useTranslation();
  const todayStr = new Date().toISOString().split('T')[0];

  // Global Dashboard Search logic (searches BOTH Leads and Properties using existing logic)
  const searchTrimmed = (searchQuery || '').trim().toLowerCase();
  const isSearching = searchTrimmed.length > 0;

  const matchingLeads = useMemo(() => {
    if (!isSearching) return [];
    return leads.filter((lead) => matchLeadWithCityAliases(lead, searchTrimmed));
  }, [leads, searchTrimmed, isSearching]);

  const matchingProperties = useMemo(() => {
    if (!isSearching || !properties) return [];
    return properties.filter((p) => matchPropertyWithCityAliases(p, searchTrimmed));
  }, [properties, searchTrimmed, isSearching]);

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

  const pipelineScrollRef = useRef<HTMLDivElement>(null);

  const scrollPipeline = (direction: 'left' | 'right') => {
    if (pipelineScrollRef.current) {
      const scrollDistance = direction === 'left' ? -150 : 150;
      pipelineScrollRef.current.scrollBy({ left: scrollDistance, behavior: 'smooth' });
    }
  };

  // If user is searching from Dashboard top search bar, display unified search results
  if (isSearching) {
    const totalResults = matchingLeads.length + matchingProperties.length;

    return (
      <div id="dashboard-search-view" className="flex-1 pb-32 safe-content w-full max-w-full overflow-x-hidden">
        <div className="p-4 space-y-4 max-w-3xl mx-auto">
          {/* Search Result Summary Header */}
          <div
            id="dashboard-search-summary-card"
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-2xs flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <Search className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span className="truncate">
                  {t('dash_search_results_for')}: <strong className="text-slate-900 dark:text-white font-bold">"{searchQuery}"</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                  {totalResults} {totalResults === 1 ? 'result' : 'results'}
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {matchingLeads.length} {matchingLeads.length === 1 ? 'Lead' : 'Leads'}, {matchingProperties.length} {matchingProperties.length === 1 ? 'Property' : 'Properties'}
                </span>
              </div>
            </div>

            {onClearSearch && (
              <button
                id="btn-clear-dashboard-search"
                type="button"
                onClick={onClearSearch}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors flex-shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('dash_clear_search')}</span>
              </button>
            )}
          </div>

          {/* Empty state when query produces 0 leads and 0 properties */}
          {totalResults === 0 ? (
            <div
              id="dashboard-search-empty-state"
              className="text-center py-12 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 my-4 shadow-xs"
            >
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('dash_no_search_results')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                {t('dash_no_search_results_desc')}
              </p>
              {onClearSearch && (
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{t('dash_clear_search')}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* 1. MATCHING LEADS SECTION */}
              <section id="dashboard-search-leads-section" className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      {t('dash_matching_leads')} ({matchingLeads.length})
                    </h4>
                  </div>
                  {matchingLeads.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('leads')}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {t('dash_view_all')}
                    </button>
                  )}
                </div>

                {matchingLeads.length === 0 ? (
                  <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                    No leads matching "{searchQuery}"
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {matchingLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onOpenDetail={onOpenLeadDetail}
                        onOpenWhatsApp={onOpenWhatsApp}
                        onQuickFollowUp={onOpenSchedule}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* 2. MATCHING PROPERTIES SECTION */}
              <section id="dashboard-search-properties-section" className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center">
                      <Building className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      {t('dash_matching_properties')} ({matchingProperties.length})
                    </h4>
                  </div>
                  {matchingProperties.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('properties')}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      {t('dash_view_all')}
                    </button>
                  )}
                </div>

                {matchingProperties.length === 0 ? (
                  <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                    No properties matching "{searchQuery}"
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {matchingProperties.map((property) => {
                      const statusCfg = PROPERTY_STATUS_CONFIG[property.status] || PROPERTY_STATUS_CONFIG.available;
                      const isRent = property.transactionType === 'rent' || property.transactionType === 'lease';
                      return (
                        <div
                          key={property.id}
                          id={`dashboard-search-property-${property.id}`}
                          onClick={() => onOpenPropertyDetail?.(property)}
                          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-2xs hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-600 transition-all group cursor-pointer"
                        >
                          <div className="flex flex-col sm:flex-row">
                            {/* Photo / Thumbnail */}
                            <div className="relative sm:w-40 aspect-16/9 sm:aspect-auto bg-slate-900 overflow-hidden flex-shrink-0">
                              {property.photos && property.photos.length > 0 ? (
                                <img
                                  src={property.photos[0]}
                                  alt={property.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full min-h-[90px] flex items-center justify-center text-slate-500 bg-slate-100 dark:bg-slate-800">
                                  <Building className="w-7 h-7 text-slate-400" />
                                </div>
                              )}
                              <span
                                className={`absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-extrabold shadow-xs border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                              >
                                {statusCfg.label}
                              </span>
                            </div>

                            {/* Details */}
                            <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between space-y-2">
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                      {PROPERTY_TYPE_LABELS[property.propertyType] || property.propertyType}
                                    </span>
                                    <h5 className="text-sm font-bold text-slate-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                                      {property.title}
                                    </h5>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 block">
                                      {formatIndianCurrency(property.price)}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {isRent ? t('prop_per_month') : property.priceNegotiable ? t('prop_negotiable') : t('prop_fixed')}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
                                  <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                                  <span className="truncate">
                                    {property.locality}, {property.city}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                  {property.bhk && (
                                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 font-bold rounded">
                                      {property.bhk}
                                    </span>
                                  )}
                                  {(property.superBuiltUpAreaSqFt || property.carpetAreaSqFt) && (
                                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 font-medium rounded">
                                      {property.superBuiltUpAreaSqFt || property.carpetAreaSqFt} sq.ft
                                    </span>
                                  )}
                                </div>

                                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                  <span>View Property</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div id="dashboard-main-view" className="flex-1 pb-32 space-y-4 w-full max-w-full overflow-x-hidden">
      {/* Trial Reminders Banner */}
      <TrialBanner profile={profile} onOpenSubscription={onOpenSubscription} />

      {/* Hero Welcome & Quick Stats */}
      <div className="px-4 pt-1">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
              {t('dash_namaste')}, {profile?.name ? profile.name.split(' ')[0] : 'Agent'} 🙏
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {t('dash_daily_focus')}
            </p>
          </div>
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all flex-shrink-0 whitespace-nowrap"
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
        <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {t('dash_deal_pipeline')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {activeLeads.length} {t('dash_active_leads')}
              </span>
              <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-700/60 rounded-lg p-0.5 border border-slate-200/60 dark:border-slate-600/40">
                <button
                  type="button"
                  onClick={() => scrollPipeline('left')}
                  className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-600 transition-colors"
                  title="Previous stages"
                  aria-label="Previous stages"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollPipeline('right')}
                  className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-600 transition-colors"
                  title="Next stages"
                  aria-label="Next stages"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Horizontally scrollable pipeline stages track */}
          <div
            ref={pipelineScrollRef}
            id="deal-pipeline-stages-track"
            className="flex items-stretch gap-2.5 overflow-x-auto pb-1.5 pt-0.5 px-0.5 scroll-smooth snap-x snap-mandatory overscroll-x-contain touch-pan-x"
            style={{
              scrollbarWidth: 'thin',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {pipelineStages.map((stage) => (
              <button
                key={stage.key}
                id={`pipeline-stage-${stage.key}`}
                onClick={() => onNavigateToLeadsWithFilter(stage.key)}
                className="flex-shrink-0 w-[116px] snap-start flex flex-col justify-between items-center p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-700/50 hover:bg-emerald-50/70 dark:hover:bg-slate-700/90 border border-slate-200/80 dark:border-slate-600/50 transition-all text-center group cursor-pointer shadow-2xs active:scale-95"
              >
                <span className="text-base font-black text-slate-900 dark:text-white leading-none">
                  {stage.count}
                </span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 text-center leading-snug my-1 px-1 break-words line-clamp-2 min-h-[30px] flex items-center justify-center">
                  {stage.label}
                </span>
                <div className={`w-full h-1.5 rounded-full ${stage.color}`} />
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

        {recentLeads.length === 0 ? (
          <div className="p-6 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Users className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('leads_no_found')}
            </p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              {t('leads_no_found_desc')}
            </p>
            <button
              onClick={onOpenQuickAdd}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('leads_add_first')}</span>
            </button>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};
