import React, { useState, useEffect, useCallback } from 'react';
import { MobileFrame } from './components/layout/MobileFrame';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { Dashboard } from './components/dashboard/Dashboard';
import { LeadsList } from './components/leads/LeadsList';
import { PropertiesList } from './components/properties/PropertiesList';
import { CalendarView } from './components/calendar/CalendarView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { SettingsView } from './components/settings/SettingsView';

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
} from './utils/storage';
import { Lead, Property, UserProfile, WhatsAppTemplate, FollowUpType, TabType } from './types';
import { formatRelativeDate } from './utils/formatters';
import { getEffectiveSubscriptionStatus, setAuthoritativeServerTime } from './utils/billing';
import {
  subscribeToAuth,
  signInWithGoogle,
  signOutUser,
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
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile>(getStoredProfile());
  const [leads, setLeads] = useState<Lead[]>(getStoredLeads());
  const [properties, setProperties] = useState<Property[]>(getStoredProperties());
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(getStoredTemplates());
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);

  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [leadsFilter, setLeadsFilter] = useState<string>('all');
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Firebase Auth listener and Firestore real-time synchronization
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubLeads: (() => void) | null = null;
    let unsubProps: (() => void) | null = null;

    const unsubAuth = subscribeToAuth(async (user) => {
      setCurrentUser(user);

      if (user) {
        setIsCloudSynced(true);
        // Safely migrate any local data into Firestore for this user
        await syncLocalDataToFirestore(user.uid, user.email, user.displayName);

        // Subscribe to real-time user profile in Firestore
        unsubProfile = subscribeUserProfile(user.uid, (firestoreProfile) => {
          if (firestoreProfile) {
            setProfile((prev) => {
              const merged: UserProfile = { ...prev, ...firestoreProfile, isOnboarded: true };
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

  const handleToggleDarkMode = () => {
    const nextMode = !darkMode;
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
    const updated = [...newLeads, ...leads];
    setLeads(updated);
    saveStoredLeads(updated);
    if (currentUser?.uid) {
      batchAddLeadsToFirestore(currentUser.uid, newLeads).catch((e) => console.warn('Firestore batch leads error:', e));
    }
    showToast(`Imported ${newLeads.length} leads successfully! 👏`);
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
    const target = leads.find((l) => l.id === leadId);
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

  const handleCompleteOnboarding = async (profileData: Partial<UserProfile>) => {
    const now = new Date();
    const updatedProfile: UserProfile = {
      ...profile,
      ...profileData,
      isOnboarded: true,
      subscriptionStatus: 'TRIAL',
      isTrialActive: true,
      trialStartDate: now.toISOString(),
      trialDaysRemaining: 30,
      isSubscribed: false,
    };
    setProfile(updatedProfile);
    saveStoredProfile(updatedProfile);
    if (currentUser?.uid) {
      await saveUserProfile(currentUser.uid, updatedProfile).catch((e) => console.warn('Firestore save profile error:', e));
    }
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
      console.warn('Google sign-in error:', err);
      showToast('Sign-in cancelled or unavailable.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setCurrentUser(null);
      setIsCloudSynced(false);
      // Clear session state to return to login screen (cloud data remains intact in Firestore)
      setProfile((prev) => {
        const updated = { ...prev, isOnboarded: false };
        saveStoredProfile(updated);
        return updated;
      });
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
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900 text-white dark:bg-emerald-600 rounded-full text-xs font-bold shadow-xl border border-slate-700 animate-bounce">
          {toastMessage}
        </div>
      )}

      {!profile.isOnboarded ? (
        <OnboardingFlow onComplete={handleCompleteOnboarding} />
      ) : (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100/70 dark:bg-slate-950">
          {/* Header */}
          <Header
            profile={profile}
            onOpenQuickAdd={() => guardLockedFeature('Add Lead', () => setIsQuickAddOpen(true))}
            onOpenSearch={() => {
              setLeadsFilter('all');
              setCurrentTab('leads');
            }}
            onOpenSubscription={() => setIsSubscriptionOpen(true)}
          />

          {/* Main Tab Views */}
          {currentTab === 'home' && (
            <Dashboard
              leads={leads}
              profile={profile}
              onOpenQuickAdd={() => guardLockedFeature('Add Lead', () => setIsQuickAddOpen(true))}
              onOpenLeadDetail={(l) => setDetailLead(l)}
              onOpenWhatsApp={(l) => setWhatsAppLead(l)}
              onOpenSchedule={(l) => guardLockedFeature('Schedule Follow-Up', () => setScheduleLead(l))}
              onOpenSubscription={() => setIsSubscriptionOpen(true)}
              onNavigateToLeadsWithFilter={(filter) => {
                setLeadsFilter(filter);
                setCurrentTab('leads');
              }}
              onNavigateToTab={(tab) => setCurrentTab(tab)}
              onOpenImportContacts={() => guardLockedFeature('Import Contacts', () => setIsImportContactsOpen(true))}
            />
          )}

          {currentTab === 'leads' && (
            <LeadsList
              leads={leads}
              profile={profile}
              initialFilter={leadsFilter}
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
              setCurrentTab(tab);
            }}
            onChangeTab={(tab) => {
              if (tab === 'leads') {
                setLeadsFilter('all');
              }
              setCurrentTab(tab);
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
      <QuickAddLeadModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSaveLead={handleSaveLead}
        profile={profile}
        onOpenSubscription={() => setIsSubscriptionOpen(true)}
      />

      {/* 2. WhatsApp Modal (1-tap templates) */}
      {whatsAppLead && (
        <WhatsAppModal
          isOpen={Boolean(whatsAppLead)}
          onClose={() => setWhatsAppLead(null)}
          lead={whatsAppLead}
          profile={profile}
          templates={templates}
        />
      )}

      {/* 3. Schedule Follow-Up Modal */}
      {scheduleLead && (
        <ScheduleFollowUpModal
          isOpen={Boolean(scheduleLead)}
          onClose={() => setScheduleLead(null)}
          lead={scheduleLead}
          onSchedule={handleScheduleFollowUp}
          onSaveFollowUp={handleScheduleFollowUp}
        />
      )}

      {/* 4. Lead Detail Modal */}
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
          onOpenSchedule={(l) => guardLockedFeature('Schedule Follow-Up', () => setScheduleLead(l))}
          onOpenEdit={(l) => guardLockedFeature('Edit Lead', () => setEditLead(l))}
          onSharePropertyWithLead={(prop, lead) =>
            setSharePropertyData({ property: prop, preselectedLead: lead })
          }
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
      <AddPropertyModal
        isOpen={isAddPropertyOpen}
        onClose={() => setIsAddPropertyOpen(false)}
        onSaveProperty={handleSaveProperty}
        profile={profile}
      />

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
        onImportLeads={handleImportBulkLeads}
      />
    </MobileFrame>
  );
}

export default App;
