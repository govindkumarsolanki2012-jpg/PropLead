import { cleanIndianPhone, formatIndianCurrency } from './formatters';
import { Lead } from '../types';

export interface WhatsAppTemplate {
  id: string;
  title: string;
  category: 'Test Presets' | 'Greeting' | 'Site Visit' | 'Brochure' | 'Follow-up' | 'Offer' | 'Hindi' | 'Hinglish';
  getMessage: (lead?: Partial<Lead>, agentName?: string, agencyName?: string) => string;
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  // --- TEST PRESETS AS SPECIFIED IN TEST SUITE ---
  {
    id: 'test_1_emoji_rupee',
    title: '🔥 Test 1: Emoji + Rupee Match',
    category: 'Test Presets',
    getMessage: (lead) => {
      const name = lead?.name || 'Rahul';
      const loc = (lead?.preferredLocations && lead.preferredLocations.length > 0 ? lead.preferredLocations[0] : '') || lead?.preferredCity || 'Gurgaon';
      const bhk = lead?.bhk || '2 BHK';
      const price = lead?.budgetMax ? formatIndianCurrency(lead.budgetMax) : '₹75 Lakh';
      
      return `Hi ${name} ji,

As discussed, here are some properties matching your requirement:

📍 Location: ${loc}
🏢 Type: ${bhk}
💰 Price: ${price}
✅ RERA Approved
🔥 Hot Property`;
    },
  },
  {
    id: 'test_2_hindi',
    title: '🏠 Test 2: Hindi (हिन्दी) Requirement',
    category: 'Test Presets',
    getMessage: (lead) => {
      const name = lead?.name || 'राहुल';
      const loc = (lead?.preferredLocations && lead.preferredLocations.length > 0 ? lead.preferredLocations[0] : '') || lead?.preferredCity || 'गुरुग्राम';
      const bhk = lead?.bhk || '2 BHK';
      const budget = lead?.budgetMax ? formatIndianCurrency(lead.budgetMax) : '₹75 लाख';

      return `नमस्ते ${name} जी,

आपकी जरूरत के अनुसार कुछ प्रॉपर्टी मिली हैं। 🏠

📍 लोकेशन: ${loc}
💰 बजट: ${budget}
✅ ${bhk}`;
    },
  },
  {
    id: 'test_3_hinglish',
    title: '✨ Test 3: Hinglish Property Match',
    category: 'Test Presets',
    getMessage: (lead) => {
      const name = lead?.name || 'Rahul';
      const loc = (lead?.preferredLocations && lead.preferredLocations.length > 0 ? lead.preferredLocations[0] : '') || lead?.preferredCity || 'Gurgaon';
      const price = lead?.budgetMax ? formatIndianCurrency(lead.budgetMax) : '₹75 Lakh';

      return `Hi ${name} ji,

Aapki requirement ke according ye property match karti hai. 🏠

📍 ${loc}
💰 ${price}
🔥 Hot Property`;
    },
  },

