import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { crmApi } from './api/crmApi';
import { useCrmRealtime } from './hooks/useCrmRealtime';
import LeadDetailsModal from './components/LeadDetailsModal';
import InstallPWA from './components/InstallPWA';
import MobileLeadCards from './components/MobileLeadCards';
import MobileTaskCards from './components/MobileTaskCards';
import CrmDashboard from './components/CrmDashboard';
import ErrorBoundary from './components/ErrorBoundary';
import ScrollNav from './components/ScrollNav';
import CallLogSheet from './components/CallLogSheet';
import LeadExportModal from './components/LeadExportModal';
import WhatsAppButton from './components/WhatsAppButton';
import FilterPanel from './components/filters/FilterPanel';
import FilterChips from './components/filters/FilterChips';
import {
  LEAD_FIELDS, LEAD_DATE_FIELDS, LEAD_SORTS, TASK_FIELDS, TASK_DATE_FIELDS,
  EMPTY_LEAD_FILTERS, EMPTY_TASK_FILTERS, countActive, toQueryParams,
} from './components/filters/filterConfig';
import { useSavedFilters } from './hooks/useSavedFilters';
import { useCallFlow } from './hooks/useCallFlow';
import { showLeadNotification } from './utils/notifications';
import {
  getPushState, enablePush, disablePush, unsubscribeOnLogout,
  getServiceWorkerPushVersion, showLocalTestNotification, sendTestPushAndWait,
} from './utils/push';
import {
  Users, CheckSquare, Search, RefreshCw, MoreVertical,
  Calendar, Building2, UserPlus, ArrowRightLeft, Trash2, Edit3,
  Eye, Bell, BellOff, Wifi, Layers, Plus, Link2, ShieldCheck, LogOut, Lock, X,
  Home, MapPin, Phone, MessageCircle, Download, SlidersHorizontal
} from 'lucide-react';

const PUSH_BANNER_DISMISSED_KEY = 'crm_push_banner_dismissed';

