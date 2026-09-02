import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Building,
  Upload,
  Plus,
  Trash2,
  Lock,
  IndianRupee,
  MapPin,
  Sparkles,
  Shield,
  FileText,
  Check,
  Image as ImageIcon,
  Compass,
  Layers,
  Phone,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  Property,
  PropertyType,
  PropertyTransactionType,
  PropertyStatus,
  FurnishingStatus,
  FacingDirection,
  UserProfile,
} from '../../types';
import { formatIndianCurrency } from '../../utils/formatters';

interface EditPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property;
  onSaveProperty?: (property: Property) => Promise<void | boolean> | void;
  onSave?: (property: Property) => Promise<void | boolean> | void;
}

const COMMON_AMENITIES = [
  'Lift with Power Backup',
  '24/7 Security & CCTV',
  'Covered Car Parking',
  'Gym & Fitness Centre',
  'Swimming Pool',
  'Clubhouse',
  'Gated Community',
  '100% Vastu Compliant',
  'PNG Piped Gas',
  'Children Play Area',
  'Rainwater Harvesting',
  'Park / Jogging Track',
  'Intercom Facility',
  'Solar Water Heating',
];

export const EditPropertyModal: React.FC<EditPropertyModalProps> = ({
  isOpen,
  onClose,
  property,
  onSaveProperty,
  onSave,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState<string>(property?.title || '');
  const [transactionType, setTransactionType] = useState<PropertyTransactionType>(property?.transactionType || 'sale');
  const [propertyType, setPropertyType] = useState<PropertyType>(property?.propertyType || 'flat');
  const [bhk, setBhk] = useState<string>(property?.bhk || '2 BHK');
  const [price, setPrice] = useState<number>(property?.price || 0);
  const [priceNegotiable, setPriceNegotiable] = useState<boolean>(property?.priceNegotiable ?? true);
  const [superBuiltUpAreaSqFt, setSuperBuiltUpAreaSqFt] = useState<number | undefined>(property?.superBuiltUpAreaSqFt);
  const [carpetAreaSqFt, setCarpetAreaSqFt] = useState<number | undefined>(property?.carpetAreaSqFt);
  const [locality, setLocality] = useState<string>(property?.locality || '');
  const [city, setCity] = useState<string>(property?.city || '');
  const [furnishing, setFurnishing] = useState<FurnishingStatus>(property?.furnishing || 'semi_furnished');
  const [floor, setFloor] = useState<string>(property?.floor || '');
  const [facing, setFacing] = useState<FacingDirection>(property?.facing || 'East');
  const [status, setStatus] = useState<PropertyStatus>(property?.status || 'available');
  const [amenities, setAmenities] = useState<string[]>(property?.amenities || []);
  const [photos, setPhotos] = useState<string[]>(property?.photos || []);

  // PRIVATE OWNER FIELDS
  const [ownerName, setOwnerName] = useState<string>(property?.ownerName || '');
  const [ownerPhone, setOwnerPhone] = useState<string>(property?.ownerPhone || '');
  const [ownerWhatsApp, setOwnerWhatsApp] = useState<string>(property?.ownerWhatsApp || '');
  const [exactAddress, setExactAddress] = useState<string>(property?.exactAddress || '');
  const [privateNotes, setPrivateNotes] = useState<string>(property?.privateNotes || '');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state whenever property changes or modal opens
  useEffect(() => {
    if (property) {
      setTitle(property.title || '');
      setTransactionType(property.transactionType || 'sale');
      setPropertyType(property.propertyType || 'flat');
      setBhk(property.bhk || '2 BHK');
      setPrice(property.price || 0);
      setPriceNegotiable(property.priceNegotiable ?? true);
      setSuperBuiltUpAreaSqFt(property.superBuiltUpAreaSqFt);
      setCarpetAreaSqFt(property.carpetAreaSqFt);
      setLocality(property.locality || '');
      setCity(property.city || '');
      setFurnishing(property.furnishing || 'semi_furnished');
      setFloor(property.floor || '');
      setFacing(property.facing || 'East');
      setStatus(property.status || 'available');
      setAmenities(property.amenities || []);
      setPhotos(property.photos || []);
      setOwnerName(property.ownerName || '');
      setOwnerPhone(property.ownerPhone || '');
      setOwnerWhatsApp(property.ownerWhatsApp || '');
      setExactAddress(property.exactAddress || '');
      setPrivateNotes(property.privateNotes || '');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [property, isOpen]);

  if (!isOpen) return null;

  const toggleAmenity = (item: string) => {
    if (amenities.includes(item)) {
      setAmenities(amenities.filter((a) => a !== item));
    } else {
      setAmenities([...amenities, item]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          setPhotos((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Please enter a property title / headline');
      return;
    }

    if (!locality.trim()) {
      setErrorMessage('Please enter locality / area');
      return;
    }

    if (!city.trim()) {
      setErrorMessage('Please enter city');
      return;
    }

    const updatedProperty: Property = {
      ...property,
      id: property.id, // Strictly preserve existing ID
      title: title.trim(),
      propertyType,
      transactionType,
      price: Number(price) || 0,
      priceNegotiable,
      bhk: propertyType === 'plot' || propertyType === 'commercial' ? propertyType : bhk,
      superBuiltUpAreaSqFt: Number(superBuiltUpAreaSqFt) || undefined,
      carpetAreaSqFt: Number(carpetAreaSqFt) || undefined,
      locality: locality.trim(),
      city: city.trim(),
      amenities,
      furnishing,
      floor: floor.trim() || undefined,
      facing,
      status,
      photos,
      ownerName: ownerName.trim() || 'Direct Owner',
      ownerPhone: ownerPhone.trim(),
      ownerWhatsApp: ownerWhatsApp.trim() || ownerPhone.trim(),
      exactAddress: exactAddress.trim(),
      privateNotes: privateNotes.trim(),
      documents: property.documents || [],
      createdAt: property.createdAt || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    try {
      setIsSubmitting(true);
      const saveFn = onSaveProperty || onSave;
      if (saveFn) {
        await saveFn(updatedProperty);
      }
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      console.error('Error updating property:', err);
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'Failed to update property. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom duration-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Edit Property Details
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Update public specs, pricing & confidential owner info
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {/* 1. Basic Details */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Property Title / Headline *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
            </div>

            {/* Transaction Type & Property Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Transaction
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  {(['sale', 'rent', 'lease'] as PropertyTransactionType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTransactionType(t)}
                      className={`py-1.5 text-[11px] font-bold rounded-lg capitalize transition-all ${
                        transactionType === t
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Property Type
                </label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="flat">Apartment / Flat</option>
                  <option value="house">Independent House</option>
                  <option value="villa">Gated Villa</option>
                  <option value="plot">Residential Plot / Land</option>
                  <option value="commercial">Commercial / Office</option>
                  <option value="penthouse">Penthouse / Duplex</option>
                  <option value="farmhouse">Farmhouse</option>
                </select>
              </div>
            </div>

            {/* BHK & Price input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  BHK / Config
                </label>
                <input
                  type="text"
                  value={bhk}
                  onChange={(e) => setBhk(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Price ({formatIndianCurrency(price)})
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-500">
                    <input
                      type="checkbox"
                      checked={priceNegotiable}
                      onChange={(e) => setPriceNegotiable(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Negotiable</span>
                  </label>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="50000"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Location & Specs */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              2. Location & Specifications (Public Details)
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Locality / Area *
                </label>
                <input
                  type="text"
                  required
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  City
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Area */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Super Built-Up Area (sq.ft)
                </label>
                <input
                  type="number"
                  value={superBuiltUpAreaSqFt || ''}
                  onChange={(e) => setSuperBuiltUpAreaSqFt(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Carpet Area (sq.ft)
                </label>
                <input
                  type="number"
                  value={carpetAreaSqFt || ''}
                  onChange={(e) => setCarpetAreaSqFt(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden"
                />
              </div>
            </div>

            {/* Floor, Facing, Furnishing */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Floor
                </label>
                <input
                  type="text"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Facing
                </label>
                <select
                  value={facing}
                  onChange={(e) => setFacing(e.target.value as FacingDirection)}
                  className="w-full px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden"
                >
                  <option value="East">East</option>
                  <option value="West">West</option>
                  <option value="North">North</option>
                  <option value="South">South</option>
                  <option value="North-East">North-East</option>
                  <option value="North-West">North-West</option>
                  <option value="South-East">South-East</option>
                  <option value="South-West">South-West</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Furnishing
                </label>
                <select
                  value={furnishing}
                  onChange={(e) => setFurnishing(e.target.value as FurnishingStatus)}
                  className="w-full px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden"
                >
                  <option value="semi_furnished">Semi-Furnished</option>
                  <option value="fully_furnished">Fully Furnished</option>
                  <option value="unfurnished">Unfurnished</option>
                </select>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Property Inventory Status
              </label>
              <div className="grid grid-cols-5 gap-1">
                {(['available', 'hold', 'negotiation', 'sold_rented', 'archived'] as PropertyStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`py-1.5 px-1 text-[10px] font-bold rounded-xl border capitalize transition-all truncate ${
                      status === s
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {s === 'sold_rented' ? 'Sold/Rent' : s}
                  </button>
                ))}
              </div>
            </div>

            {/* Amenities Chips */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Amenities & Features ({amenities.length} selected)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_AMENITIES.map((item) => {
                  const selected = amenities.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleAmenity(item)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                        selected
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-bold'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {selected && '✓ '}
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Photos */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                3. Photos ({photos.length})
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((url, idx) => (
                <div
                  key={idx}
                  className="relative group rounded-xl overflow-hidden aspect-4/3 border border-slate-200 dark:border-slate-700"
                >
                  <img
                    src={url}
                    alt={`Photo ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.2 bg-emerald-600 text-white text-[9px] font-bold rounded">
                      Cover
                    </span>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 flex flex-col items-center justify-center p-3 text-slate-400 hover:text-emerald-600 transition-colors aspect-4/3"
              >
                <Upload className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold">+ Add Photo</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* 4. PRIVATE OWNER & INTERNAL DETAILS */}
          <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/80 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <h3 className="text-xs font-extrabold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                4. Private Owner Details (Confidential)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Owner Name (Private)
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Owner Phone & WhatsApp (Private)
                </label>
                <input
                  type="tel"
                  value={ownerPhone}
                  onChange={(e) => {
                    setOwnerPhone(e.target.value);
                    if (!ownerWhatsApp) setOwnerWhatsApp(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Exact Address / Door # (Private - Never Shared)
              </label>
              <input
                type="text"
                value={exactAddress}
                onChange={(e) => setExactAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Private Internal Notes (Keys location, bottom price)
              </label>
              <textarea
                rows={2}
                value={privateNotes}
                onChange={(e) => setPrivateNotes(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>
          </div>

          {/* Error message banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Property...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Update Property Details</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
