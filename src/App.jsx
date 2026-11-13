import React, { useEffect, useState, useCallback } from 'react';
import { crmApi } from './api/crmApi';
import { useCrmRealtime } from './hooks/useCrmRealtime';
import LeadDetailsModal from './components/LeadDetailsModal';
import InstallPWA from './components/InstallPWA';
import { requestNotificationPermission, showLeadNotification } from './utils/notifications';
import {
  Users, CheckSquare, Search, RefreshCw, MoreVertical,
  Calendar, Building2, UserPlus, ArrowRightLeft, Trash2, Edit3,
  Eye, Bell, Wifi, Layers, Plus, Link2, ShieldCheck, LogOut, Lock, X
} from 'lucide-react';

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

  const [activePage, setActivePage] = useState('leads'); // 'leads' | 'tasks' | 'campaigns' | 'team'
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

  const handleLogout = () => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setCurrentUser(null);
    setActivePage('leads');
  };

  // Data Fetching Functions
  const loadCountsAndLookups = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [c, l] = await Promise.all([crmApi.getDashboardCounts(), crmApi.getLookups()]);
      setCounts(c);
      setLookups(l);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
      console.error('Failed loading counts/lookups:', err);
    }
  }, [currentUser]);

  const loadLeads = useCallback(async (tab = activeLeadTab, search = searchQuery, page = currentLeadPage) => {
    if (!currentUser) return;
    setLoadingLeads(true);
    try {
      const res = await crmApi.getLeads(tab, search, page);
      setLeadsData(res);
    } catch (err) {
      console.error('Failed loading leads:', err);
    } finally {
      setLoadingLeads(false);
    }
  }, [currentUser, activeLeadTab, searchQuery, currentLeadPage]);

  const loadTasks = useCallback(async (tab = activeTaskTab, page = currentTaskPage) => {
    if (!currentUser) return;
    setLoadingTasks(true);
    try {
      const res = await crmApi.getTasks(tab, page);
      setTasksData(res);
    } catch (err) {
      console.error('Failed loading tasks:', err);
    } finally {
      setLoadingTasks(false);
    }
  }, [currentUser, activeTaskTab, currentTaskPage]);

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

  useEffect(() => {
    if (currentUser) {
      loadCountsAndLookups();
      // Request notification permission for push notifications
      requestNotificationPermission().then(granted => {
        if (granted) {
          console.log('✅ Push notifications enabled');
        }
      });
    }
  }, [currentUser, loadCountsAndLookups]);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenuLeadId && !event.target.closest('.action-menu-container')) {
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
  }, [currentUser, activePage, activeLeadTab, activeTaskTab, currentLeadPage, currentTaskPage, currentTeamPage, loadLeads, loadTasks, loadCampaignsAndPages, loadCompanyUsers]);

  // Reset to page 1 when changing tabs or search
  useEffect(() => {
    setCurrentLeadPage(1);
  }, [activeLeadTab, searchQuery]);

  useEffect(() => {
    setCurrentTaskPage(1);
  }, [activeTaskTab]);

  const refreshAll = () => {
    loadCountsAndLookups();
    if (activePage === 'leads') loadLeads(activeLeadTab, searchQuery, currentLeadPage);
    else if (activePage === 'tasks') loadTasks(activeTaskTab, currentTaskPage);
    else if (activePage === 'campaigns') loadCampaignsAndPages();
    else if (activePage === 'team') loadCompanyUsers(currentTeamPage);
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
          refreshAll();
        }
        break;
    }
  };

  const handleRowAction = async (action, lead) => {
    setOpenMenuLeadId(null);

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

    setFormState({
      stage: lead.leadStage || 'Call Back',
      stageReason: lead.stageReason !== '-' ? lead.stageReason : 'Customer Was Traveling Ask To Callback',
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
        stage: formState.stage
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
        <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto">
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

          <nav className="hidden sm:flex gap-1.5">
            <button
              onClick={() => setActivePage('leads')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                activePage === 'leads' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" /> Leads Workspace
            </button>
            <button
              onClick={() => setActivePage('tasks')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                activePage === 'tasks' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <CheckSquare className="w-4 h-4" /> Tasks Page
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setActivePage('campaigns')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                    activePage === 'campaigns' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Layers className="w-4 h-4" /> Meta Campaigns & Pages
                </button>
                <button
                  onClick={() => setActivePage('team')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                    activePage === 'team' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Lock className="w-4 h-4" /> Team & Access Control
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex sm:hidden gap-1 w-full overflow-x-auto pb-1">
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
            </>
          )}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <span className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-full font-medium ${
            wsStatus === 'Connected'
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              : 'bg-amber-950 text-amber-400 border border-amber-800'
          }`}>
            <Wifi className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{wsStatus === 'Connected' ? 'Live Sync Active' : wsStatus}</span>
            <span className="sm:hidden">{wsStatus === 'Connected' ? 'Live' : 'Off'}</span>
          </span>
          <button
            onClick={refreshAll}
            className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs bg-slate-800 hover:bg-slate-700 px-2 sm:px-3 py-1.5 rounded border border-slate-700"
          >
            <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-[10px] sm:text-xs bg-rose-950/80 hover:bg-rose-900 text-rose-300 px-2 sm:px-3 py-1.5 rounded border border-rose-800"
          >
            <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="space-y-4 sm:space-y-6">
        {activePage === 'leads' ? (
          <div className="px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {/* 1. ALL LEADS & TODAY'S LEADS SUMMARY TABS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 shadow-xs overflow-hidden">
                <h2 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 sm:mb-3">
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
                <h2 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 sm:mb-3">
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
                  Showing Filter: <span className="text-indigo-600 uppercase">{activeLeadTab.replaceAll('_', ' ')}</span>
                </span>
                <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-medium">
                  {leadsData.totalCount || 0} records
                </span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadLeads(activeLeadTab, searchQuery);
                }}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search name or mobile..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button type="submit" className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded-md hover:bg-indigo-700 whitespace-nowrap">
                  Search
                </button>
              </form>
            </div>

            {/* 22-COLUMN LEADS TABLE */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
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
                          <div className="action-menu-container relative">
                            <button
                              onClick={() => setOpenMenuLeadId(openMenuLeadId === r.id ? null : r.id)}
                              className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openMenuLeadId === r.id && (
                              <div className="absolute right-8 top-0 w-52 bg-white border border-slate-200 rounded-lg shadow-2xl py-1 z-[100] text-left">
                                <button onClick={() => handleRowAction('add_task', r)} className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-xs">
                                  <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Add Task / Update Stage
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
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

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
                { key: 'pending', label: 'Pending Tasks (Overdue)', val: tasksData.counts?.pendingTasks ?? 0 },
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

            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-x-auto">
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
            {tasksData.totalCount > 0 && (
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
        ) : activePage === 'campaigns' ? (
          /* CAMPAIGNS & CONNECTED FACEBOOK PAGES WORKSPACE */
          <div className="px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
            <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 shadow-xs space-y-3 sm:space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                    Connected Facebook Pages ({(metaPagesInfo.pages || []).length})
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
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
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Connected Facebook Campaigns & Instant Forms</h2>
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
        ) : (
          /* TEAM & ACCESS CONTROL WORKSPACE (ADMIN ONLY) */
          <div className="px-3 sm:px-6 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 shadow-xs">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-1">Add Company User / Worker</h2>
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
                    className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
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
                    className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
                  />
                </div>
                <div>
  <label className="block font-semibold text-slate-700 mb-1">WhatsApp Mobile No (For Instant Lead Alerts)</label>
  <input
    type="text"
    placeholder="e.g. +91-9820011223"
    value={newUserForm.phone}
    onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
    className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-mono"
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
                    className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Department Role</label>
                    <select
                      value={newUserForm.departmentRole}
                      onChange={(e) => setNewUserForm({ ...newUserForm, departmentRole: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
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
                      className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
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
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  {currentUser.companyName} — Team Directory & Data Visibility Scopes
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
                  Toggle whether each Worker can view the entire company lead pool or strictly leads & tasks assigned to them.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[10px] sm:text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase">
                    <th className="py-3 px-3">ID</th>
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Login Email</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Access Role</th>
                    <th className="py-3 px-3">Lead & Task Visibility Scope</th>
                    <th className="py-3 px-3 text-center">Quick Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(companyUsers.data || []).map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono">{u.id}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{u.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{u.email}</td>
                      <td className="py-2.5 px-3">{u.role}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.accessRole === 'CompanyAdmin'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {u.accessRole}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {u.accessRole === 'CompanyAdmin' || u.canViewAllCompanyLeads ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-medium">
                            All Company Leads & Tasks
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-medium">
                            Assigned Leads & Tasks Only
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {u.accessRole !== 'CompanyAdmin' && (
                          <button
                            onClick={async () => {
                              await crmApi.updateUserPermissions(u.id, {
                                accessRole: u.accessRole,
                                canViewAllCompanyLeads: !u.canViewAllCompanyLeads,
                                isActive: u.isActive
                              });
                              loadCompanyUsers(currentTeamPage);
                            }}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-indigo-600 text-white rounded text-[11px] font-medium"
                          >
                            Switch to {u.canViewAllCompanyLeads ? 'Assigned Only' : 'All Leads'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
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
                  className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
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
                  className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-mono"
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
                  className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Default CRM Project for this Page</label>
                <select
                  value={manualPageForm.defaultProjectId}
                  onChange={(e) => setManualPageForm({ ...manualPageForm, defaultProjectId: e.target.value })}
                  className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
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

      {/* MODAL FOR ROW ACTIONS */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2 sm:pb-3 mb-3 sm:mb-4">
              <h3 className="font-bold text-sm sm:text-base uppercase tracking-wide text-slate-800 truncate pr-2">
                {activeModal.type.replaceAll('_', ' ')} — {activeModal.lead.name}
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xl shrink-0">✕</button>
            </div>

            {activeModal.type !== 'view' && (
              <form onSubmit={submitModal} className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm">
                {activeModal.type === 'add_task' && (
                  <>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Lead Stage</label>
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
                        className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2"
                      >
                        {(lookups.stages || []).map(s => <option key={s.stage} value={s.stage}>{s.stage}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Stage Reason</label>
                      <select
                        value={formState.stageReason}
                        onChange={(e) => setFormState({ ...formState, stageReason: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2"
                      >
                        {((lookups.stages || []).find(s => s.stage === formState.stage)?.allowedReasons || []).map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Activity Type</label>
                        <select
                          value={formState.activityType}
                          onChange={(e) => setFormState({ ...formState, activityType: e.target.value })}
                          className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2"
                        >
                          <option value="CALL">CALL</option>
                          <option value="SITE VISIT">SITE VISIT</option>
                          <option value="MEETING">MEETING</option>
                          <option value="WHATSAPP">WHATSAPP</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Schedule Date & Time</label>
                        <input
                          type="datetime-local"
                          value={formState.scheduleDate}
                          onChange={(e) => setFormState({ ...formState, scheduleDate: e.target.value })}
                          className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Assign Task To</label>
                      <select
                        value={formState.teamMemberId}
                        onChange={(e) => setFormState({ ...formState, teamMemberId: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2"
                      >
                        {(lookups.teamMembers || []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Remark</label>
                      <textarea
                        rows={2}
                        value={formState.remark}
                        onChange={(e) => setFormState({ ...formState, remark: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2"
                      />
                    </div>
                  </>
                )}

                {activeModal.type === 'transfer' && (
                  <>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">New Pre-Sales Agent</label>
                      <select
                        onChange={(e) => setFormState({ ...formState, preSalesAgentId: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2"
                      >
                        <option value="">-- Keep Current --</option>
                        {(lookups.teamMembers || []).filter(m => m.role === 'PreSales').map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">New Sales Agent</label>
                      <select
                        onChange={(e) => setFormState({ ...formState, salesAgentId: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2"
                      >
                        <option value="">-- Keep Current --</option>
                        {(lookups.teamMembers || []).filter(m => m.role === 'Sales').map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Transfer Reason</label>
                      <input
                        type="text"
                        value={formState.remark}
                        onChange={(e) => setFormState({ ...formState, remark: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2"
                      />
                    </div>
                  </>
                )}

                {activeModal.type === 'add_owner' && (
                  <>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Owner Role</label>
                      <select
                        value={formState.ownerRole}
                        onChange={(e) => setFormState({ ...formState, ownerRole: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2"
                      >
                        <option value="PreSales">Pre-Sales Agent</option>
                        <option value="Sales">Sales Agent</option>
                        <option value="Sourcing">Sourcing Manager</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Team Member</label>
                      <select
                        value={formState.teamMemberId}
                        onChange={(e) => setFormState({ ...formState, teamMemberId: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2"
                      >
                        {(lookups.teamMembers || []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                      </select>
                    </div>
                  </>
                )}

                {activeModal.type === 'remove_owner' && (
                  <div>
                    <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Which Owner Role to Remove?</label>
                    <select
                      value={formState.ownerRole}
                      onChange={(e) => setFormState({ ...formState, ownerRole: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2"
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
                    <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Select Channel Partner</label>
                    <select
                      value={formState.channelPartnerId}
                      onChange={(e) => setFormState({ ...formState, channelPartnerId: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2"
                    >
                      {(lookups.channelPartners || []).map(cp => (
                        <option key={cp.id} value={cp.id}>{cp.firmName} ({cp.contactName})</option>
                      ))}
                    </select>
                  </div>
                )}

                {activeModal.type === 'suggest_property' && (
                  <div>
                    <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Select Project to Suggest</label>
                    <select
                      value={formState.projectId}
                      onChange={(e) => setFormState({ ...formState, projectId: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2.5 sm:px-3 py-1.5 sm:py-2"
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
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Name</label>
                      <input type="text" value={formState.name} onChange={e => setFormState({ ...formState, name: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Primary No</label>
                      <input type="text" value={formState.primaryNo} onChange={e => setFormState({ ...formState, primaryNo: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Requirement</label>
                      <input type="text" value={formState.requirement} onChange={e => setFormState({ ...formState, requirement: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Sub Location</label>
                      <input type="text" value={formState.subLocation} onChange={e => setFormState({ ...formState, subLocation: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Budget</label>
                      <input type="text" value={formState.budget} onChange={e => setFormState({ ...formState, budget: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">Ethnicity</label>
                      <input type="text" value={formState.ethnicity} onChange={e => setFormState({ ...formState, ethnicity: e.target.value })} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
                    </div>
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t">
                  <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 border rounded text-slate-600 text-sm">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 text-sm">
                    Save Changes
                  </button>
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
      />

      {/* View Lead Tasks Modal */}
      {viewTasksModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Tasks for Lead</h2>
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
                            onClick={() => handleTaskAction('view', task)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-xs font-medium"
                          >
                            View Details
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
            </div>
          </div>
        </div>
      )}

      {/* View Task Details Modal */}
      {viewTaskModalOpen && selectedTaskDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">Task Details</h2>
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

            <div className="p-6 space-y-4">
              {/* Lead Info */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-indigo-600 font-semibold mb-1">ASSOCIATED LEAD</p>
                    <p className="font-semibold text-slate-900">{selectedTaskDetails?.leadName || 'N/A'}</p>
                    <p className="text-sm text-slate-600">{selectedTaskDetails?.leadNumber || 'N/A'} • {selectedTaskDetails?.leadPhone || 'N/A'}</p>
                  </div>
                  {selectedTaskDetails?.leadId && (
                    <button
                      onClick={() => {
                        setViewTaskModalOpen(false);
                        setSelectedLeadId(selectedTaskDetails.leadId);
                        setViewLeadModalOpen(true);
                      }}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                    >
                      View Lead →
                    </button>
                  )}
                </div>
              </div>

              {/* Task Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">STATUS</p>
                  <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                    selectedTaskDetails?.status === 'Completed' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedTaskDetails?.status || 'N/A'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">ACTIVITY TYPE</p>
                  <span className="inline-block px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm font-semibold">
                    {selectedTaskDetails?.activityType || 'N/A'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">STAGE</p>
                  <p className="font-semibold text-amber-700">{selectedTaskDetails?.stage || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">SCHEDULE DATE</p>
                  <p className="font-medium text-slate-900">{selectedTaskDetails?.scheduleDate ? fmtDate(selectedTaskDetails.scheduleDate) : 'N/A'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">TITLE</p>
                <p className="font-semibold text-slate-900">{selectedTaskDetails?.title || 'N/A'}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">REMARK</p>
                <p className="text-slate-700">{selectedTaskDetails?.remark || 'No remarks'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">ASSIGNED BY</p>
                  <p className="text-slate-900">{selectedTaskDetails?.assignedBy || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">ASSIGNED TO</p>
                  <p className="text-slate-900">{selectedTaskDetails?.assignedTo || 'N/A'}</p>
                </div>
              </div>

              {selectedTaskDetails?.status === 'Completed' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-xs text-emerald-600 font-semibold mb-1">COMPLETED</p>
                  <p className="text-sm text-slate-900">{selectedTaskDetails?.completedOn || 'N/A'}</p>
                  <p className="text-sm text-slate-600">by {selectedTaskDetails?.completedBy || 'N/A'}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-slate-200">
                {selectedTaskDetails?.status !== 'Completed' && (
                  <button
                    onClick={async () => {
                      const outcome = window.prompt('Enter call/visit outcome remark:', selectedTaskDetails?.remark || '');
                      if (outcome !== null) {
                        await crmApi.completeTask(selectedTaskDetails.id, { outcomeRemark: outcome });
                        setViewTaskModalOpen(false);
                        refreshAll();
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
                  >
                    Mark as Done
                  </button>
                )}
                <button
                  onClick={() => setViewTaskModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium"
                >
                  Close
                </button>
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