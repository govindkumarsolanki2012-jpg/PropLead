import React, { useState } from 'react';
import { X, Save, User, Phone, MapPin, Building, Sparkles } from 'lucide-react';
import {
  Lead,
  RequirementType,
  PropertyType,
  LeadSource,
  LeadPriority,
  LeadStatus,
} from '../../types';
import { BudgetCustomizer } from './BudgetCustomizer';
import { formatIndianCurrency } from '../../utils/formatters';
import { getLeadTargetLocation } from '../../utils/propertyMatching';

interface EditLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
  onSave?: (updated: Lead) => void;
  onSaveLead?: (updated: Lead) => void;
}

export const EditLeadModal: React.FC<EditLeadModalProps> = ({
  isOpen,
  onClose,
  lead,
  onSave,
  onSaveLead,
}) => {
  const initialLoc = getLeadTargetLocation(lead);

  const [name, setName] = useState<string>(lead.name);
  const [phone, setPhone] = useState<string>(lead.phone);
  const [email, setEmail] = useState<string>(lead.email || '');
  const [requirement, setRequirement] = useState<RequirementType>(lead.requirement);
  const [propertyType, setPropertyType] = useState<PropertyType>(lead.propertyType);
  const [bhk, setBhk] = useState<string>(lead.bhk || '2 BHK');
  const [budgetMin, setBudgetMin] = useState<number | undefined>(lead.budgetMin);
  const [budgetMax, setBudgetMax] = useState<number>(lead.budgetMax || 6500000);
  
  const [preferredCity, setPreferredCity] = useState<string>(
    lead.preferredCity || initialLoc.preferredCity || ''
  );
  const [preferredLocality, setPreferredLocality] = useState<string>(
    lead.preferredLocality || initialLoc.preferredLocality || lead.preferredLocations.join(', ')
  );
  const [currentCity, setCurrentCity] = useState<string>(
    lead.currentCity || initialLoc.currentCity || ''
  );

  const [source, setSource] = useState<LeadSource>(lead.source);
  const [priority, setPriority] = useState<LeadPriority>(lead.priority);
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState<string>(lead.notes || '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert('Name and Phone are required.');
      return;
    }

    const locList = [
      ...(preferredLocality.trim() ? [preferredLocality.trim()] : []),
      ...(preferredCity.trim() ? [preferredCity.trim()] : []),
    ];

    const updated: Lead = {
      ...lead,
      name: name.trim(),
      phone: phone.trim(),
      whatsapp: phone.trim(),
      email: email.trim() || undefined,
      requirement,
      propertyType,
      bhk,
      budgetMin,
      budgetMax,
      preferredCity: preferredCity.trim() || undefined,
      preferredLocality: preferredLocality.trim() || undefined,
      currentCity: currentCity.trim() || undefined,
      preferredLocations: locList.length > 0 ? locList : lead.preferredLocations,
      source,
      priority,
      status,
      notes: notes.trim(),
      updatedAt: new Date().toISOString().split('T')[0],
    };

    const saveFn = onSave || onSaveLead;
    if (saveFn) {
      saveFn(updated);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Edit Lead Details
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@gmail.com"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Requirement & Property Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Requirement
              </label>
              <select
                value={requirement}
                onChange={(e) => setRequirement(e.target.value as RequirementType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="buy">Buyer</option>
                <option value="rent">Tenant / Rent</option>
                <option value="sell">Seller / Owner</option>
                <option value="lease">Commercial Lease</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Property Type
              </label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="flat">Apartment / Flat</option>
                <option value="house">Independent House</option>
                <option value="villa">Gated Villa</option>
                <option value="plot">Plot / Land</option>
                <option value="commercial">Commercial Shop/Office</option>
                <option value="penthouse">Penthouse</option>
                <option value="farmhouse">Farmhouse</option>
              </select>
            </div>
          </div>

          {/* BHK Config */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              BHK / Config
            </label>
            <input
              type="text"
              value={bhk}
              onChange={(e) => setBhk(e.target.value)}
              placeholder="2 BHK, 3 BHK, 4 BHK..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
            />
          </div>

          {/* Customizable Budget */}
          <BudgetCustomizer
            requirement={requirement}
            budgetMin={budgetMin}
            budgetMax={budgetMax}
            onChange={(min, max) => {
              setBudgetMin(min);
              setBudgetMax(max);
            }}
          />

          {/* Target Location Specifications */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Target Property Location</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold rounded">
                Hard Filter
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Preferred Property City *
                </label>
                <input
                  type="text"
                  value={preferredCity}
                  onChange={(e) => setPreferredCity(e.target.value)}
                  placeholder="e.g. Gurgaon, Bangalore, Mumbai"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Preferred Locality / Sector
                </label>
                <input
                  type="text"
                  value={preferredLocality}
                  onChange={(e) => setPreferredLocality(e.target.value)}
                  placeholder="e.g. Sector 57, Golf Course Road"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Customer Current Residence City (Optional)
              </label>
              <input
                type="text"
                value={currentCity}
                onChange={(e) => setCurrentCity(e.target.value)}
                placeholder="e.g. Mumbai (if customer currently resides elsewhere)"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as LeadPriority)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
              >
                <option value="hot">🔥 Hot Lead</option>
                <option value="warm">☀️ Warm</option>
                <option value="cold">❄️ Cold</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pipeline Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="site_visit_scheduled">Site Visit Scheduled</option>
                <option value="site_visit_completed">Site Visit Completed</option>
                <option value="negotiation">Negotiation</option>
                <option value="advance_paid">Advance Paid</option>
                <option value="closed">Closed / Deal Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Notes & Requirement Details
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
