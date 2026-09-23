import { Lead, UserProfile, Property } from '../types';

export const INITIAL_USER_PROFILE: UserProfile = {
  id: '',
  name: '',
  agencyName: '',
  phone: '',
  email: '',
  city: '',
  reraNumber: '',
  isTrialActive: false,
  trialStatus: 'not_started',
  trialStartDate: null,
  trialEndDate: null,
  trialEverStarted: false,
  trialDaysRemaining: 0,
  subscriptionStatus: 'NOT_STARTED',
  isSubscribed: false,
  subscriptionPlan: undefined,
  language: 'en',
  notificationsEnabled: true,
  onboardingCompleted: false,
  hasCompletedOnboarding: false,
  isOnboarded: false,
};

export const INITIAL_LEADS: Lead[] = [];

export const INITIAL_PROPERTIES: Property[] = [];
