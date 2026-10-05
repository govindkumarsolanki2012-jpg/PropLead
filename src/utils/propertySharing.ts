import { Property, UserProfile } from '../types';
import { formatIndianCurrency, PROPERTY_TYPE_LABELS, normalizePropertyPhotos } from './formatters';
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
export function generateCustomerPropertyMessage(
  property: Property,
  profile?: UserProfile,
  customCustomerName?: string,
  galleryUrl?: string
): string {
  const isRent = property.transactionType === 'rent' || property.transactionType === 'lease';
  const typeLabel = PROPERTY_TYPE_LABELS[property.propertyType] || 'Property';
  const priceFormatted = `${formatIndianCurrency(property.price)}${isRent ? ' / month' : ''}${
    property.priceNegotiable ? ' (Negotiable)' : ''
  }`;

  const greeting = customCustomerName ? `Hello ${customCustomerName},\n\n` : `Hello,\n\n`;

  const isPlotOrLand = property.propertyType === 'plot' || property.propertyType === 'land';
  const statusText = property.status === 'available'
    ? (isPlotOrLand ? 'Available' : 'Ready to Move / Available')
    : property.status === 'negotiation'
    ? 'Under Discussion'
    : 'Active';

  let details = `${greeting}*NEW PROPERTY RECOMMENDATION*\n\n`;
  details += `*Property:* ${property.title}\n`;
  details += `*Location:* ${property.locality}, ${property.city}\n\n`;

  details += `*Property Highlights:*\n`;
  details += `• Type: ${typeLabel}\n`;
  details += `• Price: ${priceFormatted}\n`;
  if (property.facing) {
    details += `• Facing: ${property.facing} Facing\n`;
  }
  details += `• Status: ${statusText}\n\n`;

  // CRITICAL: Do NOT list individual image URLs here. Always keep as single public gallery URL.
  const publicGalleryUrl = getPublicGalleryUrl(property.id);
  details += `📸 *Photos & View:*\n👉 ${publicGalleryUrl}\n\n`;

  details += `--------------------------------\n`;
  details += `*Presented by:* ${profile?.name || 'Property Advisor'}\n\n`;
  details += `Reply to this message to schedule a private site visit.`;

  return details;
}

/**
 * Open WhatsApp directly with the customer-safe property message.
 * Ensures UTF-8 encoding, preserving all emojis, ₹ symbols, and formatting.
 */
export async function openWhatsAppPropertyShare(
  property: Property,
  customerPhone?: string,
  profile?: UserProfile,
  customerName?: string
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

  const message = generateCustomerPropertyMessage(property, profile, customerName, galleryUrl);
  openWhatsApp(customerPhone || '', message);
}

