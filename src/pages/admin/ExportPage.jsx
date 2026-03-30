import React, { useState, useEffect, useCallback } from 'react';
import { Download, Share2, Users, Calendar, FileSpreadsheet, Rocket, Pause, Play, X } from 'lucide-react';
import Layout from '../../components/Layout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CAMPAIGN_STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'flyer_in_progress', label: 'Flyer In Progress' },
  { value: 'flyer_complete', label: 'Flyer Complete' },
  { value: 'mailer_in_progress', label: 'Mailer In Progress' },
  { value: 'mailer_complete', label: 'Mailer Complete' },
  { value: 'converted', label: 'Converted' },
];

const AD_TEMPLATES = [
  { index: 0, name: 'Neighborhood Trust' },
  { index: 1, name: 'Pool Season' },
  { index: 2, name: 'Already Servicing Nearby' },
];

function MetaStatusBadge({ status }) {
  const styles = {
    ACTIVE: 'bg-green-100 text-green-700',
    PAUSED: 'bg-yellow-100 text-yellow-700',
    PENDING: 'bg-gray-100 text-gray-600',
  };
  const cls = styles[status] || styles.PENDING;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status || 'PENDING'}
    </span>
  );
}

export default function ExportPage() {
  const [selectedStatuses, setSelectedStatuses] = useState(['flyer_complete', 'mailer_complete']);
  const [leadSource, setLeadSource] = useState('');
  const [subdivision, setSubdivision] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [excludeExported, setExcludeExported] = useState(true);
  const [previewCount, setPreviewCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Meta campaign launch modal state
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchBudget, setLaunchBudget] = useState(20);
  const [launchDuration, setLaunchDuration] = useState(14);
  const [launchTemplate, setLaunchTemplate] = useState(0);
  const [launching, setLaunching] = useState(false);

  // Meta campaigns list state
  const [metaCampaigns, setMetaCampaigns] = useState([]);
  const [metaCampaignsLoading, setMetaCampaignsLoading] = useState(true);
  const [togglingCampaign, setTogglingCampaign] = useState(null);

  const getFilterParams = useCallback(() => {
    const params = {};
    if (selectedStatuses.length > 0) params.campaign_statuses = selectedStatuses.join(',');
    if (leadSource) params.lead_source = leadSource;
    if (subdivision) params.subdivision = subdivision;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (excludeExported) params.exclude_exported = true;
    return params;
  }, [selectedStatuses, leadSource, subdivision, dateFrom, dateTo, excludeExported]);

  const fetchPreviewCount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/export/preview-count', { params: getFilterParams() });
      setPreviewCount(res.data.count ?? res.data.total ?? 0);
    } catch {
      setPreviewCount(null);
    } finally {
      setLoading(false);
    }
  }, [getFilterParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPreviewCount();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchPreviewCount]);

  useEffect(() => {
    api
      .get('/export/history')
      .then((res) => {
        const data = res.data;
        setExportHistory(Array.isArray(data) ? data : data.exports || []);
      })
      .catch(() => setExportHistory([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  const fetchMetaCampaigns = useCallback(async () => {
    try {
      const res = await api.get('/meta/campaigns');
      setMetaCampaigns(res.data.campaigns || []);
    } catch {
      setMetaCampaigns([]);
    } finally {
      setMetaCampaignsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetaCampaigns();
  }, [fetchMetaCampaigns]);

  const handleStatusToggle = (status) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleExportFacebook = async () => {
    setExporting(true);
    try {
      const res = await api.get('/export/facebook', {
        params: getFilterParams(),
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `pooldrop-facebook-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Facebook CSV exported');

      const histRes = await api.get('/export/history');
      const hd = histRes.data;
      setExportHistory(Array.isArray(hd) ? hd : hd.exports || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportConverted = async () => {
    setExporting(true);
    try {
      const res = await api.get('/export/converted', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `pooldrop-converted-customers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Converted customers CSV exported');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleLaunchMeta = async () => {
    setLaunching(true);
    try {
      const filters = getFilterParams();
      const payload = {
        campaign_status: filters.campaign_statuses ? filters.campaign_statuses.split(',') : undefined,
        lead_source: filters.lead_source || undefined,
        subdivision: filters.subdivision || undefined,
        date_range: (filters.date_from || filters.date_to)
          ? { start: filters.date_from || undefined, end: filters.date_to || undefined }
          : undefined,
        daily_budget: Math.round(launchBudget * 100),
        duration_days: launchDuration,
        template_index: launchTemplate,
      };
      const res = await api.post('/meta/launch', payload);
      const campaign = res.data.campaign;
      toast.success(
        `Meta campaign "${campaign?.campaign_name || 'New Campaign'}" created! Status: ${campaign?.status || 'PAUSED'}`
      );
      setShowLaunchModal(false);
      fetchMetaCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to launch Meta campaign');
    } finally {
      setLaunching(false);
    }
  };

  const handleToggleCampaign = async (campaign) => {
    const action = campaign.status === 'ACTIVE' ? 'pause' : 'activate';
    setTogglingCampaign(campaign.id);
    try {
      await api.post(`/meta/campaigns/${campaign.id}/${action}`);
      toast.success(`Campaign ${action === 'pause' ? 'paused' : 'activated'}`);
      fetchMetaCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${action} campaign`);
    } finally {
      setTogglingCampaign(null);
    }
  };

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Export to Facebook</h1>
            <p className="text-sm text-slate-500 mt-1">
              Export property data as custom audiences for Facebook Ads
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Campaign Status
              </label>
              <div className="flex flex-wrap gap-2">
                {CAMPAIGN_STATUSES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => handleStatusToggle(value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                      selectedStatuses.includes(value)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-300 text-slate-600 hover:border-blue-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lead Source</label>
                <select
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Sources</option>
                  <option value="wcad_import">WCAD Import</option>
                  <option value="mls_lead">MLS Lead</option>
                  <option value="manual_spotted">Manual Spotted</option>
                  <option value="referral">Referral</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subdivision</label>
                <input
                  type="text"
                  placeholder="Filter by subdivision..."
                  value={subdivision}
                  onChange={(e) => setSubdivision(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="excludeExported"
                checked={excludeExported}
                onChange={(e) => setExcludeExported(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="excludeExported" className="text-sm text-slate-700">
                Exclude already exported properties
              </label>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div className="text-sm text-slate-600">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    Counting...
                  </span>
                ) : previewCount !== null ? (
                  <span className="font-semibold text-slate-900">
                    {previewCount} properties match your filters
                  </span>
                ) : (
                  <span className="text-slate-400">Unable to get count</span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleExportFacebook}
                disabled={exporting || previewCount === 0}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
                {exporting ? 'Exporting...' : 'Export to Facebook CSV'}
              </button>
              <button
                onClick={handleExportConverted}
                disabled={exporting}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Users className="w-4 h-4" />
                {exporting ? 'Exporting...' : 'Export Converted Customers'}
              </button>
              <button
                onClick={() => setShowLaunchModal(true)}
                disabled={previewCount === 0 || previewCount === null}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Rocket className="w-4 h-4" />
                Launch Meta Campaign
              </button>
            </div>
          </div>

          {/* Export History */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Export History</h2>
            </div>
            {historyLoading ? (
              <div className="p-8">
                <LoadingSpinner size="md" />
              </div>
            ) : exportHistory.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-400">No exports yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Records</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Filters</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Exported By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {exportHistory.map((exp, i) => (
                      <tr key={exp.id || i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600 flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {exp.created_at
                            ? new Date(exp.created_at).toLocaleString()
                            : exp.exported_at
                            ? new Date(exp.exported_at).toLocaleString()
                            : '--'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            <FileSpreadsheet className="w-3 h-3" />
                            {exp.export_type || 'Facebook'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {exp.record_count || exp.records || 0}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">
                          {exp.filter_summary || exp.filters || '--'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {exp.exported_by || exp.user_email || '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Meta Campaigns */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Meta Campaigns</h2>
            </div>
            {metaCampaignsLoading ? (
              <div className="p-8">
                <LoadingSpinner size="md" />
              </div>
            ) : metaCampaigns.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-400">No Meta campaigns yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Properties</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Budget/day</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Reach</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Impressions</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Clicks</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Leads</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Launched</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metaCampaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900 max-w-[180px] truncate">
                          {c.campaign_name}
                        </td>
                        <td className="px-4 py-3">
                          <MetaStatusBadge status={c.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-700">{c.property_count || 0}</td>
                        <td className="px-4 py-3 text-slate-700">
                          ${((c.daily_budget || 0) / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{c.reach ?? '--'}</td>
                        <td className="px-4 py-3 text-slate-700">{c.impressions ?? '--'}</td>
                        <td className="px-4 py-3 text-slate-700">{c.clicks ?? '--'}</td>
                        <td className="px-4 py-3 text-slate-700">{c.leads ?? '--'}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : '--'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleCampaign(c)}
                            disabled={togglingCampaign === c.id}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                              c.status === 'ACTIVE'
                                ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                : 'bg-green-50 text-green-700 hover:bg-green-100'
                            } disabled:opacity-50`}
                          >
                            {c.status === 'ACTIVE' ? (
                              <>
                                <Pause className="w-3 h-3" /> Pause
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3" /> Activate
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Launch Meta Campaign Modal */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Launch Meta Campaign</h3>
              <button
                onClick={() => setShowLaunchModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-violet-50 rounded-lg p-3">
                <p className="text-sm font-medium text-violet-800">
                  Audience size: <span className="font-bold">{previewCount}</span> properties
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Daily Budget ($)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={launchBudget}
                  onChange={(e) => setLaunchBudget(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Duration (days)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={launchDuration}
                  onChange={(e) => setLaunchDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Ad Template
                </label>
                <select
                  value={launchTemplate}
                  onChange={(e) => setLaunchTemplate(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {AD_TEMPLATES.map((t) => (
                    <option key={t.index} value={t.index}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleLaunchMeta}
                disabled={launching}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Rocket className="w-4 h-4" />
                {launching ? 'Launching...' : 'Launch Campaign'}
              </button>
              <button
                onClick={() => setShowLaunchModal(false)}
                disabled={launching}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
