import { Property, UserProfile } from '../types';
import { PROPERTY_TYPE_LABELS, normalizePropertyPhotos } from './formatters';
import { openWhatsApp } from './whatsapp';
import { savePublicPhotoShare } from '../services/firebaseService';

/**
 * Get the public photo gallery share URL using Firebase Hosting domain
 * to prevent 404s and Google login barriers.
 */
export function getPublicGalleryUrl(propertyId: string): string {
  return `https://proplead-e5c6a.web.app/share/photos/${encodeURIComponent(propertyId)}`;
}

/**
 * Generate a clean, high-converting WhatsApp message for customer sharing.
 *
 * CRITICAL PRIVACY RULES:
 * - NO Owner Name
 * - NO Owner Phone / WhatsApp
 * - NO Owner Notes / Private Notes
 * - NO Exact Door / Flat / Plot Number
 * - NO Internal documents
 * - Show ONLY general locality & city (e.g. MVP Colony, Visakhapatnam)
 */
// Public data is explicitly allowlisted below. Never iterate over the whole property:
// owner details, exactAddress, private/internal notes and documents must stay private.
type LegacyPublicPropertyFields = Partial<Record<
  'location' | 'landmark' | 'type' | 'forSale' | 'isNegotiable' | 'configuration' |
  'carpetArea' | 'superBuiltUpArea' | 'builtUpArea' | 'plotArea' | 'area' |
  'areaUnit' | 'dimensions' | 'bathrooms' | 'possessionStatus' | 'propertyAge' | 'ageOfProperty',
  unknown
>>;

