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
import { BellRing, X, ArrowRight } from 'lucide-react';

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
import { getEffectiveSubscriptionStatus, hasProAccess, setAuthoritativeServerTime, getBillingApiUrl, checkAndRestoreGooglePlayEntitlement } from './utils/billing';
import {
  subscribeToAuth,
  signInWithGoogle,
  signOutUser,
  initSocialLogin,
  getCurrentUser,
  subscribeUserProfile,
  subscribeSubscriptionRecordFromFirestore,
  subscribeLeadsFromFirestore,
  subscribePropertiesFromFirestore,
  addLeadToFirestore,
  updateLeadInFirestore,
  deleteLeadFromFirestore,
  batchDeleteLeadsFromFirestore,
  batchAddLeadsToFirestore,
  addPropertyToFirestore,
  updatePropertyInFirestore,
  deletePropertyFromFirestore,
  batchDeletePropertiesFromFirestore,
  saveUserProfile,
} from './services/firebaseService';
import { syncLocalDataToFirestore } from './utils/migration';
import { FirebaseUser } from './lib/firebase';
import {
  initLocalNotifications,
  scheduleFollowUpNotifications,
  cancelNotificationsForLead,
  scheduleDailySummaryNotification,
  syncAllLeadNotifications,
  requestNotificationPermission,
  wasNotificationPermissionPrompted,
  SAMPLE_DEMO_LEAD,
  triggerNotificationAction,
} from './utils/notifications';

const checkHasActiveSession = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    if (localStorage.getItem('proplead_is_logged_in_v1') === 'true') return true;
    const raw = localStorage.getItem('proplead_profile_v1');
    if (raw) {
      const p = JSON.parse(raw);
      if (p && (p.isOnboarded || p.email || (p.id && p.id !== 'usr_001'))) {
        return true;
      }
    }
  } catch {}
  return false;
};

