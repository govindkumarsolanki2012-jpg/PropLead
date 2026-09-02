import React, { useState } from 'react';
import {
  X,
  Share2,
  Edit,
  Trash2,
  Phone,
  MessageSquare,
  Lock,
  MapPin,
  Building,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Users,
  Compass,
  Layers,
  Sparkles,
  Calendar,
  Eye,
  FileText,
  Clock,
  ArrowRight,
  Send,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Property, Lead, UserProfile, PropertyStatus } from '../../types';
import {
  formatIndianCurrency,
  PROPERTY_STATUS_CONFIG,
  PROPERTY_TYPE_LABELS,
  FURNISHING_LABELS,
  TRANSACTION_TYPE_LABELS,
  formatDisplayPhone,
  formatBudgetRange,
} from '../../utils/formatters';
import { findMatchingLeads } from '../../utils/propertyMatching';
import { openDialer, openWhatsApp } from '../../utils/whatsapp';

interface PropertyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property;
  leads: Lead[];
  profile?: UserProfile;
  onUpdateProperty: (updated: Property) => Promise<void | boolean> | void;
  onDeleteProperty: (propertyId: string) => Promise<void | boolean> | void;
  onOpenShareModal?: (property: Property, preselectedLead?: Lead | null) => void;
  onShareToLead?: (property: Property, preselectedLead?: Lead | null) => void;
  onOpenEditModal?: (property: Property) => void;
  onOpenEdit?: (property: Property) => void;
  onOpenScheduleVisit?: (lead: Lead, propertyNote?: string) => void;
}

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({
  isOpen,
  onClose,
  property,
  leads,
  profile,
  onUpdateProperty,
  onDeleteProperty,
  onOpenShareModal,
  onShareToLead,
  onOpenEditModal,
  onOpenEdit,
  onOpenScheduleVisit,
}) => {
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'matching_leads' | 'private_owner'>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleShare = (prop: Property, preselectedLead?: Lead | null) => {
    if (typeof onOpenShareModal === 'function') {
      onOpenShareModal(prop, preselectedLead);
    } else if (typeof onShareToLead === 'function') {
      onShareToLead(prop, preselectedLead);
    }
  };

  const handleEdit = (prop: Property) => {
    if (typeof onOpenEditModal === 'function') {
      onOpenEditModal(prop);
    } else if (typeof onOpenEdit === 'function') {
      onOpenEdit(prop);
    }
  };

  if (!isOpen) return null;

  const statusInfo = PROPERTY_STATUS_CONFIG[property.status] || PROPERTY_STATUS_CONFIG.available;
  const isRent = property.transactionType === 'rent' || property.transactionType === 'lease';
  const matchingLeads = findMatchingLeads(property, leads);

  const handleStatusChange = (newStatus: PropertyStatus) => {
    onUpdateProperty({
      ...property,
      status: newStatus,
      updatedAt: new Date().toISOString().split('T')[0],
    });
  };

  const handleCallOwner = () => {
    if (property.ownerPhone) {
      openDialer(property.ownerPhone);
    } else {
      alert('No owner phone registered');
    }
  };

  const handleWhatsAppOwner = () => {
    const phone = property.ownerWhatsApp || property.ownerPhone;
    if (phone) {
      const msg = `Hello ${property.ownerName || 'Sir/Madam'}, regarding your property "${property.title}" in ${property.locality} - I have an update on buyer inquiries.`;
      openWhatsApp(phone, msg);
    } else {
      alert('No owner WhatsApp number registered');
    }
  };

  const nextPhoto = () => {
    if (!property.photos || property.photos.length === 0) return;
    setActivePhotoIdx((prev) => (prev + 1) % property.photos.length);
  };

  const prevPhoto = () => {
    if (!property.photos || property.photos.length === 0) return;
    setActivePhotoIdx((prev) => (prev - 1 + property.photos.length) % property.photos.length);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom duration-200">
        {/* Top Header Bar */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
            >
              {statusInfo.label}
            </span>
            <span className="text-xs font-bold text-slate-500 capitalize">
              {property.transactionType === 'sale' ? 'For Sale' : 'For Rent/Lease'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleShare(property)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
              title="Share with Customer on WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
            <button
              onClick={() => handleEdit(property)}
              className="w-8 h-8 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
              title="Edit Property"
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
              title="Delete Property"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Delete Confirmation Overlay Dialog */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Delete this property?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[200px]">
                    {property.title}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete this property? This action cannot be undone and will remove it from all matching leads and inventory.
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
                      await onDeleteProperty(property.id);
                      setShowDeleteConfirm(false);
                      onClose();
                    } catch (err: any) {
                      console.error('Error deleting property:', err);
                      setDeleteError(err?.message || 'Unable to delete property. Please try again.');
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
                    <span>Delete</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Modal Body */}
        <div className="overflow-y-auto flex-1 space-y-4 p-4 sm:p-5">
          {/* Hero Photo Carousel */}
          {property.photos && property.photos.length > 0 ? (
            <div className="relative rounded-2xl overflow-hidden aspect-16/9 bg-slate-900 shadow-md group">
              <img
                src={property.photos[activePhotoIdx] || property.photos[0]}
                alt={property.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

              {/* Photos count badge */}
              <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-white text-[11px] font-bold">
                {activePhotoIdx + 1} / {property.photos.length}
              </div>

              {/* Prev / Next controls */}
              {property.photos.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Price Overlay */}
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wide">
                    {PROPERTY_TYPE_LABELS[property.propertyType]}
                  </span>
                  <h3 className="text-xl font-extrabold text-white leading-tight drop-shadow-sm">
                    {formatIndianCurrency(property.price)}
                    {isRent && <span className="text-xs font-normal"> / month</span>}
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-white/90 text-xs font-medium drop-shadow-sm">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {property.locality}, {property.city}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-8 bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400">
              <Building className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-xs font-bold">No Photos Uploaded</p>
            </div>
          )}

          {/* Title & Quick Status Selector */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white leading-snug">
                {property.title}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {property.bhk} • {FURNISHING_LABELS[property.furnishing]}
                </span>
                {property.facing && <span>• {property.facing} Facing</span>}
              </div>
            </div>

            <div className="flex-shrink-0">
              <select
                value={property.status}
                onChange={(e) => handleStatusChange(e.target.value as PropertyStatus)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border appearance-none cursor-pointer outline-hidden ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
              >
                <option value="available">Available</option>
                <option value="hold">On Hold</option>
                <option value="negotiation">In Negotiation</option>
                <option value="sold_rented">Sold / Rented</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Tabs: Overview, Matching Leads, Confidential Owner Info */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Specs & Amenities</span>
            </button>

            <button
              onClick={() => setActiveTab('matching_leads')}
              className={`pb-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 relative ${
                activeTab === 'matching_leads'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Matching Leads ({matchingLeads.length})</span>
              {matchingLeads.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('private_owner')}
              className={`pb-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'private_owner'
                  ? 'border-amber-600 text-amber-700 dark:text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Owner & Private Info</span>
            </button>
          </div>

          {/* TAB 1: OVERVIEW SPECS & AMENITIES */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Pricing</span>
                  <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                    {formatIndianCurrency(property.price)}
                  </span>
                  {property.priceNegotiable && (
                    <span className="text-[10px] text-slate-500 block">Negotiable</span>
                  )}
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Configuration</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                    {property.bhk || 'Plot / Space'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {PROPERTY_TYPE_LABELS[property.propertyType]}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Area</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                    {property.superBuiltUpAreaSqFt
                      ? `${property.superBuiltUpAreaSqFt} sq.ft`
                      : property.carpetAreaSqFt
                      ? `${property.carpetAreaSqFt} sq.ft`
                      : 'On Request'}
                  </span>
                  {property.carpetAreaSqFt && (
                    <span className="text-[10px] text-slate-500 block">
                      Carpet: {property.carpetAreaSqFt} sq.ft
                    </span>
                  )}
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Facing & Floor</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {property.facing || 'East'} Facing
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {property.floor || 'Standard Floor'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Furnishing</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {FURNISHING_LABELS[property.furnishing]}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Locality</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">
                    📍 {property.locality}
                  </span>
                  <span className="text-[10px] text-slate-500 block">{property.city}</span>
                </div>
              </div>

              {/* Amenities */}
              {property.amenities && property.amenities.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                    Amenities & Key Features ({property.amenities.length})
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {property.amenities.map((amenity, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>{amenity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MATCHING LEADS */}
          {activeTab === 'matching_leads' && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    Lead ↔ Property Matching Engine
                  </span>
                </div>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {matchingLeads.length} Potential Buyers/Tenants
                </span>
              </div>

              {matchingLeads.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold">No Matching Leads Found Right Now</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Leads looking for {property.bhk} in {property.locality} around {formatIndianCurrency(property.price)} will automatically show here.
                  </p>
                </div>
              ) : (
                matchingLeads.map(({ lead, score, matchReasons }) => (
                  <div
                    key={lead.id}
                    className="p-3.5 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-400 transition-all shadow-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                            {lead.name}
                          </h4>
                          <span className="px-2 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold rounded-full">
                            {score}% Match 🔥
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {formatDisplayPhone(lead.phone)} • Budget: {formatBudgetRange(lead.budgetMin, lead.budgetMax)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleShare(property, lead)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-all"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>Share on WhatsApp</span>
                        </button>
                      </div>
                    </div>

                    {/* Match Reasons Badges */}
                    <div className="flex flex-wrap gap-1">
                      {matchReasons.map((r, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-semibold rounded-md"
                        >
                          ✓ {r}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: PRIVATE OWNER & AGENT CONFIDENTIAL DETAILS */}
          {activeTab === 'private_owner' && (
            <div className="space-y-3">
              {/* Privacy Warning Header */}
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold text-amber-900 dark:text-amber-200">
                    Agent-Only Confidential Dossier
                  </h4>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                    This information is <strong>STRICTLY PRIVATE</strong>. It is never included when sharing property brochures with customers.
                  </p>
                </div>
              </div>

              {/* Owner Contact Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Property Owner / Seller
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {property.ownerName || 'Direct Owner'}
                    </h3>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {formatDisplayPhone(property.ownerPhone) || 'No phone registered'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCallOwner}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-all"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Owner</span>
                    </button>
                    <button
                      onClick={handleWhatsAppOwner}
                      className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>

                {/* Exact Door / Street Address */}
                {property.exactAddress && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block mb-0.5">
                      🔒 Exact Private Address (Flat/Door/Street)
                    </span>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      {property.exactAddress}
                    </p>
                  </div>
                )}

                {/* Internal Agent Notes */}
                {property.privateNotes && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block mb-0.5">
                      📝 Private Internal Notes
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 italic whitespace-pre-line bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 leading-relaxed">
                      {property.privateNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Fixed Action Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2">
          <button
            onClick={() => handleShare(property)}
            className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <Share2 className="w-4 h-4" />
            <span>Share with Customer on WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