  // --- CORE REAL ESTATE WORKFLOW TEMPLATES ---
  {
    id: 'intro_greeting',
    title: '👋 Welcome & Requirement Acknowledgment',
    category: 'Greeting',
    getMessage: (lead, agentName = 'your property consultant', agencyName = 'our agency') => {
      const bhkText = lead?.bhk ? ` for ${lead.bhk}` : '';
      const locText = lead?.preferredLocations && lead.preferredLocations.length > 0 ? ` in ${lead.preferredLocations.join(', ')}` : '';
      const budgetText = lead?.budgetMax ? ` (Budget approx ${formatIndianCurrency(lead.budgetMax)})` : '';
      
      return `Hello ${lead?.name || 'Customer'} ji 🙏,

Thank you for connecting with us regarding your property requirement${bhkText}${locText}${budgetText}.

I am ${agentName} from ${agencyName}. I have shortlisted some verified and ready-to-move / pre-launch options that match your exact criteria.

May I share the brochures and floor plans with you here on WhatsApp?

Best regards,
${agentName}`;
    },
  },
  {
    id: 'share_options',
    title: '🏡 Sharing Matched Properties & Floor Plans',
    category: 'Brochure',
    getMessage: (lead, agentName = 'your property advisor') => {
      const loc = (lead?.preferredLocations && lead.preferredLocations.length > 0 ? lead.preferredLocations.join(', ') : '') || lead?.preferredCity || 'Prime Locality';
      return `Hi ${lead?.name || 'Customer'} ji,

As discussed, here are top handpicked options matching your requirement:

📍 Location: ${loc}
🏢 Type: ${lead?.bhk || 'Residential Apartment'}
💰 Price Range: ${lead?.budgetMax ? formatIndianCurrency(lead.budgetMax) : 'Best Market Rate'}
✅ RERA Approved • High Rental Yield & Appreciation

Please review the details and let me know a convenient time for a quick 15-min site visit.

Thanks,
${agentName}`;
    },
  },
  {
    id: 'site_visit_invite',
    title: '📅 Site Visit Confirmation & Location Pin',
    category: 'Site Visit',
    getMessage: (lead, agentName = 'your property advisor') => {
      const loc = (lead?.preferredLocations && lead.preferredLocations.length > 0 ? lead.preferredLocations[0] : '') || lead?.preferredCity || 'Project Sales Lounge';
      return `Dear ${lead?.name || 'Customer'} ji,

Your site visit has been scheduled! 🚗

📅 Date: ${lead?.nextFollowUpDate || 'Tomorrow'}
⏰ Time: ${lead?.nextFollowUpTime || '11:00 AM'}
📍 Location: ${loc}

I will be present at the site to guide you through the sample flat, amenities, and builder offers.

See you there!
${agentName}`;
    },
  },
  {
    id: 'post_visit_feedback',
    title: '💬 Post Site Visit Feedback & Best Price',
    category: 'Follow-up',
    getMessage: (lead, agentName = 'your property advisor') => {
      return `Hello ${lead?.name || 'Customer'} ji,

Thank you for taking out the time for the site visit today! 

How did you and your family like the unit layout and amenities? If you have any questions regarding the pricing, payment plan, or bank loan approval, I will be happy to assist you in getting the best negotiated builder deal.

Looking forward to your thoughts.

Regards,
${agentName}`;
    },
  },
  {
    id: 'gentle_followup',
    title: '⏰ Gentle Follow-up / Status Check',
    category: 'Follow-up',
    getMessage: (lead, agentName = 'your property consultant') => {
      const loc = (lead?.preferredLocations && lead.preferredLocations.length > 0 ? lead.preferredLocations[0] : '') || lead?.preferredCity || 'the area';
      return `Hi ${lead?.name || 'Customer'} ji,

Just wanted to check back regarding your property search in ${loc}. 

Are you still looking, or should I hold the shortlisted units for you? A couple of prime corner units are currently available.

Let me know whenever you have a minute to speak.

Thanks,
${agentName}`;
    },
  },
  {
    id: 'special_offer',
    title: '🎁 Exclusive Festival / Limited Price Deal',
    category: 'Offer',
    getMessage: (lead, agentName = 'your property consultant') => {
      const budgetStr = lead?.budgetMax || lead?.budgetMin ? ` of ${formatIndianCurrency(lead.budgetMax || lead.budgetMin)}` : '';
      return `Special Update for ${lead?.name || 'Customer'} ji! 🎁

For a limited time, the developer has announced a special spot-booking discount + zero floor rise charges on selected units.

Since this fits your budget${budgetStr}, I wanted to inform you first before public release.

Would you like to lock this offer today?

Regards,
${agentName}`;
    },
  },
];

/**
 * Builds a direct, UTF-8 safe WhatsApp Click-to-Chat URL.
 * Preserves all Unicode emojis, ₹ Indian Rupee symbols, Hindi script, Hinglish,
 * special characters, and line breaks without ASCII downgrading or character corruption.
 */
export function buildWhatsAppUrl(phone?: string, text?: string): string {
  const cleaned = phone ? cleanIndianPhone(phone) : '';
  const trimmedText = text ? text.trim() : '';
  
  // Standard UTF-8 URL percent-encoding preserving all Unicode codepoints
  const encodedText = trimmedText ? encodeURIComponent(trimmedText) : '';

  if (cleaned) {
    // api.whatsapp.com/send directly opens WhatsApp without intermediary redirect hops that strip 4-byte UTF-8 emojis
    return `https://api.whatsapp.com/send?phone=${cleaned}${encodedText ? `&text=${encodedText}` : ''}`;
  }
  
  return `https://api.whatsapp.com/send?${encodedText ? `text=${encodedText}` : ''}`;
}

/**
 * Open WhatsApp directly with full Unicode & Emoji preservation.
 */
export function openWhatsApp(phone: string, text?: string): void {
  const url = buildWhatsAppUrl(phone, text);
  if (!url) return;

  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      // If popup was blocked, fallback to top-level window redirection or secondary attempt
      window.location.assign(url);
    }
  } catch (err) {
    console.error('Failed to open WhatsApp window:', err);
    window.location.href = url;
  }
}

export const openWhatsAppDirect = openWhatsApp;

/**
 * Fallback-safe clipboard copy function that preserves emojis, Hindi characters,
 * ₹ symbol, line breaks, and all special Unicode characters.
 */
export async function copyUnicodeTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Primary: modern navigator.clipboard API
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard writeText failed, trying DOM fallback', err);
  }

  // 2. Fallback: Hidden DOM textarea with UTF-8 preservation
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('All clipboard copy attempts failed', err);
    return false;
  }
}

export function openDialer(phone: string): void {
  if (!phone) return;
  window.location.href = `tel:${phone.replace(/\s+/g, '')}`;
}