export function App() {
  // WhatsApp / YouTube style clean 1.5-second smooth splash screen
  const [isSplashActive, setIsSplashActive] = useState<boolean>(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplashActive(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Firebase Authentication coordination
  const [isAuthResolved, setIsAuthResolved] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(() => getCurrentUser());

  // Developer sample notification heads-up banner for in-browser / preview test verification
  const [sampleNotificationBanner, setSampleNotificationBanner] = useState<{
    id: number;
    title: string;
    body: string;
    extra: any;
  } | null>(null);

  useEffect(() => {
    const handleSampleNotificationFired = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setSampleNotificationBanner(customEvent.detail);
      }
    };
    window.addEventListener('proplead_sample_notification_fired', handleSampleNotificationFired);
    return () => {
      window.removeEventListener('proplead_sample_notification_fired', handleSampleNotificationFired);
    };
  }, []);

  // Safety fallback for offline / extreme latency
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setIsAuthResolved((prev) => (prev ? prev : true));
    }, 4000);
    return () => clearTimeout(safetyTimer);
  }, []);

  // Pre-initialize native Google Credential Manager on Android startup
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      initSocialLogin().catch((err) => console.debug('[GoogleAuth] Pre-init error:', err));
    }
  }, []);

  const isUserAuthenticated = Boolean(currentUser) || (!isAuthResolved && checkHasActiveSession());
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
    currentUser,
    isUserAuthenticated,
    isSplashActive,
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
      currentUser,
      isUserAuthenticated,
      isSplashActive,
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

    // If during splash or not authenticated, back exits the app
    if (s.isSplashActive || !s.isUserAuthenticated) {
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
    let unsubSubscription: (() => void) | null = null;
    let unsubLeads: (() => void) | null = null;
    let unsubProps: (() => void) | null = null;

    const unsubAuth = subscribeToAuth(async (user) => {
      setCurrentUser(user);
      setIsAuthResolved(true);

      if (user) {
        try {
          localStorage.setItem('proplead_is_logged_in_v1', 'true');
        } catch {}
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
                subscriptionStatus: firestoreProfile.subscriptionStatus || prev.subscriptionStatus,
                isSubscribed: firestoreProfile.isSubscribed !== undefined ? firestoreProfile.isSubscribed : prev.isSubscribed,
                subscriptionProductId: firestoreProfile.subscriptionProductId || prev.subscriptionProductId,
                subscriptionBasePlan: firestoreProfile.subscriptionBasePlan || prev.subscriptionBasePlan,
                subscriptionBasePlanId: firestoreProfile.subscriptionBasePlanId || prev.subscriptionBasePlanId,
                subscriptionExpiryDate: firestoreProfile.subscriptionExpiryDate || prev.subscriptionExpiryDate,
                subscriptionExpiryTime: firestoreProfile.subscriptionExpiryTime || prev.subscriptionExpiryTime,
                trialEndDate: effectiveTrialEndDate,
                trialStartDate: effectiveTrialStartDate,
                isOnboarded: true,
              };
              saveStoredProfile(merged);
              return merged;
            });
          }
        });

        // Subscribe to real-time subscription entitlement record in Firestore (/subscriptions/{userId})
        unsubSubscription = subscribeSubscriptionRecordFromFirestore(user.uid, (subRecord) => {
          if (subRecord) {
            const rawSubStatus = (subRecord.subscriptionStatus || '').toLowerCase();
            const isSubActive = rawSubStatus === 'active' || rawSubStatus === 'canceled_but_active';
            const subExpiry = subRecord.subscriptionExpiryTime || subRecord.subscriptionExpiryDate || subRecord.expiryDate;
            const subExpiryMs = subExpiry ? new Date(subExpiry).getTime() : NaN;
            // A paid subscription must only be treated as unexpired when a valid expiry timestamp exists and is in the future
            const isUnexpired = Boolean(
              subExpiry && !isNaN(subExpiryMs) && subExpiryMs > Date.now()
            );

            if (isSubActive && isUnexpired) {
              setProfile((prev) => {
                const merged: UserProfile = {
                  ...prev,
                  subscriptionStatus: rawSubStatus === 'canceled_but_active' ? 'CANCELED_BUT_ACTIVE' : 'ACTIVE',
                  isSubscribed: true,
                  subscriptionProductId: subRecord.subscriptionProductId || prev.subscriptionProductId || 'property_agent_pro',
                  subscriptionBasePlan: subRecord.subscriptionBasePlanId || subRecord.subscriptionBasePlan || prev.subscriptionBasePlan || 'quarterly',
                  subscriptionBasePlanId: subRecord.subscriptionBasePlanId || prev.subscriptionBasePlanId || 'quarterly',
                  planId: subRecord.subscriptionBasePlanId || prev.planId || 'quarterly',
                  subscriptionExpiryDate: subExpiry || prev.subscriptionExpiryDate,
                  subscriptionExpiryTime: subExpiry || prev.subscriptionExpiryTime,
                  expiryDate: subExpiry || prev.expiryDate,
                  autoRenewing: subRecord.autoRenewing !== undefined ? subRecord.autoRenewing : prev.autoRenewing,
                  lastVerifiedAt: subRecord.lastVerifiedAt || prev.lastVerifiedAt,
                  purchaseToken: subRecord.purchaseToken || prev.purchaseToken,
                };
                saveStoredProfile(merged);
                return merged;
              });
            } else if (rawSubStatus === 'expired' || (isSubActive && !isUnexpired && !isNaN(subExpiryMs) && subExpiryMs <= Date.now())) {
              setProfile((prev) => {
                const merged: UserProfile = {
                  ...prev,
                  subscriptionStatus: 'EXPIRED',
                  isSubscribed: false,
                  subscriptionExpiryDate: subExpiry || prev.subscriptionExpiryDate,
                  subscriptionExpiryTime: subExpiry || prev.subscriptionExpiryTime,
                  expiryDate: subExpiry || prev.expiryDate,
                  autoRenewing: false,
                };
                saveStoredProfile(merged);
                return merged;
              });
            }
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
      if (unsubSubscription) unsubSubscription();
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

        const endpoint = getBillingApiUrl(`/api/billing/subscription-status?userId=${encodeURIComponent(currentUser.uid)}`);
        const res = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const resText = await res.text();
          let data: any = null;
          try {
            data = JSON.parse(resText);
          } catch {
            return;
          }
          if (data && data.subscriptionStatus) {
            if (data.serverTimestamp || data.serverNow) {
              setAuthoritativeServerTime(data.serverTimestamp || data.serverNow);
            }
            const rawStat = (data.subscriptionStatus || '').toUpperCase();
            const isSub = Boolean(data.isSubscribed || rawStat === 'ACTIVE' || rawStat === 'CANCELED_BUT_ACTIVE');
            const resolvedExp = data.subscriptionExpiryTime || data.subscriptionExpiryDate || data.expiryDate;

            setProfile((prev) => {
              const updated: UserProfile = {
                ...prev,
                subscriptionStatus: data.subscriptionStatus,
                trialStartDate: data.trialStartDate ?? prev.trialStartDate,
                trialEndDate: data.trialEndDate ?? prev.trialEndDate,
                serverTimestamp: data.serverTimestamp || data.serverNow || prev.serverTimestamp,
                trialDaysRemaining: data.trialDaysRemaining ?? prev.trialDaysRemaining,
                isSubscribed: isSub || prev.isSubscribed,
                subscriptionExpiryDate: resolvedExp ?? prev.subscriptionExpiryDate,
                subscriptionExpiryTime: resolvedExp ?? prev.subscriptionExpiryTime,
                expiryDate: resolvedExp ?? prev.expiryDate,
                subscriptionProductId: data.subscriptionProductId ?? prev.subscriptionProductId,
                subscriptionBasePlan: data.subscriptionBasePlanId ?? data.subscriptionBasePlan ?? prev.subscriptionBasePlan,
                subscriptionBasePlanId: data.subscriptionBasePlanId ?? prev.subscriptionBasePlanId,
                autoRenewing: data.autoRenewing ?? prev.autoRenewing,
                paymentIssueMessage: data.paymentIssueMessage,
              };
              saveStoredProfile(updated);
              return updated;
            });
          }
        }

        // On native device, check if there's an active Google Play purchase to restore
        if (Capacitor.isNativePlatform()) {
          checkAndRestoreGooglePlayEntitlement(currentUser.uid)
            .then((restoredUpdates) => {
              if (restoredUpdates) {
                setProfile((prev) => {
                  const updated: UserProfile = {
                    ...prev,
                    ...restoredUpdates,
                  };
                  saveStoredProfile(updated);
                  return updated;
                });
              }
            })
            .catch((err) => console.warn('[Startup Google Play Check Notice]:', err));
        }
      } catch (err) {
        console.log('Subscription sync offline or fallback to local state:', err);
      }
    };
    syncSubscription();
  }, [currentUser]);

  // Ensure Light Mode is permanently active and cleanup any legacy theme storage
  useEffect(() => {
    try {
      localStorage.removeItem('proplead_theme_v1');
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    } catch (e) {
      // ignore
    }
  }, []);

  // Stable reference to current leads for notification callbacks
  const leadsRef = useRef<Lead[]>(leads);
  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  // Pending notification lead ID for cold-start deep linking
  const [pendingNotificationLeadId, setPendingNotificationLeadId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('proplead_pending_lead_id') || null;
    } catch {
      return null;
    }
  });

  // Local Notifications initialization and tap deep-linking
  useEffect(() => {
    initLocalNotifications((extra) => {
      const targetId = extra.leadId || extra.visitId;
      if (targetId) {
        // Special developer / QA sample lead handler
        if (targetId === 'sample-lead') {
          setIsQuickAddOpen(false);
          setIsFeatureLockedOpen(false);
          setDetailLead(SAMPLE_DEMO_LEAD);
          setCurrentTab('leads');
          showToast(
            extra.type === 'visit'
              ? '🔔 Sample visit notification tap handled! Opened sample lead (Jyothi • Madhurawada). 🎯'
              : '🔔 Sample notification tap handled! Opened sample lead (Jyothi • 6:00 PM). 🎯'
          );
          try {
            sessionStorage.removeItem('proplead_pending_lead_id');
          } catch {}
          setPendingNotificationLeadId(null);
          return;
        }

        // 1. Try currently loaded in-memory leads
        const currentList = leadsRef.current || [];
        const inMemoryMatch = currentList.find((l) => l.id === targetId);
        if (inMemoryMatch) {
          setIsQuickAddOpen(false);
          setIsFeatureLockedOpen(false);
          setDetailLead(inMemoryMatch);
          setCurrentTab('leads');
          try {
            sessionStorage.removeItem('proplead_pending_lead_id');
          } catch {}
          setPendingNotificationLeadId(null);
          return;
        }

        // 2. Try cached stored leads from localStorage
        const storedList = getStoredLeads();
        const storedMatch = storedList.find((l) => l.id === targetId);
        if (storedMatch) {
          setIsQuickAddOpen(false);
          setIsFeatureLockedOpen(false);
          setDetailLead(storedMatch);
          setCurrentTab('leads');
          try {
            sessionStorage.removeItem('proplead_pending_lead_id');
          } catch {}
          setPendingNotificationLeadId(null);
          return;
        }

        // 3. Queue for cold start while Firestore sync completes
        try {
          sessionStorage.setItem('proplead_pending_lead_id', targetId);
        } catch {}
        setPendingNotificationLeadId(targetId);
        setCurrentTab('leads');
      } else if (extra.type === 'visit') {
        setCurrentTab('calendar');
      } else if (extra.type === 'daily_summary') {
        setCurrentTab('leads');
      }
    });

    if (Capacitor.isNativePlatform() && !wasNotificationPermissionPrompted()) {
      requestNotificationPermission().then((res) => {
        if (res.granted) {
          syncAllLeadNotifications(leadsRef.current || []);
        }
      });
    }
  }, []);

  // Deep-link: If cold-start was waiting for Firestore/state sync, open lead when leads update
  useEffect(() => {
    if (pendingNotificationLeadId && leads.length > 0) {
      const match = leads.find((l) => l.id === pendingNotificationLeadId);
      if (match) {
        setIsQuickAddOpen(false);
        setIsFeatureLockedOpen(false);
        setDetailLead(match);
        setCurrentTab('leads');
        try {
          sessionStorage.removeItem('proplead_pending_lead_id');
        } catch {}
        setPendingNotificationLeadId(null);
      }
    }
  }, [leads, pendingNotificationLeadId]);

  // Initial synchronization for notifications once leads are ready
  const hasInitialNotificationSyncRef = useRef(false);
  useEffect(() => {
    if (!hasInitialNotificationSyncRef.current && leads.length > 0) {
      hasInitialNotificationSyncRef.current = true;
      syncAllLeadNotifications(leads);
    }
  }, [leads]);

  // Guarded actions for locked state / Pro access
  const guardLockedFeature = useCallback(
    (featureName: string, action: () => void) => {
      if (!hasProAccess(profile)) {
        setLockedFeatureName(featureName);
        setIsFeatureLockedOpen(true);
      } else {
        action();
      }
    },
    [profile]
  );

  // Lead CRUD handlers
  const handleSaveLead = (newLead: Lead) => {
    const updated = [newLead, ...leads];
    setLeads(updated);
    saveStoredLeads(updated);
    if (currentUser?.uid) {
      addLeadToFirestore(currentUser.uid, newLead).catch((e) => console.warn('Firestore add lead error:', e));
    }
    if (newLead.nextFollowUpDate && newLead.nextFollowUpTime) {
      scheduleFollowUpNotifications(newLead);
    }
    scheduleDailySummaryNotification(updated);
    showToast(`Lead "${newLead.name}" added successfully! 🚀`);
  };

  const handleUpdateLead = (updatedLead: Lead) => {
    if (updatedLead.id === 'sample-lead') {
      setDetailLead(updatedLead);
      showToast('Sample lead preview updated.');
      return;
    }

    // Pro access check: If trial is expired and subscription is not active, block follow-up modifications
    if (!hasProAccess(profile)) {
      const existing = leads.find((l) => l.id === updatedLead.id);
      const followUpModified =
        existing &&
        (existing.nextFollowUpDate !== updatedLead.nextFollowUpDate ||
          existing.nextFollowUpTime !== updatedLead.nextFollowUpTime ||
          existing.nextFollowUpNote !== updatedLead.nextFollowUpNote);
      if (followUpModified) {
        setLockedFeatureName('Follow-Ups');
        setIsFeatureLockedOpen(true);
        return;
      }
    }

    const updated = leads.map((l) => (l.id === updatedLead.id ? updatedLead : l));
    setLeads(updated);
    saveStoredLeads(updated);
    if (currentUser?.uid) {
      updateLeadInFirestore(currentUser.uid, updatedLead).catch((e) => console.warn('Firestore update lead error:', e));
    }
    if (detailLead && detailLead.id === updatedLead.id) {
      setDetailLead(updatedLead);
    }

    if (updatedLead.nextFollowUpDate && updatedLead.nextFollowUpTime) {
      scheduleFollowUpNotifications(updatedLead);
    } else {
      cancelNotificationsForLead(updatedLead.id);
    }
    scheduleDailySummaryNotification(updated);

    showToast('Lead details updated.');
  };

  const handleDeleteLead = async (leadId: string): Promise<void> => {
    if (leadId === 'sample-lead') {
      setDetailLead(null);
      showToast('Sample lead closed.');
      return;
    }

    cancelNotificationsForLead(leadId);
    if (currentUser?.uid) {
      await deleteLeadFromFirestore(currentUser.uid, leadId);
    }
    const updated = leads.filter((l) => l.id !== leadId);
    setLeads(updated);
    saveStoredLeads(updated);
    scheduleDailySummaryNotification(updated);
    if (detailLead && detailLead.id === leadId) {
      setDetailLead(null);
    }
    showToast('Lead deleted.');
  };

  const handleDeleteBulkLeads = async (leadIds: string[]): Promise<void> => {
    if (!leadIds || leadIds.length === 0) return;
    for (const id of leadIds) {
      cancelNotificationsForLead(id);
    }
    if (currentUser?.uid) {
      await batchDeleteLeadsFromFirestore(currentUser.uid, leadIds);
    }
    const idSet = new Set(leadIds);
    const updated = leads.filter((l) => !idSet.has(l.id));
    setLeads(updated);
    saveStoredLeads(updated);
    scheduleDailySummaryNotification(updated);
    if (detailLead && idSet.has(detailLead.id)) {
      setDetailLead(null);
    }
    showToast(`${leadIds.length} lead${leadIds.length === 1 ? '' : 's'} deleted.`);
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

  const handleDeleteBulkProperties = async (propertyIds: string[]): Promise<void> => {
    if (!propertyIds || propertyIds.length === 0) return;
    try {
      if (currentUser?.uid) {
        await batchDeletePropertiesFromFirestore(currentUser.uid, propertyIds);
      }
      const idSet = new Set(propertyIds);
      const updated = properties.filter((p) => !idSet.has(p.id));
      setProperties(updated);
      saveStoredProperties(updated);
      if (detailProperty && idSet.has(detailProperty.id)) {
        setDetailProperty(null);
      }
      showToast(`${propertyIds.length} propert${propertyIds.length === 1 ? 'y' : 'ies'} removed from inventory.`);
    } catch (err: any) {
      console.error('Firestore batch delete properties error:', err);
      const idSet = new Set(propertyIds);
      const updated = properties.filter((p) => !idSet.has(p.id));
      setProperties(updated);
      saveStoredProperties(updated);
      if (detailProperty && idSet.has(detailProperty.id)) {
        setDetailProperty(null);
      }
      showToast(`${propertyIds.length} propert${propertyIds.length === 1 ? 'y' : 'ies'} removed locally.`);
    }
  };

  const handleOpenEditProperty = (propertyToEdit: Property) => {
    guardLockedFeature('Edit Property', () => {
      // Dismiss the Property Detail view first so two competing modal layers do not remain open
      setDetailProperty(null);
      // Immediately open the Edit Property view as the active foreground view
      setEditProperty(propertyToEdit);
    });
  };

  const handleScheduleFollowUp = (
    leadId: string,
    date: string,
    time: string,
    type: FollowUpType,
    note: string
  ) => {
    // Pro access check: Block follow-up scheduling for expired non-subscribed users
    if (!hasProAccess(profile)) {
      setLockedFeatureName('Follow-Ups');
      setIsFeatureLockedOpen(true);
      return;
    }

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
      metadata: { followUpType: type },
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };

    const updatedLead: Lead = {
      ...target,
      nextFollowUpDate: date,
      nextFollowUpTime: time,
      nextFollowUpType: type,
      nextFollowUpNote: note,
      status: type === 'site_visit' ? 'site_visit_scheduled' : target.status,
      activities: [activity, ...(target.activities || [])],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    handleUpdateLead(updatedLead);
    scheduleFollowUpNotifications(updatedLead, type);
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
      try {
        localStorage.removeItem('proplead_is_logged_in_v1');
      } catch {}
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
    <MobileFrame>
      {/* WhatsApp / YouTube style clean animated splash screen */}
      <AnimatePresence>
        {isSplashActive && <SplashScreen key="app-launch-splash" />}
      </AnimatePresence>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2 text-white rounded-full text-xs font-bold shadow-xl border animate-bounce ${
            toastMessage.isError
              ? 'bg-rose-600 border-rose-700'
              : 'bg-slate-900 border-slate-700'
          }`}
          style={{
            top: 'calc(4.5rem + max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px)))',
          }}
        >
          {toastMessage.text}
        </div>
      )}

      {!isUserAuthenticated ? (
        <AuthFlow />
      ) : (
        <div className="flex-1 min-h-0 flex flex-col h-full bg-slate-100/70 dark:bg-slate-950 w-full max-w-full">
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
            onOpenSettings={() => {
              if (currentTab === 'settings') {
                handleTabChange('home');
              } else {
                handleTabChange('settings');
              }
            }}
          />

          {/* Single Vertical Scroll Container for Main Content */}
          <main
            id="main-content-scroll"
            className="flex-1 min-h-0 overflow-y-auto w-full overscroll-y-contain"
          >
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
                onOpenSchedule={(l) => guardLockedFeature('Follow-Ups', () => setScheduleLead(l))}
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
                onOpenSchedule={(l) => guardLockedFeature('Follow-Ups', () => setScheduleLead(l))}
                onDeleteBulkLeads={handleDeleteBulkLeads}
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
                onDeleteBulkProperties={handleDeleteBulkProperties}
              />
            )}

            {currentTab === 'calendar' && (
              <CalendarView
                leads={leads}
                onOpenLeadDetail={(l) => setDetailLead(l)}
                onOpenWhatsApp={(l) => setWhatsAppLead(l)}
                onOpenSchedule={(l) => guardLockedFeature('Follow-Ups', () => setScheduleLead(l))}
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
                currentUserEmail={currentUser?.email || currentUser?.displayName}
                isCloudSynced={isCloudSynced}
                onGoogleSignIn={handleGoogleSignIn}
                onSignOut={handleSignOut}
                onAccountDeleted={() => {
                  setLeads([]);
                  setProperties([]);
                  setCurrentUser(null);
                  setIsCloudSynced(false);
                  setCurrentTab('leads');
                }}
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
          </main>

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
          onOpenSchedule={(l) => guardLockedFeature('Follow-Ups', () => setScheduleLead(l))}
          onOpenEdit={(l) => guardLockedFeature('Edit Lead', () => setEditLead(l))}
          onRequirePro={(feat) => {
            setLockedFeatureName(feat || 'Follow-Ups');
            setIsFeatureLockedOpen(true);
          }}
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
          profile={profile}
          onRequirePro={(feat) => {
            setLockedFeatureName(feat || 'Follow-Ups');
            setIsFeatureLockedOpen(true);
          }}
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

      {/* 2. Property Detail Modal */}
      {detailProperty && (
        <PropertyDetailModal
          isOpen={Boolean(detailProperty)}
          onClose={() => setDetailProperty(null)}
          property={detailProperty}
          leads={leads}
          profile={profile}
          onUpdateProperty={handleUpdateProperty}
          onDeleteProperty={handleDeleteProperty}
          onOpenEditModal={handleOpenEditProperty}
          onOpenEdit={handleOpenEditProperty}
          onOpenShareModal={(prop, lead) =>
            setSharePropertyData({ property: prop, preselectedLead: lead })
          }
          onShareToLead={(prop, lead) =>
            setSharePropertyData({ property: prop, preselectedLead: lead })
          }
        />
      )}

      {/* 3. Edit Property Modal */}
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
        onSubscribe={() => {
          setIsFeatureLockedOpen(false);
          setIsSubscriptionOpen(true);
        }}
        featureName={lockedFeatureName}
        title="PropLead Pro Required"
        message={
          lockedFeatureName === 'Follow-Ups' || !lockedFeatureName || lockedFeatureName === 'Schedule Follow-Up'
            ? 'Your free trial has expired. Subscribe to continue managing follow-ups.'
            : `Your free trial has expired. Subscribe to continue using ${lockedFeatureName}.`
        }
        confirmText="View Plans"
        cancelText="Not Now"
      />

      {/* Import Contacts Modal */}
      <ImportContactsModal
        isOpen={isImportContactsOpen}
        onClose={() => setIsImportContactsOpen(false)}
        existingLeads={leads}
        onImportLeads={handleImportBulkLeads}
      />

      {/* Developer Sample Notification Interactive Heads-Up Banner (AI Studio / Web Preview) */}
      {sampleNotificationBanner && (
        <div className="fixed top-3 left-3 right-3 max-w-sm mx-auto z-[9999] bg-slate-900 text-white rounded-2xl shadow-2xl border border-emerald-500/50 p-3 flex items-center justify-between gap-2.5 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <BellRing className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                Sample Notification Fired
              </div>
              <div className="text-xs font-bold truncate text-white">
                {sampleNotificationBanner.title}
              </div>
              <div className="text-[11px] text-slate-300 truncate">
                {sampleNotificationBanner.body}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const extra = sampleNotificationBanner.extra;
                setSampleNotificationBanner(null);
                triggerNotificationAction(extra);
              }}
              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              Tap to Open
            </button>
            <button
              type="button"
              onClick={() => setSampleNotificationBanner(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </MobileFrame>
  );
}

export default App;
