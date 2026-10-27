import React, { useMemo, useState } from 'react';
import { X, MapPin, User } from 'lucide-react';
import { Lead, Property } from '../../types';
import { hasExplicitLeadTargetLocation, isAssignedTargetLocation, isStrictTargetCityMatch } from '../../utils/propertyMatching';

interface Props {
  leads: Lead[];
  properties: Property[];
  onBack: () => void;
  onComplete: (leads: Lead[], matchLeadId?: string) => void;
}

export const ImportedContactSetupModal: React.FC<Props> = ({ leads, properties, onBack, onComplete }) => {
  const [drafts, setDrafts] = useState<Lead[]>(() => leads);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  const lead = drafts[index];
  const cities = useMemo(() => Array.from(new Set(properties.map((property) => property.city?.trim())
    .filter((city): city is string => Boolean(city) && isAssignedTargetLocation(city)))).sort(), [properties]);
  const localities = useMemo(() => Array.from(new Set(properties
    .filter((property) => isStrictTargetCityMatch(property.city, lead?.preferredCity))
    .map((property) => property.locality?.trim())
    .filter((locality): locality is string => Boolean(locality) && isAssignedTargetLocation(locality)))).sort(),
    [properties, lead?.preferredCity]);

  if (!lead) return null;
  const updateLocation = (field: 'preferredCity' | 'preferredLocality', value: string) => {
    setError('');
    setDrafts((prev) => prev.map((item, i) => i !== index ? item : field === 'preferredCity'
      ? { ...item, preferredCity: value, preferredLocality: '', preferredLocations: [] }
      : { ...item, preferredLocality: value, preferredLocations: value.trim() ? [value.trim()] : [] }));
  };
  const save = () => {
    if (!hasExplicitLeadTargetLocation(lead)) {
      setError('Enter a target City and Locality, or choose Skip & Save Later.');
      return;
    }
    const saved = drafts.map((item) => ({
      ...item,
      preferredCity: item.preferredCity?.trim() || '',
      preferredLocality: item.preferredLocality?.trim() || '',
      preferredLocations: item.preferredLocality?.trim() ? [item.preferredLocality.trim()] : [],
    }));
    onComplete(saved, lead.id);
  };
  const inputClass = 'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white';
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-3 overflow-hidden"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}>
      <div className="w-full max-w-md max-h-[90dvh] min-h-0 flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-xl">
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-600" />Quick Target Location Setup</h2>
          <button type="button" onClick={onBack} aria-label="Back to contact selection" className="p-2 text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <p className="text-xs text-slate-500">Optional: choose where this customer wants property. Contacts without both targets are saved with no matches.</p>
          {drafts.length > 1 && <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Contact ({index + 1} of {drafts.length})
            <select value={index} onChange={(e) => { setIndex(Number(e.target.value)); setError(''); }} className={inputClass}>
              {drafts.map((item, i) => <option key={item.id} value={i}>{item.name} · {item.phone}</option>)}
            </select>
          </label>}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><User className="w-4 h-4" />Imported contact</div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Name<input readOnly value={lead.name} className={inputClass} /></label>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Phone<input readOnly value={lead.phone} className={inputClass} /></label>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Target City
            <input list="import-target-cities" value={lead.preferredCity || ''} onChange={(e) => updateLocation('preferredCity', e.target.value)} placeholder="Enter target city" autoComplete="off" className={inputClass} />
          </label>
          <datalist id="import-target-cities">{cities.map((city) => <option key={city} value={city} />)}</datalist>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Target Locality / Area
            <input list="import-target-localities" value={lead.preferredLocality || ''} onChange={(e) => updateLocation('preferredLocality', e.target.value)} placeholder="Enter target locality / area" autoComplete="off" className={inputClass} />
          </label>
          <datalist id="import-target-localities">{localities.map((locality) => <option key={locality} value={locality} />)}</datalist>
          <p className="text-xs text-slate-500">Suggestions come from your property inventory. You can also type a new location. Changing the city clears its previous locality.</p>
          {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
        </div>
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onComplete(drafts)} className="flex-1 min-w-[140px] rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">Skip &amp; Save Later</button>
          <button type="button" onClick={save} className="flex-1 min-w-[140px] rounded-xl bg-emerald-600 px-3 py-3 text-xs font-bold text-white">Save &amp; Find Matches</button>
        </div>
      </div>
    </div>
  );
};
