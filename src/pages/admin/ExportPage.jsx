import React, { useState, useEffect, useCallback } from 'react';
import { Download, Share2, Users, Calendar, FileSpreadsheet } from 'lucide-react';
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
            </div>
          </div>

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
        </div>
      </div>
    </Layout>
  );
}
