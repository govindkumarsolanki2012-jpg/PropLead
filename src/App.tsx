import React, { useState, useEffect, useCallback, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { MobileFrame } from './components/layout/MobileFrame';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { AuthFlow } from './components/auth/AuthFlow';
import { Dashboard } from './components/dashboard/Dashboard';
import { LeadsList } from './components/leads/LeadsList';
import { PropertiesList } from './components/properties/PropertiesList';
import { CalendarView } from './components/calendar/CalendarView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { SettingsView } from './components/settings/SettingsView';
import { SplashScreen } from './components/common/SplashScreen';
import { AnimatePresence } from 'motion/react';

// Modals
import { QuickAddLeadModal } from './components/leads/QuickAddLeadModal';
import { WhatsAppModal } from './components/common/WhatsAppModal';
import { ScheduleFollowUpModal } from './components/common/ScheduleFollowUpModal';
import { LeadDetailModal } from './components/leads/LeadDetailModal';
import { EditLeadModal } from './components/leads/EditLeadModal';
import { SubscriptionModal } from './components/subscription/SubscriptionModal';
import { ImportContactsModal } from './components/leads/ImportContactsModal';
import { FeatureLockedModal } from './components/common/FeatureLockedModal';

// Property Modals
import { AddPropertyModal } from './components/properties/AddPropertyModal';
import { EditPropertyModal } from './components/properties/EditPropertyModal';
import { PropertyDetailModal } from './components/properties/PropertyDetailModal';
import { SharePropertyModal } from './components/properties/SharePropertyModal';

// Storage & Types
import {
  getStoredProfile,
  saveStoredProfile,
  getStoredLeads,
  saveStoredLeads,
  getStoredProperties,
  saveStoredProperties,
  getStoredTemplates,
  saveStoredTemplates,
  clearAllData,
} from './utils/storage';
import { Lead, Property, UserProfile, WhatsAppTemplate, FollowUpType, TabType } from './types';
import { INITIAL_USER_PROFILE } from './data/initialData';
import { formatRelativeDate, normalizePhoneForMatch } from './utils/formatters';
import { getEffectiveSubscriptionStatus, setAuthoritativeServerTime } from './utils/billing';
import {
  subscribeToAuth,
  signInWithGoogle,
  signOutUser,
  initSocialLogin,
  subscribeUserProfile,
  subscribeLeadsFromFirestore,
  subscribePropertiesFromFirestore,
  addLeadToFirestore,
  updateLeadInFirestore,
  deleteLeadFromFirestore,
  batchAddLeadsToFirestore,
  addPropertyToFirestore,
  updatePropertyInFirestore,
  deletePropertyFromFirestore,
  saveUserProfile,
} from './services/firebaseService';
import { syncLocalDataToFirestore } from './utils/migration';
import { FirebaseUser } from './lib/firebase';

export function App() {
  // Launch Splash and Firebase Authentication coordination
  // Display the PropLead logo and app name for ~1 second while checking Firebase auth state concurrently
  const [isSplashTimerActive, setIsSplashTimerActive] = useState<boolean>(true);
  const [isAuthResolved, setIsAuthResolved] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  // 1-second splash timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplashTimerActive(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Safety fallback for offline / extreme latency
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setIsAuthResolved((prev) => (prev ? prev : true));
    }, 4000);
    return () => clearTimeout(safetyTimer);
  }, []);

  // Pre-warm native Android Google authentication on startup
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      initSocialLogin().catch((e) => console.debug('Native Google Auth init:', e));
    }
  }, []);

  const isSplashVisible = isSplashTimerActive || !isAuthResolved;
  const [profile, setProfile] = useState<UserProfile>(getStoredProfile());
  const [leads, setLeads] = useState<Lead[]>(getStoredLeads());
  const [properties, setProperties] = useState<Property[]>(getStoredProperties());
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(getStoredTemplates());
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);

  // Tab navigation state & history (Dashboard/home is root)
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [tabHistory, setTabHistory] = useState<TabType[]>(['home']);
  const [leadsFilter, setLeadsFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [propertySearchQuery, setPropertySearchQuery] = useState<string>('');
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState<string>('');

  const handleTabChange = useCallback((newTab: TabType) => {
    setCurrentTab(newTab);
    setTabHistory((prev) => {
      if (newTab === 'home') {
        // Navigating to home resets the history stack so Dashboard is the root
        return ['home'];
      }
      if (prev[prev.length - 1] === newTab) {
        return prev;
      }
      return [...prev, newTab];
    });
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    if (currentTab === 'home') {
      setDashboardSearchQuery(query);
      return;
    }
    if (currentTab === 'properties') {
      setPropertySearchQuery(query);
      return;
    }
    setSearchQuery(query);
  }, [currentTab]);

  const handleSearchFocus = useCallback(() => {
    // When the user taps the search bar on Dashboard or any tab, do NOT automatically navigate away
  }, []);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const savedTheme = localStorage.getItem('proplead_theme_v1');
      if (savedTheme === 'dark') return true;
      if (savedTheme === 'light') return false;
      const initialProfile = getStoredProfile();
      if (typeof initialProfile.darkMode === 'boolean') {
        return initialProfile.darkMode;
      }
    } catch (e) {
      // Fallback to system preference
    }
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Modal states for Leads
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [whatsAppLead, setWhatsAppLead] = useState<Lead | null>(null);
  const [scheduleLead, setScheduleLead] = useState<Lead | null>(null);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState<boolean>(false);
  const [isImportContactsOpen, setIsImportContactsOpen] = useState<boolean>(false);
  const [isFeatureLockedOpen, setIsFeatureLockedOpen] = useState<boolean>(false);
  const [lockedFeatureName, setLockedFeatureName] = useState<string>('');

  // Modal states for Properties
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState<boolean>(false);
  const [detailProperty, setDetailProperty] = useState<Property | null>(null);
  const [editProperty, setEditProperty] = useState<Property | null>(null);
  const [sharePropertyData, setSharePropertyData] = useState<{
    property: Property;
    preselectedLead?: Lead | null;
  } | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const showToast = useCallback((msg: string, isError = false) => {
    setToastMessage({ text: msg, isError });
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  useEffect(() => {
    const handleToastEvent = (e: any) => {
      if (e?.detail?.message) {
        showToast(e.detail.message, Boolean(e.detail.isError));
      } else if (typeof e?.detail === 'string') {
        showToast(e.detail);
      }
    };
    window.addEventListener('proplead:show-toast', handleToastEvent);
    return () => window.removeEventListener('proplead:show-toast', handleToastEvent);
  }, [showToast]);

  // Fresh references ref for the single back button listener
  const appStateRef = useRef({
    isSplashVisible,
    currentUser,
    currentTab,
    tabHistory,
    isQuickAddOpen,
    detailLead,
    whatsAppLead,
    scheduleLead,
    editLead,
    isSubscriptionOpen,
    isImportContactsOpen,
    isFeatureLockedOpen,
    isAddPropertyOpen,
    detailProperty,
    editProperty,
    sharePropertyData,
  });

  useEffect(() => {
    appStateRef.current = {
      isSplashVisible,
      currentUser,
      currentTab,
      tabHistory,
      isQuickAddOpen,
      detailLead,
      whatsAppLead,
      scheduleLead,
      editLead,
      isSubscriptionOpen,
      isImportContactsOpen,
      isFeatureLockedOpen,
      isAddPropertyOpen,
      detailProperty,
      editProperty,
      sharePropertyData,
    };
  });

  // Central Android Back Button handler
  const handleBack = useCallback(() => {
    const s = appStateRef.current;

    // If during launch splash or not authenticated, back exits the app
    if (s.isSplashVisible || !s.currentUser) {
      if (Capacitor.isNativePlatform()) {
        CapApp.exitApp();
      } else {
        try {
          CapApp.exitApp();
        } catch (e) {
          // safe fallback
        }
        showToast('Exiting PropLead...');
      }
      return;
    }

    // 1. Open modal -> Android Back -> close the modal first (topmost/nested child modals first)
    if (s.editLead) {
      setEditLead(null);
      return;
    }
    if (s.editProperty) {
      setEditProperty(null);
      return;
    }
    if (s.sharePropertyData) {
      setSharePropertyData(null);
      return;
    }
    if (s.whatsAppLead) {
      setWhatsAppLead(null);
      return;
    }
    if (s.scheduleLead) {
      setScheduleLead(null);
      return;
    }
    if (s.isSubscriptionOpen && s.isFeatureLockedOpen) {
      setIsSubscriptionOpen(false);
      return;
    }
    if (s.isQuickAddOpen) {
      setIsQuickAddOpen(false);
      return;
    }
    if (s.isAddPropertyOpen) {
      setIsAddPropertyOpen(false);
      return;
    }
    if (s.isImportContactsOpen) {
      setIsImportContactsOpen(false);
      return;
    }
    if (s.isSubscriptionOpen) {
      setIsSubscriptionOpen(false);
      return;
    }
    if (s.isFeatureLockedOpen) {
      setIsFeatureLockedOpen(false);
      return;
    }
    if (s.detailLead) {
      setDetailLead(null);
      return;
    }
    if (s.detailProperty) {
      setDetailProperty(null);
      return;
    }

    // 2. Nested screen -> Android Back -> return to previous screen
    if (s.tabHistory.length > 1) {
      const newHistory = s.tabHistory.slice(0, -1);
      const previousTab = newHistory[newHistory.length - 1] || 'home';
      setTabHistory(newHistory);
      setCurrentTab(previousTab);
      return;
    }

    // 3. If currently on a non-home tab but stack is 1 or empty -> return to Dashboard
    if (s.currentTab !== 'home') {
      setTabHistory(['home']);
      setCurrentTab('home');
      return;
    }

    // 4. Press Back again on Dashboard/root -> exit the app
    if (Capacitor.isNativePlatform()) {
      CapApp.exitApp();
    } else {
      try {
        CapApp.exitApp();
      } catch (e) {
        // safe fallback
      }
      showToast('Exiting PropLead...');
    }
  }, [showToast]);

  const lastBackTimeRef = useRef<number>(0);

  const triggerBack = useCallback(() => {
    const now = Date.now();
    // 250ms throttle prevents rapid duplicate firings from same physical press
    if (now - lastBackTimeRef.current < 250) {
      return;
    }
    lastBackTimeRef.current = now;
    handleBack();
  }, [handleBack]);

  // Single Capacitor and hardware/keyboard back-button listener
  useEffect(() => {
    let listenerHandle: PluginListenerHandle | null = null;
    let isCleanedUp = false;

    // 1. Capacitor native Android backButton listener
    CapApp.addListener('backButton', () => {
      triggerBack();
    })
      .then((handle) => {
        if (isCleanedUp) {
          handle.remove();
        } else {
          listenerHandle = handle;
        }
      })
      .catch((err) => {
        console.warn('Capacitor backButton listener unavailable:', err);
      });

    // 2. Desktop keyboard Escape listener for testing and preview
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        triggerBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isCleanedUp = true;
      if (listenerHandle) {
        listenerHandle.remove();
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [triggerBack]);

  // 1. Firebase Auth listener and Firestore real-time synchronization
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubLeads: (() => void) | null = null;
    let unsubProps: (() => void) | null = null;

    const unsubAuth = subscribeToAuth(async (user) => {
      setCurrentUser(user);
      setIsAuthResolved(true);

      if (user) {
        setIsCloudSynced(true);
        // Safely migrate/initialize user data in Firestore with user phone
        await syncLocalDataToFirestore(user.uid, user.email, user.displayName, user.phoneNumber);

        // Subscribe to real-time user profile in Firestore
        unsubProfile = subscribeUserProfile(user.uid, (firestoreProfile) => {
          if (firestoreProfile) {
            setProfile((prev) => {
              let effectiveTrialEndDate = firestoreProfile.trialEndDate || prev.trialEndDate;
              const effectiveTrialStartDate = firestoreProfile.trialStartDate || prev.trialStartDate;
              if (effectiveTrialStartDate && effectiveTrialEndDate) {
                const sTime = new Date(effectiveTrialStartDate).getTime();
                const eTime = new Date(effectiveTrialEndDate).getTime();
                if (!isNaN(sTime) && !isNaN(eTime) && eTime > sTime + 7 * 86400000) {
                  effectiveTrialEndDate = new Date(sTime + 7 * 86400000).toISOString();
                }
              }

              const merged: UserProfile = {
                ...prev,
                ...firestoreProfile,
                trialEndDate: effectiveTrialEndDate,
                trialStartDate: effectiveTrialStartDate,
                isOnboarded: true,
              };
              saveStoredProfile(merged);
              return merged;
            });
          }
        });

        // Subscribe to real-time leads in Firestore
        unsubLeads = subscribeLeadsFromFirestore(user.uid, (firestoreLeads) => {
          if (firestoreLeads) {
            setLeads(firestoreLeads);
            saveStoredLeads(firestoreLeads);
          }
        });

        // Subscribe to real-time properties in Firestore
        unsubProps = subscribePropertiesFromFirestore(user.uid, (firestoreProps) => {
          if (firestoreProps) {
            setProperties(firestoreProps);
            saveStoredProperties(firestoreProps);
          }
        });
      } else {
        setIsCloudSynced(false);
        // Reset in-memory sensitive data when not authenticated
        setLeads([]);
        setProperties([]);
        setProfile(INITIAL_USER_PROFILE);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubLeads) unsubLeads();
      if (unsubProps) unsubProps();
    };
  }, []);

  // Subscription calculation
  const { isLocked, status, daysRemaining } = getEffectiveSubscriptionStatus(profile);

  // Sync with backend subscription API on startup
  useEffect(() => {
    const syncSubscription = async () => {
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdToken();
        if (!token) return;

        const res = await fetch(`/api/billing/subscription-status?userId=${currentUser.uid}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.subscriptionStatus) {
            if (data.serverTimestamp || data.serverNow) {
              setAuthoritativeServerTime(data.serverTimestamp || data.serverNow);
            }
            setProfile((prev) => {
              const updated: UserProfile = {
                ...prev,
                subscriptionStatus: data.subscriptionStatus,
                trialStartDate: data.trialStartDate ?? prev.trialStartDate,
                trialEndDate: data.trialEndDate ?? prev.trialEndDate,
                serverTimestamp: data.serverTimestamp || data.serverNow || prev.serverTimestamp,
                trialDaysRemaining: data.trialDaysRemaining ?? prev.trialDaysRemaining,
                isSubscribed: data.isSubscribed ?? prev.isSubscribed,
                subscriptionExpiryDate: data.subscriptionExpiryDate ?? prev.subscriptionExpiryDate,
                autoRenewing: data.autoRenewing ?? prev.autoRenewing,
                paymentIssueMessage: data.paymentIssueMessage,
              };
              saveStoredProfile(updated);
              return updated;
            });
          }
        }
      } catch (err) {
        console.log('Subscription sync offline or fallback to local state:', err);
      }
    };
    syncSubscription();
  }, [currentUser]);

  // Dark mode effect with local storage persistence & class syncing
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    try {
      localStorage.setItem('proplead_theme_v1', darkMode ? 'dark' : 'light');
    } catch (e) {
      // ignore
    }
  }, [darkMode]);

  const handleToggleDarkMode = (target?: boolean) => {
    const nextMode = typeof target === 'boolean' ? target : !darkMode;
    if (nextMode === darkMode) return;
    setDarkMode(nextMode);
    const updatedProfile = { ...profile, darkMode: nextMode };
    setProfile(updatedProfile);
    saveStoredProfile(updatedProfile);
    if (currentUser?.uid) {
      saveUserProfile(currentUser.uid, updatedProfile).catch((e) =>
        console.warn('Firestore update profile error:', e)
      );
    }
  };

  // Guarded actions for locked state
  const guardLockedFeature = useCallback(
    (featureName: string, action: () => void) => {
      if (isLocked) {
        setLockedFeatureName(featureName);
        setIsFeatureLockedOpen(true);
      } else {
        action();
      }
    },
    [isLocked]
  );

  // Lead CRUD handlers
  const handleSaveLead = (newLead: Lead) => {
    const updated = [newLead, ...leads];
    setLeads(updated);
    saveStoredLeads(updated);
    if (currentUser?.uid) {
      addLeadToFirestore(currentUser.uid, newLead).catch((e) => console.warn('Firestore add lead error:', e));
    }
    showToast(`Lead "${newLead.name}" added successfully! 🚀`);
  };

  const handleUpdateLead = (updatedLead: Lead) => {
    const updated = leads.map((l) => (l.id === updatedLead.id ? updatedLead : l));
    setLeads(updated);
    saveStoredLeads(updated);
    if (currentUser?.uid) {
      updateLeadInFirestore(currentUser.uid, updatedLead).catch((e) => console.warn('Firestore update lead error:', e));
    }
    if (detailLead && detailLead.id === updatedLead.id) {
      setDetailLead(updatedLead);
    }
    showToast('Lead details updated.');
  };

  const handleDeleteLead = async (leadId: string): Promise<void> => {
    if (currentUser?.uid) {
      await deleteLeadFromFirestore(currentUser.uid, leadId);
    }
    const updated = leads.filter((l) => l.id !== leadId);
    setLeads(updated);
    saveStoredLeads(updated);
    if (detailLead && detailLead.id === leadId) {
      setDetailLead(null);
    }
    showToast('Lead deleted.');
  };

  const handleImportBulkLeads = (newLeads: Lead[]) => {
    const existingPhones = new Set(
      leads.map((l) => normalizePhoneForMatch(l.phone)).filter(Boolean)
    );
    const existingNames = new Set(
      leads.map((l) => l.name.trim().toLowerCase()).filter(Boolean)
    );

    const nonDuplicates = newLeads.filter((nl) => {
      const normPhone = normalizePhoneForMatch(nl.phone);
      if (normPhone && existingPhones.has(normPhone)) {
        return false;
      }
      if (!normPhone && nl.name && existingNames.has(nl.name.trim().toLowerCase())) {
        return false;
      }
      return true;
    });

    if (nonDuplicates.length === 0) {
      showToast('All selected contacts are already in your leads list.');
      return;
    }

    const updated = [...nonDuplicates, ...leads];
    setLeads(updated);
    saveStoredLeads(updated);
    if (currentUser?.uid) {
      batchAddLeadsToFirestore(currentUser.uid, nonDuplicates).catch((e) => console.warn('Firestore batch leads error:', e));
    }
    const skipped = newLeads.length - nonDuplicates.length;
    if (skipped > 0) {
      showToast(`Imported ${nonDuplicates.length} leads (${skipped} duplicate${skipped === 1 ? '' : 's'} skipped).`);
    } else {
      showToast(`Imported ${nonDuplicates.length} leads successfully! 👏`);
    }
  };

  // Property CRUD handlers
  const handleSaveProperty = async (newProperty: Property) => {
    try {
      if (currentUser?.uid) {
        await addPropertyToFirestore(currentUser.uid, newProperty);
      }
      const updated = [newProperty, ...properties];
      setProperties(updated);
      saveStoredProperties(updated);
      showToast(`Property "${newProperty.title}" added to inventory! 🏠`);
      return true;
    } catch (err: any) {
      console.error('Firestore add property error:', err);
      const updated = [newProperty, ...properties];
      setProperties(updated);
      saveStoredProperties(updated);
      showToast(`Property "${newProperty.title}" saved locally.`);
      return true;
    }
  };

  const handleUpdateProperty = async (updatedProperty: Property) => {
    try {
      if (currentUser?.uid) {
        await updatePropertyInFirestore(currentUser.uid, updatedProperty);
      }
      const updated = properties.map((p) => (p.id === updatedProperty.id ? updatedProperty : p));
      setProperties(updated);
      saveStoredProperties(updated);
      if (detailProperty && detailProperty.id === updatedProperty.id) {
        setDetailProperty(updatedProperty);
      }
      showToast('Property details updated.');
      return true;
    } catch (err: any) {
      console.error('Firestore update property error:', err);
      const updated = properties.map((p) => (p.id === updatedProperty.id ? updatedProperty : p));
      setProperties(updated);
      saveStoredProperties(updated);
      if (detailProperty && detailProperty.id === updatedProperty.id) {
        setDetailProperty(updatedProperty);
      }
      showToast('Property details updated locally.');
      return true;
    }
  };

  const handleDeleteProperty = async (propertyId: string) => {
    try {
      if (currentUser?.uid) {
        await deletePropertyFromFirestore(currentUser.uid, propertyId);
      }
      const updated = properties.filter((p) => p.id !== propertyId);
      setProperties(updated);
      saveStoredProperties(updated);
      if (detailProperty && detailProperty.id === propertyId) {
        setDetailProperty(null);
      }
      showToast('Property removed from inventory.');
      return true;
    } catch (err: any) {
      console.error('Firestore delete property error:', err);
      const updated = properties.filter((p) => p.id !== propertyId);
      setProperties(updated);
      saveStoredProperties(updated);
      if (detailProperty && detailProperty.id === propertyId) {
        setDetailProperty(null);
      }
      showToast('Property removed locally.');
      return true;
    }
  };

  const handleScheduleFollowUp = (
    leadId: string,
    date: string,
    time: string,
    type: FollowUpType,
    note: string
  ) => {
    const target =
      (detailLead && detailLead.id === leadId ? detailLead : null) ||
      (scheduleLead && scheduleLead.id === leadId ? scheduleLead : null) ||
      leads.find((l) => l.id === leadId);
    if (!target) return;

    const activity = {
      id: `act_${Date.now()}`,
      leadId,
      type: (type === 'site_visit' ? 'site_visit' : 'followup_scheduled') as any,
      title: `Follow-Up Scheduled (${date} at ${time})`,
      description: note || `Scheduled ${type} reminder`,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };

    const updatedLead: Lead = {
      ...target,
      nextFollowUpDate: date,
      nextFollowUpTime: time,
      nextFollowUpNote: note,
      status: type === 'site_visit' ? 'site_visit_scheduled' : target.status,
      activities: [activity, ...(target.activities || [])],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    handleUpdateLead(updatedLead);
    showToast(`Reminder set for ${target.name} on ${date}! ⏰`);
  };

  const handleUpdateProfile = (updates: Partial<UserProfile>) => {
    const updated = { ...profile, ...updates };
    setProfile(updated);
    saveStoredProfile(updated);
    if (currentUser?.uid) {
      saveUserProfile(currentUser.uid, updated).catch((e) => console.warn('Firestore update profile error:', e));
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const user = await signInWithGoogle();
      if (user) {
        showToast(`Connected as ${user.displayName || user.email}! ☁️`);
      }
    } catch (err: any) {
      console.error('[App] Google sign-in failed:', err);
      const msg = err?.message || String(err || '');
      const isCancelled =
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'USER_CANCELLED' ||
        msg.toLowerCase().includes('user cancelled') ||
        msg.toLowerCase().includes('user canceled');

      if (!isCancelled) {
        showToast(err?.message || 'Sign-in failed. Please try again.');
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setCurrentUser(null);
      setIsCloudSynced(false);
      setLeads([]);
      setProperties([]);
      setProfile(INITIAL_USER_PROFILE);
      setCurrentTab('home');
      setTabHistory(['home']);
      clearAllData();
      showToast('Logged out successfully. Cloud data preserved! 🔒');
    } catch (err) {
      console.error('Sign-out error:', err);
      showToast('Failed to log out. Please try again.');
    }
  };

  // Check today and overdue follow-up counts for bottom nav badge
  const todayCount = leads.filter((l) => formatRelativeDate(l.nextFollowUpDate).isToday).length;

  return (
    <MobileFrame darkMode={darkMode}>
      {/* Launch Splash Screen with subtle fade-out transition */}
      <AnimatePresence>
        {isSplashVisible && <SplashScreen key="app-launch-splash" />}
      </AnimatePresence>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2 text-white rounded-full text-xs font-bold shadow-xl border animate-bounce ${
            toastMessage.isError
              ? 'bg-rose-600 border-rose-700'
              : 'bg-slate-900 dark:bg-emerald-600 border-slate-700 dark:border-emerald-500'
          }`}
          style={{
            top: 'calc(4.5rem + max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px)))',
          }}
        >
          {toastMessage.text}
        </div>
      )}

      {!currentUser ? (
        <AuthFlow />
      ) : (
        <div className="flex-1 flex flex-col min-h-screen bg-slate-100/70 dark:bg-slate-950 w-full max-w-full overflow-x-clip">
          {/* Header */}
          <Header
            profile={profile}
            currentTab={currentTab}
            searchQuery={
              currentTab === 'home'
                ? dashboardSearchQuery
                : currentTab === 'properties'
                ? propertySearchQuery
                : searchQuery
            }
            onSearchChange={handleSearchChange}
            onSearchFocus={handleSearchFocus}
            onOpenQuickAdd={() => {
              if (currentTab === 'properties') {
                guardLockedFeature('Add Property', () => setIsAddPropertyOpen(true));
              } else {
                guardLockedFeature('Add Lead', () => setIsQuickAddOpen(true));
              }
            }}
            onOpenSubscription={() => setIsSubscriptionOpen(true)}
          />

          {/* Main Tab Views */}
          {currentTab === 'home' && (
            <Dashboard
              leads={leads}
              properties={properties}
              profile={profile}
              searchQuery={dashboardSearchQuery}
              onClearSearch={() => setDashboardSearchQuery('')}
              onOpenQuickAdd={() => guardLockedFeature('Add Lead', () => setIsQuickAddOpen(true))}
              onOpenLeadDetail={(l) => setDetailLead(l)}
              onOpenPropertyDetail={(p) => setDetailProperty(p)}
              onOpenWhatsApp={(l) => setWhatsAppLead(l)}
              onOpenSchedule={(l) => guardLockedFeature('Schedule Follow-Up', () => setScheduleLead(l))}
              onOpenSubscription={() => setIsSubscriptionOpen(true)}
              onNavigateToLeadsWithFilter={(filter) => {
                setLeadsFilter(filter);
                setSearchQuery('');
                handleTabChange('leads');
              }}
              onNavigateToTab={(tab) => handleTabChange(tab)}
              onOpenImportContacts={() => guardLockedFeature('Import Contacts', () => setIsImportContactsOpen(true))}
            />
          )}

          {currentTab === 'leads' && (
            <LeadsList
              leads={leads}
              profile={profile}
              initialFilter={leadsFilter}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onOpenQuickAdd={() => guardLockedFeature('Add Lead', () => setIsQuickAddOpen(true))}
              onOpenLeadDetail={(l) => setDetailLead(l)}
              onOpenWhatsApp={(l) => setWhatsAppLead(l)}
              onOpenSchedule={(l) => guardLockedFeature('Schedule Follow-Up', () => setScheduleLead(l))}
            />
          )}

          {currentTab === 'properties' && (
            <PropertiesList
              properties={properties}
              leads={leads}
              profile={profile}
              searchQuery={propertySearchQuery}
              onSearchChange={setPropertySearchQuery}
              onOpenAddProperty={() => guardLockedFeature('Add Property', () => setIsAddPropertyOpen(true))}
              onOpenPropertyDetail={(prop) => setDetailProperty(prop)}
              onOpenShareModal={(prop, preselectedLead) =>
                setSharePropertyData({ property: prop, preselectedLead })
              }
            />
          )}

          {currentTab === 'calendar' && (
            <CalendarView
              leads={leads}
              onOpenLeadDetail={(l) => setDetailLead(l)}
              onOpenWhatsApp={(l) => setWhatsAppLead(l)}
              onOpenSchedule={(l) => guardLockedFeature('Schedule Follow-Up', () => setScheduleLead(l))}
              onOpenQuickAdd={() => guardLockedFeature('Add Lead', () => setIsQuickAddOpen(true))}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsView leads={leads} profile={profile} />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              profile={profile}
              leads={leads}
              templates={templates}
              darkMode={darkMode}
              currentUserEmail={currentUser?.email || currentUser?.displayName}
              isCloudSynced={isCloudSynced}
              onGoogleSignIn={handleGoogleSignIn}
              onSignOut={handleSignOut}
              onToggleDarkMode={handleToggleDarkMode}
              onUpdateProfile={(p) => {
                setProfile(p);
                saveStoredProfile(p);
                if (currentUser?.uid) {
                  saveUserProfile(currentUser.uid, p).catch((e) => console.warn('Firestore update profile error:', e));
                }
              }}
              onUpdateTemplates={(t) => {
                setTemplates(t);
                saveStoredTemplates(t);
              }}
              onOpenSubscription={() => setIsSubscriptionOpen(true)}
            />
          )}

          {/* Bottom Navigation */}
          <BottomNav
            currentTab={currentTab}
            onTabChange={(tab) => {
              if (tab === 'leads') {
                setLeadsFilter('all');
              }
              handleTabChange(tab);
            }}
            onChangeTab={(tab) => {
              if (tab === 'leads') {
                setLeadsFilter('all');
              }
              handleTabChange(tab);
            }}
            onOpenQuickAdd={() => guardLockedFeature('Add Lead', () => setIsQuickAddOpen(true))}
            todayFollowUpCount={todayCount}
            leadCount={leads.length}
            propertyCount={properties.length}
          />
        </div>
      )}

      {/* LEAD MODALS */}
      {/* 1. Quick Add Lead Modal (10s capture) */}
      {isQuickAddOpen && (
        <QuickAddLeadModal
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          onSaveLead={handleSaveLead}
          profile={profile}
          onOpenSubscription={() => setIsSubscriptionOpen(true)}
        />
      )}

      {/* 2. Lead Detail Modal */}
      {detailLead && (
        <LeadDetailModal
          isOpen={Boolean(detailLead)}
          onClose={() => setDetailLead(null)}
          lead={detailLead}
          profile={profile}
          properties={properties}
          onUpdateLead={handleUpdateLead}
          onDeleteLead={handleDeleteLead}
          onOpenWhatsApp={(l) => setWhatsAppLead(l)}
          onOpenSchedule={(l) => setScheduleLead(l)}
          onOpenEdit={(l) => guardLockedFeature('Edit Lead', () => setEditLead(l))}
          onSharePropertyWithLead={(prop, lead) =>
            setSharePropertyData({ property: prop, preselectedLead: lead })
          }
        />
      )}

      {/* 3. Schedule Follow-Up Modal - Rendered after LeadDetailModal with z-[60] */}
      {scheduleLead && (
        <ScheduleFollowUpModal
          isOpen={Boolean(scheduleLead)}
          onClose={() => setScheduleLead(null)}
          lead={scheduleLead}
          onSchedule={handleScheduleFollowUp}
          onSaveFollowUp={handleScheduleFollowUp}
        />
      )}

      {/* 4. WhatsApp Modal (1-tap templates) */}
      {whatsAppLead && (
        <WhatsAppModal
          isOpen={Boolean(whatsAppLead)}
          onClose={() => setWhatsAppLead(null)}
          lead={whatsAppLead}
          profile={profile}
          templates={templates}
        />
      )}

      {/* 5. Edit Lead Modal */}
      {editLead && (
        <EditLeadModal
          isOpen={Boolean(editLead)}
          onClose={() => setEditLead(null)}
          lead={editLead}
          onSave={handleUpdateLead}
        />
      )}

      {/* PROPERTY MODALS */}
      {/* 1. Add Property Modal */}
      {isAddPropertyOpen && (
        <AddPropertyModal
          isOpen={isAddPropertyOpen}
          onClose={() => setIsAddPropertyOpen(false)}
          onSaveProperty={handleSaveProperty}
          profile={profile}
        />
      )}

      {/* 2. Edit Property Modal */}
      {editProperty && (
        <EditPropertyModal
          key={editProperty.id}
          isOpen={Boolean(editProperty)}
          onClose={() => setEditProperty(null)}
          property={editProperty}
          onSaveProperty={handleUpdateProperty}
          onSave={handleUpdateProperty}
        />
      )}

      {/* 3. Property Detail Modal */}
      {detailProperty && (
        <PropertyDetailModal
          isOpen={Boolean(detailProperty)}
          onClose={() => setDetailProperty(null)}
          property={detailProperty}
          leads={leads}
          profile={profile}
          onUpdateProperty={handleUpdateProperty}
          onDeleteProperty={handleDeleteProperty}
          onOpenEditModal={(prop) => guardLockedFeature('Edit Property', () => setEditProperty(prop))}
          onOpenEdit={(prop) => guardLockedFeature('Edit Property', () => setEditProperty(prop))}
          onOpenShareModal={(prop, lead) =>
            setSharePropertyData({ property: prop, preselectedLead: lead })
          }
          onShareToLead={(prop, lead) =>
            setSharePropertyData({ property: prop, preselectedLead: lead })
          }
        />
      )}

      {/* 4. Customer-Safe WhatsApp Share Modal */}
      {sharePropertyData && (
        <SharePropertyModal
          isOpen={Boolean(sharePropertyData)}
          onClose={() => setSharePropertyData(null)}
          property={sharePropertyData.property}
          leads={leads}
          profile={profile}
          preselectedLead={sharePropertyData.preselectedLead}
        />
      )}

      {/* Subscription / Upgrade Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionOpen}
        onClose={() => setIsSubscriptionOpen(false)}
        profile={profile}
        onUpdateProfile={handleUpdateProfile}
        onSubscribe={() => {
          showToast('PropLead Pro subscription active! 🏆');
        }}
      />

      {/* Feature Locked Modal when Free Trial Expired */}
      <FeatureLockedModal
        isOpen={isFeatureLockedOpen}
        onClose={() => setIsFeatureLockedOpen(false)}
        onSubscribe={() => setIsSubscriptionOpen(true)}
        featureName={lockedFeatureName}
      />

      {/* Import Contacts Modal */}
      <ImportContactsModal
        isOpen={isImportContactsOpen}
        onClose={() => setIsImportContactsOpen(false)}
        existingLeads={leads}
        onImportLeads={handleImportBulkLeads}
      />
    </MobileFrame>
  );
}

export default App;
