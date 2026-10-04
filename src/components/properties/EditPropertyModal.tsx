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
import { auth } from '../../lib/firebase';
import {
  uploadPropertyPhotoToStorage,
  validateAttachmentFile,
  UploadProgress,
} from '../../utils/attachmentStorage';
import { hasProAccess } from '../../utils/billing';
import { PropertyTypeSpecificFields } from './PropertyTypeSpecificFields';
import { getBhkLabel, isPropertyFieldVisible, PROPERTY_TYPE_AMENITIES } from '../../utils/propertyTypeFields';

interface EditPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property;
  profile?: UserProfile | null;
  onSaveProperty?: (property: Property) => Promise<void | boolean> | void;
  onSave?: (property: Property) => Promise<void | boolean> | void;
  onOpenSubscription?: () => void;
}

export const EditPropertyModal: React.FC<EditPropertyModalProps> = ({
  isOpen,
  onClose,
  property,
  profile,
  onSaveProperty,
  onSave,
  onOpenSubscription,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState<string>(property?.title || '');
  const [transactionType, setTransactionType] = useState<PropertyTransactionType>(property?.transactionType || 'sale');
  const [propertyType, setPropertyType] = useState<PropertyType>(property?.propertyType || 'flat');
  const [bhk, setBhk] = useState<string>(property?.bhk || '');
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
  const [extraFields, setExtraFields] = useState<Partial<Property>>({ ...property });

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
      setBhk(property.bhk || '');
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
      setExtraFields({ ...property });
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

  const [isUploadingPhotos, setIsUploadingPhotos] = useState<boolean>(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState<UploadProgress | null>(null);
  const [failedPhotoFiles, setFailedPhotoFiles] = useState<File[]>([]);

  const uploadFileList = async (fileList: File[]) => {
    if (fileList.length === 0) return;

    if (profile && !hasProAccess(profile)) {
      if (onOpenSubscription) onOpenSubscription();
      setErrorMessage('Your trial has expired. Please subscribe to continue.');
      return;
    }

    const currentUid = auth.currentUser?.uid;
    if (!currentUid) {
      setErrorMessage('Please sign in to upload property photos.');
      return;
    }

    setIsUploadingPhotos(true);
    setErrorMessage(null);
    setPhotoUploadProgress({ percent: 0, statusText: 'Uploading...' });

    const newlyFailed: File[] = [];
    const propId = property.id || `prop_${Date.now()}`;

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const validation = validateAttachmentFile(file);
        if (!validation.valid) {
          setErrorMessage(validation.error || 'File is too large. Maximum size is 10 MB.');
          continue;
        }

        try {
          const { downloadUrl } = await uploadPropertyPhotoToStorage({
            userId: currentUid,
            propertyId: propId,
            file,
            onProgress: (progress) => {
              const prefix = fileList.length > 1 ? `Photo ${i + 1}/${fileList.length}: ` : '';
              setPhotoUploadProgress({
                percent: progress.percent,
                statusText: `${prefix}${progress.statusText}`,
              });
            },
          });
          setPhotos((prev) => [...prev, downloadUrl]);
        } catch (storageErr: any) {
          console.error('[EditPropertyModal] Photo upload failed:', storageErr);
          newlyFailed.push(file);
        }
      }

      if (newlyFailed.length > 0) {
        setFailedPhotoFiles(newlyFailed);
        setErrorMessage('Upload did not complete. Please retry.');
      } else {
        setFailedPhotoFiles([]);
        setPhotoUploadProgress({ percent: 100, statusText: 'Upload complete' });
        setTimeout(() => {
          setPhotoUploadProgress(null);
        }, 3000);
      }
    } finally {
      setIsUploadingPhotos(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploadingPhotos) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileList: File[] = Array.from(files);
    await uploadFileList(fileList);
  };

  const handleRetryFailedPhotos = async () => {
    if (isUploadingPhotos || failedPhotoFiles.length === 0) return;
    const toRetry = [...failedPhotoFiles];
    await uploadFileList(toRetry);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (profile && !hasProAccess(profile)) {
      if (onOpenSubscription) onOpenSubscription();
      setErrorMessage('Your trial has expired. Please subscribe to continue.');
      return;
    }

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
      ...extraFields,
      id: property.id, // Strictly preserve existing ID
      title: title.trim(),
      propertyType,
      transactionType,
      price: Number(price) || 0,
      priceNegotiable,
      bhk: bhk.trim() || undefined,
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
      if (!saveFn) {
        console.error('[EditPropertyModal] Cannot save property: no save callback was provided.');
        setIsSubmitting(false);
        setErrorMessage('Unable to save the property. Please close and reopen it, then try again.');
        return;
      }

      await saveFn(updatedProperty);
      console.log('[UPLOAD_STAGE: 10. FIRESTORE_METADATA_SAVED]', {
        propertyId: updatedProperty.id,
        photoCount: updatedProperty.photos.length,
        title: updatedProperty.title,
      });
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      console.warn('Notice updating property:', err);
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'Failed to update property. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden">
      <div className="relative w-full sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[100dvh] sm:max-h-[min(90dvh,850px)] h-full sm:h-auto overflow-hidden border border-slate-200 dark:border-slate-800 box-border animate-in fade-in slide-in-from-bottom duration-200">
        {/* Modal Header - Sticky Top */}
        <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                Edit Property Details
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Update public specs, pricing &amp; confidential owner info
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 sm:space-y-5 flex-1 min-h-0 pb-10 sm:pb-8">
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
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold box-border"
                />
              </div>

              {/* Transaction Type & Property Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        className={`py-1.5 text-[11px] font-bold rounded-lg capitalize transition-all cursor-pointer ${
                          transactionType === t
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500 box-border"
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
              <div className={`grid grid-cols-1 ${isPropertyFieldVisible(propertyType, 'bhk') ? 'sm:grid-cols-2' : ''} gap-3`}>
                {isPropertyFieldVisible(propertyType, 'bhk') && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {getBhkLabel(propertyType)}
                    </label>
                    <input
                      type="text"
                      value={bhk}
                      onChange={(e) => setBhk(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500 box-border"
                    />
                  </div>
                )}

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
                      className="w-full pl-7 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold box-border"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Locality / Area *
                  </label>
                  <input
                    type="text"
                    required
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500 box-border"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500 box-border"
                  />
                </div>
              </div>

              {/* Area */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Super Built-Up Area (sq.ft)
                  </label>
                  <input
                    type="number"
                    value={superBuiltUpAreaSqFt || ''}
                    onChange={(e) => setSuperBuiltUpAreaSqFt(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden box-border"
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden box-border"
                  />
                </div>
              </div>

              {/* Floor, Facing, Furnishing */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {isPropertyFieldVisible(propertyType, 'floor') && <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Floor
                  </label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden box-border"
                  />
                </div>}

                {isPropertyFieldVisible(propertyType, 'facing') && <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Facing
                  </label>
                  <select
                    value={facing}
                    onChange={(e) => setFacing(e.target.value as FacingDirection)}
                    className="w-full px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden box-border"
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
                </div>}

                {isPropertyFieldVisible(propertyType, 'furnishing') && <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Furnishing
                  </label>
                  <select
                    value={furnishing}
                    onChange={(e) => setFurnishing(e.target.value as FurnishingStatus)}
                    className="w-full px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden box-border"
                  >
                    <option value="semi_furnished">Semi-Furnished</option>
                    <option value="fully_furnished">Fully Furnished</option>
                    <option value="unfurnished">Unfurnished</option>
                  </select>
                </div>}
              </div>

              <PropertyTypeSpecificFields
                propertyType={propertyType}
                values={extraFields}
                onChange={(field, value) => setExtraFields((prev) => ({ ...prev, [field]: value }))}
              />

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Property Inventory Status
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {(['available', 'hold', 'negotiation', 'sold_rented', 'archived'] as PropertyStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`py-2 px-1 text-[11px] sm:text-[10px] font-bold rounded-xl border capitalize transition-all truncate cursor-pointer ${
                        status === s
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
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
                  {PROPERTY_TYPE_AMENITIES[propertyType].map((item) => {
                    const selected = amenities.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleAmenity(item)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
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
                disabled={isUploadingPhotos}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 flex flex-col items-center justify-center p-3 text-slate-400 hover:text-emerald-600 transition-colors aspect-4/3 disabled:opacity-50"
              >
                {isUploadingPhotos ? (
                  <>
                    <RefreshCw className="w-5 h-5 mb-1 animate-spin text-emerald-600" />
                    <span className="text-[10px] font-bold text-emerald-600">
                      {photoUploadProgress?.statusText || 'Uploading...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold">+ Add Photo</span>
                  </>
                )}
              </button>
            </div>

            {/* Photo Upload Progress Bar */}
            {isUploadingPhotos && photoUploadProgress && (
              <div className="pt-1 space-y-1 animate-fade-in">
                <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>{photoUploadProgress.statusText}</span>
                  </span>
                  {photoUploadProgress.percent > 0 && <span>{photoUploadProgress.percent}%</span>}
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
                  {photoUploadProgress.percent > 0 ? (
                    <div
                      className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.max(5, photoUploadProgress.percent)}%` }}
                    />
                  ) : (
                    <div className="h-full bg-emerald-600 rounded-full animate-pulse w-full" />
                  )}
                </div>
              </div>
            )}

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

            {/* Error message banner with Retry button */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span className="truncate">{errorMessage}</span>
                </div>
                {failedPhotoFiles.length > 0 && !isUploadingPhotos && (
                  <button
                    type="button"
                    onClick={handleRetryFailedPhotos}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-lg text-[11px] inline-flex items-center gap-1 shadow-xs transition-all cursor-pointer flex-shrink-0"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sticky Action Footer */}
          <div className="shrink-0 p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs flex items-center gap-2 sm:gap-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-10 w-full box-border">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 sm:py-3 px-3.5 sm:px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-all shrink-0 cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingPhotos}
              className="py-2.5 sm:py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all flex-1 min-w-0 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer min-h-[44px]"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  <span className="truncate">Saving Property...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 shrink-0" />
                  <span className="truncate">Update Property Details</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
