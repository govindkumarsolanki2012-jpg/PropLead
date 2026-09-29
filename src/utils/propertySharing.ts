import { Property, UserProfile } from '../types';
import { formatIndianCurrency, PROPERTY_TYPE_LABELS, normalizePropertyPhotos } from './formatters';
import { openWhatsApp } from './whatsapp';

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

  const isPlotOrLand = property.propertyType === 'plot' || property.propertyType === 'land';
  const isCommercial = property.propertyType === 'commercial';
  const isFarmhouse = property.propertyType === 'farmhouse';

  let details = `${greeting}🌟 *NEW PROPERTY RECOMMENDATION*\n\n`;
  details += `🏡 *${property.title}*\n`;
  details += `📍 *Location:* ${property.locality}, ${property.city}\n\n`;

  details += `📋 *Property Highlights:*\n`;
  details += `• *Type:* ${typeLabel}\n`;

  if (!isPlotOrLand && !isCommercial && property.bhk) {
    details += `• *Configuration:* ${property.bhk}\n`;
  }
  if (isCommercial && property.commercialType) {
    details += `• *Commercial Type:* ${property.commercialType}\n`;
  }

  details += `• *Pricing:* *${priceFormatted}*\n`;

  if (isPlotOrLand && property.plotAreaSqFt) {
    details += `• *Plot Area:* ${property.plotAreaSqFt.toLocaleString('en-IN')} sq.ft\n`;
  } else if (isFarmhouse) {
    if (property.landAreaSqFt) details += `• *Land Area:* ${property.landAreaSqFt.toLocaleString('en-IN')} sq.ft\n`;
    if (property.builtUpAreaSqFt) details += `• *Built-Up Area:* ${property.builtUpAreaSqFt.toLocaleString('en-IN')} sq.ft\n`;
  } else if (isCommercial) {
    if (property.carpetAreaSqFt) details += `• *Carpet Area:* ${property.carpetAreaSqFt.toLocaleString('en-IN')} sq.ft\n`;
    if (property.builtUpAreaSqFt) details += `• *Built-Up Area:* ${property.builtUpAreaSqFt.toLocaleString('en-IN')} sq.ft\n`;
  } else {
    if (property.superBuiltUpAreaSqFt) {
      details += `• *Super Built-Up Area:* ${property.superBuiltUpAreaSqFt.toLocaleString('en-IN')} sq.ft\n`;
    }
    if (property.carpetAreaSqFt) {
      details += `• *Carpet Area:* ${property.carpetAreaSqFt.toLocaleString('en-IN')} sq.ft\n`;
    }
    if (property.plotAreaSqFt) {
      details += `• *Plot Area:* ${property.plotAreaSqFt.toLocaleString('en-IN')} sq.ft\n`;
    }
  }

  if (!isPlotOrLand && property.furnishing) {
    const furnishingLabel =
      property.furnishing === 'fully_furnished'
        ? 'Fully Furnished'
        : property.furnishing === 'semi_furnished'
        ? 'Semi-Furnished'
        : 'Unfurnished';
    details += `• *Furnishing:* ${furnishingLabel}\n`;
  }

  if (!isPlotOrLand && !isFarmhouse && property.floor) {
    details += `• *Floor:* ${property.floor}\n`;
  }

  if (property.facing) {
    details += `• *Facing:* ${property.facing} Facing\n`;
  }

  if (isPlotOrLand) {
    if (property.roadWidthFt) details += `• *Road Width:* ${property.roadWidthFt} ft\n`;
    if (property.isCornerPlot) details += `• *Corner Plot:* Yes\n`;
    if (property.boundaryWall) details += `• *Boundary Wall:* ${property.boundaryWall}\n`;
  }

  details += `• *Status:* ${
    property.status === 'available'
      ? 'Ready to Move / Available'
      : property.status === 'negotiation'
      ? 'Under Discussion'
      : 'Active'
  }\n\n`;

  if (property.amenities && property.amenities.length > 0) {
    details += `✨ *Key Amenities & Features:*\n`;
    property.amenities.slice(0, 8).forEach((amenity) => {
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
