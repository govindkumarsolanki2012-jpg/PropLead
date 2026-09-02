export type Language = 'en' | 'hi' | 'hinglish';

export interface TranslationDictionary {
  // Navigation & Tabs
  nav_home: string;
  nav_leads: string;
  nav_properties: string;
  nav_calendar: string;
  nav_analytics: string;
  nav_settings: string;

  // Header
  header_pro: string;
  header_free_trial: string;
  header_add_lead: string;
  header_search: string;

  // Dashboard
  dash_namaste: string;
  dash_daily_focus: string;
  dash_add_lead: string;
  dash_today_action: string;
  dash_followups_today: string;
  dash_overdue_reminders: string;
  dash_immediate_attention: string;
  dash_active_leads: string;
  dash_in_progress: string;
  dash_closed_deals: string;
  dash_won_volume: string;
  dash_quick_actions: string;
  dash_import_contacts: string;
  dash_add_property: string;
  dash_whatsapp_message: string;
  dash_view_schedule: string;
  dash_all_leads: string;
  dash_deal_pipeline: string;
  dash_recent_leads: string;
  dash_view_all: string;
  dash_no_followups_today: string;
  dash_all_caught_up: string;
  dash_no_overdue: string;
  dash_schedule_followup: string;
  dash_call: string;
  dash_whatsapp: string;
  dash_today_schedule: string;
  dash_pipeline_overview: string;

  // Leads View
  leads_title: string;
  leads_search_placeholder: string;
  leads_export_csv: string;
  leads_filter_all: string;
  leads_filter_today: string;
  leads_filter_overdue: string;
  leads_filter_hot: string;
  leads_filter_buy: string;
  leads_filter_rent: string;
  leads_filter_visits: string;
  leads_filter_negotiation: string;
  leads_filter_closed: string;
  leads_showing_count: string;
  leads_sort_by: string;
  leads_sort_followup: string;
  leads_sort_newest: string;
  leads_sort_budget: string;
  leads_sort_priority: string;
  leads_no_found: string;
  leads_no_found_desc: string;
  leads_add_first: string;
  leads_source: string;

  // Quick Add Lead Modal
  modal_quick_add_title: string;
  modal_save_in_10s: string;
  modal_customer_name: string;
  modal_name_placeholder: string;
  modal_phone_whatsapp: string;
  modal_requirement_type: string;
  modal_req_buy: string;
  modal_req_rent: string;
  modal_req_sell: string;
  modal_req_lease: string;
  modal_bhk_config: string;
  modal_budget_target: string;
  modal_target_location: string;
  modal_city_hard_filter: string;
  modal_preferred_city: string;
  modal_preferred_locality: string;
  modal_current_city_residence: string;
  modal_current_city_note: string;
  modal_lead_source: string;
  modal_priority: string;
  modal_priority_hot: string;
  modal_priority_warm: string;
  modal_priority_cold: string;
  modal_schedule_followup: string;
  modal_followup_call: string;
  modal_followup_whatsapp: string;
  modal_followup_visit: string;
  modal_date_today: string;
  modal_date_tomorrow: string;
  modal_date_in_3_days: string;
  modal_date_weekend: string;
  modal_date_custom: string;
  modal_date_none: string;
  modal_select_date_cal: string;
  modal_followup_time: string;
  modal_quick_note: string;
  modal_quick_note_placeholder: string;
  modal_save_lead_btn: string;
  modal_saved_success: string;
  modal_saved_in_10s: string;
  modal_immediate_action: string;
  modal_call_lead: string;
  modal_whatsapp_intro: string;
  modal_done_return: string;

  // Property Inventory
  prop_title: string;
  prop_total: string;
  prop_available: string;
  prop_in_negotiation: string;
  prop_add_btn: string;
  prop_search_placeholder: string;
  prop_all_types: string;
  prop_for_sale: string;
  prop_for_rent: string;
  prop_available_only: string;
  prop_more_filters: string;
  prop_category: string;
  prop_all_categories: string;
  prop_bhk: string;
  prop_all_bhks: string;
  prop_sort_newest: string;
  prop_sort_price_low: string;
  prop_sort_price_high: string;
  prop_no_found: string;
  prop_no_found_desc: string;
  prop_add_first: string;
  prop_matching_leads: string;
  prop_share: string;
  prop_per_month: string;
  prop_negotiable: string;
  prop_fixed: string;

  // Calendar & Schedule View
  cal_title: string;
  cal_today_btn: string;
  cal_legend_call: string;
  cal_legend_visit: string;
  cal_schedule_for: string;
  cal_activity: string;
  cal_activities: string;
  cal_no_activities: string;
  cal_no_activities_desc: string;

  // WhatsApp Modal
  wa_title: string;
  wa_unicode_notice: string;
  wa_choose_template: string;
  wa_filter_all: string;
  wa_filter_test: string;
  wa_filter_hindi: string;
  wa_preview_title: string;
  wa_copy_text: string;
  wa_copied: string;
  wa_cancel: string;
  wa_send: string;

  // Analytics View
  analytics_agency_perf: string;
  analytics_deal_volume: string;
  analytics_brokerage_est: string;
  analytics_conversion_rate: string;
  analytics_won_of_total: string;
  analytics_active_pipeline: string;
  analytics_in_progress: string;
  analytics_followups_met: string;
  analytics_completed_actions: string;
  analytics_overdue: string;
  analytics_immediate_call: string;
  analytics_top_sources: string;
  analytics_pipeline_stages: string;

