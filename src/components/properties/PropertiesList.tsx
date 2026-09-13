import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Filter,
  Building,
  MapPin,
  Share2,
  Lock,
  ChevronRight,
  Eye,
  Layers,
  Sparkles,
  SlidersHorizontal,
  Home,
  CheckCircle2,
  X,
  Compass,
  CheckSquare,
  Check,
  Minus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { Property, Lead, UserProfile, PropertyStatus, PropertyType, PropertyTransactionType } from '../../types';
import {
  formatIndianCurrency,
  PROPERTY_STATUS_CONFIG,
  PROPERTY_TYPE_LABELS,
  FURNISHING_LABELS,
  TRANSACTION_TYPE_LABELS,
} from '../../utils/formatters';
import { findMatchingLeads } from '../../utils/propertyMatching';
import { matchPropertyWithCityAliases } from '../../utils/cityAliases';
import { useTranslation } from '../../context/LanguageContext';

interface PropertiesListProps {
  properties: Property[];
  leads: Lead[];
  profile: UserProfile;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onOpenAddProperty: () => void;
  onOpenPropertyDetail: (property: Property) => void;
  onOpenShareModal: (property: Property, preselectedLead?: Lead | null) => void;
  onDeleteBulkProperties?: (propertyIds: string[]) => Promise<void>;
}

