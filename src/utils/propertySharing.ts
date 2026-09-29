import { Property, UserProfile } from '../types';
import { formatIndianCurrency, PROPERTY_TYPE_LABELS, normalizePropertyPhotos } from './formatters';
import { openWhatsApp } from './whatsapp';
import { getRelevantPropertySpecs, PROPERTY_TYPE_AMENITIES } from './propertyTypeFields';

/**
 * Generate a clean, high-converting WhatsApp message for customer sharing.
 *
 * CRITICAL PRIVACY RULES:
 * - NO Owner Name
 * - NO Owner Phone / WhatsApp
 * - NO Owner Notes / Private Notes
 * - NO Exact Door / Flat / Plot Number
 * - NO Internal documents
 * - Show ONLY general locality & city (e.g. 📍 MVP Colony, Visakhapatnam)
 */
export function generateCustomerPropertyMessage(
  property: Property,
  profile?: UserProfile,
  customCustomerName?: string
): string {
  const isRent = property.transactionType === 'rent' || property.transactionType === 'lease';
  const typeLabel = PROPERTY_TYPE_LABELS[property.propertyType] || 'Property';
  const priceFormatted = `${formatIndianCurrency(property.price)}${isRent ? ' / month' : ''}${
    property.priceNegotiable ? ' (Negotiable)' : ''
  }`;

  const greeting = customCustomerName ? `Hello ${customCustomerName},\n\n` : `Hello,\n\n`;

  let details = `${greeting}🌟 *NEW PROPERTY RECOMMENDATION*\n\n`;
  details += `🏡 *${property.title}*\n`;
  details += `📍 *Location:* ${property.locality}, ${property.city}\n\n`;

  details += `📋 *Property Highlights:*\n`;
  details += `• *Type:* ${typeLabel}\n`;
  details += `• *Pricing:* *${priceFormatted}*\n`;
  getRelevantPropertySpecs(property).forEach((spec) => {
    details += `• *${spec.label}:* ${spec.value}\n`;
  });
  details += `• *Status:* ${
    property.status === 'available'
      ? 'Ready to Move / Available'
      : property.status === 'negotiation'
      ? 'Under Discussion'
      : 'Active'
  }\n\n`;

  const relevantAmenities = (property.amenities || []).filter((amenity) =>
    PROPERTY_TYPE_AMENITIES[property.propertyType].includes(amenity)
  );
  if (relevantAmenities.length > 0) {
    details += `✨ *Key Amenities & Features:*\n`;
    relevantAmenities.slice(0, 8).forEach((amenity) => {
      details += `✓ ${amenity}\n`;
    });
    details += `\n`;
  }

  // Include photo links if available (first 2-3 links)
  if (property.photos && property.photos.length > 0) {
    const validUrlPhotos = normalizePropertyPhotos(property.photos);
    if (validUrlPhotos.length > 0) {
      details += `📸 *Photos & View:*\n`;
      validUrlPhotos.slice(0, 2).forEach((url, i) => {
        details += `Image ${i + 1}: ${url}\n`;
      });
      details += `\n`;
    }
  }

  details += `---------------------------------\n`;
  details += `🤝 *Presented by:*\n`;
  details += `*${profile?.name || 'Property Advisor'}*\n`;
  if (profile?.agencyName) {
    details += `${profile.agencyName}\n`;
  }
  if (profile?.phone) {
    details += `📞 Phone/WhatsApp: +91 ${profile.phone}\n`;
  }
  if (profile?.reraNumber) {
    details += `📜 RERA Reg: ${profile.reraNumber}\n`;
  }

  details += `\n_Reply to this message to schedule a private site visit or discuss customized payment plans._`;

  return details;
}

/**
 * Open WhatsApp directly with the customer-safe property message.
 * Ensures UTF-8 encoding, preserving all emojis, ₹ symbols, and formatting.
 */
export function openWhatsAppPropertyShare(
  property: Property,
  customerPhone?: string,
  profile?: UserProfile,
  customerName?: string
): void {
  const message = generateCustomerPropertyMessage(property, profile, customerName);
  openWhatsApp(customerPhone || '', message);
}
