export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'site_visit_scheduled'
  | 'site_visit_completed'
  | 'negotiation'
  | 'advance_paid'
  | 'closed'
  | 'lost';

export type LeadPriority = 'hot' | 'warm' | 'cold';

export type RequirementType = 'buy' | 'sell' | 'rent' | 'lease';

export type PropertyType =
  | 'flat'
  | 'house'
  | 'villa'
  | 'plot'
  | 'commercial'
  | 'land'
  | 'penthouse'
  | 'farmhouse';

export type BHKType = '1 BHK' | '2 BHK' | '3 BHK' | '4+ BHK' | 'Studio' | 'Plot/Land' | 'Commercial' | 'Any';

export type LeadSource =
  | 'WhatsApp'
  | '99acres'
  | 'MagicBricks'
  | 'Housing.com'
  | 'Referral'
  | 'Walk-in'
  | 'Phone Call'
  | 'Instagram'
  | 'Facebook'
  | 'Google'
  | 'Website'
  | 'Other';

export type FollowUpType = 'call' | 'whatsapp' | 'site_visit' | 'meeting' | 'document_collection';

export interface FollowUp {
  id: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM (24h)
  type: FollowUpType;
  note: string;
  isCompleted: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  leadId: string;
  type:
    | 'created'
    | 'status_changed'
    | 'call'
    | 'whatsapp'
    | 'note'
    | 'voice_note'
    | 'site_visit'
    | 'followup_created'
    | 'followup_completed'
    | 'attachment_added';
  title: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface VoiceNote {
  id: string;
  leadId: string;
  audioUrl: string;
  durationSeconds: number;
  createdAt: string;
  note?: string;
}

export interface Attachment {
  id: string;
  leadId: string;
  name: string;
  type: 'image' | 'document';
  url: string;
  size?: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  requirement: RequirementType;
  propertyType: PropertyType;
  bhk?: string;
  budgetMin?: number; // In Rupees
  budgetMax?: number; // In Rupees
  currentCity?: string; // Where the customer currently lives (e.g. Mumbai)
  preferredCity?: string; // Preferred property city (HARD FILTER, e.g. Gurgaon)
  preferredLocality?: string; // Preferred property locality/sector (e.g. Sector 57)
  preferredLocations: string[]; // List of preferred localities/areas
  plotSizeSqFt?: number;
  source: LeadSource;
  priority: LeadPriority;
  status: LeadStatus;
  notes: string;
  nextFollowUpDate?: string; // YYYY-MM-DD
  nextFollowUpTime?: string; // HH:MM
  nextFollowUpNote?: string;
  lastContactedAt?: string;
  createdAt: string;
  updatedAt: string;
  voiceNotes: VoiceNote[];
  attachments: Attachment[];
  activities: ActivityLog[];
}

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'CANCELED_BUT_ACTIVE'
  | 'PAYMENT_ISSUE'
  | 'EXPIRED';

export interface GooglePlayOffer {
  offerId: string;
  offerToken: string;
  pricingPhases: {
    priceFormatted: string;
    priceMicros: number;
    billingPeriod: string;
    recurrenceMode: number;
    billingCycleCount: number;
  }[];
}

export interface GooglePlaySubscriptionProduct {
  productId: string;
  basePlanId: string;
  title: string;
  description: string;
  priceFormatted: string;
  priceMicros: number;
  currencyCode: string;
  billingPeriod: string;
  freeTrialPeriod: string;
  freeTrialDays: number;
  offers: GooglePlayOffer[];
  features: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  agencyName: string;
  phone: string;
  email: string;
  city: string;
  reraNumber?: string;
  subscriptionStatus?: SubscriptionStatus | 'trial' | 'subscribed' | 'expired'; // Full support for legacy and new state
  isTrialActive: boolean;
  trialStartDate: string;
  trialEndDate?: string;
  trialDaysRemaining: number;
  isSubscribed: boolean;
  subscriptionPlan?: string;
  subscriptionExpiryDate?: string | null;
  subscriptionProductId?: string;
  subscriptionBasePlan?: string;
  autoRenewing?: boolean;
  purchaseToken?: string;
  paymentIssueMessage?: string;
  isFeatureLocked?: boolean;
  language?: 'en' | 'hi' | 'hinglish';
  darkMode: boolean;
  notificationsEnabled: boolean;
  hasCompletedOnboarding?: boolean;
  isOnboarded?: boolean;
}

export type TabType = 'home' | 'leads' | 'properties' | 'calendar' | 'analytics' | 'settings';

export type PropertyTransactionType = 'sale' | 'rent' | 'lease';

export type PropertyStatus =
  | 'available'
  | 'hold'
  | 'negotiation'
  | 'sold_rented'
  | 'archived';

export type FurnishingStatus = 'unfurnished' | 'semi_furnished' | 'fully_furnished';

export type FacingDirection =
  | 'East'
  | 'West'
  | 'North'
  | 'South'
  | 'North-East'
  | 'North-West'
  | 'South-East'
  | 'South-West';

export interface PropertyDocument {
  id: string;
  propertyId: string;
  name: string;
  type: 'brochure' | 'floor_plan' | 'rera_doc' | 'title_deed' | 'tax_receipt' | 'other';
  url: string;
  size?: string;
  createdAt: string;
}

export interface Property {
  id: string;
  title: string;
  propertyType: PropertyType;
  transactionType: PropertyTransactionType;
  price: number; // In Rupees
  priceNegotiable?: boolean;
  bhk?: string; // '1 BHK', '2 BHK', '3 BHK', etc.
  carpetAreaSqFt?: number;
  superBuiltUpAreaSqFt?: number;
  locality: string; // Customer-facing (e.g. 'MVP Colony')
  city: string; // Customer-facing (e.g. 'Visakhapatnam')
  amenities: string[];
  furnishing: FurnishingStatus;
  floor?: string;
  facing?: FacingDirection;
  status: PropertyStatus;
  photos: string[];

  // PRIVATE OWNER & AGENT DETAILS (NEVER SHARED WITH CUSTOMERS)
  ownerName: string;
  ownerPhone: string;
  ownerWhatsApp?: string;
  exactAddress?: string; // Private door/house/street address
  privateNotes?: string; // Private internal agent notes
  documents?: PropertyDocument[]; // Private internal documents

  createdAt: string;
  updatedAt: string;
}

export type MatchCategory = 'best_match' | 'nearby_match' | 'expanded_match';

export interface PropertyMatchResult {
  property: Property;
  score: number; // 0 to 100
  matchReasons: string[];
  matchCategory: MatchCategory; // 'best_match' | 'nearby_match' | 'expanded_match'
  isExactLocality: boolean;
  isNearbyLocality: boolean;
  isSameCity: boolean;
  budgetDiffPercentage?: number;
}

export interface LeadMatchResult {
  lead: Lead;
  score: number; // 0 to 100
  matchReasons: string[];
  matchCategory?: MatchCategory;
  isExactLocality?: boolean;
  isSameCity?: boolean;
}

export interface WhatsAppTemplate {
  id: string;
  title: string;
  category: 'Test Presets' | 'Greeting' | 'Site Visit' | 'Brochure' | 'Follow-up' | 'Offer' | 'Hindi' | 'Hinglish';
  getMessage: (lead?: any, agentName?: string, agencyName?: string) => string;
}

export interface PhoneContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
}