export const PropertiesList: React.FC<PropertiesListProps> = ({
  properties,
  leads,
  profile,
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange,
  onOpenAddProperty,
  onOpenPropertyDetail,
  onOpenShareModal,
  onDeleteBulkProperties,
}) => {
  const { t } = useTranslation();
  const [internalSearchQuery, setInternalSearchQuery] = useState<string>('');

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = externalOnSearchChange || setInternalSearchQuery;
  const [selectedTransaction, setSelectedTransaction] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedBhk, setSelectedBhk] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high'>('newest');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Bulk selection state
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filter and Sort properties
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      // 1. Search Query (supports bidirectional Indian city alias matching)
      if (searchQuery.trim()) {
        if (!matchPropertyWithCityAliases(p, searchQuery)) {
          return false;
        }
      }

      // 2. Transaction Filter
      if (selectedTransaction !== 'all' && p.transactionType !== selectedTransaction) {
        return false;
      }

      // 3. Status Filter
      if (selectedStatus !== 'all' && p.status !== selectedStatus) {
        return false;
      }

      // 4. Property Type Filter
      if (selectedType !== 'all' && p.propertyType !== selectedType) {
        return false;
      }

      // 5. BHK Filter
      if (selectedBhk !== 'all') {
        if (selectedBhk === '4+ BHK') {
          if (!p.bhk || (!p.bhk.includes('4') && !p.bhk.includes('5'))) return false;
        } else if (p.bhk !== selectedBhk) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price_low') return a.price - b.price;
      if (sortBy === 'price_high') return b.price - a.price;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [properties, searchQuery, selectedTransaction, selectedStatus, selectedType, selectedBhk, sortBy]);

  // Key stats
  const availableCount = properties.filter((p) => p.status === 'available').length;
  const negotiationCount = properties.filter((p) => p.status === 'negotiation').length;

  // Check if all filtered properties are selected
  const isAllSelected = useMemo(() => {
    if (filteredProperties.length === 0) return false;
    return filteredProperties.every((p) => selectedPropertyIds.has(p.id));
  }, [filteredProperties, selectedPropertyIds]);

  // Toggle select all visible
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const next = new Set(selectedPropertyIds);
      filteredProperties.forEach((p) => next.delete(p.id));
      setSelectedPropertyIds(next);
    } else {
      const next = new Set(selectedPropertyIds);
      filteredProperties.forEach((p) => next.add(p.id));
      setSelectedPropertyIds(next);
    }
  };

  // Toggle single property
  const handleToggleSelectProperty = (propertyId: string) => {
    setSelectedPropertyIds((prev) => {
      const next = new Set(prev);
      if (next.has(propertyId)) {
        next.delete(propertyId);
      } else {
        next.add(propertyId);
      }
      return next;
    });
  };

  // Confirm delete bulk
  const handleConfirmDeleteBulk = async () => {
    if (isDeletingBulk || selectedPropertyIds.size === 0) return;
    setIsDeletingBulk(true);
    setDeleteError(null);
    try {
      const ids = Array.from(selectedPropertyIds);
      if (onDeleteBulkProperties) {
        await onDeleteBulkProperties(ids);
      }
      setSelectedPropertyIds(new Set());
      setIsSelectionMode(false);
      setShowDeleteModal(false);
    } catch (err: any) {
      console.error('Error deleting selected properties:', err);
      setDeleteError(err?.message || 'Unable to delete selected properties. Please try again.');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  return (
    <div className="flex-1 pb-8 bg-slate-100/70 dark:bg-slate-950">
      {/* Top Banner / Title Header */}
      <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('prop_title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {properties.length} {t('prop_total')} • <span className="text-emerald-600 font-bold">{availableCount} {t('prop_available')}</span> •{' '}
              <span className="text-blue-600 font-bold">{negotiationCount} {t('prop_in_negotiation')}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Select Button */}
            <button
              id="btn-select-mode-props"
              type="button"
              onClick={() => {
                if (isSelectionMode) {
                  setIsSelectionMode(false);
                  setSelectedPropertyIds(new Set());
                } else {
                  setIsSelectionMode(true);
                  setSelectedPropertyIds(new Set());
                }
              }}
              className={`py-2 px-3 rounded-2xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                isSelectionMode
                  ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
              title={isSelectionMode ? 'Cancel Selection' : 'Select Properties'}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isSelectionMode ? 'Cancel' : 'Select'}</span>
            </button>

            <button
              onClick={onOpenAddProperty}
              className="py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl text-xs flex items-center gap-1.5 shadow-md transition-all flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{t('prop_add_btn')}</span>
            </button>
          </div>
        </div>

        {/* Bulk Selection Action Bar */}
        {isSelectionMode && (
          <div className="mb-3 flex items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 transition-all">
            <div className="flex items-center gap-2.5">
              {/* Select All */}
              <button
                type="button"
                id="btn-select-all-props"
                onClick={handleToggleSelectAll}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-600 transition-colors"
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                    isAllSelected
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : selectedPropertyIds.size > 0
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-500 text-emerald-600'
                      : 'border-slate-300 dark:border-slate-500 bg-transparent'
                  }`}
                >
                  {isAllSelected ? (
                    <Check className="w-3 h-3 stroke-[3]" />
                  ) : selectedPropertyIds.size > 0 ? (
                    <Minus className="w-3 h-3 stroke-[3]" />
                  ) : null}
                </div>
                <span>Select All</span>
              </button>

              {/* Number of selected properties */}
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {selectedPropertyIds.size} selected
              </span>
            </div>

            {/* Delete Selected Button */}
            <button
              type="button"
              id="btn-delete-selected-props"
              disabled={selectedPropertyIds.size === 0 || isDeletingBulk}
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg text-xs shadow-xs transition-all active:scale-95 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        )}

        {/* Search Input Bar */}
        <div className="relative mb-2.5">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('prop_search_placeholder')}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Horizontal Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 text-xs font-semibold">
          {/* Transaction Type Filters */}
          <button
            onClick={() => setSelectedTransaction('all')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              selectedTransaction === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {t('prop_all_types')} ({properties.length})
          </button>
          <button
            onClick={() => setSelectedTransaction('sale')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              selectedTransaction === 'sale'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {t('prop_for_sale')}
          </button>
          <button
            onClick={() => setSelectedTransaction('rent')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              selectedTransaction === 'rent'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {t('prop_for_rent')}
          </button>

          {/* Status Filter quick button */}
          <button
            onClick={() => setSelectedStatus(selectedStatus === 'available' ? 'all' : 'available')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              selectedStatus === 'available'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            ✓ {t('prop_available_only')}
          </button>

          {/* Toggle More Filters */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1 whitespace-nowrap transition-all ${
              showAdvancedFilters || selectedType !== 'all' || selectedBhk !== 'all'
                ? 'border-emerald-600 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{t('prop_more_filters')}</span>
          </button>
        </div>

        {/* Collapsible Advanced Filters Tray */}
        {showAdvancedFilters && (
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs animate-in fade-in duration-150">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {t('prop_category')}
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="all">{t('prop_all_categories')}</option>
                <option value="flat">Apartments / Flats</option>
                <option value="house">Independent Houses</option>
                <option value="villa">Villas</option>
                <option value="plot">Plots / Land</option>
                <option value="commercial">Commercial / Office</option>
                <option value="penthouse">Penthouse</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {t('prop_bhk')}
              </label>
              <select
                value={selectedBhk}
                onChange={(e) => setSelectedBhk(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="all">{t('prop_all_bhks')}</option>
                <option value="1 BHK">1 BHK</option>
                <option value="2 BHK">2 BHK</option>
                <option value="3 BHK">3 BHK</option>
                <option value="4+ BHK">4+ BHK</option>
                <option value="Plot/Land">Plot/Land</option>
                <option value="Commercial">Commercial</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {t('leads_sort_by')}
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="newest">{t('prop_sort_newest')}</option>
                <option value="price_low">{t('prop_sort_price_low')}</option>
                <option value="price_high">{t('prop_sort_price_high')}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Properties List Feed */}
      <div className="p-4 space-y-3.5">
        {filteredProperties.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <Building className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {t('prop_no_found')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1">
                {searchQuery || selectedTransaction !== 'all' || selectedStatus !== 'all'
                  ? t('prop_no_found_desc')
                  : t('prop_no_found_desc')}
              </p>
            </div>
            <button
              onClick={onOpenAddProperty}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            >
              {t('prop_add_first')}
            </button>
          </div>
        ) : (
          filteredProperties.map((property) => {
            const statusCfg = PROPERTY_STATUS_CONFIG[property.status] || PROPERTY_STATUS_CONFIG.available;
            const isRent = property.transactionType === 'rent' || property.transactionType === 'lease';
            const matching = findMatchingLeads(property, leads);
            const isSelected = selectedPropertyIds.has(property.id);

            return (
              <div
                key={property.id}
                onClick={() => {
                  if (isSelectionMode) {
                    handleToggleSelectProperty(property.id);
                  }
                }}
                className={`bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden shadow-xs transition-all group relative ${
                  isSelectionMode
                    ? isSelected
                      ? 'border-emerald-500/80 ring-2 ring-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20 cursor-pointer'
                      : 'border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer'
                    : 'border-slate-200/90 dark:border-slate-800 hover:shadow-md'
                }`}
              >
                <div className="flex flex-col sm:flex-row">
                  {/* Photo Thumbnail */}
                  <div
                    onClick={(e) => {
                      if (isSelectionMode) {
                        e.stopPropagation();
                        handleToggleSelectProperty(property.id);
                      } else {
                        onOpenPropertyDetail(property);
                      }
                    }}
                    className="relative sm:w-48 aspect-16/10 sm:aspect-auto bg-slate-900 cursor-pointer overflow-hidden flex-shrink-0"
                  >
                    {/* Checkbox in selection mode */}
                    {isSelectionMode && (
                      <div
                        className="absolute top-2.5 right-2.5 z-30 flex items-center justify-center cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelectProperty(property.id);
                        }}
                      >
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center border shadow-md transition-all ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-600 text-white ring-2 ring-white/90'
                              : 'bg-white/95 dark:bg-slate-800/95 border-slate-300 dark:border-slate-600 text-transparent hover:border-emerald-500'
                          }`}
                        >
                          {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                        </div>
                      </div>
                    )}

                    {property.photos && property.photos.length > 0 ? (
                      <img
                        src={property.photos[0]}
                        alt={property.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <Building className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 sm:hidden" />

                    {/* Status Pill */}
                    <span
                      className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg text-[10px] font-extrabold shadow-sm border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                    >
                      {statusCfg.label}
                    </span>

                    {/* Photos count */}
                    {property.photos && property.photos.length > 1 && (
                      <span className="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold rounded">
                        📸 {property.photos.length}
                      </span>
                    )}
                  </div>

                  {/* Property Details Container */}
                  <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-2.5">
                    {/* Top Row: Price and Locality */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            {PROPERTY_TYPE_LABELS[property.propertyType]}
                          </span>
                          <h3
                            onClick={(e) => {
                              if (isSelectionMode) {
                                e.stopPropagation();
                                handleToggleSelectProperty(property.id);
                              } else {
                                onOpenPropertyDetail(property);
                              }
                            }}
                            className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                          >
                            {property.title}
                          </h3>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="text-base font-black text-emerald-600 dark:text-emerald-400 block">
                            {formatIndianCurrency(property.price)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {isRent ? t('prop_per_month') : property.priceNegotiable ? t('prop_negotiable') : t('prop_fixed')}
                          </span>
                        </div>
                      </div>

                      {/* Locality and specs chips */}
                      <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 mt-1 font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="truncate">
                          📍 {property.locality}, {property.city}
                        </span>
                      </div>
                    </div>

                    {/* Specs Row */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {property.bhk && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-md">
                          {property.bhk}
                        </span>
                      )}
                      {(property.superBuiltUpAreaSqFt || property.carpetAreaSqFt) && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-md">
                          {property.superBuiltUpAreaSqFt || property.carpetAreaSqFt} sq.ft
                        </span>
                      )}
                      {property.facing && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-md">
                          {property.facing}
                        </span>
                      )}
                      {property.furnishing && FURNISHING_LABELS[property.furnishing] && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-md">
                          {FURNISHING_LABELS[property.furnishing]}
                        </span>
                      )}
                    </div>

                    {/* Matching Leads Pill & Action Bar */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      {matching.length > 0 ? (
                        <button
                          onClick={(e) => {
                            if (isSelectionMode) {
                              e.stopPropagation();
                              handleToggleSelectProperty(property.id);
                            } else {
                              onOpenPropertyDetail(property);
                            }
                          }}
                          className="flex items-center gap-1 text-[11px] font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1 rounded-lg hover:bg-rose-100 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                          <span>{t('prop_matching_leads', { count: matching.length })}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">0 CRM matches</span>
                      )}

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenShareModal(property);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-all"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>{t('prop_share')}</span>
                        </button>

                        <button
                          onClick={(e) => {
                            if (isSelectionMode) {
                              e.stopPropagation();
                              handleToggleSelectProperty(property.id);
                            } else {
                              onOpenPropertyDetail(property);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
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
                  Delete {selectedPropertyIds.size} selected {selectedPropertyIds.size === 1 ? 'property' : 'properties'}?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              These {selectedPropertyIds.size} selected {selectedPropertyIds.size === 1 ? 'property' : 'properties'} will be permanently deleted from Firestore.
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
                id="btn-cancel-delete-props"
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
                id="btn-confirm-delete-props"
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