export default function App() {
  // Auth & Current Tenant User State
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('crm_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register_company'
  const [authError, setAuthError] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerCompanyForm, setRegisterCompanyForm] = useState({
    companyName: '',
    adminName: '',
    adminEmail: '',
    password: ''
  });

  const isAdmin = currentUser?.accessRole === 'CompanyAdmin' || currentUser?.accessRole === 'SuperAdmin';
  const canViewAll = isAdmin || !!currentUser?.canViewAllCompanyLeads;

  // Leads / Tasks filters (remembered per user on this device). People filters only for users who see others' records.
  const leadFields = useMemo(() => LEAD_FIELDS.filter((f) => !f.people || canViewAll), [canViewAll]);
  const taskFields = useMemo(() => TASK_FIELDS.filter((f) => !f.people || canViewAll), [canViewAll]);
  const [leadFilters, setLeadFilters, clearLeadFilters] = useSavedFilters(currentUser?.id, 'leads', LEAD_FIELDS, EMPTY_LEAD_FILTERS);
  const [taskFilters, setTaskFilters, clearTaskFilters] = useSavedFilters(currentUser?.id, 'tasks', TASK_FIELDS, EMPTY_TASK_FILTERS);
  const leadParamsKey = JSON.stringify(toQueryParams(leadFilters, leadFields));
  const taskParamsKey = JSON.stringify(toQueryParams(taskFilters, taskFields));
  const leadFilterParams = useMemo(() => JSON.parse(leadParamsKey), [leadParamsKey]);
  const taskFilterParams = useMemo(() => JSON.parse(taskParamsKey), [taskParamsKey]);
  const [leadFilterOptions, setLeadFilterOptions] = useState(null);
  const [taskFilterOptions, setTaskFilterOptions] = useState(null);
  const [loadingFilterOptions, setLoadingFilterOptions] = useState(false);
  const [filterPanel, setFilterPanel] = useState(null); // 'leads' | 'tasks' | null
  const [taskSearchInput, setTaskSearchInput] = useState(taskFilters.search || '');

  const [activePage, setActivePage] = useState('crm'); // 'crm' | 'leads' | 'tasks' | 'campaigns' | 'team' | 'projects'
  const [projects, setProjects] = useState([]);
  const [editingProject, setEditingProject] = useState(null); // null = closed, {} = new, {id,...} = edit
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [addLeadForm, setAddLeadForm] = useState({
    name: '', primaryNo: '', email: '', requirement: '', subLocation: '',
    budget: '', remark: '', ethnicity: '', tags: '', formName: '', projectId: ''
  });
  const [counts, setCounts] = useState(null);
  const [lookups, setLookups] = useState({ teamMembers: [], projects: [], channelPartners: [], stages: [] });

  // Leads State
  const [activeLeadTab, setActiveLeadTab] = useState('all_total');
  const [searchQuery, setSearchQuery] = useState('');
  const [leadsData, setLeadsData] = useState({ totalCount: 0, page: 1, pageSize: 50, data: [] });
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [currentLeadPage, setCurrentLeadPage] = useState(1);

  // Tasks State
  const [activeTaskTab, setActiveTaskTab] = useState('today');
  const [tasksData, setTasksData] = useState({
    counts: { todaysTask: 0, upcomingTask: 0, pendingTasks: 0, completedTasks: 0 },
    data: [],
    totalCount: 0,
    page: 1,
    pageSize: 50
  });
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [currentTaskPage, setCurrentTaskPage] = useState(1);

  // Campaigns & Connected Meta Pages State
  const [campaigns, setCampaigns] = useState([]);
  const [metaPagesInfo, setMetaPagesInfo] = useState({ appId: '', pages: [] });
  const [adAccountInput, setAdAccountInput] = useState('');
  const [syncingCampaigns, setSyncingCampaigns] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [showManualPageModal, setShowManualPageModal] = useState(false);
  const [manualPageForm, setManualPageForm] = useState({
    pageId: '',
    pageName: '',
    pageAccessToken: '',
    defaultProjectId: ''
  });
  const [connectingOAuth, setConnectingOAuth] = useState(false);

  // Team & RBAC Management State
  const [companyUsers, setCompanyUsers] = useState({ totalCount: 0, page: 1, pageSize: 50, data: [] });
  const [currentTeamPage, setCurrentTeamPage] = useState(1);
  const [editingUser, setEditingUser] = useState(null); // user being edited
  const [holidayUser, setHolidayUser] = useState(null); // user for holiday modal
  const [holidayForm, setHolidayForm] = useState({ start: '', end: '' });
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    phone:'',
    password: '',
    departmentRole: 'PreSales',
    accessRole: 'Worker',
    canViewAllCompanyLeads: false
  });

  // Action Menu, Modal & Live Toast State
  const [openMenuLeadId, setOpenMenuLeadId] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [formState, setFormState] = useState({});
  const [liveToast, setLiveToast] = useState(null);
  const [viewLeadModalOpen, setViewLeadModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [viewTasksModalOpen, setViewTasksModalOpen] = useState(false);
  const [leadTasks, setLeadTasks] = useState([]);
  const [viewTaskModalOpen, setViewTaskModalOpen] = useState(false);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);

  // Web Push (background notifications) for this device
  const [pushState, setPushState] = useState('unknown'); // unknown | unsupported | ios-needs-install | denied | off | on
  const [pushBusy, setPushBusy] = useState(false);
  const [pushBannerDismissed, setPushBannerDismissed] = useState(
    () => localStorage.getItem(PUSH_BANNER_DISMISSED_KEY) === '1'
  );
  // Lead to open from a notification tap (?lead=<id>), kept until the user is logged in
  const pendingLeadIdRef = useRef(new URLSearchParams(window.location.search).get('lead'));

  const handleLogout = async () => {
    // Stop this device receiving the user's alerts (shared phones). Capped so logout never hangs.
    await Promise.race([unsubscribeOnLogout(), new Promise((r) => setTimeout(r, 5000))]);
    setPushState('off');
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setCurrentUser(null);
    setActivePage('leads');
  };

  // Data Fetching Functions
  const loadCountsAndLookups = useCallback(async () => {
    if (!currentUser) return;
    try {
      // Bucket counts follow the active Leads filters
      const [c, l] = await Promise.all([crmApi.getDashboardCounts(leadFilterParams), crmApi.getLookups()]);
      setCounts(c);
      setLookups(l);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
      console.error('Failed loading counts/lookups:', err);
    }
  }, [currentUser, leadFilterParams]);

  const loadLeads = useCallback(async (tab = activeLeadTab, search = searchQuery, page = currentLeadPage) => {
    if (!currentUser) return;
    setLoadingLeads(true);
    try {
      const res = await crmApi.getLeads(tab, search, page, leadFilterParams);
      setLeadsData(res);
    } catch (err) {
      console.error('Failed loading leads:', err);
      if (err.response?.status === 400) {
        // A saved filter the server no longer accepts: drop it rather than leave the page empty
        alert('Some saved filters were invalid and have been cleared: ' + (err.response.data?.message || ''));
        clearLeadFilters();
      }
    } finally {
      setLoadingLeads(false);
    }
  }, [currentUser, activeLeadTab, searchQuery, currentLeadPage, leadFilterParams, clearLeadFilters]);

  const loadTasks = useCallback(async (tab = activeTaskTab, page = currentTaskPage) => {
    if (!currentUser) return;
    setLoadingTasks(true);
    try {
      const res = await crmApi.getTasks(tab, page, taskFilterParams);
      setTasksData(res);
    } catch (err) {
      console.error('Failed loading tasks:', err);
      if (err.response?.status === 400) {
        alert('Some saved filters were invalid and have been cleared: ' + (err.response.data?.message || ''));
        clearTaskFilters();
      }
    } finally {
      setLoadingTasks(false);
    }
  }, [currentUser, activeTaskTab, currentTaskPage, taskFilterParams, clearTaskFilters]);

  // Dropdown values for the filter panels (only what this user can see)
  const fetchFilterOptions = useCallback(async (which) => {
    try {
      if (which === 'leads') setLeadFilterOptions(await crmApi.getLeadFilterOptions());
      else setTaskFilterOptions(await crmApi.getTaskFilterOptions());
    } catch (err) {
      console.error('Failed loading filter options:', err);
    }
  }, []);
  // With a loading indicator (used when a panel opens)
  const loadFilterOptions = useCallback(async (which) => {
    setLoadingFilterOptions(true);
    await fetchFilterOptions(which);
    setLoadingFilterOptions(false);
  }, [fetchFilterOptions]);

  const loadCampaignsAndPages = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [campData, pagesData] = await Promise.all([
        crmApi.getCampaigns(),
        crmApi.getConnectedPages()
      ]);
      setCampaigns(campData);
      setMetaPagesInfo(pagesData || { appId: '', pages: [] });
    } catch (err) {
      console.error('Failed loading campaigns/pages:', err);
    }
  }, [currentUser]);

  const loadCompanyUsers = useCallback(async (page = currentTeamPage) => {
    if (!currentUser) return;
    try {
      const users = await crmApi.getCompanyUsers(page);
      setCompanyUsers(users);
    } catch (err) {
      console.error('Failed loading company users:', err);
    }
  }, [currentUser, currentTeamPage]);

  const loadProjects = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await crmApi.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed loading projects:', err);
    }
  }, [currentUser]);

  // Real-Time SignalR Handler
  const handleRealtimeLead = useCallback((notification) => {
    if (!currentUser) return;
    setLiveToast(notification);
    
    // Show push notification
    showLeadNotification(notification);
    
    loadCountsAndLookups();
    if (activePage === 'leads') loadLeads(activeLeadTab, searchQuery);
    else if (activePage === 'tasks') loadTasks(activeTaskTab);
    else if (activePage === 'campaigns') loadCampaignsAndPages();

    setTimeout(() => {
      setLiveToast((current) => (current?.id === notification.id ? null : current));
    }, 7000);
  }, [currentUser, activePage, activeLeadTab, activeTaskTab, searchQuery, loadCountsAndLookups, loadLeads, loadTasks, loadCampaignsAndPages]);

  const wsStatus = useCrmRealtime(handleRealtimeLead, currentUser);
  const { sheet: callSheet, startCall, logManual, closeSheet: closeCallSheet } = useCallFlow({
    enabled: !!currentUser,
    onChange: () => refreshAll(),
  });

  useEffect(() => {
    if (currentUser) {
      loadCountsAndLookups();
    }
  }, [currentUser, loadCountsAndLookups]);

  // Push state for this device. Permission is only requested from a tap (banner / bell), as iOS requires.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    getPushState().then((s) => { if (!cancelled) setPushState(s); });
    return () => { cancelled = true; };
  }, [currentUser]);

  const openLeadFromNotification = useCallback((leadId) => {
    if (!leadId) return;
    setSelectedLeadId(leadId);
    setViewLeadModalOpen(true);
  }, []);

  // Notification tap → open that lead (?lead=<id> on launch, or a message from the service worker if the app is open)
  useEffect(() => {
    if (!currentUser) return;
    if (pendingLeadIdRef.current) {
      openLeadFromNotification(pendingLeadIdRef.current);
      pendingLeadIdRef.current = null;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.has('lead')) {
      params.delete('lead');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    }
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event) => {
      if (event.data?.type !== 'OPEN_URL') return;
      try {
        openLeadFromNotification(new URL(event.data.url).searchParams.get('lead'));
      } catch { /* ignore malformed */ }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [currentUser, openLeadFromNotification]);

  const handleEnablePush = async () => {
    setPushBusy(true);
    try {
      const s = await enablePush();
      setPushState(s);
      if (s === 'denied') alert('Notifications are blocked for this app. Turn them on in your phone or browser settings, then try again.');
    } catch (err) {
      console.error('Enable push failed:', err);
      alert('Could not turn on notifications: ' + (err?.response?.data?.message || err.message));
      setPushState(await getPushState());
    } finally {
      setPushBusy(false);
      setOpenMenuLeadId(null);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    try {
      setPushState(await disablePush());
    } catch (err) {
      console.error('Disable push failed:', err);
      setPushState(await getPushState());
    } finally {
      setPushBusy(false);
      setOpenMenuLeadId(null);
    }
  };

  // Bell-menu diagnostics: is the current push code running, and does a test push reach this phone?
  const [pushSwVersion, setPushSwVersion] = useState(undefined); // undefined = not checked, null = no answer
  const [pushTest, setPushTest] = useState(null); // { tone: 'info'|'ok'|'warn'|'error', text }

  useEffect(() => {
    if (openMenuLeadId !== 'push-menu' || pushState !== 'on') return;
    let cancelled = false;
    getServiceWorkerPushVersion().then((v) => { if (!cancelled) setPushSwVersion(v); });
    return () => { cancelled = true; };
  }, [openMenuLeadId, pushState]);

  const handleTestPush = async () => {
    setPushTest({ tone: 'info', text: 'Sending… keep the app open for a few seconds.' });
    try {
      const r = await sendTestPushAndWait();
      if (!r.sent) setPushTest({ tone: 'error', text: `Not sent: ${r.error}` });
      else if (r.received) setPushTest({ tone: 'ok', text: 'Delivered to this phone. If no notification appeared, the phone is hiding them: check Settings → Notifications for this app, and Focus mode.' });
      else if (r.partial) setPushTest({ tone: 'error', text: `This phone did not receive it. ${r.partial}` });
      else setPushTest({ tone: 'warn', text: 'The push service accepted it, but this phone did not confirm receiving it. Fully close the app (swipe it away), reopen it from the home-screen icon, then tap Turn off and Turn on.' });
    } catch (err) {
      setPushTest({ tone: 'error', text: 'Test failed: ' + (err?.response?.data?.message || err.message) });
    }
  };

  const handleLocalTest = async () => {
    try {
      await showLocalTestNotification();
      setPushTest({ tone: 'info', text: 'Local notification shown. If you saw nothing, notifications for this app are hidden in the phone settings.' });
    } catch (err) {
      setPushTest({ tone: 'error', text: 'Could not show a notification: ' + err.message });
    }
  };

  const dismissPushBanner = () => {
    localStorage.setItem(PUSH_BANNER_DISMISSED_KEY, '1');
    setPushBannerDismissed(true);
  };

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenuLeadId && 
          !event.target.closest('.action-menu-container') &&
          !event.target.closest('.mobile-action-sheet')) {
        setOpenMenuLeadId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuLeadId]);

  useEffect(() => {
    if (!currentUser) return;
    if (activePage === 'leads') loadLeads(activeLeadTab, searchQuery, currentLeadPage);
    else if (activePage === 'tasks') loadTasks(activeTaskTab, currentTaskPage);
    else if (activePage === 'campaigns') loadCampaignsAndPages();
    else if (activePage === 'team') loadCompanyUsers(currentTeamPage);
    else if (activePage === 'projects') loadProjects();
  }, [currentUser, activePage, activeLeadTab, activeTaskTab, currentLeadPage, currentTaskPage, currentTeamPage, loadLeads, loadTasks, loadCampaignsAndPages, loadCompanyUsers, loadProjects]);

  // Reset to page 1 when changing tabs, search or filters
  useEffect(() => {
    setCurrentLeadPage(1);
  }, [activeLeadTab, searchQuery, leadParamsKey]);

  useEffect(() => {
    setCurrentTaskPage(1);
  }, [activeTaskTab, taskParamsKey]);

  // Chip labels (names for ids) need the options; preload them quietly once per page
  useEffect(() => {
    if (!currentUser) return;
    const failed = (err) => console.error('Failed loading filter options:', err);
    if (activePage === 'leads' && !leadFilterOptions) crmApi.getLeadFilterOptions().then(setLeadFilterOptions).catch(failed);
    if (activePage === 'tasks' && !taskFilterOptions) crmApi.getTaskFilterOptions().then(setTaskFilterOptions).catch(failed);
  }, [activePage, currentUser, leadFilterOptions, taskFilterOptions]);

  // Task search: applied shortly after typing stops
  useEffect(() => {
    const t = setTimeout(() => {
      setTaskFilters((f) => (f.search === taskSearchInput ? f : { ...f, search: taskSearchInput }));
    }, 400);
    return () => clearTimeout(t);
  }, [taskSearchInput, setTaskFilters]);

  const openFilterPanel = (which) => {
    setFilterPanel(which);
    loadFilterOptions(which); // refresh so new values show up
  };

  const refreshAll = () => {
    loadCountsAndLookups();
    if (activePage === 'leads') loadLeads(activeLeadTab, searchQuery, currentLeadPage);
    else if (activePage === 'tasks') loadTasks(activeTaskTab, currentTaskPage);
    else if (activePage === 'campaigns') loadCampaignsAndPages();
    else if (activePage === 'team') loadCompanyUsers(currentTeamPage);
    else if (activePage === 'projects') loadProjects();
  };

  // Login / Company Registration Submit Handlers
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await crmApi.login(loginForm.email, loginForm.password);
      localStorage.setItem('crm_token', res.token);
      localStorage.setItem('crm_user', JSON.stringify(res.user));
      setCurrentUser(res.user);
    } catch (err) {
      setAuthError(err.response?.data?.message || 'Invalid login credentials.');
    }
  };

  const handleRegisterCompanySubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await crmApi.registerCompany(registerCompanyForm);
      const res = await crmApi.login(registerCompanyForm.adminEmail, registerCompanyForm.password);
      localStorage.setItem('crm_token', res.token);
      localStorage.setItem('crm_user', JSON.stringify(res.user));
      setCurrentUser(res.user);
    } catch (err) {
      setAuthError(err.response?.data?.message || 'Failed registering company.');
    }
  };

  // Dynamic Facebook JS SDK Loader + OAuth Popup Handler
  const handleFacebookOAuthConnect = () => {
    const appId = metaPagesInfo.appId;
    if (!appId) {
      alert('Meta:AppId is empty in appsettings.json. Use "+ Link Page via Token" or configure AppId first.');
      return;
    }

    setConnectingOAuth(true);

    const launchFbLogin = () => {
      window.FB.init({
        appId: appId,
        cookie: true,
        xfbml: false,
        version: 'v26.0'
      });

      window.FB.login(
        (response) => {
          if (response.authResponse && response.authResponse.accessToken) {
            crmApi
              .connectPagesOAuth(response.authResponse.accessToken)
              .then(async (res) => {
                alert(`Successfully connected ${res.connectedPages} Facebook Page(s) with permanent tokens!`);
                await crmApi.syncCampaigns(adAccountInput);
                await loadCampaignsAndPages();
              })
              .catch((err) => {
                console.error('OAuth exchange failed:', err);
                alert('Failed exchanging token: ' + (err.response?.data || err.message));
              })
              .finally(() => setConnectingOAuth(false));
          } else {
            setConnectingOAuth(false);
          }
        },
        {
          scope: 'pages_show_list,leads_retrieval,pages_manage_ads,pages_manage_metadata,pages_read_engagement,ads_management'
        }
      );
    };

    if (window.FB) {
      launchFbLogin();
    } else {
      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.onload = launchFbLogin;
      script.onerror = () => {
        setConnectingOAuth(false);
        alert('Could not load Facebook SDK. Use "+ Link Page via Token".');
      };
      document.body.appendChild(script);
    }
  };

  const fmtDate = (val) => {
    if (!val || val === '-') return '-';
    const date = new Date(val);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Handler for task actions
  const handleTaskAction = async (action, task) => {
    setOpenTaskMenuId(null);
    
    switch (action) {
      case 'view':
        try {
          const details = await crmApi.getTask(task.id);
          setSelectedTaskDetails(details);
          setViewTasksModalOpen(false); // Close the tasks list modal
          setViewTaskModalOpen(true);
        } catch (err) {
          console.error('Failed loading task details:', err);
        }
        break;
        
      case 'navigate_to_lead':
        if (task.leadId) {
          setSelectedLeadId(task.leadId);
          setViewLeadModalOpen(true);
        }
        break;
        
      case 'mark_done':
        const outcome = window.prompt('Enter call/visit outcome remark:', task.remark);
        if (outcome !== null) {
          await crmApi.completeTask(task.id, { outcomeRemark: outcome });
          setViewTasksModalOpen(false); // Close modal after marking done
          refreshAll();
        }
        break;
    }
  };

  const handleRowAction = async (action, lead) => {
    setOpenMenuLeadId(null);

    // Call actions must run synchronously inside the tap so the phone dialer opens
    if (action === 'call') { startCall(lead); return; }
    if (action === 'log_call') { logManual(lead); return; }

    try {
    if (action === 'add_task') {
      // Check if lead has existing tasks
      try {
        const tasks = await crmApi.getLeadTasks(lead.id);
        if (tasks && tasks.length > 0) {
          // Lead has tasks - show tasks modal
          setLeadTasks(tasks);
          setViewTasksModalOpen(true);
          return;
        }
      } catch (err) {
        console.error('Failed checking lead tasks:', err);
      }
      // No tasks or error - show add task form (fall through to setFormState below)
    }

    if (action === 'convert') {
      await crmApi.convertToContact(lead.id);
      refreshAll();
      return;
    }
    if (action === 'remove_cp') {
      await crmApi.removeChannelPartner(lead.id);
      refreshAll();
      return;
    }
    if (action === 'delete') {
      if (window.confirm(`Delete lead ${lead.name} (${lead.leadId})?`)) {
        await crmApi.deleteLead(lead.id);
        refreshAll();
      }
      return;
    }
    if (action === 'view') {
      setSelectedLeadId(lead.id);
      setViewLeadModalOpen(true);
      return;
    }

    if (action === 'update_stage') {
      setFormState({
        stage: lead.leadStage || 'New Lead',
        stageReason: '',
        updateStage: true,
        remark: '',
      });
      setActiveModal({ type: 'update_stage', lead });
      return;
    }

    setFormState({
      stage: lead.leadStage || 'Call Back',
      stageReason: lead.stageReason !== '-' ? lead.stageReason : 'Customer Was Traveling Ask To Callback',
      updateStage: false,
      activityType: 'CALL',
      scheduleDate: new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 16),
      title: `Followup Task With ${lead.name}`,
      remark: lead.remark !== '-' ? lead.remark : '',
      ownerRole: 'PreSales',
      teamMemberId: currentUser?.id || lookups.teamMembers?.[0]?.id || 1,
      channelPartnerId: lookups.channelPartners?.[0]?.id || 1,
      projectId: lookups.projects?.[0]?.id || 1,
      name: lead.name,
      primaryNo: lead.primaryNo,
      status: lead.status,
      requirement: lead.requirement !== '-' ? lead.requirement : '',
      subLocation: lead.subLocation !== '-' ? lead.subLocation : '',
      budget: lead.budget !== '-' ? lead.budget : '',
      ethnicity: lead.ethnicity !== '-' ? lead.ethnicity : '',
      tags: (lead.tags || []).join(',')
    });
    setActiveModal({ type: action, lead });
    } catch (err) {
      console.error('handleRowAction error:', err);
      alert('Action failed: ' + (err?.message || err));
    }
  };

  const submitModal = async (e) => {
    e.preventDefault();
    if (!activeModal) return;
    const { type, lead } = activeModal;

    if (type === 'add_task') {
      await crmApi.addTask(lead.id, {
        assignedById: currentUser.id,
        assignedToId: Number(formState.teamMemberId),
        scheduleDate: new Date(formState.scheduleDate).toISOString(),
        title: formState.title || `Followup Task With ${lead.name}`,
        remark: formState.remark,
        activityType: formState.activityType,
        stage: formState.updateStage !== false ? formState.stage : lead.leadStage
      });
    } else if (type === 'transfer') {
      await crmApi.transferLead(lead.id, {
        preSalesAgentId: formState.preSalesAgentId ? Number(formState.preSalesAgentId) : null,
        salesAgentId: formState.salesAgentId ? Number(formState.salesAgentId) : null,
        sourcingManagerId: formState.sourcingManagerId ? Number(formState.sourcingManagerId) : null,
        reason: formState.remark
      });
    } else if (type === 'add_owner') {
      await crmApi.addOwner(lead.id, {
        ownerRole: formState.ownerRole,
        teamMemberId: Number(formState.teamMemberId)
      });
    } else if (type === 'remove_owner') {
      await crmApi.removeOwner(lead.id, formState.ownerRole);
    } else if (type === 'add_cp') {
      await crmApi.addChannelPartner(lead.id, Number(formState.channelPartnerId));
    } else if (type === 'suggest_property') {
      await crmApi.suggestProperty(lead.id, Number(formState.projectId));
    } else if (type === 'update_stage') {
      await crmApi.changeStage(lead.id, {
        stage: formState.stage,
        stageReason: formState.stageReason,
        remark: formState.remark,
      });
    } else if (type === 'edit') {
      await crmApi.editLead(lead.id, {
        name: formState.name,
        primaryNo: formState.primaryNo,
        status: formState.status,
        requirement: formState.requirement,
        subLocation: formState.subLocation,
        budget: formState.budget,
        ethnicity: formState.ethnicity,
        tags: formState.tags,
        remark: formState.remark
      });
    }

    setActiveModal(null);
    refreshAll();
  };

  // RENDER LOGIN / CLIENT ONBOARDING SCREEN IF NOT AUTHENTICATED
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-7">
          <div className="flex items-center gap-2.5 font-bold text-xl text-slate-900 mb-1">
            <Building2 className="w-6 h-6 text-indigo-600" />
            <span>CRM Portal</span>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            Lead Management System for Real Estate
          </p>

          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {authError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-3.5 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
              <input
                type="email"
                required
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition"
            >
              Sign In to Workspace
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white px-3 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 shadow">
        <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto sm:flex-1 sm:min-w-0">
          <div>
            <div className="flex items-center gap-2 font-bold text-sm sm:text-base tracking-tight">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
              <span>{currentUser.companyName || 'CRM'}</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
              <span className="truncate max-w-[100px] sm:max-w-none">{currentUser.name}</span> •
              <span className="text-indigo-400 font-semibold">{currentUser.accessRole}</span>
              {!isAdmin && (
                <span className="px-1.5 py-0.2 bg-slate-800 rounded text-[9px] sm:text-[10px] text-amber-300 whitespace-nowrap">
                  {currentUser.canViewAllCompanyLeads ? 'Scope: All Company Leads' : 'Scope: Assigned to Me Only'}
                </span>
              )}
            </div>
          </div>

          <ScrollNav className="hidden sm:block">
            <button
              onClick={() => setActivePage('crm')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition whitespace-nowrap flex-shrink-0 ${
                activePage === 'crm' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Home className="w-4 h-4" /> CRM
            </button>
            <button
              onClick={() => setActivePage('leads')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition whitespace-nowrap flex-shrink-0 ${
                activePage === 'leads' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" /> Leads
            </button>
            <button
              onClick={() => setActivePage('tasks')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition whitespace-nowrap flex-shrink-0 ${
                activePage === 'tasks' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <CheckSquare className="w-4 h-4" /> Tasks
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setActivePage('campaigns')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition whitespace-nowrap flex-shrink-0 ${
                    activePage === 'campaigns' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Layers className="w-4 h-4" /> Campaigns
                </button>
                <button
                  onClick={() => setActivePage('team')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition whitespace-nowrap flex-shrink-0 ${
                    activePage === 'team' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Lock className="w-4 h-4" /> Team
                </button>
                <button
                  onClick={() => setActivePage('projects')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition whitespace-nowrap flex-shrink-0 ${
                    activePage === 'projects' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Home className="w-4 h-4" /> Projects
                </button>
              </>
            )}
          </ScrollNav>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex flex-wrap sm:hidden gap-1.5 w-full pb-1">
          <button
            onClick={() => setActivePage('crm')}
            className={`px-2.5 py-1.5 rounded-md text-[10px] font-medium flex items-center gap-1 transition whitespace-nowrap ${
              activePage === 'crm' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            <Home className="w-3.5 h-3.5" /> CRM
          </button>
          <button
            onClick={() => setActivePage('leads')}
            className={`px-2.5 py-1.5 rounded-md text-[10px] font-medium flex items-center gap-1 transition whitespace-nowrap ${
              activePage === 'leads' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Leads
          </button>
          <button
            onClick={() => setActivePage('tasks')}
            className={`px-2.5 py-1.5 rounded-md text-[10px] font-medium flex items-center gap-1 transition whitespace-nowrap ${
              activePage === 'tasks' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" /> Tasks
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => setActivePage('campaigns')}
                className={`px-2.5 py-1.5 rounded-md text-[10px] font-medium flex items-center gap-1 transition whitespace-nowrap ${
                  activePage === 'campaigns' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Campaigns
              </button>
              <button
                onClick={() => setActivePage('team')}
                className={`px-2.5 py-1.5 rounded-md text-[10px] font-medium flex items-center gap-1 transition whitespace-nowrap ${
                  activePage === 'team' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                <Lock className="w-3.5 h-3.5" /> Team
              </button>
              <button
                onClick={() => setActivePage('projects')}
                className={`px-2.5 py-1.5 rounded-md text-[10px] font-medium flex items-center gap-1 transition whitespace-nowrap ${
                  activePage === 'projects' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                <Home className="w-3.5 h-3.5" /> Projects
              </button>
            </>
          )}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto sm:flex-shrink-0 justify-between sm:justify-end">
          <span className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-full font-medium ${
            wsStatus === 'Connected'
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              : 'bg-amber-950 text-amber-400 border border-amber-800'
          }`}>
            <Wifi className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden xl:inline">{wsStatus === 'Connected' ? 'Live Sync Active' : wsStatus}</span>
            <span className="xl:hidden">{wsStatus === 'Connected' ? 'Live' : 'Off'}</span>
          </span>
          <button
            onClick={refreshAll}
            className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs bg-slate-800 hover:bg-slate-700 px-2 sm:px-3 py-1.5 rounded border border-slate-700"
          >
            <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden xl:inline">Refresh</span>
          </button>
          {/* Notifications toggle for this device */}
          <div className="relative action-menu-container">
            <button
              onClick={() => setOpenMenuLeadId(openMenuLeadId === 'push-menu' ? null : 'push-menu')}
              aria-label="Notifications"
              data-testid="push-bell"
              className={`flex items-center gap-1 text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 rounded border ${
                pushState === 'on'
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {pushState === 'on'
                ? <Bell className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                : <BellOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
              <span className="hidden xl:inline">{pushState === 'on' ? 'Alerts On' : 'Alerts Off'}</span>
            </button>
            {openMenuLeadId === 'push-menu' && (
              <div className="absolute right-0 top-9 w-64 bg-white text-slate-700 border border-slate-200 rounded-lg shadow-2xl p-3 z-[100] text-left text-xs space-y-2">
                <div className="font-semibold text-slate-900">Notifications on this device</div>
                {pushState === 'on' && (
                  <>
                    <p className="text-slate-500">On. You'll get lead alerts even when the app is closed.</p>
                    {pushSwVersion === null && (
                      <p className="text-amber-700 bg-amber-50 rounded px-2 py-1.5" data-testid="push-sw-outdated">
                        This phone is running an older version of the app. Fully close the app (swipe it away) and reopen it.
                      </p>
                    )}
                    <button onClick={handleTestPush} disabled={pushTest?.tone === 'info' && pushTest.text.startsWith('Sending')} className="w-full px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50">Send test notification</button>
                    <button onClick={handleLocalTest} className="w-full px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200">Show local notification</button>
                    {pushTest && (
                      <p data-testid="push-test-result" className={`rounded px-2 py-1.5 ${
                        { ok: 'bg-emerald-50 text-emerald-800', warn: 'bg-amber-50 text-amber-800', error: 'bg-rose-50 text-rose-700', info: 'bg-slate-50 text-slate-600' }[pushTest.tone]
                      }`}>{pushTest.text}</p>
                    )}
                    <button onClick={handleDisablePush} disabled={pushBusy} className="w-full px-3 py-1.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50">Turn off</button>
                  </>
                )}
                {pushState === 'off' && (
                  <>
                    <p className="text-slate-500">Get new lead, returning lead and transfer alerts even when the app is closed.</p>
                    <button onClick={handleEnablePush} disabled={pushBusy} className="w-full px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">{pushBusy ? 'Turning on…' : 'Turn on'}</button>
                  </>
                )}
                {pushState === 'denied' && (
                  <p className="text-slate-500">Notifications are blocked. Allow them for this app in your phone or browser settings, then reopen the app.</p>
                )}
                {pushState === 'ios-needs-install' && (
                  <p className="text-slate-500">On iPhone, tap Share → "Add to Home Screen", then open the app from its icon and turn alerts on there (iOS 16.4+).</p>
                )}
                {(pushState === 'unsupported' || pushState === 'unknown') && (
                  <p className="text-slate-500">This browser doesn't support background notifications.</p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-[10px] sm:text-xs bg-rose-950/80 hover:bg-rose-900 text-rose-300 px-2 sm:px-3 py-1.5 rounded border border-rose-800"
          >
            <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* One-time opt-in banner for background notifications */}
      {!pushBannerDismissed && (pushState === 'off' || pushState === 'ios-needs-install') && (
        <div data-testid="push-banner" className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <Bell className="hidden sm:block w-5 h-5 flex-shrink-0 text-indigo-600" />
          <div className="flex-1">
            {pushState === 'off'
              ? 'Turn on notifications to get new lead alerts even when the app is closed.'
              : 'To get lead alerts on iPhone, tap Share → "Add to Home Screen", then open the app from its icon and turn on notifications.'}
          </div>
          <div className="flex gap-2">
            {pushState === 'off' && (
              <button onClick={async () => { await handleEnablePush(); dismissPushBanner(); }} disabled={pushBusy}
                className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
                {pushBusy ? 'Turning on…' : 'Enable'}
              </button>
            )}
            <button onClick={dismissPushBanner} className="px-3 py-1.5 rounded bg-white border border-indigo-200 text-indigo-700 text-xs hover:bg-indigo-100">
              Not now
            </button>
          </div>
        </div>
      )}

      <main className="space-y-4 sm:space-y-6">
        {activePage === 'crm' ? (
          <ErrorBoundary>
            <CrmDashboard
              onOpenStage={(stage) => {
                // Start from clean filters so saved ones don't hide the stage's leads
                setSearchQuery('');
                setCurrentLeadPage(1);
                setLeadFilters({ ...EMPTY_LEAD_FILTERS, stage: [stage] });
                setActiveLeadTab('all_total');
                setActivePage('leads');
              }}
              onOpenTasks={(tab) => {
                setCurrentTaskPage(1);
                setActiveTaskTab(tab);
                setActivePage('tasks');
              }}
            />
          </ErrorBoundary>
        ) : activePage === 'leads' ? (
          <div className="px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6  ">
            {/* 1. ALL LEADS & TODAY'S LEADS SUMMARY TABS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 shadow-xs overflow-hidden">
                <h2 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-2 sm:mb-3 !text-black">
  1. {isAdmin || currentUser.canViewAllCompanyLeads ? 'All Company Leads' : 'My Assigned Leads'}
</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                  {[
                    { key: 'all_total', label: 'Total', val: counts?.allLeads?.total ?? 0 },
                    { key: 'all_fresh_untouched', label: 'Fresh Untouched', val: counts?.allLeads?.freshUntouched ?? 0 },
                    { key: 'all_returning', label: 'Returning', val: counts?.allLeads?.returning ?? 0 },
                    { key: 'all_unassigned', label: 'Unassigned', val: counts?.allLeads?.unassigned ?? 0 },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setActiveLeadTab(item.key)}
                      className={`p-2 sm:p-3 rounded-lg border text-left transition min-h-[60px] sm:min-h-0 ${
                        activeLeadTab === item.key
                          ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-lg sm:text-2xl font-bold text-slate-900">{item.val}</div>
                      <div className="text-[9px] sm:text-xs font-medium text-slate-600 mt-0.5 line-clamp-2 leading-tight">{item.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 shadow-xs overflow-hidden">
                <h2 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-2 sm:mb-3 !text-black">
                  2. Today's Leads (IST)
                </h2>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
                  {[
                    { key: 'today_leads', label: 'Leads', val: counts?.todaysLeads?.leads ?? 0 },
                    { key: 'today_fresh', label: 'Fresh Leads', val: counts?.todaysLeads?.freshLeads ?? 0 },
                    { key: 'today_returning', label: 'Returning', val: counts?.todaysLeads?.returning ?? 0 },
                    { key: 'JUMP_TASKS', label: 'Tasks', val: counts?.todaysLeads?.tasks ?? 0 },
                    { key: 'today_site_visits', label: 'Site Visits', val: counts?.todaysLeads?.siteVisits ?? 0 },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        if (item.key === 'JUMP_TASKS') {
                          setActiveTaskTab('today');
                          setActivePage('tasks');
                        } else {
                          setActiveLeadTab(item.key);
                        }
                      }}
                      className={`p-2 sm:p-3 rounded-lg border text-left transition min-h-[60px] sm:min-h-0 ${
                        activeLeadTab === item.key
                          ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-lg sm:text-2xl font-bold text-slate-900">{item.val}</div>
                      <div className="text-[9px] sm:text-xs font-medium text-slate-600 mt-0.5 line-clamp-2 leading-tight">{item.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Search & Active Filter Bar */}
            <div className="bg-white rounded-lg border border-slate-200 px-3 sm:px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs sm:text-sm font-semibold text-slate-700">
                  Showing Filter: <span className="text-indigo-600 uppercase">{activeLeadTab.startsWith('stage:') ? `Stage: ${activeLeadTab.slice(6)}` : activeLeadTab.replaceAll('_', ' ')}</span>
                  {activeLeadTab.startsWith('stage:') && (
                    <button onClick={() => setActiveLeadTab('all_total')} className="ml-2 text-[11px] text-slate-500 underline normal-case">clear</button>
                  )}
                </span>
                <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-medium" data-testid="leads-record-count">
                  {leadsData.totalCount || 0} records
                </span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadLeads(activeLeadTab, searchQuery);
                }}
                className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto"
              >
                <button
                  type="button"
                  onClick={() => openFilterPanel('leads')}
                  data-testid="lead-filters-button"
                  className={`text-sm px-3 py-1.5 rounded-md border flex items-center gap-1.5 whitespace-nowrap ${
                    countActive(leadFilters, leadFields) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" /> Filters
                  {countActive(leadFilters, leadFields) > 0 && (
                    <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {countActive(leadFilters, leadFields)}
                    </span>
                  )}
                </button>
                <select
                  value={leadFilters.sort}
                  onChange={(e) => setLeadFilters({ ...leadFilters, sort: e.target.value })}
                  aria-label="Sort leads"
                  data-testid="lead-sort"
                  className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white flex-1 min-w-[120px] sm:flex-initial"
                >
                  {LEAD_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <div className="relative basis-full sm:basis-auto sm:flex-initial">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Name, mobile, email or LD-…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button type="submit" className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded-md hover:bg-indigo-700 whitespace-nowrap">
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddLeadForm({ name: '', primaryNo: '', email: '', requirement: '', subLocation: '', budget: '', remark: '', ethnicity: '', tags: '', formName: '', projectId: '' });
                    setShowAddLeadModal(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" /> Add Lead
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowExportModal(true)}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap"
                    data-testid="export-leads-button"
                  >
                    <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export</span>
                  </button>
                )}
              </form>
            </div>
            <FilterChips
              filters={leadFilters}
              fields={leadFields}
              options={leadFilterOptions}
              dateFields={LEAD_DATE_FIELDS}
              onChange={setLeadFilters}
              onClear={clearLeadFilters}
            />

            {/* 22-COLUMN LEADS TABLE */}
            {/* Mobile cards — hidden on sm+ */}
            <div className="sm:hidden">
              <MobileLeadCards
                leads={leadsData.data}
                loading={loadingLeads}
                openMenuLeadId={openMenuLeadId}
                setOpenMenuLeadId={setOpenMenuLeadId}
                onViewDetails={(r) => { setSelectedLeadId(r.id); setViewLeadModalOpen(true); }}
                handleRowAction={handleRowAction}
                onCall={startCall}
                isAdmin={isAdmin}
              />
            </div>
            {/* Desktop table — hidden on mobile */}
            <div className="hidden sm:block bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-semibold border-b-2 border-slate-300 uppercase text-[10px] tracking-wide">
                    <th className="py-3 px-3 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Row</th>
                    <th className="py-3 px-3 sticky left-12 bg-slate-50 z-10 border-r border-slate-200">Lead ID</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Assigned Date</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 sticky left-32 bg-slate-50 z-10 border-r border-slate-200">Name</th>
                    <th className="py-3 px-3">Primary No</th>
                    <th className="py-3 px-3">Lead Stage</th>
                    <th className="py-3 px-3">Stage Reason</th>
                    <th className="py-3 px-3">Source</th>
                    <th className="py-3 px-3">Project</th>
                    <th className="py-3 px-3">Tags</th>
                    <th className="py-3 px-3">Pre Sales Agent</th>
                    <th className="py-3 px-3">Sales Agent</th>
                    <th className="py-3 px-3">Channel Partner</th>
                    <th className="py-3 px-3">Sourcing Manager</th>
                    <th className="py-3 px-3">Requirement</th>
                    <th className="py-3 px-3">Sub Location</th>
                    <th className="py-3 px-3">Budget</th>
                    <th className="py-3 px-3">Remark</th>
                    <th className="py-3 px-3">Site Visit</th>
                    <th className="py-3 px-3">Last Activity</th>
                    <th className="py-3 px-3">Ethnicity</th>
                    <th className="py-3 px-3 sticky right-0 bg-slate-50 z-20 text-center border-l border-slate-200">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loadingLeads ? (
                    <tr>
                      <td colSpan={24} className="py-8 text-center text-slate-500">Loading leads...</td>
                    </tr>
                  ) : (leadsData.data || []).length === 0 ? (
                    <tr>
                      <td colSpan={24} className="py-8 text-center text-slate-500">No leads found for this tab.</td>
                    </tr>
                  ) : (
                    (leadsData.data || []).map((r) => (
                      <tr key={r.id} className={`transition-colors ${openMenuLeadId === r.id ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-300' : 'bg-white hover:bg-slate-50/90'}`}>
                        <td className={`py-2.5 px-3 font-medium sticky left-0 z-10 ${openMenuLeadId === r.id ? 'bg-indigo-50' : 'bg-white'}`}>{r.row}</td>
                        <td className={`py-2.5 px-3 font-mono font-semibold text-indigo-600 sticky left-12 z-10 ${openMenuLeadId === r.id ? 'bg-indigo-50' : 'bg-white'}`}>
                          {r.leadId}
                          {r.inquiryCount > 1 && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-800 rounded">
                              Re-Inquiry ({r.inquiryCount})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{fmtDate(r.date)}</td>
                        <td className="py-2.5 px-3 text-slate-600">{fmtDate(r.assignedDate)}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            r.status === 'Hot' ? 'bg-rose-100 text-rose-700' :
                            r.status === 'Warm' ? 'bg-amber-100 text-amber-700' :
                            r.status === 'Booked' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className={`py-2.5 px-3 font-semibold text-slate-900 sticky left-32 z-10 ${openMenuLeadId === r.id ? 'bg-indigo-50' : 'bg-white'}`}>
                          {r.name}
                          {r.isConvertedToContact && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-700 rounded">
                              Contact
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono">{r.primaryNo}</td>
                        <td className="py-2.5 px-3 font-medium text-indigo-700">{r.leadStage}</td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-48 truncate" title={r.stageReason}>{r.stageReason}</td>
                        <td className="py-2.5 px-3">{r.source}</td>
                        <td className="py-2.5 px-3 font-medium">{r.project}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex gap-1">
                            {(r.tags || []).map((t, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">{r.preSalesAgent}</td>
                        <td className="py-2.5 px-3">{r.salesAgent}</td>
                        <td className="py-2.5 px-3">{r.channelPartner}</td>
                        <td className="py-2.5 px-3">{r.sourcingManager}</td>
                        <td className="py-2.5 px-3">{r.requirement}</td>
                        <td className="py-2.5 px-3">{r.subLocation}</td>
                        <td className="py-2.5 px-3">{r.budget}</td>
                        <td className="py-2.5 px-3 max-w-48 truncate" title={r.remark}>{r.remark}</td>
                        <td className="py-2.5 px-3">{r.siteVisit}</td>
                        <td className="py-2.5 px-3 text-slate-600">{r.lastActivity}</td>
                        <td className="py-2.5 px-3">{r.ethnicity}</td>
                        <td className={`py-2.5 px-3 sticky right-0 text-center relative z-20 ${openMenuLeadId === r.id ? 'bg-indigo-50' : 'bg-white'}`}>
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              onClick={() => startCall(r)}
                              title="Call"
                              aria-label={`Call ${r.name}`}
                              className="p-1.5 rounded hover:bg-emerald-100 text-emerald-600 transition-colors"
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                            <WhatsAppButton
                              phone={r.primaryNo}
                              name={r.name}
                              className="p-1.5 rounded hover:bg-green-100 transition-colors"
                              iconClassName="w-4 h-4"
                            />
                          <div className="action-menu-container relative">
                            <button
                              onClick={() => setOpenMenuLeadId(openMenuLeadId === r.id ? null : r.id)}
                              className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openMenuLeadId === r.id && (
                              <div className="absolute right-8 top-0 w-52 bg-white border border-slate-200 rounded-lg shadow-2xl py-1 z-[100] text-left">
                                <button onClick={() => handleRowAction('call', r)} className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-xs">
                                  <Phone className="w-3.5 h-3.5 text-emerald-600" /> Call
                                </button>
                                <button onClick={() => handleRowAction('log_call', r)} className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-xs">
                                  <Phone className="w-3.5 h-3.5 text-slate-400" /> Log Call (made elsewhere)
                                </button>
                                <button onClick={() => handleRowAction('add_task', r)} className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-xs">
                                  <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Add Task / Update Stage
                                </button>
                                <button onClick={() => handleRowAction('update_stage', r)} className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-xs">
                                  <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" /> Update Stage Only
                                </button>
                                <button onClick={() => handleRowAction('view', r)} className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-xs">
                                  <Eye className="w-3.5 h-3.5 text-blue-600" /> View Details
                                </button>
                                <button onClick={() => handleRowAction('convert', r)} className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-xs">
                                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> Convert to Contact
                                </button>
                                {isAdmin && (
                                  <button onClick={() => handleRowAction('transfer', r)} className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-xs">
                                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" /> Transfer Lead
                                  </button>
                                )}
                                <button onClick={() => handleRowAction('add_owner', r)} className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-xs">
                                  <UserPlus className="w-3.5 h-3.5 text-blue-600" /> Add Owner
                                </button>
                                <button onClick={() => handleRowAction('remove_owner', r)} className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-xs">
                                  <Users className="w-3.5 h-3.5 text-rose-500" /> Remove Lead Owner
                                </button>
                                <button onClick={() => handleRowAction('add_cp', r)} className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-xs">
                                  <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Add Channel Partner
                                </button>
                                <button onClick={() => handleRowAction('remove_cp', r)} className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-xs">
                                  <Building2 className="w-3.5 h-3.5 text-rose-500" /> Remove Channel Partner
                                </button>
                                <button onClick={() => handleRowAction('suggest_property', r)} className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-xs">
                                  <Building2 className="w-3.5 h-3.5 text-emerald-600" /> Suggested Property
                                </button>
                                <button onClick={() => handleRowAction('edit', r)} className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-xs">
                                  <Edit3 className="w-3.5 h-3.5 text-slate-600" /> Edit
                                </button>
                                {isAdmin && (
                                  <>
                                    <hr className="my-1 border-slate-100" />
                                    <button onClick={() => handleRowAction('delete', r)} className="w-full px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2 text-xs">
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>{/* end desktop leads table */}

            {/* Leads Pagination */}
            {leadsData.totalCount > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>
                    Showing {((leadsData.page - 1) * leadsData.pageSize) + 1} to {Math.min(leadsData.page * leadsData.pageSize, leadsData.totalCount)} of {leadsData.totalCount} results
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentLeadPage(p => Math.max(1, p - 1))}
                    disabled={currentLeadPage === 1}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1.5 text-sm font-medium text-slate-700">
                    Page {currentLeadPage} of {Math.ceil(leadsData.totalCount / leadsData.pageSize)}
                  </span>
                  <button
                    onClick={() => setCurrentLeadPage(p => p + 1)}
                    disabled={currentLeadPage >= Math.ceil(leadsData.totalCount / leadsData.pageSize)}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activePage === 'tasks' ? (
          /* TASKS PAGE */
          <div className="px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              {[
                { key: 'today', label: "Today's Task", val: tasksData.counts?.todaysTask ?? 0 },
                { key: 'upcoming', label: 'Upcoming Task', val: tasksData.counts?.upcomingTask ?? 0 },
                { key: 'pending', label: 'Overdue Tasks', val: tasksData.counts?.pendingTasks ?? 0 },
                { key: 'completed', label: 'Completed Tasks', val: tasksData.counts?.completedTasks ?? 0 },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTaskTab(t.key)}
                  className={`p-2.5 sm:p-4 rounded-lg border text-left bg-white transition min-h-[60px] sm:min-h-0 ${
                    activeTaskTab === t.key
                      ? 'border-indigo-600 ring-1 ring-indigo-600 bg-indigo-50/40'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-lg sm:text-2xl font-bold text-slate-900">{t.val}</div>
                  <div className="text-[9px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 mt-0.5 sm:mt-1 line-clamp-2 leading-tight">{t.label}</div>
                </button>
              ))}
            </div>

            {/* Task search & filters */}
            <div className="space-y-2">
              <div className="bg-white rounded-lg border border-slate-200 px-3 sm:px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-medium self-start sm:self-auto" data-testid="tasks-record-count">
                  {tasksData.totalCount || 0} tasks
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => openFilterPanel('tasks')}
                    data-testid="task-filters-button"
                    className={`text-sm px-3 py-1.5 rounded-md border flex items-center gap-1.5 whitespace-nowrap ${
                      countActive(taskFilters, taskFields) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <SlidersHorizontal className="w-4 h-4" /> Filters
                    {countActive(taskFilters, taskFields) > 0 && (
                      <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {countActive(taskFilters, taskFields)}
                      </span>
                    )}
                  </button>
                  <div className="relative flex-1 sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={taskSearchInput}
                      onChange={(e) => setTaskSearchInput(e.target.value)}
                      placeholder="Lead, mobile, LD-… or task title"
                      data-testid="task-search"
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
              <FilterChips
                filters={taskFilters}
                fields={taskFields}
                options={taskFilterOptions}
                dateFields={TASK_DATE_FIELDS}
                onChange={setTaskFilters}
                onClear={() => { clearTaskFilters(); setTaskSearchInput(''); }}
              />
            </div>

            {/* Mobile task cards — hidden on sm+ */}
            <div className="sm:hidden">
              <MobileTaskCards
                tasks={tasksData.data}
                loading={loadingTasks}
                onViewTask={async (taskId) => {
                  try {
                    const taskDetails = await crmApi.getTask(taskId);
                    setSelectedTaskDetails(taskDetails);
                    setViewTaskModalOpen(true);
                  } catch (err) {
                    alert('Could not load task details.');
                  }
                }}
              />
            </div>

            {/* Desktop table — hidden on mobile */}
            <div className="hidden sm:block bg-white rounded-lg border border-slate-200 shadow-xs overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase">
                    <th className="py-3 px-3">Row</th>
                    <th className="py-3 px-3">Created Date</th>
                    <th className="py-3 px-3">Lead</th>
                    <th className="py-3 px-3">Mobile</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Assigned By</th>
                    <th className="py-3 px-3">Assigned To</th>
                    <th className="py-3 px-3">Pre Sales Agent</th>
                    <th className="py-3 px-3">Schedule Date</th>
                    <th className="py-3 px-3">Title</th>
                    <th className="py-3 px-3">Remark</th>
                    <th className="py-3 px-3">Activity Type</th>
                    <th className="py-3 px-3">Stage</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Completed On</th>
                    <th className="py-3 px-3">Completed By</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loadingTasks ? (
                    <tr>
                      <td colSpan={17} className="py-8 text-center text-slate-500">Loading tasks...</td>
                    </tr>
                  ) : (tasksData.data || []).length === 0 ? (
                    <tr>
                      <td colSpan={17} className="py-8 text-center text-slate-500">No tasks in this bucket.</td>
                    </tr>
                  ) : (
                    (tasksData.data || []).map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-medium">{t.row}</td>
                        <td className="py-2.5 px-3 text-slate-600">{fmtDate(t.createdDate)}</td>
                        <td className="py-2.5 px-3">
                          <button 
                            onClick={() => {
                              if (t.leadId) {
                                setSelectedLeadId(t.leadId);
                                setViewLeadModalOpen(true);
                              }
                            }}
                            className="font-semibold text-slate-900 hover:text-indigo-600 hover:underline transition"
                          >
                            {t.lead}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{t.mobile}</td>
                        <td className="py-2.5 px-3 font-semibold text-indigo-600">{t.category}</td>
                        <td className="py-2.5 px-3">{t.assignedBy}</td>
                        <td className="py-2.5 px-3">{t.assignedTo}</td>
                        <td className="py-2.5 px-3">{t.preSalesAgent || '-'}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{fmtDate(t.scheduleDate)}</td>
                        <td className="py-2.5 px-3 font-medium">{t.title}</td>
                        <td className="py-2.5 px-3 text-slate-600">{t.remark}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold text-[11px]">
                            {t.activityType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-amber-700">{t.stage}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                            t.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{t.completedOn}</td>
                        <td className="py-2.5 px-3">{t.completedBy}</td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={async () => {
                              try {
                                console.log('Fetching task details for:', t.id);
                                const taskDetails = await crmApi.getTask(t.id);
                                console.log('Task details received:', taskDetails);
                                setSelectedTaskDetails(taskDetails);
                                setViewTaskModalOpen(true);
                              } catch (err) {
                                console.error('Failed to fetch task details:', err);
                                alert('Could not load task details. Please try again.');
                              }
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium transition inline-flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Tasks Pagination */}
            {(tasksData?.totalCount > 0) && (
              <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>
                    Showing {((tasksData.page - 1) * tasksData.pageSize) + 1} to {Math.min(tasksData.page * tasksData.pageSize, tasksData.totalCount)} of {tasksData.totalCount} tasks
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentTaskPage(p => Math.max(1, p - 1))}
                    disabled={currentTaskPage === 1}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1.5 text-sm font-medium text-slate-700">
                    Page {currentTaskPage} of {Math.ceil(tasksData.totalCount / tasksData.pageSize)}
                  </span>
                  <button
                    onClick={() => setCurrentTaskPage(p => p + 1)}
                    disabled={currentTaskPage >= Math.ceil(tasksData.totalCount / tasksData.pageSize)}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activePage === 'campaigns' && isAdmin ? (
          /* CAMPAIGNS & CONNECTED FACEBOOK PAGES WORKSPACE */
          <div className="px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
            <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 shadow-xs space-y-3 sm:space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <h2 style={{ color: '#000000' }} className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                    Connected Facebook Pages ({(metaPagesInfo.pages || []).length})
                  </h2>
                  <p style={{ color: '#000000' }} className="text-[11px] sm:text-xs mt-1">
  Connect multiple Facebook Pages for {currentUser.companyName}. Leads from these pages route exclusively to your company's agents.
</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleFacebookOAuthConnect}
                    disabled={connectingOAuth}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] sm:text-xs font-semibold px-3 sm:px-3.5 py-2 rounded-md flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {connectingOAuth ? 'Connecting...' : 'Connect with Facebook (OAuth)'}
                  </button>
                  <button
                    onClick={() => {
                      setManualPageForm({ pageId: '', pageName: '', pageAccessToken: '', defaultProjectId: '' });
                      setShowManualPageModal(true);
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] sm:text-xs font-semibold px-3 sm:px-3.5 py-2 rounded-md flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" /> Link Page via Token
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
                {(metaPagesInfo.pages || []).map((p) => (
                  <div key={p.id} className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm text-slate-900">{p.pageName}</div>
                          <div className="text-[11px] font-mono text-slate-500">Page ID: {p.pageId}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          p.isWebhookSubscribed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.isWebhookSubscribed ? 'Webhook Active' : 'Polling Only'}
                        </span>
                      </div>
                      <div className="mt-2.5 text-xs text-slate-600 space-y-1">
                        <div>
                          <span className="font-semibold text-slate-700">Default Project:</span> {p.defaultProjectName}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-700">Last Polled:</span>{' '}
                          {p.lastSyncedAt ? fmtDate(p.lastSyncedAt) : 'Waiting for cycle'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200/80 flex justify-between items-center text-[11px]">
                      <span className="text-emerald-700 font-medium">Permanent Token Stored</span>
                      <button
                        onClick={async () => {
                          if (window.confirm(`Disconnect page "${p.pageName}" (${p.pageId})?`)) {
                            await crmApi.disconnectPage(p.id);
                            loadCampaignsAndPages();
                          }
                        }}
                        className="text-rose-600 hover:underline font-medium"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
              <div>
                <h2 style={{ color: '#000000' }} className="text-sm sm:text-base font-bold text-left w-full mr-auto">
  Connected Facebook Campaigns & Instant Forms
</h2>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
                  Map Facebook Campaigns to CRM Projects, configure automatic Pre-Sales routing, and track Cost-Per-Lead (CPL) & Site Visits.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Optional: Ad Account ID (act_...)"
                  value={adAccountInput}
                  onChange={(e) => setAdAccountInput(e.target.value)}
                  className="text-xs border border-slate-300 rounded-md px-3 py-2 w-full sm:w-56"
                />
                <button
                  disabled={syncingCampaigns}
                  onClick={async () => {
                    setSyncingCampaigns(true);
                    try {
                      await crmApi.syncCampaigns(adAccountInput);
                      await loadCampaignsAndPages();
                    } finally {
                      setSyncingCampaigns(false);
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 sm:px-4 py-2 rounded-md flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingCampaigns ? 'animate-spin' : ''}`} />
                  {syncingCampaigns ? 'Syncing...' : 'Sync Campaigns & Forms'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase">
                    <th className="py-3 px-3">Row</th>
                    <th className="py-3 px-3">Meta ID / Form ID</th>
                    <th className="py-3 px-3">Campaign / Form Name</th>
                    <th className="py-3 px-3">Page</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Mapped CRM Project</th>
                    <th className="py-3 px-3">Lead Routing Mode</th>
                    <th className="py-3 px-3">Default Requirement</th>
                    <th className="py-3 px-3 text-right">Total Leads</th>
                    <th className="py-3 px-3 text-right">Fresh Untouched</th>
                    <th className="py-3 px-3 text-right">Site Visits</th>
                    <th className="py-3 px-3 text-right">Booked</th>
                    <th className="py-3 px-3 text-right">Ad Spend (₹)</th>
                    <th className="py-3 px-3 text-right">CPL (₹)</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="py-8 text-center text-slate-500">
                        No campaigns synced yet. Click "Sync Campaigns & Forms" to import from Meta and existing leads.
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-medium">{c.row}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{c.metaCampaignId}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{c.name}</td>
                        <td className="py-2.5 px-3">
                          {c.pageName ? (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-200">
                              {c.pageName}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded font-medium ${
                            c.mappedProjectName === 'Unmapped'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {c.mappedProjectName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            {c.assignedWorkerCount > 0 && (
                              <span className="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[9px] font-bold" title={`${c.assignedWorkerCount} specific workers assigned`}>
                                {c.assignedWorkerCount}👥
                              </span>
                            )}
                            <span className="text-slate-700 text-xs">{c.routingMode}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">{c.defaultRequirement || '-'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">{c.totalLeads}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 font-semibold">{c.freshUntouched}</td>
                        <td className="py-2.5 px-3 text-right text-indigo-600 font-semibold">{c.siteVisits}</td>
                        <td className="py-2.5 px-3 text-right text-rose-600 font-bold">{c.booked}</td>
                        <td className="py-2.5 px-3 text-right font-mono">₹{Number(c.spendInr || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold">₹{Number(c.costPerLead || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={async () => {
                              // Fetch assigned workers for this campaign
                              let selectedWorkerIds = [];
                              try {
                                const workerData = await crmApi.getCampaignWorkers(c.id);
                                selectedWorkerIds = workerData.assignedWorkers.map(w => w.id);
                              } catch (err) {
                                console.error('Failed to fetch campaign workers:', err);
                              }
                              
                              setEditingCampaign({
                                ...c,
                                mappedProjectId: c.mappedProjectId || '',
                                defaultPreSalesAgentId: c.defaultPreSalesAgentId || '',
                                defaultRequirement: c.defaultRequirement || '',
                                defaultSubLocation: c.defaultSubLocation || '',
                                defaultTags: c.defaultTags || '',
                                spendInr: c.spendInr || 0,
                                selectedWorkerIds: selectedWorkerIds,
                                applyToExistingLeads: true
                              });
                            }}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-indigo-600 text-white rounded text-[11px] font-medium transition"
                          >
                            Configure Mapping
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activePage === 'team' && isAdmin ? (
          /* TEAM & ACCESS CONTROL WORKSPACE (ADMIN ONLY) */
          <div className="px-3 sm:px-6 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 shadow-xs">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-1 !text-black">Add Company User / Worker</h2>
              <p className="text-[11px] sm:text-xs text-slate-500 mb-3 sm:mb-4">
                Create Pre-Sales, Sales, or Sourcing accounts for <strong>{currentUser.companyName}</strong> and configure their lead visibility scope.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await crmApi.createCompanyUser(newUserForm);
                  setNewUserForm({
                    name: '',
                    email: '',
                    password: '',
                    departmentRole: 'PreSales',
                    accessRole: 'Worker',
                    canViewAllCompanyLeads: false
                  });
                  await loadCompanyUsers();
                  await loadCountsAndLookups();
                }}
                className="space-y-3 text-xs"
              >
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Neha Kulkarni"
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Login Email</label>
                  <input
                    type="email"
                    required
                    placeholder="neha@company.com"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs sm:text-sm"
                  />
                </div>
                <div>
  <label className="block font-semibold text-slate-700 mb-1">WhatsApp Mobile No (For Instant Lead Alerts)</label>
  <input
    type="text"
    placeholder="e.g. +91-9820011223"
    value={newUserForm.phone}
    onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs sm:text-sm font-mono"
  />
</div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Temporary Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs sm:text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Department Role</label>
                    <select
                      value={newUserForm.departmentRole}
                      onChange={(e) => setNewUserForm({ ...newUserForm, departmentRole: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs sm:text-sm"
                    >
                      <option value="PreSales">Pre-Sales (Round-Robin)</option>
                      <option value="Sales">Sales (Closing)</option>
                      <option value="Sourcing">Sourcing Manager</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Access Level</label>
                    <select
                      value={newUserForm.accessRole}
                      onChange={(e) => setNewUserForm({ ...newUserForm, accessRole: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs sm:text-sm"
                    >
                      <option value="Worker">Worker</option>
                      <option value="CompanyAdmin">Company Admin</option>
                    </select>
                  </div>
                </div>
                {newUserForm.accessRole === 'Worker' && (
                  <label className="flex items-start sm:items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      checked={newUserForm.canViewAllCompanyLeads}
                      onChange={(e) => setNewUserForm({ ...newUserForm, canViewAllCompanyLeads: e.target.checked })}
                      className="mt-0.5 sm:mt-0"
                    />
                    <span className="text-slate-700 font-medium text-xs sm:text-sm">
                      Allow this worker to view ALL company leads (unchecked = only leads assigned to them)
                    </span>
                  </label>
                )}
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 sm:py-2.5 rounded-md transition text-sm"
                >
                  + Create Team Member
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-xs">
              <div className="p-3 sm:p-4 border-b border-slate-200">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 !text-black">
                  {currentUser.companyName} — Team Directory & Data Visibility Scopes
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
                  Toggle whether each Worker can view the entire company lead pool or strictly leads & tasks assigned to them.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px]">
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Lead Visibility</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(companyUsers.data || []).map((u) => {
                      const now = new Date();
                      const isAbsent = u.absentUntil && new Date(u.absentUntil) > now;
                      const isOnHoliday = u.holidayStart && u.holidayEnd &&
                        now >= new Date(u.holidayStart) && now < new Date(u.holidayEnd);
                      return (
                        <tr key={u.id} className={`hover:bg-slate-50 transition ${!u.isActive ? 'opacity-40' : ''}`}>
                          {/* Member */}
                          <td className="py-3 px-4">
                            <div className="flex items-start gap-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                                !u.isActive ? 'bg-slate-400' :
                                isOnHoliday ? 'bg-orange-400' :
                                isAbsent ? 'bg-amber-400' :
                                'bg-indigo-500'
                              }`}>
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                  {u.name}
                                  {isAbsent && !isOnHoliday && (
                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold">ABSENT</span>
                                  )}
                                  {isOnHoliday && (
                                    <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[9px] font-bold">ON LEAVE</span>
                                  )}
                                  {!u.isActive && (
                                    <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-bold">INACTIVE</span>
                                  )}
                                </div>
                                <div className="text-slate-500 text-[11px]">{u.email}</div>
                                {u.phone && <div className="text-slate-400 text-[11px]">{u.phone}</div>}
                                {isOnHoliday && (
                                  <div className="text-orange-600 text-[10px] mt-0.5">
                                    Leave: {new Date(u.holidayStart).toLocaleDateString('en-IN', {day:'numeric',month:'short'})} → {new Date(u.holidayEnd).toLocaleDateString('en-IN', {day:'numeric',month:'short'})}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* Role */}
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.accessRole === 'CompanyAdmin' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'
                            }`}>{u.accessRole}</span>
                            <div className="text-slate-500 text-[11px] mt-0.5">{u.role}</div>
                          </td>
                          {/* Visibility */}
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                              u.canViewAllCompanyLeads || u.accessRole === 'CompanyAdmin'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {u.canViewAllCompanyLeads || u.accessRole === 'CompanyAdmin' ? 'All Leads' : 'Assigned Only'}
                            </span>
                          </td>
                          {/* Status */}
                          <td className="py-3 px-4">
                            {!u.isActive ? (
                              <span className="inline-block px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-medium">Deleted</span>
                            ) : isOnHoliday ? (
                              <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-medium">
                                Holiday → {new Date(u.holidayEnd).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                              </span>
                            ) : isAbsent ? (
                              <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">Absent Today</span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-medium">Available</span>
                            )}
                          </td>
                          {/* Actions dropdown */}
                          <td className="py-3 px-4 text-center">
                            <div className="relative inline-block action-menu-container">
                              <button
                                onClick={() => setOpenMenuLeadId(openMenuLeadId === `team-${u.id}` ? null : `team-${u.id}`)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-medium flex items-center gap-1.5"
                              >
                                Actions <span className="text-slate-400">▾</span>
                              </button>
                              {openMenuLeadId === `team-${u.id}` && (
                                <div className="absolute right-0 top-8 w-48 bg-white border border-slate-200 rounded-lg shadow-2xl py-1 z-[100] text-left">
                                  {/* Edit */}
                                  <button
                                    onClick={() => { setEditingUser({ ...u, password: '' }); setOpenMenuLeadId(null); }}
                                    className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-xs text-slate-700"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-slate-500" /> Edit Details
                                  </button>
                                  {/* Test WhatsApp alert */}
                                  {u.phone && (
                                    <button
                                      onClick={async () => {
                                        setOpenMenuLeadId(null);
                                        try {
                                          const r = await crmApi.sendTestWhatsApp(u.id);
                                          alert(r.success
                                            ? `Test WhatsApp sent to ${r.name} (${r.sentTo}).`
                                            : `Test WhatsApp failed: ${r.error}`);
                                        } catch (e) {
                                          alert('Test WhatsApp failed: ' + (e?.response?.data?.message || e.message));
                                        }
                                      }}
                                      className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-xs text-slate-700"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> Send test WhatsApp
                                    </button>
                                  )}
                                  {/* Toggle visibility */}
                                  {u.accessRole !== 'CompanyAdmin' && (
                                    <button
                                      onClick={async () => {
                                        await crmApi.updateUserPermissions(u.id, {
                                          accessRole: u.accessRole,
                                          canViewAllCompanyLeads: !u.canViewAllCompanyLeads,
                                          isActive: u.isActive
                                        });
                                        setOpenMenuLeadId(null);
                                        loadCompanyUsers(currentTeamPage);
                                      }}
                                      className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-xs text-slate-700"
                                    >
                                      <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
                                      {u.canViewAllCompanyLeads ? 'Switch to Assigned Only' : 'Switch to All Leads'}
                                    </button>
                                  )}
                                  {/* Absent */}
                                  {u.accessRole !== 'CompanyAdmin' && u.isActive && (
                                    isAbsent ? (
                                      <button
                                        onClick={async () => { await crmApi.markUserAbsent(u.id, true); setOpenMenuLeadId(null); loadCompanyUsers(currentTeamPage); }}
                                        className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-xs text-emerald-700"
                                      >
                                        <CheckSquare className="w-3.5 h-3.5" /> Clear Absent
                                      </button>
                                    ) : (
                                      <button
                                        onClick={async () => { await crmApi.markUserAbsent(u.id, false); setOpenMenuLeadId(null); loadCompanyUsers(currentTeamPage); }}
                                        className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-xs text-amber-700"
                                      >
                                        <Calendar className="w-3.5 h-3.5" /> Mark Absent Today
                                      </button>
                                    )
                                  )}
                                  {/* Holiday */}
                                  {u.accessRole !== 'CompanyAdmin' && u.isActive && (
                                    isOnHoliday ? (
                                      <button
                                        onClick={async () => { await crmApi.setUserHoliday(u.id, { clear: true }); setOpenMenuLeadId(null); loadCompanyUsers(currentTeamPage); }}
                                        className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-xs text-orange-700"
                                      >
                                        <X className="w-3.5 h-3.5" /> Clear Holiday
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => { setHolidayUser(u); setHolidayForm({ start: '', end: '' }); setOpenMenuLeadId(null); }}
                                        className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-xs text-blue-700"
                                      >
                                        <Calendar className="w-3.5 h-3.5" /> Set Holiday
                                      </button>
                                    )
                                  )}
                                  {/* Delete */}
                                  {u.accessRole !== 'CompanyAdmin' && (
                                    <>
                                      <hr className="my-1 border-slate-100" />
                                      <button
                                        onClick={async () => {
                                          if (window.confirm(`Deactivate ${u.name}? They will no longer receive leads.`)) {
                                            await crmApi.deleteUser(u.id);
                                            setOpenMenuLeadId(null);
                                            loadCompanyUsers(currentTeamPage);
                                          }
                                        }}
                                        className="w-full px-3 py-2 hover:bg-rose-50 flex items-center gap-2 text-xs text-rose-600"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" /> Deactivate User
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Team Pagination */}
              {companyUsers.totalCount > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span>
                      Showing {((companyUsers.page - 1) * companyUsers.pageSize) + 1} to {Math.min(companyUsers.page * companyUsers.pageSize, companyUsers.totalCount)} of {companyUsers.totalCount} team members
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentTeamPage(p => Math.max(1, p - 1))}
                      disabled={currentTeamPage === 1}
                      className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1.5 text-sm font-medium text-slate-700">
                      Page {currentTeamPage} of {Math.ceil(companyUsers.totalCount / companyUsers.pageSize)}
                    </span>
                    <button
                      onClick={() => setCurrentTeamPage(p => p + 1)}
                      disabled={currentTeamPage >= Math.ceil(companyUsers.totalCount / companyUsers.pageSize)}
                      className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* PROJECTS PAGE */}
        {activePage === 'projects' && isAdmin && (
          <div className="px-3 sm:px-6 py-4 sm:py-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-slate-900  text-left !text-black">Projects</h1>
                <p className="text-sm text-slate-500 mt-0.5">Manage the real-estate projects leads are tagged against.</p>
              </div>
              <button
                onClick={() => setEditingProject({ name: '', subLocation: '', configSummary: '', priceRange: '' })}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                <span className="text-lg leading-none">+</span> New Project
              </button>
            </div>

            {/* Project Cards */}
            {projects.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <Home className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No projects yet</p>
                <p className="text-slate-400 text-sm mt-1">Click "New Project" to create your first one.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(p => (
                  <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition p-5 flex flex-col gap-3">
                    {/* Name + badges */}
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{p.name}</h3>
                      {p.subLocation && (
                        <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />{p.subLocation}
                        </p>
                      )}
                    </div>
                    {/* Details */}
                    <div className="space-y-1 text-sm text-slate-600">
                      {p.configSummary && (
                        <p><span className="text-slate-400 text-xs">Config:</span> {p.configSummary}</p>
                      )}
                      {p.priceRange && (
                        <p><span className="text-slate-400 text-xs">Price:</span> {p.priceRange}</p>
                      )}
                    </div>
                    {/* Stats */}
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-800">{p.leadCount}</span> leads
                      </span>
                      <span className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-800">{p.campaignCount}</span> campaigns
                      </span>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingProject({ ...p })}
                        className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
                      >Edit</button>
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
                          try {
                            await crmApi.deleteProject(p.id);
                            loadProjects();
                          } catch (err) {
                            alert(err.response?.data || 'Could not delete project.');
                          }
                        }}
                        className="flex-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-medium"
                      >Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROJECT CREATE / EDIT MODAL */}
        {editingProject !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  {editingProject.id ? 'Edit Project' : 'New Project'}
                </h2>
                <button onClick={() => setEditingProject(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Project Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={editingProject.name || ''}
                    onChange={e => setEditingProject({ ...editingProject, name: e.target.value })}
                    placeholder="e.g. Skyline Residency"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Location / Sub-location</label>
                  <input
                    type="text"
                    value={editingProject.subLocation || ''}
                    onChange={e => setEditingProject({ ...editingProject, subLocation: e.target.value })}
                    placeholder="e.g. Andheri West, Mumbai"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Configuration Summary</label>
                  <input
                    type="text"
                    value={editingProject.configSummary || ''}
                    onChange={e => setEditingProject({ ...editingProject, configSummary: e.target.value })}
                    placeholder="e.g. 2 & 3 BHK"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Price Range</label>
                  <input
                    type="text"
                    value={editingProject.priceRange || ''}
                    onChange={e => setEditingProject({ ...editingProject, priceRange: e.target.value })}
                    placeholder="e.g. 1.8 Cr – 2.9 Cr"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex gap-3 pt-2 border-t border-slate-100">
                  <button
                    onClick={async () => {
                      if (!editingProject.name?.trim()) { alert('Project name is required.'); return; }
                      try {
                        if (editingProject.id) {
                          await crmApi.updateProject(editingProject.id, {
                            name: editingProject.name,
                            subLocation: editingProject.subLocation,
                            configSummary: editingProject.configSummary,
                            priceRange: editingProject.priceRange
                          });
                        } else {
                          await crmApi.createProject({
                            name: editingProject.name,
                            subLocation: editingProject.subLocation,
                            configSummary: editingProject.configSummary,
                            priceRange: editingProject.priceRange
                          });
                        }
                        setEditingProject(null);
                        loadProjects();
                        // Refresh lookups so campaign mapping dropdowns pick up new project
                        const updatedLookups = await crmApi.getLookups();
                        setLookups(updatedLookups);
                      } catch (err) {
                        alert(err.response?.data || 'Failed to save project.');
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm"
                  >
                    {editingProject.id ? 'Save Changes' : 'Create Project'}
                  </button>
                  <button
                    onClick={() => setEditingProject(null)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold text-sm"
                  >Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Manual Connect Facebook Page Modal */}
      {showManualPageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-sm sm:text-base text-slate-900 mb-1">Link New Facebook Page</h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mb-3 sm:mb-4">
              Paste the Page ID and Permanent Page Access Token. The system will automatically subscribe this Page to the leadgen webhook.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await crmApi.connectPageManual({
                  pageId: manualPageForm.pageId,
                  pageName: manualPageForm.pageName,
                  pageAccessToken: manualPageForm.pageAccessToken,
                  defaultProjectId: manualPageForm.defaultProjectId ? Number(manualPageForm.defaultProjectId) : null
                });
                setShowManualPageModal(false);
                await loadCampaignsAndPages();
              }}
              className="space-y-2.5 sm:space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Facebook Page Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Skyline Luxury Residences"
                  value={manualPageForm.pageName}
                  onChange={(e) => setManualPageForm({ ...manualPageForm, pageName: e.target.value })}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Facebook Page ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 924782454049982"
                  value={manualPageForm.pageId}
                  onChange={(e) => setManualPageForm({ ...manualPageForm, pageId: e.target.value })}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs sm:text-sm font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Permanent Page Access Token</label>
                <textarea
                  rows={3}
                  required
                  placeholder="EAA..."
                  value={manualPageForm.pageAccessToken}
                  onChange={(e) => setManualPageForm({ ...manualPageForm, pageAccessToken: e.target.value })}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs sm:text-sm font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Default CRM Project for this Page</label>
                <select
                  value={manualPageForm.defaultProjectId}
                  onChange={(e) => setManualPageForm({ ...manualPageForm, defaultProjectId: e.target.value })}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs sm:text-sm"
                >
                  <option value="">-- Use Campaign Mapping --</option>
                  {(lookups.projects || []).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.subLocation})</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowManualPageModal(false)} className="px-4 py-2 border rounded text-sm">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded font-semibold text-sm">
                  Connect & Subscribe Page
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CallLogSheet
        sheet={callSheet}
        currentUserId={currentUser?.id}
        stages={lookups.stages || []}
        projects={lookups.projects || []}
        onClose={closeCallSheet}
        onSaved={() => refreshAll()}
      />

      {isAdmin && showExportModal && (
        <LeadExportModal
          onClose={() => setShowExportModal(false)}
          currentFilters={leadFilters}
          fields={leadFields}
          options={leadFilterOptions}
          loadingOptions={loadingFilterOptions}
          onNeedOptions={() => loadFilterOptions('leads')}
        />
      )}

      <FilterPanel
        open={filterPanel === 'leads'}
        title="Filter leads"
        fields={leadFields}
        options={leadFilterOptions}
        loadingOptions={loadingFilterOptions}
        value={leadFilters}
        empty={EMPTY_LEAD_FILTERS}
        dateFields={LEAD_DATE_FIELDS}
        showInactive
        onApply={setLeadFilters}
        onClose={() => setFilterPanel(null)}
      />
      <FilterPanel
        open={filterPanel === 'tasks'}
        title="Filter tasks"
        fields={taskFields}
        options={taskFilterOptions}
        loadingOptions={loadingFilterOptions}
        value={taskFilters}
        empty={EMPTY_TASK_FILTERS}
        dateFields={TASK_DATE_FIELDS}
        datePresets={['today', 'yesterday', 'next7', 'last7', 'last30', 'thisMonth']}
        onApply={(f) => setTaskFilters({ ...f, search: taskSearchInput })} // the search box stays the source of truth
        onClose={() => setFilterPanel(null)}
      />

      {/* ADD LEAD MANUALLY MODAL */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
              <div>
                <h2 className="font-bold text-slate-900">Add Lead Manually</h2>
                <p className="text-xs text-slate-500 mt-0.5">Lead will be assigned to your account</p>
              </div>
              <button onClick={() => setShowAddLeadModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">✕</button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

              {/* Required fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name <span className="text-rose-500">*</span></label>
                  <input type="text" value={addLeadForm.name} onChange={e => setAddLeadForm({ ...addLeadForm, name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mobile Number <span className="text-rose-500">*</span></label>
                  <input type="tel" value={addLeadForm.primaryNo} onChange={e => setAddLeadForm({ ...addLeadForm, primaryNo: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <input type="email" value={addLeadForm.email} onChange={e => setAddLeadForm({ ...addLeadForm, email: e.target.value })}
                  placeholder="e.g. rahul@example.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              {/* Project + Form mapping */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Map to Project</label>
                  <select value={addLeadForm.projectId} onChange={e => setAddLeadForm({ ...addLeadForm, projectId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">-- None --</option>
                    {(lookups.projects || []).map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.subLocation ? ` (${p.subLocation})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Form / Lead Source Name</label>
                  <input type="text" value={addLeadForm.formName} onChange={e => setAddLeadForm({ ...addLeadForm, formName: e.target.value })}
                    placeholder="e.g. Walk-in, Referral…"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              {/* Lead details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Requirement</label>
                  <input type="text" value={addLeadForm.requirement} onChange={e => setAddLeadForm({ ...addLeadForm, requirement: e.target.value })}
                    placeholder="e.g. 2 BHK, 3 BHK"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Budget</label>
                  <input type="text" value={addLeadForm.budget} onChange={e => setAddLeadForm({ ...addLeadForm, budget: e.target.value })}
                    placeholder="e.g. 1.5 Cr"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Preferred Location</label>
                  <input type="text" value={addLeadForm.subLocation} onChange={e => setAddLeadForm({ ...addLeadForm, subLocation: e.target.value })}
                    placeholder="e.g. Andheri West"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Ethnicity</label>
                  <input type="text" value={addLeadForm.ethnicity} onChange={e => setAddLeadForm({ ...addLeadForm, ethnicity: e.target.value })}
                    placeholder="e.g. Gujarati"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tags</label>
                <input type="text" value={addLeadForm.tags} onChange={e => setAddLeadForm({ ...addLeadForm, tags: e.target.value })}
                  placeholder="Comma separated e.g. VIP, Referral"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Initial Remark</label>
                <textarea rows={2} value={addLeadForm.remark} onChange={e => setAddLeadForm({ ...addLeadForm, remark: e.target.value })}
                  placeholder="Any notes about this lead…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 py-3 border-t border-slate-200 flex-shrink-0">
              <button onClick={() => setShowAddLeadModal(false)}
                className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!addLeadForm.name.trim()) { alert('Name is required.'); return; }
                  if (!addLeadForm.primaryNo.trim()) { alert('Mobile number is required.'); return; }
                  try {
                    const result = await crmApi.createManualLead({
                      name: addLeadForm.name,
                      primaryNo: addLeadForm.primaryNo,
                      email: addLeadForm.email || null,
                      requirement: addLeadForm.requirement || null,
                      subLocation: addLeadForm.subLocation || null,
                      budget: addLeadForm.budget || null,
                      remark: addLeadForm.remark || null,
                      ethnicity: addLeadForm.ethnicity || null,
                      tags: addLeadForm.tags || null,
                      formName: addLeadForm.formName || null,
                      projectId: addLeadForm.projectId ? Number(addLeadForm.projectId) : null,
                    });
                    setShowAddLeadModal(false);
                    alert(`✅ Lead ${result.leadId} (${result.name}) created successfully.`);
                    refreshAll();
                  } catch (err) {
                    alert(err.response?.data || 'Failed to create lead.');
                  }
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm">
                Create Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FOR ROW ACTIONS */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3 flex-shrink-0">
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-800 truncate pr-2">
                {activeModal.type.replaceAll('_', ' ')} — {activeModal.lead.name}
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xl shrink-0">✕</button>
            </div>

            {activeModal.type !== 'view' && (
              <form onSubmit={submitModal} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2.5 text-xs">
                {activeModal.type === 'add_task' && (
                  <>
                    {/* Current stage indicator + update toggle */}
                    <div className="bg-slate-50 rounded-lg px-3 py-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">Current stage: <span className="font-semibold text-indigo-700">{activeModal.lead.leadStage || 'New Lead'}</span></span>
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formState.updateStage !== false}
                          onChange={e => setFormState({ ...formState, updateStage: e.target.checked })}
                          className="rounded"
                        />
                        Update stage
                      </label>
                    </div>

                    {formState.updateStage !== false && (
                      <>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Update Stage To</label>
                      <select
                        value={formState.stage}
                        onChange={(e) => {
                          const st = (lookups.stages || []).find(s => s.stage === e.target.value);
                          setFormState({
                            ...formState,
                            stage: e.target.value,
                            stageReason: st?.allowedReasons?.[0] || ''
                          });
                        }}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        {(lookups.stages || []).map(s => <option key={s.stage} value={s.stage}>{s.stage}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Stage Reason</label>
                      <select
                        value={formState.stageReason}
                        onChange={(e) => setFormState({ ...formState, stageReason: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        {((lookups.stages || []).find(s => s.stage === formState.stage)?.allowedReasons || []).map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                      </>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Activity Type</label>
                        <select
                          value={formState.activityType}
                          onChange={(e) => setFormState({ ...formState, activityType: e.target.value })}
                          className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                        >
                          <option value="CALL">CALL</option>
                          <option value="SITE VISIT">SITE VISIT</option>
                          <option value="MEETING">MEETING</option>
                          <option value="WHATSAPP">WHATSAPP</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Schedule Date & Time</label>
                        <input
                          type="datetime-local"
                          value={formState.scheduleDate}
                          onChange={(e) => setFormState({ ...formState, scheduleDate: e.target.value })}
                          className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Assign Task To</label>
                      <select
                        value={formState.teamMemberId}
                        onChange={(e) => setFormState({ ...formState, teamMemberId: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        {(lookups.teamMembers || []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Remark</label>
                      <textarea
                        rows={2}
                        value={formState.remark}
                        onChange={(e) => setFormState({ ...formState, remark: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    </div>
                  </>
                )}

                {activeModal.type === 'update_stage' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">New Stage</label>
                      <select
                        value={formState.stage}
                        onChange={(e) => { const st = (lookups.stages||[]).find(s=>s.stage===e.target.value); setFormState({...formState, stage:e.target.value, stageReason:st?.allowedReasons?.[0]||''}); }}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        {(lookups.stages||[]).map(s=><option key={s.stage} value={s.stage}>{s.stage}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Stage Reason</label>
                      <select
                        value={formState.stageReason}
                        onChange={(e)=>setFormState({...formState,stageReason:e.target.value})}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        {((lookups.stages||[]).find(s=>s.stage===formState.stage)?.allowedReasons||[]).map(r=><option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Remark</label>
                      <textarea rows={2} value={formState.remark} onChange={e=>setFormState({...formState,remark:e.target.value})}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
                    </div>
                  </>
                )}

                {activeModal.type === 'transfer' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">New Pre-Sales Agent</label>
                      <select
                        onChange={(e) => setFormState({ ...formState, preSalesAgentId: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        <option value="">-- Keep Current --</option>
                        {(lookups.teamMembers || []).filter(m => m.role === 'PreSales').map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">New Sales Agent</label>
                      <select
                        onChange={(e) => setFormState({ ...formState, salesAgentId: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        <option value="">-- Keep Current --</option>
                        {(lookups.teamMembers || []).filter(m => m.role === 'Sales').map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Transfer Reason</label>
                      <input
                        type="text"
                        value={formState.remark}
                        onChange={(e) => setFormState({ ...formState, remark: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    </div>
                  </>
                )}

                {activeModal.type === 'add_owner' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Owner Role</label>
                      <select
                        value={formState.ownerRole}
                        onChange={(e) => setFormState({ ...formState, ownerRole: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        <option value="PreSales">Pre-Sales Agent</option>
                        <option value="Sales">Sales Agent</option>
                        <option value="Sourcing">Sourcing Manager</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Team Member</label>
                      <select
                        value={formState.teamMemberId}
                        onChange={(e) => setFormState({ ...formState, teamMemberId: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                      >
                        {(lookups.teamMembers || []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                      </select>
                    </div>
                  </>
                )}

                {activeModal.type === 'remove_owner' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Which Owner Role to Remove?</label>
                    <select
                      value={formState.ownerRole}
                      onChange={(e) => setFormState({ ...formState, ownerRole: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                    >
                      <option value="PreSales">Pre-Sales Agent</option>
                      <option value="Sales">Sales Agent</option>
                      <option value="Sourcing">Sourcing Manager</option>
                      <option value="all">Remove All Owners (Make Unassigned)</option>
                    </select>
                  </div>
                )}

                {activeModal.type === 'add_cp' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Channel Partner</label>
                    <select
                      value={formState.channelPartnerId}
                      onChange={(e) => setFormState({ ...formState, channelPartnerId: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                    >
                      {(lookups.channelPartners || []).map(cp => (
                        <option key={cp.id} value={cp.id}>{cp.firmName} ({cp.contactName})</option>
                      ))}
                    </select>
                  </div>
                )}

                {activeModal.type === 'suggest_property' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Project to Suggest</label>
                    <select
                      value={formState.projectId}
                      onChange={(e) => setFormState({ ...formState, projectId: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                    >
                      {(lookups.projects || []).map(p => (
                        <option key={p.id} value={p.id}>{p.name} — {p.subLocation} ({p.priceRange})</option>
                      ))}
                    </select>
                  </div>
                )}

                {activeModal.type === 'edit' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Name</label>
                      <input type="text" value={formState.name} onChange={e => setFormState({ ...formState, name: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Primary No</label>
                      <input type="text" value={formState.primaryNo} onChange={e => setFormState({ ...formState, primaryNo: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Requirement</label>
                      <input type="text" value={formState.requirement} onChange={e => setFormState({ ...formState, requirement: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sub Location</label>
                      <input type="text" value={formState.subLocation} onChange={e => setFormState({ ...formState, subLocation: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Budget</label>
                      <input type="text" value={formState.budget} onChange={e => setFormState({ ...formState, budget: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ethnicity</label>
                      <input type="text" value={formState.ethnicity} onChange={e => setFormState({ ...formState, ethnicity: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
                    </div>
                  </div>
                )}
                </div>{/* end scroll */}
                <div className="flex gap-2 px-4 py-3 border-t flex-shrink-0">
                  <button type="button" onClick={() => setActiveModal(null)} className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 text-sm font-medium">Cancel</button>
                  <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Save</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}


      {/* Configure Campaign Mapping Modal */}
      {editingCampaign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              Map Campaign: {editingCampaign.name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">Meta ID: {editingCampaign.metaCampaignId}</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await crmApi.updateCampaignMapping(editingCampaign.id, {
                  mappedProjectId: editingCampaign.mappedProjectId ? Number(editingCampaign.mappedProjectId) : null,
                  defaultPreSalesAgentId: editingCampaign.defaultPreSalesAgentId ? Number(editingCampaign.defaultPreSalesAgentId) : null,
                  autoDistribute: editingCampaign.autoDistribute,
                  defaultRequirement: editingCampaign.defaultRequirement,
                  defaultSubLocation: editingCampaign.defaultSubLocation,
                  defaultTags: editingCampaign.defaultTags,
                  spendInr: Number(editingCampaign.spendInr || 0),
                  applyToExistingLeads: editingCampaign.applyToExistingLeads
                });
                
                // Save worker assignments
                if (editingCampaign.selectedWorkerIds && editingCampaign.selectedWorkerIds.length > 0) {
                  await crmApi.assignCampaignWorkers(editingCampaign.id, editingCampaign.selectedWorkerIds);
                } else if (editingCampaign.selectedWorkerIds?.length === 0 && editingCampaign.assignedWorkerCount > 0) {
                  // User cleared all workers, reset to tenant-wide
                  await crmApi.clearCampaignWorkers(editingCampaign.id);
                }
                
                setEditingCampaign(null);
                loadCampaignsAndPages();
                loadCountsAndLookups();
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Map to CRM Project</label>
                  <select
                    value={editingCampaign.mappedProjectId}
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, mappedProjectId: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">-- Unmapped --</option>
                    {(lookups.projects || []).map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.subLocation})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ad Spend (₹ INR)</label>
                  <input
                    type="number"
                    value={editingCampaign.spendInr}
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, spendInr: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>

              <div className="border-t pt-3">
                <h4 className="font-bold text-sm text-slate-900 mb-2">🎯 Lead Assignment Strategy</h4>
                <div className="bg-slate-50 rounded-lg p-3 space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assign Specific Workers (Optional)</label>
                    <p className="text-[10px] text-slate-500 mb-2">
                      Select specific PreSales workers for this campaign. Leads will be distributed via round-robin <strong>only within this group</strong>. Leave empty for tenant-wide round-robin.
                    </p>
                    <div className="space-y-1 max-h-40 overflow-y-auto border rounded p-2 bg-white">
                      {(lookups.teamMembers || [])
                        .filter(m => m.role === 'PreSales')
                        .map(m => (
                          <label key={m.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(editingCampaign.selectedWorkerIds || []).includes(m.id)}
                              onChange={(e) => {
                                const currentIds = editingCampaign.selectedWorkerIds || [];
                                const newIds = e.target.checked
                                  ? [...currentIds, m.id]
                                  : currentIds.filter(id => id !== m.id);
                                setEditingCampaign({ ...editingCampaign, selectedWorkerIds: newIds });
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-xs font-medium text-slate-700">{m.name}</span>
                            <span className="text-[10px] text-slate-500">({m.email})</span>
                          </label>
                        ))}
                    </div>
                    {(editingCampaign.selectedWorkerIds?.length > 0) && (
                      <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded text-[11px] text-indigo-800">
                        ✓ <strong>{editingCampaign.selectedWorkerIds.length} worker(s) selected</strong>. Round-robin will distribute leads only among these agents.
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Fallback: Default Agent (Optional)</label>
                    <select
                      value={editingCampaign.defaultPreSalesAgentId}
                      onChange={(e) => setEditingCampaign({ ...editingCampaign, defaultPreSalesAgentId: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      disabled={editingCampaign.selectedWorkerIds?.length > 0}
                    >
                      <option value="">None (Use Round-Robin)</option>
                      {(lookups.teamMembers || []).filter(m => m.role === 'PreSales').map(m => (
                        <option key={m.id} value={m.id}>Assign Only To: {m.name}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {editingCampaign.selectedWorkerIds?.length > 0
                        ? "Disabled when specific workers are selected"
                        : "Assign all leads from this campaign to one specific agent"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Default Requirement</label>
                  <input
                    type="text"
                    placeholder="e.g. 2 & 3 BHK"
                    value={editingCampaign.defaultRequirement}
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, defaultRequirement: e.target.value })}
                    className="w-full border rounded px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Default Sub Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Andheri West"
                    value={editingCampaign.defaultSubLocation}
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, defaultSubLocation: e.target.value })}
                    className="w-full border rounded px-2.5 py-1.5"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  checked={editingCampaign.applyToExistingLeads}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, applyToExistingLeads: e.target.checked })}
                />
                <span className="text-slate-700 font-medium">Retroactively update Project on existing leads from this campaign</span>
              </label>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setEditingCampaign(null)} className="px-4 py-1.5 border rounded">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white rounded font-semibold">
                  Save Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Real-Time Toast Notification */}
      {liveToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white border border-indigo-500 rounded-xl shadow-2xl p-4 w-96 flex items-start gap-3 animate-bounce">
          <div className="p-2 bg-indigo-600 rounded-lg shrink-0">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-400 uppercase tracking-wider">
                {liveToast.eventType === 'ReInquiry'
                  ? `🔁 Returning Lead (#${liveToast.inquiryCount})`
                  : '⚡ New Facebook Lead'}
              </span>
              <button onClick={() => setLiveToast(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="font-semibold text-sm mt-1">
              {liveToast.name} ({liveToast.leadId})
            </div>
            <div className="text-slate-300 mt-0.5">
              Phone: <span className="font-mono">{liveToast.primaryNo}</span>
            </div>
            <div className="text-slate-400 mt-1">
              Campaign: <span className="text-white">{liveToast.campaignName}</span> • Assigned to{' '}
              <span className="text-emerald-400 font-semibold">{liveToast.assignedAgent}</span>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Lead Details Modal */}
      <LeadDetailsModal
        leadId={selectedLeadId}
        isOpen={viewLeadModalOpen}
        onClose={() => {
          setViewLeadModalOpen(false);
          setSelectedLeadId(null);
        }}
        onNavigateToTask={async (taskId) => {
          try {
            const taskDetails = await crmApi.getTask(taskId);
            setViewLeadModalOpen(false);
            setSelectedTaskDetails(taskDetails);
            setViewTaskModalOpen(true);
          } catch (err) {
            console.error('Failed to fetch task details:', err);
            alert('Could not load task details.');
          }
        }}
      />

      {/* View Lead Tasks Modal */}
      {viewTasksModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 !text-black">Tasks for Lead</h2>
              <button
                onClick={() => {
                  setViewTasksModalOpen(false);
                  setLeadTasks([]);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {leadTasks.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No tasks found for this lead.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leadTasks.map((task) => (
                    <div
                      key={task.id}
                      className="border border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              task.status === 'Completed' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {task.status}
                            </span>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold text-[11px]">
                              {task.activityType}
                            </span>
                          </div>
                          <h3 className="font-semibold text-slate-900 mb-1">{task.title}</h3>
                          <p className="text-sm text-slate-600 mb-2">{task.remark}</p>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>📅 {fmtDate(task.scheduleDate)}</span>
                            <span>👤 {task.assignedTo}</span>
                            <span className="font-semibold text-amber-700">{task.stage}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={async () => {
                              try {
                                const details = await crmApi.getTask(task.id);
                                setSelectedTaskDetails(details);
                                setViewTasksModalOpen(false);
                                setViewTaskModalOpen(true);
                              } catch (err) {
                                console.error('Failed loading task details:', err);
                              }
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium"
                          >
                            Open Task
                          </button>
                          {task.status !== 'Completed' && (
                            <button
                              onClick={() => handleTaskAction('mark_done', task)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                            >
                              Mark Done
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add New Task Button */}
              <div className="mt-6 pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    // Close tasks modal and open add task form
                    const leadData = leadTasks[0]; // Get lead info from first task
                    setViewTasksModalOpen(false);
                    
                    // Find the lead and trigger add_task action
                    // We need the full lead object, so let's set the modal directly
                    setFormState({
                      stage: 'Call Back',
                      stageReason: 'Customer Was Traveling Ask To Callback',
                      activityType: 'CALL',
                      scheduleDate: new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 16),
                      title: `Followup Task`,
                      remark: '',
                      ownerRole: 'PreSales',
                      teamMemberId: currentUser?.id || lookups.teamMembers?.[0]?.id || 1,
                      channelPartnerId: lookups.channelPartners?.[0]?.id || 1,
                      projectId: lookups.projects?.[0]?.id || 1,
                      name: '',
                      primaryNo: '',
                      status: 'Active',
                      requirement: '',
                      subLocation: '',
                      budget: '',
                      ethnicity: '',
                      tags: ''
                    });
                    setActiveModal({ type: 'add_task', lead: { id: leadData.leadId } });
                  }}
                  className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add New Task for this Lead
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View/Edit Task Details Modal */}
      {viewTaskModalOpen && selectedTaskDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900 !text-black">Task Details</h2>
              <button
                onClick={() => {
                  setViewTaskModalOpen(false);
                  setSelectedTaskDetails(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* Lead Info - Read Only */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-indigo-600 font-semibold mb-1">ASSOCIATED LEAD</p>
                    <p className="font-semibold text-slate-900">{selectedTaskDetails?.leadName || 'N/A'}</p>
                    <p className="text-xs sm:text-sm text-slate-600">{selectedTaskDetails?.leadNumber || 'N/A'} • <span className="whitespace-nowrap">{selectedTaskDetails?.leadPhone || 'N/A'}</span></p>
                  </div>
                  {selectedTaskDetails?.leadId && (
                    <button
                      type="button"
                      onClick={() => {
                        setViewTaskModalOpen(false);
                        setSelectedLeadId(selectedTaskDetails.leadId);
                        setViewLeadModalOpen(true);
                      }}
                      className="flex-shrink-0 whitespace-nowrap px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs sm:text-sm font-medium"
                    >
                      View Lead →
                    </button>
                  )}
                </div>
              </div>

              {/* Task Status Selector */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-4">
                <label className="block text-xs font-semibold text-slate-700 mb-2">TASK STATUS</label>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(5.25rem,1fr))] sm:grid-cols-5 gap-1.5 sm:gap-2">
                  {['To Do', 'In Progress', 'Pending', 'Deferred', 'Completed'].map((s) => {
                    const isActive = selectedTaskDetails?.status === s;
                    const colors = {
                      'To Do': 'bg-slate-200 text-slate-800',
                      'In Progress': 'bg-blue-100 text-blue-700',
                      'Pending': 'bg-amber-100 text-amber-700',
                      'Deferred': 'bg-orange-100 text-orange-700',
                      'Completed': 'bg-emerald-100 text-emerald-700'
                    };
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setSelectedTaskDetails({ ...selectedTaskDetails, status: s });
                          // Auto-set "In Progress" visual cue when leaving "To Do"
                        }}
                        className={`min-w-0 px-1.5 py-2 sm:py-1.5 rounded text-[11px] leading-tight font-medium border whitespace-nowrap truncate transition ${
                          isActive
                            ? `${colors[s]} border-current ring-1 ring-current`
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editable Task Fields */}
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-bold text-slate-900 mb-3 !text-black">Task Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Activity Type</label>
                    <select
                      id="taskActivityType"
                      defaultValue={selectedTaskDetails?.activityType || 'CALL'}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                    >
                      <option value="CALL">CALL</option>
                      <option value="SITE VISIT">SITE VISIT</option>
                      <option value="MEETING">MEETING</option>
                      <option value="EMAIL">EMAIL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Stage</label>
                    <select
                      id="taskStage"
                      defaultValue={selectedTaskDetails?.stage || 'CALL BACK'}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                    >
                      <option value="NEW LEAD">NEW LEAD</option>
                      <option value="CALL BACK">CALL BACK</option>
                      <option value="SITE VISIT">SITE VISIT</option>
                      <option value="MEETING">MEETING</option>
                      <option value="NEGOTIATION">NEGOTIATION</option>
                      <option value="CONVERTED">CONVERTED</option>
                      <option value="NOT INTERESTED">NOT INTERESTED</option>
                      <option value="JUNK">JUNK</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Schedule Date & Time</label>
                    <input
                      type="datetime-local"
                      id="taskScheduleDate"
                      defaultValue={selectedTaskDetails?.scheduleDate ? new Date(selectedTaskDetails.scheduleDate).toISOString().slice(0, 16) : new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 16)}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Assign To</label>
                    <select
                      id="taskAssignedTo"
                      defaultValue={currentUser?.id}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                    >
                      {(lookups.teamMembers || []).map(tm => (
                        <option key={tm.id} value={tm.id}>{tm.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Task Title</label>
                    <input
                      type="text"
                      id="taskTitle"
                      defaultValue={selectedTaskDetails?.title || `Followup with ${selectedTaskDetails?.leadName}`}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Remark / Notes</label>
                    <textarea
                      id="taskRemark"
                      rows="2"
                      defaultValue={selectedTaskDetails?.remark || ''}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Completion Info if Completed */}
              {selectedTaskDetails?.status === 'Completed' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-xs text-emerald-600 font-semibold mb-1">TASK COMPLETED</p>
                  <p className="text-sm text-slate-900">{selectedTaskDetails?.completedOn || 'N/A'}</p>
                  <p className="text-sm text-slate-600">by {selectedTaskDetails?.completedBy || 'N/A'}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await crmApi.updateTask(selectedTaskDetails.id, {
                        status: selectedTaskDetails.status,
                        activityType: document.getElementById('taskActivityType').value,
                        stage: document.getElementById('taskStage').value,
                        scheduleDate: document.getElementById('taskScheduleDate').value,
                        title: document.getElementById('taskTitle').value,
                        remark: document.getElementById('taskRemark').value,
                        assignedToId: parseInt(document.getElementById('taskAssignedTo').value)
                      });
                      setViewTaskModalOpen(false);
                      refreshAll();
                    } catch (err) {
                      console.error('Failed updating task:', err);
                      alert('Failed to update task. Please try again.');
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setViewTaskModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Edit User — {editingUser.name}</h2>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input type="text" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input type="email" value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input type="text" value={editingUser.phone || ''} onChange={e => setEditingUser({...editingUser, phone: e.target.value})}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department Role</label>
                  <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm">
                    <option value="PreSales">PreSales</option>
                    <option value="Sales">Sales</option>
                    <option value="SourcingManager">Sourcing Manager</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Access Role</label>
                  <select value={editingUser.accessRole} onChange={e => setEditingUser({...editingUser, accessRole: e.target.value})}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm">
                    <option value="Worker">Worker</option>
                    <option value="CompanyAdmin">Company Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">New Password <span className="text-slate-400 font-normal">(leave blank to keep)</span></label>
                  <input type="password" value={editingUser.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                    placeholder="Min 8 characters"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="editCanViewAll" checked={editingUser.canViewAllCompanyLeads}
                  onChange={e => setEditingUser({...editingUser, canViewAllCompanyLeads: e.target.checked})}
                  className="w-4 h-4" />
                <label htmlFor="editCanViewAll" className="text-sm text-slate-700">Can view all company leads</label>
              </div>
              <div className="flex gap-2 pt-3 border-t border-slate-200">
                <button
                  onClick={async () => {
                    try {
                      await crmApi.editUser(editingUser.id, {
                        name: editingUser.name,
                        email: editingUser.email,
                        phone: editingUser.phone,
                        role: editingUser.role,
                        accessRole: editingUser.accessRole,
                        canViewAllCompanyLeads: editingUser.canViewAllCompanyLeads,
                        password: editingUser.password || null
                      });
                      setEditingUser(null);
                      loadCompanyUsers(currentTeamPage);
                    } catch (err) {
                      alert(err.response?.data || 'Failed to update user.');
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm"
                >Save Changes</button>
                <button onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium text-sm"
                >Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Set Holiday Modal */}
      {holidayUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Set Holiday — {holidayUser.name}</h2>
              <button onClick={() => setHolidayUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">No leads will be assigned to this user during the holiday period.</p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Holiday Start</label>
                <input type="date" value={holidayForm.start} onChange={e => setHolidayForm({...holidayForm, start: e.target.value})}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Holiday End <span className="text-slate-400 font-normal">(inclusive)</span></label>
                <input type="date" value={holidayForm.end} onChange={e => setHolidayForm({...holidayForm, end: e.target.value})}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm" />
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={async () => {
                    if (!holidayForm.start || !holidayForm.end) { alert('Please set both start and end dates.'); return; }
                    if (new Date(holidayForm.end) < new Date(holidayForm.start)) { alert('End date must be after start date.'); return; }
                    try {
                      await crmApi.setUserHoliday(holidayUser.id, {
                        holidayStart: holidayForm.start,
                        // end date is inclusive so push to midnight of next day
                        holidayEnd: new Date(new Date(holidayForm.end).getTime() + 86400000).toISOString().slice(0, 10),
                        clear: false
                      });
                      setHolidayUser(null);
                      loadCompanyUsers(currentTeamPage);
                    } catch (err) {
                      alert(err.response?.data || 'Failed to set holiday.');
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm"
                >Set Holiday</button>
                <button onClick={() => setHolidayUser(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium text-sm"
                >Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PWA Install Prompt */}
      <InstallPWA />
    </div>
  );
}