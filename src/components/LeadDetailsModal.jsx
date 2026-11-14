import React, { useState, useEffect } from 'react';
import { X, User, FileText, Clock, CheckSquare, Home, Phone, Mail, MapPin, Calendar, Tag, Eye } from 'lucide-react';
import { crmApi } from '../api/crmApi';

const LeadDetailsModal = ({ leadId, isOpen, onClose, onNavigateToTask }) => {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && leadId) {
      fetchLeadDetails();
    }
  }, [isOpen, leadId]);

  const fetchLeadDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await crmApi.getLeadDetails(leadId);
      setLead(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch lead details');
      console.error('Error fetching lead details:', err);
    } finally {
      setLoading(false);
    }
  };

  const parseCustomFields = () => {
    if (!lead?.customFieldsJson) return {};
    try {
      return JSON.parse(lead.customFieldsJson);
    } catch {
      return {};
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStageColor = (stage) => {
    const colors = {
      'new': 'bg-blue-100 text-blue-800',
      'contacted': 'bg-yellow-100 text-yellow-800',
      'qualified': 'bg-purple-100 text-purple-800',
      'proposal': 'bg-orange-100 text-orange-800',
      'negotiation': 'bg-pink-100 text-pink-800',
      'closed_won': 'bg-green-100 text-green-800',
      'closed_lost': 'bg-red-100 text-red-800'
    };
    return colors[stage?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {lead?.name || 'Lead Details'}
              </h2>
              {lead && (
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStageColor(lead.leadStage)}`}>
                    {lead.leadStage?.toUpperCase() || 'NEW'}
                  </span>
                  <span className="text-sm text-gray-500">•</span>
                  <span className="text-sm text-gray-500">ID: LD-{String(lead.leadNumber).padStart(5, '0')}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b px-6">
          <div className="flex gap-6">
            {[
              { id: 'overview', label: 'Overview', icon: User },
              { id: 'form-data', label: 'Form Data', icon: FileText },
              { id: 'timeline', label: 'Timeline', icon: Clock },
              { id: 'tasks', label: 'Tasks', icon: CheckSquare },
              { id: 'properties', label: 'Properties', icon: Home }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
              {error}
            </div>
          ) : lead ? (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Contact Information */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <h3 className="font-semibold text-gray-800 mb-3">Contact Information</h3>
                      
                      {lead.primaryNo && (
                        <div className="flex items-start gap-3">
                          <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Phone</p>
                            <p className="text-gray-800 font-medium">{lead.primaryNo}</p>
                          </div>
                        </div>
                      )}

                      {lead.email && (
                        <div className="flex items-start gap-3">
                          <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Email</p>
                            <p className="text-gray-800 font-medium">{lead.email}</p>
                          </div>
                        </div>
                      )}

                      {lead.subLocation && (
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Location</p>
                            <p className="text-gray-800 font-medium">{lead.subLocation}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Lead Information */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <h3 className="font-semibold text-gray-800 mb-3">Lead Information</h3>
                      
                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Created</p>
                          <p className="text-gray-800 font-medium">{formatDate(lead.createdAt)}</p>
                        </div>
                      </div>

                      {lead.campaignName && (
                        <div className="flex items-start gap-3">
                          <Tag className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Campaign</p>
                            <p className="text-gray-800 font-medium">{lead.campaignName}</p>
                          </div>
                        </div>
                      )}

                      {lead.formName && (
                        <div className="flex items-start gap-3">
                          <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Facebook Form</p>
                            <p className="text-gray-800 font-medium">{lead.formName}</p>
                          </div>
                        </div>
                      )}

                      {lead.pageName && (
                        <div className="flex items-start gap-3">
                          <User className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Facebook Page</p>
                            <p className="text-gray-800 font-medium">{lead.pageName}</p>
                          </div>
                        </div>
                      )}

                      {lead.adName && (
                        <div className="flex items-start gap-3">
                          <Tag className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Ad</p>
                            <p className="text-gray-800 font-medium">{lead.adName}</p>
                          </div>
                        </div>
                      )}

                      {lead.source && (
                        <div className="flex items-start gap-3">
                          <Tag className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Source</p>
                            <p className="text-gray-800 font-medium">{lead.source}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Assignment Information */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <h3 className="font-semibold text-gray-800 mb-3">Assignment</h3>
                      
                      {lead.preSalesAgent && (
                        <div>
                          <p className="text-sm text-gray-500">Pre-Sales Agent</p>
                          <p className="text-gray-800 font-medium">{lead.preSalesAgent.name}</p>
                        </div>
                      )}

                      {lead.salesAgent && (
                        <div>
                          <p className="text-sm text-gray-500">Sales Agent</p>
                          <p className="text-gray-800 font-medium">{lead.salesAgent.name}</p>
                        </div>
                      )}

                      {lead.channelPartner && (
                        <div>
                          <p className="text-sm text-gray-500">Channel Partner</p>
                          <p className="text-gray-800 font-medium">{lead.channelPartner.firmName}</p>
                        </div>
                      )}

                      {lead.sourcingManager && (
                        <div>
                          <p className="text-sm text-gray-500">Sourcing Manager</p>
                          <p className="text-gray-800 font-medium">{lead.sourcingManager.name}</p>
                        </div>
                      )}
                    </div>

                    {/* Project Information */}
                    {lead.project && (
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <h3 className="font-semibold text-gray-800 mb-3">Project</h3>
                        <div>
                          <p className="text-gray-800 font-medium">{lead.project.name}</p>
                          {lead.project.subLocation && (
                            <p className="text-sm text-gray-500 mt-1">{lead.project.subLocation}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Remark */}
                  {lead.remark && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-800 mb-2">Remark</h3>
                      <p className="text-gray-700 whitespace-pre-wrap">{lead.remark}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Form Data Tab */}
              {activeTab === 'form-data' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-800 text-lg mb-4">Facebook Form Responses</h3>
                  {(() => {
                    const customFields = parseCustomFields();
                    const fieldEntries = Object.entries(customFields);
                    
                    if (fieldEntries.length === 0) {
                      return (
                        <div className="bg-gray-50 rounded-lg p-8 text-center">
                          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">No additional form data available</p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fieldEntries.map(([key, value]) => (
                          <div key={key} className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm text-gray-500 mb-1 font-medium">
                              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                            <p className="text-gray-800">
                              {Array.isArray(value) ? value.join(', ') : (value?.toString() || 'N/A')}
                            </p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Timeline Tab */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-800 text-lg mb-4">Activity Timeline</h3>
                  {lead.activities && lead.activities.length > 0 ? (
                    <div className="space-y-4">
                      {lead.activities.map((activity, index) => {
                        const typeStyles = {
                          'TaskCreated': { bg: 'bg-indigo-100', text: 'text-indigo-600', label: 'Task Created' },
                          'TaskUpdated': { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Task Updated' },
                          'TaskCompleted': { bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Task Completed' },
                          'StageChange': { bg: 'bg-amber-100', text: 'text-amber-600', label: 'Stage Changed' },
                          'ConvertedToContact': { bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Converted to Contact' },
                          'LeadTransferred': { bg: 'bg-orange-100', text: 'text-orange-600', label: 'Lead Transferred' },
                        };
                        const style = typeStyles[activity.activityType] || { bg: 'bg-slate-100', text: 'text-slate-600', label: activity.activityType || 'Activity' };
                        return (
                          <div key={activity.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className={`w-10 h-10 rounded-full ${style.bg} flex items-center justify-center`}>
                                <Clock className={`w-5 h-5 ${style.text}`} />
                              </div>
                              {index < lead.activities.length - 1 && (
                                <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                              )}
                            </div>
                            <div className="flex-1 bg-gray-50 rounded-lg p-4 mb-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-gray-800">{style.label}</p>
                                  {activity.taskId && (
                                    <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                      TASK-{activity.taskId.substring(0, 8).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <span className="text-sm text-gray-500">{formatDate(activity.createdAt)}</span>
                              </div>
                              {activity.notes && (
                                <p className="text-gray-600 text-sm whitespace-pre-wrap">{activity.notes}</p>
                              )}
                              {activity.taskId && onNavigateToTask && (
                                <button
                                  onClick={() => onNavigateToTask(activity.taskId)}
                                  className="mt-2 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-medium flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  Open Task
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No activities recorded yet</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tasks Tab */}
              {activeTab === 'tasks' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-800 text-lg mb-4">Tasks</h3>
                  {lead.tasks && lead.tasks.length > 0 ? (
                    <div className="space-y-3">
                      {lead.tasks.map((task) => {
                        const isCompleted = task.status === 'Completed';
                        const shortId = task.id?.toString().substring(0, 8).toUpperCase();
                        return (
                          <div key={task.id} className={`bg-gray-50 rounded-lg p-4 border-l-4 ${isCompleted ? 'border-emerald-500' : 'border-blue-500'}`}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                  TASK-{shortId}
                                </span>
                                <p className={`font-semibold ${isCompleted ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                  {task.title}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                  isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {task.status}
                                </span>
                                {onNavigateToTask && (
                                  <button
                                    onClick={() => onNavigateToTask(task.id)}
                                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-medium flex items-center gap-1"
                                  >
                                    <Eye className="w-3 h-3" />
                                    Open Task
                                  </button>
                                )}
                              </div>
                            </div>
                            {task.remark && (
                              <p className="text-gray-600 text-sm mb-2">{task.remark}</p>
                            )}
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              {task.scheduleDate && (
                                <span>📅 {formatDate(task.scheduleDate)}</span>
                              )}
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold">{task.activityType}</span>
                              <span className="font-semibold text-amber-700 text-[10px]">{task.stage}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No tasks assigned yet</p>
                    </div>
                  )}
                </div>
              )}

              {/* Properties Tab */}
              {activeTab === 'properties' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-800 text-lg mb-4">Suggested Properties</h3>
                  {lead.suggestedProperties && lead.suggestedProperties.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {lead.suggestedProperties.map((property) => (
                        <div key={property.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors">
                          <div className="flex items-start gap-3">
                            <Home className="w-5 h-5 text-blue-600 mt-1" />
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 mb-1">
                                {property.project?.name || 'Property'}
                              </p>
                              {property.project?.location && (
                                <p className="text-sm text-gray-600 mb-2">📍 {property.project.location}</p>
                              )}
                              {property.matchScore && (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-blue-600 h-2 rounded-full"
                                      style={{ width: `${property.matchScore}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm font-semibold text-gray-700">
                                    {property.matchScore}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No properties suggested yet</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
          >
            Close
          </button>
          {lead && (
            <button
              onClick={() => {
                // Navigate to edit lead or perform action
                console.log('Edit lead:', lead.id);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Edit Lead
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadDetailsModal;
