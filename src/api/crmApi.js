import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5260/api',
});

// Automatically attach JWT token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('crm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const crmApi = {
  // Auth & Multi-Tenant RBAC APIs
  login: (email, password) =>
    api.post('/auth/login', { email, password }).then(r => r.data),
  registerCompany: (payload) =>
    api.post('/auth/register-company', payload).then(r => r.data),
  getCompanyUsers: () =>
    api.get('/auth/users').then(r => r.data),
  createCompanyUser: (payload) =>
    api.post('/auth/users', payload).then(r => r.data),
  updateUserPermissions: (id, payload) =>
    api.put(`/auth/users/${id}/permissions`, payload).then(r => r.data),

  // Leads Workspace APIs
  getDashboardCounts: () => api.get('/leads/dashboard-counts').then(r => r.data),
  getLookups: () => api.get('/leads/lookups').then(r => r.data),
  getLeads: (tab = 'all_total', search = '', page = 1) =>
    api.get('/leads', { params: { tab, search, page } }).then(r => r.data),
  getLeadDetails: (id) => api.get(`/leads/${id}`).then(r => r.data),
  addTask: (id, payload) => api.post(`/leads/${id}/tasks`, payload).then(r => r.data),
  changeStage: (id, payload) => api.post(`/leads/${id}/stage`, payload).then(r => r.data),
  convertToContact: (id) => api.post(`/leads/${id}/convert-to-contact`).then(r => r.data),
  transferLead: (id, payload) => api.post(`/leads/${id}/transfer`, payload).then(r => r.data),
  addOwner: (id, payload) => api.post(`/leads/${id}/owners`, payload).then(r => r.data),
  removeOwner: (id, role) => api.delete(`/leads/${id}/owners/${role}`).then(r => r.data),
  addChannelPartner: (id, channelPartnerId) =>
    api.post(`/leads/${id}/channel-partner`, { channelPartnerId }).then(r => r.data),
  removeChannelPartner: (id) => api.delete(`/leads/${id}/channel-partner`).then(r => r.data),
  suggestProperty: (id, projectId) =>
    api.post(`/leads/${id}/suggested-properties`, { projectId }).then(r => r.data),
  editLead: (id, payload) => api.put(`/leads/${id}`, payload).then(r => r.data),
  deleteLead: (id) => api.delete(`/leads/${id}`).then(r => r.data),

  // Tasks Page APIs
  getTasks: (tab = 'today', page = 1) =>
    api.get('/tasks', { params: { tab, page } }).then(r => r.data),
  completeTask: (taskId, payload) =>
    api.post(`/tasks/${taskId}/complete`, payload).then(r => r.data),

  // Meta Campaigns Page APIs
  getCampaigns: () => api.get('/campaigns').then(r => r.data),
  syncCampaigns: (adAccountId = '') =>
    api.post('/campaigns/sync', null, { params: { adAccountId } }).then(r => r.data),
  updateCampaignMapping: (id, payload) =>
    api.put(`/campaigns/${id}/mapping`, payload).then(r => r.data),

  // Connected Facebook Pages APIs
  getConnectedPages: () => api.get('/meta-pages').then(r => r.data),
  connectPagesOAuth: (userAccessToken) =>
    api.post('/meta-pages/connect-oauth', { userAccessToken }).then(r => r.data),
  connectPageManual: (payload) =>
    api.post('/meta-pages/connect-manual', payload).then(r => r.data),
  disconnectPage: (id) =>
    api.delete(`/meta-pages/${id}`).then(r => r.data),
};