import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Download,
  Users,
  Clock,
  Flame,
  ArrowUpDown,
  X,
  Building,
  CheckSquare,
  Check,
  Minus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { Lead, LeadStatus, LeadPriority, RequirementType, UserProfile } from '../../types';
import { LeadCard } from './LeadCard';
import { exportLeadsToCSV } from '../../utils/storage';
import { formatRelativeDate } from '../../utils/formatters';
import { matchLeadWithCityAliases } from '../../utils/cityAliases';
import { useTranslation } from '../../context/LanguageContext';

interface LeadsListProps {
  leads: Lead[];
  profile: UserProfile;
  initialFilter?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onOpenQuickAdd: () => void;
  onOpenLeadDetail: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onOpenSchedule: (lead: Lead) => void;
  onDeleteBulkLeads?: (leadIds: string[]) => Promise<void>;
}

export const LeadsList: React.FC<LeadsListProps> = ({
  leads,
  profile,
  initialFilter = 'all',
  searchQuery = '',
  onSearchChange,
  onOpenQuickAdd,
  onOpenLeadDetail,
  onOpenWhatsApp,
  onOpenSchedule,
  onDeleteBulkLeads,
}) => {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<string>(initialFilter);
  const [sortBy, setSortBy] = useState<'followup' | 'newest' | 'budget' | 'priority'>('followup');

  // Bulk selection state
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Sync initialFilter prop if it updates from parent navigation
  useEffect(() => {
    if (initialFilter) {
      setActiveFilter(initialFilter);
    }
  }, [initialFilter]);

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
        // Search query filter (supports bidirectional Indian city alias matching)
        if (searchQuery.trim()) {
          if (!matchLeadWithCityAliases(lead, searchQuery)) {
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

  // Check if all filtered leads are selected
  const isAllSelected = useMemo(() => {
    if (filteredLeads.length === 0) return false;
    return filteredLeads.every((l) => selectedLeadIds.has(l.id));
  }, [filteredLeads, selectedLeadIds]);

  // Toggle select all visible
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const next = new Set(selectedLeadIds);
      filteredLeads.forEach((l) => next.delete(l.id));
      setSelectedLeadIds(next);
    } else {
      const next = new Set(selectedLeadIds);
      filteredLeads.forEach((l) => next.add(l.id));
      setSelectedLeadIds(next);
    }
  };

  // Toggle individual lead
  const handleToggleSelectLead = (leadId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  // Confirm delete bulk
  const handleConfirmDeleteBulk = async () => {
    if (isDeletingBulk || selectedLeadIds.size === 0) return;
    setIsDeletingBulk(true);
    setDeleteError(null);
    try {
      const ids = Array.from(selectedLeadIds);
      if (onDeleteBulkLeads) {
        await onDeleteBulkLeads(ids);
      }
      setSelectedLeadIds(new Set());
      setIsSelectionMode(false);
      setShowDeleteModal(false);
    } catch (err: any) {
      console.warn('Notice deleting selected leads:', err);
      setDeleteError(err?.message || 'Unable to delete selected leads. Please try again.');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  return (
    <div className="flex-1 pb-8 flex flex-col">
      {/* Filter Chips & Action Toolbar */}
      <div className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-2.5 sticky top-0 z-20">
        {/* Filter Chips Scrollbar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
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

        {/* Results Header, CSV Export & Sort Selector */}
        <div
          id="leads-toolbar"
          className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs text-slate-500 pt-0.5"
        >
          {/* Row 1: "Showing X leads" (Full Width on Mobile, completely separate row) */}
          <div
            id="leads-toolbar-row-1"
            className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 flex-wrap"
          >
            <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs sm:text-sm tracking-tight">
              {t('leads_showing_count', { count: filteredLeads.length, total: leads.length })}
            </span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/50 truncate max-w-[160px]">
                <span className="truncate">"{searchQuery}"</span>
                <button
                  type="button"
                  onClick={() => onSearchChange?.('')}
                  className="hover:text-emerald-900 dark:hover:text-emerald-100 flex-shrink-0 p-0.5"
                  aria-label="Clear filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          {/* Row 2: Action Controls - CSV | Select | Follow-Up Date (Full Width on Mobile, placed below Row 1) */}
          <div
            id="leads-toolbar-row-2"
            className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 flex-wrap sm:flex-nowrap"
          >
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Export CSV Button */}
              <button
                type="button"
                id="btn-export-csv"
                onClick={() => exportLeadsToCSV(filteredLeads, profile.name)}
                className="p-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all flex-shrink-0"
                title={t('leads_export_csv')}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="text-[11px]">CSV</span>
              </button>

              {/* Select Button */}
              <button
                id="btn-select-mode"
                type="button"
                onClick={() => {
                  if (isSelectionMode) {
                    setIsSelectionMode(false);
                    setSelectedLeadIds(new Set());
                  } else {
                    setIsSelectionMode(true);
                    setSelectedLeadIds(new Set());
                  }
                }}
                className={`p-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 flex-shrink-0 ${
                  isSelectionMode
                    ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
                title={isSelectionMode ? 'Cancel Selection' : 'Select Leads'}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="text-[11px]">{isSelectionMode ? 'Cancel' : 'Select'}</span>
              </button>
            </div>

            {/* Follow-Up Date Sorting Selector */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 flex-shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
              <select
                id="leads-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer outline-hidden pr-0.5"
              >
                <option value="followup">{t('leads_sort_followup')}</option>
                <option value="newest">{t('leads_sort_newest')}</option>
                <option value="budget">{t('leads_sort_budget')}</option>
                <option value="priority">{t('leads_sort_priority')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Selection Action Bar */}
        {isSelectionMode && (
          <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 transition-all">
            <div className="flex items-center gap-2.5">
              {/* Select All */}
              <button
                type="button"
                id="btn-select-all"
                onClick={handleToggleSelectAll}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-600 transition-colors"
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                    isAllSelected
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : selectedLeadIds.size > 0
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-500 text-emerald-600'
                      : 'border-slate-300 dark:border-slate-500 bg-transparent'
                  }`}
                >
                  {isAllSelected ? (
                    <Check className="w-3 h-3 stroke-[3]" />
                  ) : selectedLeadIds.size > 0 ? (
                    <Minus className="w-3 h-3 stroke-[3]" />
                  ) : null}
                </div>
                <span>Select All</span>
              </button>

              {/* Number of selected leads */}
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {selectedLeadIds.size} selected
              </span>
            </div>

            {/* Delete Selected Button */}
            <button
              type="button"
              id="btn-delete-selected"
              disabled={selectedLeadIds.size === 0 || isDeletingBulk}
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg text-xs shadow-xs transition-all active:scale-95 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        )}
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
            {searchQuery ? (
              <button
                onClick={() => onSearchChange?.('')}
                className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-all"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('leads_filter_all')}</span>
              </button>
            ) : (
              <button
                onClick={onOpenQuickAdd}
                className="mt-4 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md inline-flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{t('leads_add_first')}</span>
              </button>
            )}
          </div>
        ) : (
          filteredLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onOpenDetail={onOpenLeadDetail}
              onOpenWhatsApp={onOpenWhatsApp}
              onQuickFollowUp={onOpenSchedule}
              isSelectionMode={isSelectionMode}
              isSelected={selectedLeadIds.has(lead.id)}
              onToggleSelect={handleToggleSelectLead}
            />
          ))
        )}
      </div>

      {/* Bulk Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete {selectedLeadIds.size} selected {selectedLeadIds.size === 1 ? 'lead' : 'leads'}?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              These {selectedLeadIds.size} selected {selectedLeadIds.size === 1 ? 'lead' : 'leads'} will be permanently deleted from Firestore.
            </p>

            {deleteError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                id="btn-cancel-delete"
                disabled={isDeletingBulk}
                onClick={() => {
                  if (!isDeletingBulk) {
                    setShowDeleteModal(false);
                    setDeleteError(null);
                  }
                }}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                id="btn-confirm-delete"
                disabled={isDeletingBulk}
                onClick={handleConfirmDeleteBulk}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-60"
              >
                {isDeletingBulk ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
