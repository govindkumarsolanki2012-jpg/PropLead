import React, { useState } from 'react';
import { X, Search, Check, UserPlus, Phone, CheckSquare, Square, Smartphone, FileText, Plus } from 'lucide-react';
import { Lead, RequirementType } from '../../types';

interface ContactItem {
  id: string;
  name: string;
  phone: string;
  suggestedLocality?: string;
}

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
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [search, setSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [defaultRequirement, setDefaultRequirement] = useState<RequirementType>('buy');
  const [showPasteInput, setShowPasteInput] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');

  if (!isOpen) return null;

  const handlePickDeviceContacts = async () => {
    try {
      if ('contacts' in navigator && 'ContactsManager' in window) {
        const props = ['name', 'tel'];
        const picked = await (navigator as any).contacts.select(props, { multiple: true });
        if (picked && picked.length > 0) {
          const newItems: ContactItem[] = picked
            .map((p: any, idx: number) => {
              const name = Array.isArray(p.name) ? p.name[0] : p.name || 'Unknown Contact';
              const phone = Array.isArray(p.tel) ? p.tel[0] : p.tel || '';
              return {
                id: `dev_${Date.now()}_${idx}`,
                name: String(name).trim(),
                phone: String(phone).replace(/\s+/g, ''),
              };
            })
            .filter((c: ContactItem) => c.name || c.phone);

          if (newItems.length > 0) {
            setContacts((prev) => [...prev, ...newItems]);
            setSelectedIds((prev) => new Set([...prev, ...newItems.map((c) => c.id)]));
          }
        }
      } else {
        // Fallback to paste view if browser does not support Contact Picker API
        setShowPasteInput(true);
      }
    } catch (err) {
      console.warn('Contact picker error or cancelled:', err);
    }
  };

  const handleParsePasteText = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.split('\n');
    const parsed: ContactItem[] = [];

    lines.forEach((line, idx) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;

      // Match "Name, Phone" or "Name - Phone" or tab-separated
      const parts = cleanLine.split(/[,;\t\-–]+/).map((s) => s.trim());
      if (parts.length >= 2) {
        const name = parts[0];
        const phone = parts[1];
        const locality = parts[2] || undefined;
        if (name || phone) {
          parsed.push({
            id: `paste_${Date.now()}_${idx}`,
            name: name || 'Client',
            phone: phone || '',
            suggestedLocality: locality,
          });
        }
      } else if (parts.length === 1 && parts[0]) {
        // Just a phone number or name
        const item = parts[0];
        const isNumeric = /^[0-9+\s()-]{7,}$/.test(item);
        parsed.push({
          id: `paste_${Date.now()}_${idx}`,
          name: isNumeric ? 'New Contact' : item,
          phone: isNumeric ? item.replace(/\s+/g, '') : '',
        });
      }
    });

    if (parsed.length > 0) {
      setContacts((prev) => [...prev, ...parsed]);
      setSelectedIds((prev) => new Set([...prev, ...parsed.map((c) => c.id)]));
      setPasteText('');
      setShowPasteInput(false);
    }
  };

  const filteredContacts = contacts.filter(
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
    const newLeads: Lead[] = contacts
      .filter((c) => selectedIds.has(c.id))
      .map((c) => ({
        id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: c.name || 'Client',
        phone: c.phone || '',
        whatsapp: c.phone || '',
        requirement: defaultRequirement,
        propertyType: 'flat',
        bhk: '2 BHK',
        budgetMin: undefined,
        budgetMax: undefined,
        preferredLocations: c.suggestedLocality ? [c.suggestedLocality] : [],
        status: 'new',
        priority: 'warm',
        source: 'Phone Contacts',
        notes: '',
        nextFollowUpDate: today,
        nextFollowUpTime: '11:30',
        nextFollowUpNote: 'First follow-up call from imported phone contact',
        createdAt: today,
        updatedAt: today,
        voiceNotes: [],
        attachments: [],
        activities: [
          {
            id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            leadId: '',
            type: 'created',
            title: 'Lead Imported',
            description: `Imported from phone contacts as ${defaultRequirement.toUpperCase()}`,
            timestamp: new Date().toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            }),
          },
        ],
      }));

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
              <span className="text-[11px] text-slate-400">Convert phone contacts into active leads</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source Action Bar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={handlePickDeviceContacts}
            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Select from Device</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPasteInput(!showPasteInput)}
            className="py-2 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{showPasteInput ? 'Hide Paste' : 'Paste Numbers'}</span>
          </button>
        </div>

        {/* Paste Box Drawer */}
        {showPasteInput && (
          <div className="p-3 bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in duration-150">
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Paste or type contacts (one per line):
            </div>
            <textarea
              rows={3}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Rahul Sharma, 9820011223, Andheri\nSuresh Patel, 9819987654`}
              className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteInput(false)}
                className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleParsePasteText}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
              >
                Add to List
              </button>
            </div>
          </div>
        )}

        {/* Controls: Search and Requirement */}
        {contacts.length > 0 && (
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2 bg-white dark:bg-slate-900">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
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
        )}

        {/* Contact List or Empty State */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {contacts.length === 0 ? (
            <div className="text-center py-10 px-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  No contacts loaded yet
                </h3>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-0.5">
                  Select contacts directly from your device address book or paste a list of client numbers to create leads.
                </p>
              </div>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No contacts match your search query.
            </div>
          ) : (
            filteredContacts.map((contact) => {
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
            })
          )}
        </div>

        {/* Bottom CTA */}
        {contacts.length > 0 && (
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
        )}
      </div>
    </div>
  );
};
