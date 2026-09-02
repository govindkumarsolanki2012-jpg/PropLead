import React, { useState } from 'react';
import { X, Search, Check, UserPlus, Phone, Building, CheckSquare, Square } from 'lucide-react';
import { Lead, RequirementType } from '../../types';

interface ContactItem {
  id: string;
  name: string;
  phone: string;
  suggestedLocality?: string;
}

const SAMPLE_DEVICE_CONTACTS: ContactItem[] = [
  { id: 'c1', name: 'Vikram Malhotra', phone: '+919820012345', suggestedLocality: 'Andheri West' },
  { id: 'c2', name: 'Ananya Sharma', phone: '+919819987654', suggestedLocality: 'Bandra West' },
  { id: 'c3', name: 'Sanjay Agarwal (Builder)', phone: '+919833344556', suggestedLocality: 'Goregaon East' },
  { id: 'c4', name: 'Dr. Meenakshi Iyer', phone: '+919877766554', suggestedLocality: 'Powai' },
  { id: 'c5', name: 'Ritesh Deshmukh (Plot)', phone: '+919766655443', suggestedLocality: 'Panvel' },
  { id: 'c6', name: 'Kavita Singhania', phone: '+919922233445', suggestedLocality: 'Kandivali West' },
  { id: 'c7', name: 'Amitabh Joshi', phone: '+919811122334', suggestedLocality: 'Worli' },
];

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportLeads: (newLeads: Lead[]) => void;
}

export const ImportContactsModal: React.FC<ImportContactsModalProps> = ({
  isOpen,
  onClose,
  onImportLeads,
}) => {
  const [search, setSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(['c1', 'c2']));
  const [defaultRequirement, setDefaultRequirement] = useState<RequirementType>('buy');

  if (!isOpen) return null;

  const filteredContacts = SAMPLE_DEVICE_CONTACTS.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.suggestedLocality?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const handleImport = () => {
    const today = new Date().toISOString().split('T')[0];
    const newLeads: Lead[] = SAMPLE_DEVICE_CONTACTS.filter((c) => selectedIds.has(c.id)).map(
      (c) => ({
        id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: c.name,
        phone: c.phone,
        whatsapp: c.phone,
        requirement: defaultRequirement,
        propertyType: 'flat',
        bhk: '2 BHK',
        budgetMin: 4500000,
        budgetMax: 7500000,
        preferredLocations: c.suggestedLocality ? [c.suggestedLocality] : ['Local Area'],
        status: 'new',
        priority: 'warm',
        source: 'Walk-in',
        notes: '',
        nextFollowUpDate: today,
        nextFollowUpTime: '11:30',
        nextFollowUpNote: 'First inquiry call from imported contact',
        createdAt: today,
        updatedAt: today,
        voiceNotes: [],
        attachments: [],
        activities: [
          {
            id: `act_${Date.now()}`,
            leadId: '',
            type: 'created',
            title: 'Lead Imported from Phone Contacts',
            description: `Imported with ${defaultRequirement.toUpperCase()} requirement`,
            timestamp: new Date().toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            }),
          },
        ],
      })
    );

    onImportLeads(newLeads);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Import Phone Contacts
              </h2>
              <span className="text-[11px] text-slate-400">Convert address book to leads</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search and Requirement settings */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50 dark:bg-slate-800/50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone contacts..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-bold hover:text-emerald-600"
            >
              {selectedIds.size === filteredContacts.length ? (
                <CheckSquare className="w-4 h-4 text-emerald-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Select All ({selectedIds.size} selected)</span>
            </button>

            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400 font-medium">Requirement:</span>
              <select
                value={defaultRequirement}
                onChange={(e) => setDefaultRequirement(e.target.value as RequirementType)}
                className="text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 px-1.5"
              >
                <option value="buy">Buyer</option>
                <option value="rent">Tenant</option>
                <option value="sell">Seller</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contact List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {filteredContacts.map((contact) => {
            const isSelected = selectedIds.has(contact.id);
            return (
              <div
                key={contact.id}
                onClick={() => toggleSelect(contact.id)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center border ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {contact.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {contact.phone} {contact.suggestedLocality && `• ${contact.suggestedLocality}`}
                    </div>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  Contact
                </span>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={handleImport}
            disabled={selectedIds.size === 0}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Import {selectedIds.size} Contacts as Leads</span>
          </button>
        </div>
      </div>
    </div>
  );
};
