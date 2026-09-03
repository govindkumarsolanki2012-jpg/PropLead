import { Lead, UserProfile, Property } from '../types';

export const INITIAL_USER_PROFILE: UserProfile = {
  id: '',
  name: '',
  agencyName: '',
  phone: '',
  email: '',
  city: '',
  reraNumber: '',
  isTrialActive: true,
  trialStartDate: new Date().toISOString(),
  trialDaysRemaining: 30,
  isSubscribed: false,
  subscriptionPlan: undefined,
  language: 'en',
  darkMode: false,
  notificationsEnabled: true,
  hasCompletedOnboarding: false,
  isOnboarded: false,
};

export const INITIAL_LEADS: Lead[] = [];

export const INITIAL_PROPERTIES: Property[] = [];
