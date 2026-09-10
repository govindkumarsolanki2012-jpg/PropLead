import React, { useState } from 'react';
import {
  X,
  Search,
  Check,
  UserPlus,
  Phone,
  CheckSquare,
  Square,
  Smartphone,
  FileText,
  ShieldAlert,
  RotateCcw,
  Loader2,
  AlertCircle,
  Users,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { Lead, RequirementType } from '../../types';
import { normalizePhoneForMatch } from '../../utils/formatters';

export interface ContactItem {
  id: string;
  name: string;
  phone: string;
  suggestedLocality?: string;
  isExistingLead?: boolean;
  rawContactId?: string;
}

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportLeads: (newLeads: Lead[]) => void;
  existingLeads?: Lead[];
}

export const ImportContactsModal: React.FC<ImportContactsModalProps> = ({
  isOpen,
  onClose,
  onImportLeads,
  existingLeads = [],
}) => {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [search, setSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [defaultRequirement, setDefaultRequirement] = useState<RequirementType>('buy');
  const [showPasteInput, setShowPasteInput] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');

  // Native handling state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [permissionErrorMessage, setPermissionErrorMessage] = useState<string | null>(null);
  const [deviceHasNoContacts, setDeviceHasNoContacts] = useState<boolean>(false);
  const [previewLoaded, setPreviewLoaded] = useState<boolean>(false);

  if (!isOpen) return null;

  // Set of existing phone numbers normalized to 10 digits
  const existingPhoneSet = new Set(
    existingLeads.map((l) => normalizePhoneForMatch(l.phone)).filter(Boolean)
  );
  const existingNameSet = new Set(
    existingLeads.map((l) => l.name.trim().toLowerCase()).filter(Boolean)
  );

  const checkIsDuplicate = (phone: string, name: string): boolean => {
    const normPhone = normalizePhoneForMatch(phone);
    if (normPhone && existingPhoneSet.has(normPhone)) {
      return true;
    }
    if (!normPhone && name && existingNameSet.has(name.trim().toLowerCase())) {
      return true;
    }
    return false;
  };

  const handlePickDeviceContacts = async () => {
    setIsLoading(true);
    setPermissionDenied(false);
    setPermissionErrorMessage(null);
    setDeviceHasNoContacts(false);
    setPreviewLoaded(false);

    try {
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        // Step 1: Check existing permissions or request them
        let permStatus = await Contacts.checkPermissions();

        if (permStatus.contacts !== 'granted') {
          permStatus = await Contacts.requestPermissions();
        }

        if (permStatus.contacts !== 'granted') {
          setPermissionDenied(true);
          setPermissionErrorMessage(
            'Contacts permission was denied. PropLead requires contacts access to read and import your phone address book.'
          );
          setIsLoading(false);
          return;
        }

        // Step 2: Permission granted -> Read contacts from Android device
        const result = await Contacts.getContacts({
          projection: {
            name: true,
            phones: true,
            postalAddresses: true,
          },
        });

        const rawContacts = result?.contacts || [];

        if (rawContacts.length === 0) {
          setDeviceHasNoContacts(true);
          setContacts([]);
          setSelectedIds(new Set());
          setIsLoading(false);
          return;
        }

        // Step 3: Parse and filter contacts
        const parsedContacts: ContactItem[] = [];
        const seenPhonesInDevice = new Set<string>();

        for (let i = 0; i < rawContacts.length; i++) {
          const rc = rawContacts[i];
          const displayName =
            rc.name?.display?.trim() ||
            [rc.name?.given, rc.name?.middle, rc.name?.family].filter(Boolean).join(' ').trim() ||
            '';

          const phoneList = (rc.phones || [])
            .map((p) => p.number?.trim())
            .filter((num): num is string => Boolean(num));

          const primaryPhone = phoneList[0] || '';
          const normPhone = normalizePhoneForMatch(primaryPhone);

          // Skip contact if neither name nor phone exists
          if (!displayName && !primaryPhone) continue;

          // Prevent listing identical phone numbers twice from address book
          if (normPhone && seenPhonesInDevice.has(normPhone)) continue;
          if (normPhone) seenPhonesInDevice.add(normPhone);

          const isDuplicate = checkIsDuplicate(primaryPhone, displayName);
          const locality =
            rc.postalAddresses?.[0]?.neighborhood ||
            rc.postalAddresses?.[0]?.city ||
            undefined;

          parsedContacts.push({
            id: rc.contactId || `dev_${Date.now()}_${i}`,
            name: displayName || 'Client',
            phone: primaryPhone,
            suggestedLocality: locality,
            isExistingLead: isDuplicate,
            rawContactId: rc.contactId,
          });
        }

        if (parsedContacts.length === 0) {
          setDeviceHasNoContacts(true);
          setContacts([]);
          setSelectedIds(new Set());
        } else {
          setContacts(parsedContacts);
          // Pre-select non-duplicate contacts so the user can import quickly
          const freshSelectableIds = new Set(
            parsedContacts.filter((c) => !c.isExistingLead).map((c) => c.id)
          );
          setSelectedIds(freshSelectableIds);
        }
      } else if (typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
        // Step 1b: Modern mobile web Contact Picker API fallback
        const props = ['name', 'tel'];
        const picked = await (navigator as any).contacts.select(props, { multiple: true });

        if (picked && picked.length > 0) {
          const newItems: ContactItem[] = picked
            .map((p: any, idx: number) => {
              const name = Array.isArray(p.name) ? p.name[0] : p.name || 'Unknown Contact';
              const phone = Array.isArray(p.tel) ? p.tel[0] : p.tel || '';
              const cleanP = String(phone).replace(/\s+/g, '');
              const cleanN = String(name).trim();
              const isDuplicate = checkIsDuplicate(cleanP, cleanN);

              return {
                id: `web_${Date.now()}_${idx}`,
                name: cleanN || 'Client',
                phone: cleanP,
                isExistingLead: isDuplicate,
              };
            })
            .filter((c: ContactItem) => c.name || c.phone);

          if (newItems.length > 0) {
            setContacts(newItems);
            setSelectedIds(new Set(newItems.filter((c) => !c.isExistingLead).map((c) => c.id)));
          } else {
            setDeviceHasNoContacts(true);
          }
        } else {
          setDeviceHasNoContacts(true);
        }
      } else {
        // Step 1c: Non-native web browser / AI Studio preview fallback
        // Offer sample address book contacts so user can test the selection, duplicate detection, and import workflow
        loadSampleDeviceContacts();
      }
    } catch (err: any) {
      console.warn('Contact picker error or permission failure:', err);
      const errStr = String(err?.message || err || '').toLowerCase();
      if (errStr.includes('permission') || errStr.includes('denied')) {
        setPermissionDenied(true);
        setPermissionErrorMessage(
          'Contacts permission was denied. Please allow contacts access to select from your phone.'
        );
      } else {
        setPermissionErrorMessage(
          err?.message || 'Could not load contacts from device. Please try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadSampleDeviceContacts = () => {
    const sampleContacts = [
      { name: 'Rahul Sharma', phone: '+91 98200 11223', locality: 'Andheri West' },
      { name: 'Amit Verma', phone: '+91 98199 87654', locality: 'Bandra' },
      { name: 'Priya Nair', phone: '+91 98333 44556', locality: 'Worli' },
      { name: 'Sneha Kulkarni', phone: '+91 97654 32109', locality: 'Thane West' },
      { name: 'Vikram Mehta', phone: '+91 99201 55667', locality: 'Juhu' },
      { name: 'Rajesh K. Patel', phone: '+91 98210 99887', locality: 'Powai' },
    ];

    const parsed: ContactItem[] = sampleContacts.map((s, idx) => {
      const isDuplicate = checkIsDuplicate(s.phone, s.name);
      return {
        id: `sample_${Date.now()}_${idx}`,
        name: s.name,
        phone: s.phone,
        suggestedLocality: s.locality,
        isExistingLead: isDuplicate,
      };
    });

    setContacts(parsed);
    setSelectedIds(new Set(parsed.filter((c) => !c.isExistingLead).map((c) => c.id)));
    setPreviewLoaded(true);
  };

  const handleParsePasteText = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.split('\n');
    const parsed: ContactItem[] = [];

    lines.forEach((line, idx) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;

      const parts = cleanLine.split(/[,;\t\-–]+/).map((s) => s.trim());
      if (parts.length >= 2) {
        const name = parts[0];
        const phone = parts[1];
        const locality = parts[2] || undefined;
        if (name || phone) {
          const isDuplicate = checkIsDuplicate(phone, name);
          parsed.push({
            id: `paste_${Date.now()}_${idx}`,
            name: name || 'Client',
            phone: phone || '',
            suggestedLocality: locality,
            isExistingLead: isDuplicate,
          });
        }
      } else if (parts.length === 1 && parts[0]) {
        const item = parts[0];
        const isNumeric = /^[0-9+\s()-]{7,}$/.test(item);
        const name = isNumeric ? 'Client' : item;
        const phone = isNumeric ? item.replace(/\s+/g, '') : '';
        const isDuplicate = checkIsDuplicate(phone, name);
        parsed.push({
          id: `paste_${Date.now()}_${idx}`,
          name,
          phone,
          isExistingLead: isDuplicate,
        });
      }
    });

    if (parsed.length > 0) {
      setContacts((prev) => [...prev, ...parsed]);
      // Select non-duplicates
      setSelectedIds((prev) => {
        const next = new Set(prev);
        parsed.forEach((c) => {
          if (!c.isExistingLead) next.add(c.id);
        });
        return next;
      });
      setPasteText('');
      setShowPasteInput(false);
      setDeviceHasNoContacts(false);
    }
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.suggestedLocality?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (contact: ContactItem) => {
    if (contact.isExistingLead) {
      return; // Do not allow selecting existing duplicates
    }
    const next = new Set(selectedIds);
    if (next.has(contact.id)) {
      next.delete(contact.id);
    } else {
      next.add(contact.id);
    }
    setSelectedIds(next);
  };

  const selectableFilteredContacts = filteredContacts.filter((c) => !c.isExistingLead);

  const handleSelectAll = () => {
    if (selectedIds.size === selectableFilteredContacts.length && selectableFilteredContacts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableFilteredContacts.map((c) => c.id)));
    }
  };

  const handleImport = () => {
    const today = new Date().toISOString().split('T')[0];

    // Filter only selected contacts that are not already leads (prevent duplicate creation)
    const validContactsToImport = contacts.filter(
      (c) => selectedIds.has(c.id) && !c.isExistingLead && !checkIsDuplicate(c.phone, c.name)
    );

    if (validContactsToImport.length === 0) {
      return;
    }

    // Selected contacts must be imported as inactive leads ('status: new'), as intended by the existing feature
    const newLeads: Lead[] = validContactsToImport.map((c) => ({
      id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: c.name || 'Client',
      phone: c.phone || '',
      whatsapp: c.phone || '',
      requirement: defaultRequirement,
      propertyType: 'flat',
      bhk: undefined,
      budgetMin: undefined,
      budgetMax: undefined,
      preferredLocations: c.suggestedLocality ? [c.suggestedLocality] : [],
      status: 'new', // Inactive lead initial pipeline stage
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

  const duplicateCount = contacts.filter((c) => c.isExistingLead).length;
  const newContactsCount = contacts.filter((c) => !c.isExistingLead).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col overflow-hidden animate-slide-up safe-bottom">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Import Phone Contacts
              </h2>
              <span className="text-[11px] text-slate-400">Import address book contacts as inactive leads</span>
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
            disabled={isLoading}
            className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Reading Contacts...</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5" />
                <span>Select from Device</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowPasteInput(!showPasteInput)}
            className="py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{showPasteInput ? 'Hide Paste' : 'Paste Numbers'}</span>
          </button>
        </div>

        {/* Permission Denied Banner with Grant Permission Retry CTA */}
        {permissionDenied && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border-b border-rose-200 dark:border-rose-900/60 animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs space-y-1">
                <div className="font-bold text-rose-900 dark:text-rose-200">
                  Contacts Permission Required
                </div>
                <div className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed">
                  {permissionErrorMessage ||
                    'Contacts permission was denied. PropLead needs access to your Android contacts to import them.'}
                </div>
                <div className="pt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePickDeviceContacts}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Grant Permission Again</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Generic Error Banner */}
        {!permissionDenied && permissionErrorMessage && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900/60 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="flex-1 text-[11px]">{permissionErrorMessage}</span>
          </div>
        )}

        {/* Web Preview Informational Tag */}
        {previewLoaded && (
          <div className="px-3.5 py-2 bg-sky-50 dark:bg-sky-950/40 border-b border-sky-200 dark:border-sky-800/60 flex items-center justify-between text-[11px] text-sky-800 dark:text-sky-300">
            <span>ℹ️ Loaded preview contacts for testing</span>
            <span className="text-[10px] opacity-75">On Android: reads real phone contacts</span>
          </div>
        )}

        {/* Paste Box Drawer */}
        {showPasteInput && (
          <div className="p-3 bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in duration-150">
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Paste or type contacts (one per line: Name, Phone, Locality):
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
                className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleParsePasteText}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
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
                disabled={selectableFilteredContacts.length === 0}
                className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold hover:text-emerald-600 disabled:opacity-50 cursor-pointer"
              >
                {selectedIds.size === selectableFilteredContacts.length && selectableFilteredContacts.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>
                  Select All ({selectedIds.size}/{selectableFilteredContacts.length} new)
                </span>
              </button>

              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400 font-medium">Default:</span>
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

            {/* Duplicate Notice Banner */}
            {duplicateCount > 0 && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-md flex items-center justify-between">
                <span>
                  {duplicateCount} contact{duplicateCount === 1 ? '' : 's'} already exist in your leads and won't be duplicated.
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {newContactsCount} new
                </span>
              </div>
            )}
          </div>
        )}

        {/* Contact List or Empty State */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {isLoading ? (
            <div className="text-center py-12 px-4 space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Accessing Android Contacts...
              </div>
              <p className="text-[11px] text-slate-400">
                Reading available contacts from your device address book.
              </p>
            </div>
          ) : deviceHasNoContacts ? (
            <div className="text-center py-10 px-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  No Contacts Found on Device
                </h3>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-0.5">
                  Your device address book doesn't have any contacts with phone numbers. You can paste numbers manually.
                </p>
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasteInput(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Paste Numbers Manually
                </button>
                <button
                  type="button"
                  onClick={handlePickDeviceContacts}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Check Again
                </button>
              </div>
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-10 px-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  No contacts loaded yet
                </h3>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-0.5">
                  Tap "Select from Device" to load phone contacts from your address book, or paste numbers directly.
                </p>
              </div>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No contacts match "{search}".
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isSelected = selectedIds.has(contact.id);
              const isDuplicate = Boolean(contact.isExistingLead);

              return (
                <div
                  key={contact.id}
                  onClick={() => toggleSelect(contact)}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    isDuplicate
                      ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-75 cursor-not-allowed'
                      : isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 cursor-pointer'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                        isDuplicate
                          ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-400'
                          : isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isDuplicate ? (
                        <Check className="w-3.5 h-3.5 opacity-50" />
                      ) : (
                        isSelected && <Check className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{contact.name}</span>
                        {isDuplicate && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-sm bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                            Already in Leads
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {contact.phone || 'No phone number'} {contact.suggestedLocality && `• ${contact.suggestedLocality}`}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {isDuplicate ? 'Saved' : 'New'}
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
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                Import {selectedIds.size} Contact{selectedIds.size === 1 ? '' : 's'} as Inactive Leads
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