export function generateCustomerPropertyMessage(
  property: Property,
  profile?: UserProfile,
  customCustomerName?: string,
  _galleryUrl?: string
): string {
  const p = property as Property & LegacyPublicPropertyFields;
  const filled = (value: unknown): boolean =>
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value) && value !== 0) ||
    (typeof value === 'string' && value.trim() !== '' && !/^0(?:\.0+)?$/.test(value.trim()));
  const first = (...values: unknown[]): unknown => values.find(filled);
  const text = (value: unknown): string => {
    if (!filled(value)) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value).trim();
  };
  const label = (value: unknown): string => text(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const locationText = (value: unknown): string =>
    text(value).split(/(\s+)/).map((word) => {
      // Preserve short locality acronyms such as MVP while normalizing names.
      if (/^[A-Z]{2,4}$/.test(word)) return word;
      return word.toLocaleLowerCase('en-IN').replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
    }).join('');
  const sharePrice = (amount: number): string => {
    const format = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    if (amount >= 10000000) return `₹${format(amount / 10000000)} Crores`;
    if (amount >= 100000) return `₹${format(amount / 100000)} Lakhs`;
    return `₹${format(amount)}`;
  };
  const specs: string[] = [];
  const add = (name: string, value: unknown) => {
    const rendered = text(value);
    if (rendered) specs.push(`• ${name}: ${rendered}`);
  };
  const area = (name: string, canonical: unknown, ...legacy: unknown[]) => {
    const value = first(canonical, ...legacy);
    if (filled(value)) add(name, `${text(value)} sq.ft`);
  };
  const feet = (value: unknown): string => {
    const rendered = text(value);
    return rendered && /^\d+(?:\.\d+)?$/.test(rendered) ? `${rendered} ft` : rendered;
  };

  const type = first(p.propertyType, p.type);
  add('Type', PROPERTY_TYPE_LABELS[text(type) as Property['propertyType']] || label(type));
  add('Purpose', p.forSale === true ? 'For Sale' : label(p.transactionType));
  const negotiable = p.priceNegotiable ?? p.isNegotiable;
  if (filled(p.price)) {
    const rent = p.transactionType === 'rent' || p.transactionType === 'lease';
    add('Price', `${sharePrice(p.price)}${rent ? ' / month' : ''}${negotiable === true ? ' (Negotiable)' : ''}`);
  }
  add('Negotiable', negotiable);
  add('Configuration', first(p.bhk, p.configuration));
  area('Carpet Area', p.carpetAreaSqFt, p.carpetArea);
  area('Super Built-Up Area', p.superBuiltUpAreaSqFt, p.superBuiltUpArea);
  area('Built-Up Area', p.builtUpAreaSqFt, p.builtUpArea);
  if (filled(p.plotAreaSqFt)) area('Plot Area', p.plotAreaSqFt);
  else {
    const plot = first(p.plotArea, p.area);
    if (filled(plot)) add('Plot Area', `${text(plot)} ${text(p.areaUnit) || 'sq.yd'}`);
  }
  area('Land Area', p.landAreaSqFt);
  area('Terrace Area', p.terraceAreaSqFt);
  add('Dimensions', first(p.plotDimension, p.dimensions));
  if (filled(p.floor)) add('Floor', `${text(p.floor)}${filled(p.totalFloors) ? ` of ${text(p.totalFloors)}` : ''}`);
  else add('Total Floors', p.totalFloors);
  add('Facing', p.facing);
  add('Furnishing', label(p.furnishing));
  add('Balconies', first(p.balconyCount, p.balconies));
  add('Bedrooms / Rooms', p.bedrooms);
  add('Bathrooms / Washrooms', first(p.washrooms, p.bathrooms));
  add('Washroom Available', p.washroom);
  add('Parking', p.parking);
  add('Road Width', feet(first(p.roadWidth, p.roadWidthFt)));
  add('Frontage', feet(first(p.frontage, p.frontageFt)));
  add('Status', label(first(p.status, p.possessionStatus)));
  add('Age of Property', first(p.propertyAge, p.ageOfProperty));
  add('Commercial Type', label(p.commercialType));
  add('Suitable For', label(p.suitableFor));
  add('Approval Type', label(p.approvalType));
  add('Road Type', label(p.roadType));
  add('Road Access', p.roadAccess);
  add('Nearby Village / City', locationText(p.nearbyVillageOrCity));
  add('Water Source', label(p.waterSource));
  add('Water Supply', p.waterSupply);
  add('Electricity Supply', p.electricitySupply);
  add('Trees / Garden', p.treesOrGarden);
  add('Corner Plot', p.cornerPlot ?? p.isCornerPlot);
  add('Boundary Wall', p.boundaryWall);
  add('Water Available', p.waterAvailability);
  add('Electricity Available', p.electricityAvailability);
  add('Drainage Available', p.drainageAvailability);
  add('Lift', p.lift);
  add('Private Terrace', p.privateTerrace);
  add('Terrace', p.terrace);
  add('Garden', p.garden);
  add('Fencing', p.fencing);
  add('Farm / Garden Area', p.farmGarden);
  // Internal IDs and database timestamps are never customer-facing specs.

  const lines = [
    customCustomerName?.trim() ? `Hello ${customCustomerName.trim()},` : 'Hello,',
    '',
    '🏡 NEW PROPERTY RECOMMENDATION',
    '',
  ];
  if (text(p.title)) lines.push(`📍 Property: ${text(p.title)}`);
  const location = [...new Set([p.locality, p.location, p.city].map(locationText).filter(Boolean))].join(', ');
  if (location) lines.push(`📌 Location: ${location}`);
  const landmark = first(p.nearbyLandmark, p.landmark);
  if (filled(landmark)) lines.push(`🗺️ Landmark: ${locationText(landmark)}`);
  lines.push('', '📋 Property Details & Specs:', ...specs);
  const amenities = Array.isArray(p.amenities) ? p.amenities.map(text).filter(Boolean) : [];
  if (amenities.length) lines.push('', '✨ Amenities & Key Features:', ...amenities.map((item) => `• ${item}`));
  // CRITICAL: Do NOT list individual image URLs here. Always keep as single public gallery URL.
  lines.push('', '📸 Photos & Full Gallery:', `👉 ${getPublicGalleryUrl(p.id)}`, '',
    '--------------------------------', `Presented by: ${profile?.name?.trim() || 'Property Advisor'}`);
  if (profile?.phone?.trim()) lines.push(`📞 Contact: ${profile.phone.trim()}`);
  lines.push('', 'Reply to this message to schedule a private site visit.');
  return lines.join('\n');
}

/**
 * Open WhatsApp directly with the customer-safe property message.
 * Ensures UTF-8 encoding, preserving all emojis, ₹ symbols, and formatting.
 */
export async function openWhatsAppPropertyShare(
  property: Property,
  customerPhone?: string,
  profile?: UserProfile,
  customerName?: string,
  messageText?: string
): Promise<void> {
  const galleryUrl = getPublicGalleryUrl(property.id);
  if (property.photos && property.photos.length > 0) {
    const validUrlPhotos = normalizePropertyPhotos(property.photos);
    if (validUrlPhotos.length > 0) {
      try {
        await savePublicPhotoShare(property.id, validUrlPhotos);
      } catch (err) {
        console.warn('Failed to save public photo share:', err);
      }
    }
  }

  const message = messageText?.trim() || generateCustomerPropertyMessage(property, profile, customerName, galleryUrl);
  openWhatsApp(customerPhone || '', message);
}