  // Settings View
  settings_title: string;
  settings_agent_profile: string;
  settings_broker_name: string;
  settings_agency_name: string;
  settings_mobile: string;
  settings_primary_city: string;
  settings_rera_no: string;
  settings_save_profile: string;
  settings_profile_saved: string;
  settings_preferences: string;
  settings_dark_mode: string;
  settings_light_mode: string;
  settings_app_language: string;
  settings_cloud_sync: string;
  settings_account: string;
  settings_synced: string;
  settings_leads_backed_up: string;
  settings_export_backup: string;
  settings_download_csv: string;
  settings_subscription: string;
  settings_support: string;
  settings_contact_whatsapp: string;
  settings_reset_data: string;
  settings_reset_desc: string;

  // Status Labels
  status_new: string;
  status_contacted: string;
  status_site_visit_scheduled: string;
  status_site_visit_completed: string;
  status_negotiation: string;
  status_advance_paid: string;
  status_closed: string;
  status_lost: string;

  // Requirement Labels
  req_buy: string;
  req_rent: string;
  req_sell: string;
  req_lease: string;

  // Priority Labels
  priority_hot: string;
  priority_warm: string;
  priority_cold: string;

  // Common buttons & terms
  btn_save: string;
  btn_cancel: string;
  btn_edit: string;
  btn_delete: string;
  btn_close: string;
  btn_call: string;
  btn_whatsapp: string;
  btn_share: string;
  btn_done: string;

  // Trial / Pro
  trial_ended: string;
  trial_desc: string;
  unlock_unlimited: string;
}

export const translations: Record<Language, TranslationDictionary> = {
  en: {
    // Nav
    nav_home: 'Home',
    nav_leads: 'Leads',
    nav_properties: 'Properties',
    nav_calendar: 'Calendar',
    nav_analytics: 'Analytics',
    nav_settings: 'Settings',

    // Header
    header_pro: 'PRO',
    header_free_trial: 'd Free Trial',
    header_add_lead: 'Add Lead',
    header_search: 'Search',

    // Dashboard
    dash_namaste: 'Namaste',
    dash_daily_focus: 'Here is your daily action focus for today.',
    dash_add_lead: '+ Add Lead',
    dash_today_action: "Today's Action",
    dash_followups_today: 'Follow-Ups Today',
    dash_overdue_reminders: 'Overdue Reminders',
    dash_immediate_attention: 'Needs Immediate Call',
    dash_active_leads: 'Active Pipeline',
    dash_in_progress: 'In-Progress Deals',
    dash_closed_deals: 'Deals Closed',
    dash_won_volume: 'Total Brokerage Won',
    dash_quick_actions: 'Quick Actions',
    dash_import_contacts: 'Import Contacts',
    dash_add_property: 'Add Property',
    dash_whatsapp_message: 'WhatsApp Broadcast',
    dash_view_schedule: 'View Calendar',
    dash_all_leads: 'All Leads',
    dash_deal_pipeline: 'Deal Pipeline Stages',
    dash_recent_leads: 'Recent Leads & Enquiries',
    dash_view_all: 'View All',
    dash_no_followups_today: 'No Follow-Ups Pending for Today',
    dash_all_caught_up: 'Great job! You have completed all scheduled client actions.',
    dash_no_overdue: 'Zero Overdue Follow-Ups',
    dash_schedule_followup: 'Schedule Follow-Up',
    dash_call: 'Call',
    dash_whatsapp: 'WhatsApp',
    dash_today_schedule: "Today's Schedule & Site Visits",
    dash_pipeline_overview: 'Pipeline Overview',

    // Leads
    leads_title: 'Leads Management',
    leads_search_placeholder: 'Search by name, phone, locality, BHK...',
    leads_export_csv: 'Export CSV',
    leads_filter_all: 'All Leads',
    leads_filter_today: '⚡ Today',
    leads_filter_overdue: '🚨 Overdue',
    leads_filter_hot: '🔥 Hot Leads',
    leads_filter_buy: 'Buyers',
    leads_filter_rent: 'Rentals',
    leads_filter_visits: 'Site Visits',
    leads_filter_negotiation: 'Negotiation',
    leads_filter_closed: 'Closed Deals',
    leads_showing_count: 'Showing {count} of {total} Leads',
    leads_sort_by: 'Sort By',
    leads_sort_followup: 'Follow-Up Date',
    leads_sort_newest: 'Recently Added',
    leads_sort_budget: 'Highest Budget',
    leads_sort_priority: 'Priority (Hot first)',
    leads_no_found: 'No matching leads found',
    leads_no_found_desc: 'Add a new buyer, seller or rental inquiry in 10 seconds.',
    leads_add_first: '+ Add Your First Lead',
    leads_source: 'Source',

    // Quick Add
    modal_quick_add_title: '+ Quick Add Lead',
    modal_save_in_10s: 'Save in ~10 seconds',
    modal_customer_name: 'Customer Name *',
    modal_name_placeholder: 'e.g. Rahul Sharma',
    modal_phone_whatsapp: 'Phone / WhatsApp *',
    modal_requirement_type: 'Requirement Type',
    modal_req_buy: '🏡 Buy',
    modal_req_rent: '🔑 Rent',
    modal_req_sell: '💰 Sell',
    modal_req_lease: '🏢 Lease',
    modal_bhk_config: 'BHK / Config',
    modal_budget_target: 'Target Budget Range',
    modal_target_location: 'Target Property Location',
    modal_city_hard_filter: 'City is Hard Filter',
    modal_preferred_city: 'Preferred Property City *',
    modal_preferred_locality: 'Preferred Locality / Sector',
    modal_current_city_residence: 'Customer Current Residence City (Optional)',
    modal_current_city_note: "Note: Customer's current residence will never override the target property city.",
    modal_lead_source: 'Lead Source',
    modal_priority: 'Priority',
    modal_priority_hot: '🔥 Hot',
    modal_priority_warm: '☀️ Warm',
    modal_priority_cold: '❄️ Cold',
    modal_schedule_followup: 'Schedule Next Follow-Up',
    modal_followup_call: 'Call',
    modal_followup_whatsapp: 'WhatsApp',
    modal_followup_visit: 'Site Visit',
    modal_date_today: 'Today',
    modal_date_tomorrow: 'Tomorrow',
    modal_date_in_3_days: '+3 Days',
    modal_date_weekend: 'Weekend',
    modal_date_custom: 'Custom',
    modal_date_none: 'None',
    modal_select_date_cal: 'Select Date (Calendar)',
    modal_followup_time: 'Follow-Up Time',
    modal_quick_note: 'Quick Note (Optional)',
    modal_quick_note_placeholder: 'e.g. Customer wants East facing flat, loan pre-approved...',
    modal_save_lead_btn: 'Save Lead (10s)',
    modal_saved_success: 'Lead Added Successfully!',
    modal_saved_in_10s: 'Saved in 10 Seconds',
    modal_immediate_action: 'Immediate Next Action:',
    modal_call_lead: 'Call Customer',
    modal_whatsapp_intro: 'WhatsApp Intro',
    modal_done_return: 'Done & Return to Leads',

    // Properties
    prop_title: 'Property Inventory',
    prop_total: 'total',
    prop_available: 'Available',
    prop_in_negotiation: 'in Negotiation',
    prop_add_btn: 'Add Property',
    prop_search_placeholder: 'Search by locality, BHK, title, city (e.g. Sector 57, 3 BHK)...',
    prop_all_types: 'All Types',
    prop_for_sale: 'For Sale',
    prop_for_rent: 'For Rent',
    prop_available_only: '✓ Available Only',
    prop_more_filters: 'Filters',
    prop_category: 'Property Category',
    prop_all_categories: 'All Categories',
    prop_bhk: 'BHK Config',
    prop_all_bhks: 'All BHKs',
    prop_sort_newest: 'Newest Added',
    prop_sort_price_low: 'Price: Low to High',
    prop_sort_price_high: 'Price: High to Low',
    prop_no_found: 'No Properties Found',
    prop_no_found_desc: 'Start adding properties to your inventory to match leads and share 1-tap WhatsApp brochures.',
    prop_add_first: '+ Add First Property',
    prop_matching_leads: 'Matching Leads 🔥',
    prop_share: 'Share',
    prop_per_month: 'per month',
    prop_negotiable: 'Negotiable',
    prop_fixed: 'Fixed',

    // Calendar
    cal_title: 'Calendar & Visits',
    cal_today_btn: 'Today',
    cal_legend_call: 'Follow-Up Call',
    cal_legend_visit: 'Site Visit / Meeting',
    cal_schedule_for: 'Schedule for',
    cal_activity: 'Activity',
    cal_activities: 'Activities',
    cal_no_activities: 'No follow-ups or site visits scheduled for this date.',
    cal_no_activities_desc: 'Select a lead to schedule a visit, or add a new enquiry.',

    // WhatsApp
    wa_title: 'WhatsApp to',
    wa_unicode_notice: 'UTF-8 Unicode Safe: Emojis, ₹ Rupee, Hindi & Line breaks preserved',
    wa_choose_template: 'Choose Template / Presets:',
    wa_filter_all: 'All',
    wa_filter_test: '🔥 Test Presets',
    wa_filter_hindi: '🇮🇳 हिन्दी / Hinglish',
    wa_preview_title: 'Message Preview & Edit (Unicode Preserved)',
    wa_copy_text: 'Copy Text',
    wa_copied: 'Copied with Emojis & ₹!',
    wa_cancel: 'Cancel',
    wa_send: 'Open WhatsApp & Send',

    // Analytics
    analytics_agency_perf: 'Agency Performance',
    analytics_deal_volume: 'Deal Volume Closed',
    analytics_brokerage_est: 'Est. 2% Brokerage',
    analytics_conversion_rate: 'Conversion',
    analytics_won_of_total: '{won} of {total} won',
    analytics_active_pipeline: 'Active Pipeline',
    analytics_in_progress: 'In-progress deals',
    analytics_followups_met: 'Follow-Ups Met',
    analytics_completed_actions: 'Completed actions',
    analytics_overdue: 'Overdue Follow-ups',
    analytics_immediate_call: 'Needs immediate call',
    analytics_top_sources: 'Top Lead Sources',
    analytics_pipeline_stages: 'Pipeline Stage Distribution',

    // Settings
    settings_title: 'Settings & Agency Profile',
    settings_agent_profile: 'Agent & Agency Profile',
    settings_broker_name: 'Broker / Agent Name',
    settings_agency_name: 'Agency / Firm Name',
    settings_mobile: 'Mobile Number',
    settings_primary_city: 'Primary City / Markets',
    settings_rera_no: 'RERA Registration No.',
    settings_save_profile: 'Save Profile Changes',
    settings_profile_saved: 'Profile Saved Successfully!',
    settings_preferences: 'App Preferences',
    settings_dark_mode: 'Dark Mode',
    settings_light_mode: 'Light Mode',
    settings_app_language: 'App Language',
    settings_cloud_sync: 'Cloud Backup & Sync',
    settings_account: 'Account:',
    settings_synced: 'Synced',
    settings_leads_backed_up: 'Leads Backed Up',
    settings_export_backup: 'Export & Backup',
    settings_download_csv: 'Download CSV of All Leads',
    settings_subscription: 'Pro Subscription & Billing',
    settings_support: 'Support & Help',
    settings_contact_whatsapp: 'Contact Support on WhatsApp',
    settings_reset_data: 'Reset Sample Data',
    settings_reset_desc: 'Restore default sample leads and properties',

    // Status
    status_new: 'New Lead',
    status_contacted: 'Contacted',
    status_site_visit_scheduled: 'Visit Scheduled',
    status_site_visit_completed: 'Visit Completed',
    status_negotiation: 'Negotiation',
    status_advance_paid: 'Advance Paid',
    status_closed: 'Deal Won / Closed',
    status_lost: 'Lost / Dropped',

    // Req
    req_buy: 'Buy',
    req_rent: 'Rent',
    req_sell: 'Sell',
    req_lease: 'Lease',

    // Priority
    priority_hot: 'Hot',
    priority_warm: 'Warm',
    priority_cold: 'Cold',

    // Buttons
    btn_save: 'Save',
    btn_cancel: 'Cancel',
    btn_edit: 'Edit',
    btn_delete: 'Delete',
    btn_close: 'Close',
    btn_call: 'Call',
    btn_whatsapp: 'WhatsApp',
    btn_share: 'Share',
    btn_done: 'Done',
    trial_ended: 'Your free trial has ended.',
    trial_desc: 'Continue using Property Agent Lead Tracker for:',
    unlock_unlimited: 'Unlock Unlimited Leads & Sync',
  },

  hi: {
    // Nav
    nav_home: 'होम',
    nav_leads: 'लीड्स',
    nav_properties: 'प्रॉपर्टीज',
    nav_calendar: 'कैलेंडर',
    nav_analytics: 'एनालिटिक्स',
    nav_settings: 'सेटिंग्स',

    // Header
    header_pro: 'प्रो',
    header_free_trial: 'दिन का फ्री ट्रायल',
    header_add_lead: 'लीड जोड़ें',
    header_search: 'सर्च',

    // Dashboard
    dash_namaste: 'नमस्ते',
    dash_daily_focus: 'आज के आपके मुख्य कार्य और फॉलो-अप्स।',
    dash_add_lead: '+ नई लीड',
    dash_today_action: 'आज के कार्य',
    dash_followups_today: 'आज के फॉलो-अप',
    dash_overdue_reminders: 'पेंडिंग / ओवरड्यू',
    dash_immediate_attention: 'तुरंत कॉल करें',
    dash_active_leads: 'सक्रिय पाइपलाइन',
    dash_in_progress: 'चल रही डील्स',
    dash_closed_deals: 'सफल डील्स (बंद)',
    dash_won_volume: 'कुल ब्रोकरेज जीती',
    dash_quick_actions: 'त्वरित कार्य',
    dash_import_contacts: 'कॉन्टैक्ट्स इम्पोर्ट करें',
    dash_add_property: 'प्रॉपर्टी जोड़ें',
    dash_whatsapp_message: 'व्हाट्सएप ब्रॉडकास्ट',
    dash_view_schedule: 'कैलेंडर देखें',
    dash_all_leads: 'सभी लीड्स',
    dash_deal_pipeline: 'डील पाइपलाइन चरण',
    dash_recent_leads: 'हाल की नई लीड्स',
    dash_view_all: 'सभी देखें',
    dash_no_followups_today: 'आज के सभी फॉलो-अप पूरे हो चुके हैं',
    dash_all_caught_up: 'शानदार! आज का कोई भी क्लाइंट फॉलो-अप बाकी नहीं है।',
    dash_no_overdue: 'कोई पेंडिंग फॉलो-अप नहीं है',
    dash_schedule_followup: 'फॉलो-अप सेट करें',
    dash_call: 'कॉल करें',
    dash_whatsapp: 'व्हाट्सएप',
    dash_today_schedule: 'आज का शेड्यूल और साइट विज़िट्स',
    dash_pipeline_overview: 'पाइपलाइन अवलोकन',

    // Leads
    leads_title: 'लीड्स प्रबंधन',
    leads_search_placeholder: 'नाम, फोन, इलाका, BHK द्वारा खोजें...',
    leads_export_csv: 'CSV एक्सपोर्ट',
    leads_filter_all: 'सभी लीड्स',
    leads_filter_today: '⚡ आज के',
    leads_filter_overdue: '🚨 पेंडिंग',
    leads_filter_hot: '🔥 हॉट लीड्स',
    leads_filter_buy: 'खरीदार',
    leads_filter_rent: 'किरायेदार',
    leads_filter_visits: 'साइट विज़िट्स',
    leads_filter_negotiation: 'बातचीत जारी',
    leads_filter_closed: 'सफल डील्स',
    leads_showing_count: '{total} में से {count} लीड्स दिख रही हैं',
    leads_sort_by: 'क्रमबद्ध करें',
    leads_sort_followup: 'फॉलो-अप तारीख',
    leads_sort_newest: 'हाल ही में जोड़ी गई',
    leads_sort_budget: 'अधिकतम बजट',
    leads_sort_priority: 'प्राथमिकता (हॉट पहले)',
    leads_no_found: 'कोई लीड नहीं मिली',
    leads_no_found_desc: '10 सेकंड में नया खरीदार या किरायेदार जोड़ें।',
    leads_add_first: '+ पहली लीड जोड़ें',
    leads_source: 'स्रोत',

    // Quick Add
    modal_quick_add_title: '+ तुरंत लीड जोड़ें',
    modal_save_in_10s: 'सिर्फ ~10 सेकंड में सेव करें',
    modal_customer_name: 'ग्राहक का नाम *',
    modal_name_placeholder: 'उदा. राहुल शर्मा',
    modal_phone_whatsapp: 'फोन / व्हाट्सएप नंबर *',
    modal_requirement_type: 'आवश्यकता का प्रकार',
    modal_req_buy: '🏡 खरीदना',
    modal_req_rent: '🔑 किराये पर लेना',
    modal_req_sell: '💰 बेचना',
    modal_req_lease: '🏢 लीज',
    modal_bhk_config: 'BHK / कॉन्फिग',
    modal_budget_target: 'अनुमानित बजट',
    modal_target_location: 'प्रॉपर्टी का पसंदीदा स्थान',
    modal_city_hard_filter: 'शहर मुख्य फिल्टर है',
    modal_preferred_city: 'पसंदीदा शहर *',
    modal_preferred_locality: 'पसंदीदा इलाका / सेक्टर',
    modal_current_city_residence: 'ग्राहक का वर्तमान निवास शहर (वैकल्पिक)',
    modal_current_city_note: 'नोट: ग्राहक का निवास शहर प्रॉपर्टी के शहर को नहीं बदलेगा।',
    modal_lead_source: 'लीड का स्रोत',
    modal_priority: 'प्राथमिकता',
    modal_priority_hot: '🔥 हॉट',
    modal_priority_warm: '☀️ वॉर्म',
    modal_priority_cold: '❄️ कोल्ड',
    modal_schedule_followup: 'अगला फॉलो-अप तय करें',
    modal_followup_call: 'कॉल',
    modal_followup_whatsapp: 'व्हाट्सएप',
    modal_followup_visit: 'साइट विज़िट',
    modal_date_today: 'आज',
    modal_date_tomorrow: 'कल',
    modal_date_in_3_days: '+3 दिन',
    modal_date_weekend: 'सप्ताहांत (Weekend)',
    modal_date_custom: 'कस्टम तारीख',
    modal_date_none: 'कोई नहीं',
    modal_select_date_cal: 'तारीख चुनें (कैलेंडर)',
    modal_followup_time: 'फॉलो-अप का समय',
    modal_quick_note: 'त्वरित नोट (वैकल्पिक)',
    modal_quick_note_placeholder: 'उदा. पूर्व मुखी फ्लैट चाहिए, लोन पास है...',
    modal_save_lead_btn: 'लीड सेव करें (10s)',
    modal_saved_success: 'लीड सफलतापूर्वक सेव हो गई!',
    modal_saved_in_10s: '10 सेकंड में सुरक्षित',
    modal_immediate_action: 'तुरंत अगला कदम:',
    modal_call_lead: 'ग्राहक को कॉल करें',
    modal_whatsapp_intro: 'व्हाट्सएप पर परिचय भेजें',
    modal_done_return: 'हो गया, लीड्स पर वापस जाएं',

    // Properties
    prop_title: 'प्रॉपर्टी इन्वेंट्री',
    prop_total: 'कुल',
    prop_available: 'उपलब्ध',
    prop_in_negotiation: 'बातचीत जारी',
    prop_add_btn: 'प्रॉपर्टी जोड़ें',
    prop_search_placeholder: 'इलाका, BHK, नाम या शहर द्वारा खोजें...',
    prop_all_types: 'सभी प्रकार',
    prop_for_sale: 'बिक्री के लिए',
    prop_for_rent: 'किराये के लिए',
    prop_available_only: '✓ केवल उपलब्ध',
    prop_more_filters: 'फिल्टर्स',
    prop_category: 'प्रॉपर्टी श्रेणी',
    prop_all_categories: 'सभी श्रेणियां',
    prop_bhk: 'BHK कॉन्फिग',
    prop_all_bhks: 'सभी BHK',
    prop_sort_newest: 'नवीनतम जोड़ी गई',
    prop_sort_price_low: 'कीमत: कम से ज्यादा',
    prop_sort_price_high: 'कीमत: ज्यादा से कम',
    prop_no_found: 'कोई प्रॉपर्टी नहीं मिली',
    prop_no_found_desc: 'लीड्स मैच करने और 1-क्लिक व्हाट्सएप ब्रोशर भेजने के लिए प्रॉपर्टी जोड़ें।',
    prop_add_first: '+ पहली प्रॉपर्टी जोड़ें',
    prop_matching_leads: 'मैचिंग लीड्स 🔥',
    prop_share: 'शेयर करें',
    prop_per_month: 'प्रति माह',
    prop_negotiable: 'बातचीत संभव',
    prop_fixed: 'फिक्स्ड',

    // Calendar
    cal_title: 'कैलेंडर और विज़िट्स',
    cal_today_btn: 'आज',
    cal_legend_call: 'फॉलो-अप कॉल',
    cal_legend_visit: 'साइट विज़िट / मीटिंग',
    cal_schedule_for: 'का शेड्यूल:',
    cal_activity: 'गतिविधि',
    cal_activities: 'गतिविधियां',
    cal_no_activities: 'इस तारीख के लिए कोई फॉलो-अप या साइट विज़िट निर्धारित नहीं है।',
    cal_no_activities_desc: 'विज़िट शेड्यूल करने के लिए लीड चुनें या नई पूछताछ जोड़ें।',

    // WhatsApp
    wa_title: 'व्हाट्सएप भेजें:',
    wa_unicode_notice: 'UTF-8 सुरक्षित: इमोजी, ₹ रुपया और हिंदी पूरी तरह सही रहेगा',
    wa_choose_template: 'टेम्प्लेट / प्रीसेट चुनें:',
    wa_filter_all: 'सभी',
    wa_filter_test: '🔥 टेस्ट प्रीसेट्स',
    wa_filter_hindi: '🇮🇳 हिन्दी / Hinglish',
    wa_preview_title: 'संदेश का पूर्वावलोकन व बदलाव',
    wa_copy_text: 'टेक्स्ट कॉपी करें',
    wa_copied: 'इमोजी और ₹ के साथ कॉपी हुआ!',
    wa_cancel: 'रद्द करें',
    wa_send: 'व्हाट्सएप खोलें और भेजें',

    // Analytics
    analytics_agency_perf: 'एजेंसी का प्रदर्शन',
    analytics_deal_volume: 'क्लोज की गई डील्स का मूल्य',
    analytics_brokerage_est: 'अनुमानित 2% ब्रोकरेज',
    analytics_conversion_rate: 'कन्वर्जन दर',
    analytics_won_of_total: '{total} में से {won} डील्स जीतीं',
    analytics_active_pipeline: 'सक्रिय पाइपलाइन',
    analytics_in_progress: 'प्रक्रियाधीन डील्स',
    analytics_followups_met: 'पूरे किए गए फॉलो-अप',
    analytics_completed_actions: 'सफलतापूर्वक संपर्क किया',
    analytics_overdue: 'पेंडिंग फॉलो-अप्स',
    analytics_immediate_call: 'तुरंत कॉल की जरूरत है',
    analytics_top_sources: 'लीड्स के मुख्य स्रोत',
    analytics_pipeline_stages: 'पाइपलाइन चरण वितरण',

    // Settings
    settings_title: 'सेटिंग्स और एजेंसी प्रोफाइल',
    settings_agent_profile: 'एजेंट और एजेंसी प्रोफाइल',
    settings_broker_name: 'ब्रोकर / एजेंट का नाम',
    settings_agency_name: 'एजेंसी / फर्म का नाम',
    settings_mobile: 'मोबाइल नंबर',
    settings_primary_city: 'मुख्य शहर / मार्केट',
    settings_rera_no: 'रेरा (RERA) पंजीकरण संख्या',
    settings_save_profile: 'प्रोफाइल सेव करें',
    settings_profile_saved: 'प्रोफाइल सफलतापूर्वक सेव हो गई!',
    settings_preferences: 'ऐप की प्राथमिकताएं',
    settings_dark_mode: 'डार्क मोड',
    settings_light_mode: 'लाइट मोड',
    settings_app_language: 'ऐप की भाषा (Language)',
    settings_cloud_sync: 'क्लाउड बैकअप और सिंक',
    settings_account: 'खाता:',
    settings_synced: 'सिंक हो चुका है',
    settings_leads_backed_up: 'लीड्स सुरक्षित हैं',
    settings_export_backup: 'डेटा एक्सपोर्ट और बैकअप',
    settings_download_csv: 'सभी लीड्स की CSV डाउनलोड करें',
    settings_subscription: 'प्रो सब्सक्रिप्शन और बिलिंग',
    settings_support: 'सहायता और सपोर्ट',
    settings_contact_whatsapp: 'व्हाट्सएप पर सहायता प्राप्त करें',
    settings_reset_data: 'सैंपल डेटा रीसेट करें',
    settings_reset_desc: 'डिफ़ॉल्ट सैंपल लीड्स और प्रॉपर्टीज को पुनर्स्थापित करें',

    // Status
    status_new: 'नई लीड',
    status_contacted: 'संपर्क किया',
    status_site_visit_scheduled: 'विज़िट तय हुई',
    status_site_visit_completed: 'विज़िट पूरी हुई',
    status_negotiation: 'बातचीत जारी',
    status_advance_paid: 'टोकन / एडवांस जमा',
    status_closed: 'सफल डील (Deal Won)',
    status_lost: 'रद्द / ड्रॉप (Lost)',

    // Req
    req_buy: 'खरीदना',
    req_rent: 'किराया',
    req_sell: 'बेचना',
    req_lease: 'लीज',

    // Priority
    priority_hot: 'हॉट',
    priority_warm: 'वॉर्म',
    priority_cold: 'कोल्ड',

    // Buttons
    btn_save: 'सेव करें',
    btn_cancel: 'रद्द करें',
    btn_edit: 'संपादित करें',
    btn_delete: 'हटाएं',
    btn_close: 'बंद करें',
    btn_call: 'कॉल करें',
    btn_whatsapp: 'व्हाट्सएप',
    btn_share: 'शेयर करें',
    btn_done: 'पूर्ण',
    trial_ended: 'आपका फ्री ट्रायल समाप्त हो गया है।',
    trial_desc: 'प्रॉपर्टी एजेंट लीड ट्रैकर का उपयोग जारी रखें:',
    unlock_unlimited: 'असीमित लीड्स और क्लाउड सिंक अनलॉक करें',
  },

  hinglish: {
    // Nav
    nav_home: 'Home',
    nav_leads: 'Leads',
    nav_properties: 'Inventory',
    nav_calendar: 'Calendar',
    nav_analytics: 'Reports',
    nav_settings: 'Settings',

    // Header
    header_pro: 'PRO',
    header_free_trial: 'Din ka Free Trial',
    header_add_lead: '+ Nayi Lead',
    header_search: 'Search',

    // Dashboard
    dash_namaste: 'Namaste',
    dash_daily_focus: 'Aaj ke aapke main actions aur client follow-ups.',
    dash_add_lead: '+ Naya Lead',
    dash_today_action: 'Aaj ke Actions',
    dash_followups_today: 'Aaj ke Follow-Ups',
    dash_overdue_reminders: 'Pending Reminders',
    dash_immediate_attention: 'Turant Call Karein',
    dash_active_leads: 'Active Pipeline',
    dash_in_progress: 'Chalu Deals',
    dash_closed_deals: 'Closed Deals',
    dash_won_volume: 'Total Brokerage Won',
    dash_quick_actions: 'Quick Shortcuts',
    dash_import_contacts: 'Contacts Import Karein',
    dash_add_property: 'Property Add Karein',
    dash_whatsapp_message: 'WhatsApp Broadcast',
    dash_view_schedule: 'Calendar Dekhein',
    dash_all_leads: 'Sabhi Leads',
    dash_deal_pipeline: 'Deal Pipeline Stages',
    dash_recent_leads: 'Recent Leads & Enquiries',
    dash_view_all: 'Sabhi Dekhein',
    dash_no_followups_today: 'Aaj ke sabhi follow-ups complete ho chuke hain',
    dash_all_caught_up: 'Badiya! Aaj ka koi bhi client follow-up bacha nahi hai.',
    dash_no_overdue: 'Zero Pending Follow-Ups',
    dash_schedule_followup: 'Follow-Up Schedule Karein',
    dash_call: 'Call Karein',
    dash_whatsapp: 'WhatsApp',
    dash_today_schedule: "Aaj ka Schedule aur Site Visits",
    dash_pipeline_overview: 'Pipeline Overview',

    // Leads
    leads_title: 'Leads Management',
    leads_search_placeholder: 'Naam, phone, locality, BHK se search karein...',
    leads_export_csv: 'CSV Export',
    leads_filter_all: 'Sabhi Leads',
    leads_filter_today: '⚡ Aaj ke',
    leads_filter_overdue: '🚨 Pending',
    leads_filter_hot: '🔥 Hot Leads',
    leads_filter_buy: 'Buyers (Kharidar)',
    leads_filter_rent: 'Rentals (Kiraya)',
    leads_filter_visits: 'Site Visits',
    leads_filter_negotiation: 'Negotiation',
    leads_filter_closed: 'Closed Deals',
    leads_showing_count: '{total} me se {count} Leads dikh rahi hain',
    leads_sort_by: 'Sort Karein',
    leads_sort_followup: 'Follow-Up Date',
    leads_sort_newest: 'Recently Added',
    leads_sort_budget: 'Highest Budget',
    leads_sort_priority: 'Priority (Hot pehle)',
    leads_no_found: 'Koi matching lead nahi mili',
    leads_no_found_desc: '10 second me naya buyer ya rental enquiry add karein.',
    leads_add_first: '+ Pehla Lead Add Karein',
    leads_source: 'Source',

    // Quick Add
    modal_quick_add_title: '+ Quick Add Lead',
    modal_save_in_10s: 'Bas ~10 seconds me save karein',
    modal_customer_name: 'Customer ka Naam *',
    modal_name_placeholder: 'e.g. Rahul Sharma',
    modal_phone_whatsapp: 'Phone / WhatsApp *',
    modal_requirement_type: 'Requirement Type',
    modal_req_buy: '🏡 Buy (Kharidna)',
    modal_req_rent: '🔑 Rent (Kiraya)',
    modal_req_sell: '💰 Sell (Bechna)',
    modal_req_lease: '🏢 Lease',
    modal_bhk_config: 'BHK / Config',
    modal_budget_target: 'Target Budget',
    modal_target_location: 'Property Location Preference',
    modal_city_hard_filter: 'City Hard Filter Hai',
    modal_preferred_city: 'Preferred Property City *',
    modal_preferred_locality: 'Preferred Locality / Sector',
    modal_current_city_residence: 'Customer Current City (Optional)',
    modal_current_city_note: 'Note: Customer ka residence property city ko replace nahi karega.',
    modal_lead_source: 'Lead Source',
    modal_priority: 'Priority',
    modal_priority_hot: '🔥 Hot',
    modal_priority_warm: '☀️ Warm',
    modal_priority_cold: '❄️ Cold',
    modal_schedule_followup: 'Next Follow-Up Schedule Karein',
    modal_followup_call: 'Call',
    modal_followup_whatsapp: 'WhatsApp',
    modal_followup_visit: 'Site Visit',
    modal_date_today: 'Aaj',
    modal_date_tomorrow: 'Kal (Tomorrow)',
    modal_date_in_3_days: '+3 Din me',
    modal_date_weekend: 'Weekend',
    modal_date_custom: 'Custom Date',
    modal_date_none: 'Koi nahi',
    modal_select_date_cal: 'Date Select Karein (Calendar)',
    modal_followup_time: 'Follow-Up ka Time',
    modal_quick_note: 'Quick Note (Optional)',
    modal_quick_note_placeholder: 'e.g. East facing flat chahiye, loan SBI se approved hai...',
    modal_save_lead_btn: 'Lead Save Karein (10s)',
    modal_saved_success: 'Lead Successfully Add Ho Gayi!',
    modal_saved_in_10s: '10 Seconds me Saved',
    modal_immediate_action: 'Immediate Next Step:',
    modal_call_lead: 'Customer ko Call Karein',
    modal_whatsapp_intro: 'WhatsApp Intro Bhejein',
    modal_done_return: 'Done & Return to Leads',

    // Properties
    prop_title: 'Property Inventory',
    prop_total: 'total',
    prop_available: 'Available',
    prop_in_negotiation: 'Negotiation me',
    prop_add_btn: 'Property Add Karein',
    prop_search_placeholder: 'Locality, BHK, title, city se search karein...',
    prop_all_types: 'Sabhi Types',
    prop_for_sale: 'Sale ke liye',
    prop_for_rent: 'Rent ke liye',
    prop_available_only: '✓ Sirf Available',
    prop_more_filters: 'Filters',
    prop_category: 'Property Category',
    prop_all_categories: 'Sabhi Categories',
    prop_bhk: 'BHK Config',
    prop_all_bhks: 'Sabhi BHKs',
    prop_sort_newest: 'Sabse Nayi',
    prop_sort_price_low: 'Price: Kam se Jyada',
    prop_sort_price_high: 'Price: Jyada se Kam',
    prop_no_found: 'Koi Property Nahi Mili',
    prop_no_found_desc: 'Leads match karne aur WhatsApp brochure bhejne ke liye property inventory add karein.',
    prop_add_first: '+ Pehli Property Add Karein',
    prop_matching_leads: 'Matching Leads 🔥',
    prop_share: 'Share Karein',
    prop_per_month: 'per month',
    prop_negotiable: 'Negotiable',
    prop_fixed: 'Fixed',

    // Calendar
    cal_title: 'Calendar & Visits',
    cal_today_btn: 'Aaj',
    cal_legend_call: 'Follow-Up Call',
    cal_legend_visit: 'Site Visit / Meeting',
    cal_schedule_for: 'ka Schedule:',
    cal_activity: 'Activity',
    cal_activities: 'Activities',
    cal_no_activities: 'Is date ke liye koi follow-up ya site visit scheduled nahi hai.',
    cal_no_activities_desc: 'Site visit plan karne ke liye lead choose karein ya nayi enquiry add karein.',

    // WhatsApp
    wa_title: 'WhatsApp to',
    wa_unicode_notice: 'UTF-8 Unicode Safe: Emojis, ₹ Rupee, Hindi & Line breaks intact rahenge',
    wa_choose_template: 'Template / Preset Choose Karein:',
    wa_filter_all: 'Sabhi',
    wa_filter_test: '🔥 Test Presets',
    wa_filter_hindi: '🇮🇳 हिन्दी / Hinglish',
    wa_preview_title: 'Message Preview & Edit (Unicode Preserved)',
    wa_copy_text: 'Text Copy Karein',
    wa_copied: 'Emojis aur ₹ ke saath Copy Ho Gaya!',
    wa_cancel: 'Cancel',
    wa_send: 'WhatsApp Kholein & Bhejein',

    // Analytics
    analytics_agency_perf: 'Agency Performance',
    analytics_deal_volume: 'Total Deal Volume Closed',
    analytics_brokerage_est: 'Est. 2% Brokerage',
    analytics_conversion_rate: 'Conversion Rate',
    analytics_won_of_total: '{total} me se {won} deals jeeti',
    analytics_active_pipeline: 'Active Pipeline',
    analytics_in_progress: 'In-progress deals',
    analytics_followups_met: 'Follow-Ups Met',
    analytics_completed_actions: 'Completed actions',
    analytics_overdue: 'Pending Follow-ups',
    analytics_immediate_call: 'Immediate call chahiye',
    analytics_top_sources: 'Top Lead Sources',
    analytics_pipeline_stages: 'Pipeline Stage Breakdown',

    // Settings
    settings_title: 'Settings & Agency Profile',
    settings_agent_profile: 'Agent & Agency Profile',
    settings_broker_name: 'Broker / Agent ka Naam',
    settings_agency_name: 'Agency / Firm ka Naam',
    settings_mobile: 'Mobile Number',
    settings_primary_city: 'Primary City / Markets',
    settings_rera_no: 'RERA Registration No.',
    settings_save_profile: 'Profile Changes Save Karein',
    settings_profile_saved: 'Profile Successfully Save Ho Gayi!',
    settings_preferences: 'App Preferences',
    settings_dark_mode: 'Dark Mode',
    settings_light_mode: 'Light Mode',
    settings_app_language: 'App Language',
    settings_cloud_sync: 'Cloud Backup & Sync',
    settings_account: 'Account:',
    settings_synced: 'Synced',
    settings_leads_backed_up: 'Leads Backed Up',
    settings_export_backup: 'Export & Backup',
    settings_download_csv: 'Sabhi Leads ki CSV Download Karein',
    settings_subscription: 'Pro Subscription & Billing',
    settings_support: 'Support & Help',
    settings_contact_whatsapp: 'WhatsApp Support se Baat Karein',
    settings_reset_data: 'Sample Data Reset Karein',
    settings_reset_desc: 'Default sample leads aur properties reload karein',

    // Status
    status_new: 'Nayi Lead',
    status_contacted: 'Contacted',
    status_site_visit_scheduled: 'Visit Scheduled',
    status_site_visit_completed: 'Visit Completed',
    status_negotiation: 'Negotiation',
    status_advance_paid: 'Advance / Token Paid',
    status_closed: 'Deal Won / Closed',
    status_lost: 'Lost / Dropped',

    // Req
    req_buy: 'Buy',
    req_rent: 'Rent',
    req_sell: 'Sell',
    req_lease: 'Lease',

    // Priority
    priority_hot: 'Hot',
    priority_warm: 'Warm',
    priority_cold: 'Cold',

    // Buttons
    btn_save: 'Save',
    btn_cancel: 'Cancel',
    btn_edit: 'Edit',
    btn_delete: 'Delete',
    btn_close: 'Close',
    btn_call: 'Call',
    btn_whatsapp: 'WhatsApp',
    btn_share: 'Share',
    btn_done: 'Done',
    trial_ended: 'Aapka free trial end ho gaya hai.',
    trial_desc: 'Property Agent Lead Tracker use karte rehne ke liye:',
    unlock_unlimited: 'Unlimited Leads & Cloud Sync Unlock Karein',
  },
};
