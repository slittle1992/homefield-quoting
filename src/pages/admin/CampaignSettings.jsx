import React, { useState, useEffect } from 'react';
import { Save, ArrowRight } from 'lucide-react';
import Layout from '../../components/Layout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../services/api';
import toast from 'react-hot-toast';

const DEFAULT_FLYER_SCHEDULE = [
  { drop: 1, days_after_import: 0, label: 'Immediately after import' },
  { drop: 2, days_after_import: 14, label: '14 days after drop 1' },
  { drop: 3, days_after_import: 28, label: '14 days after drop 2' },
  { drop: 4, days_after_import: 42, label: '14 days after drop 3' },
];

const DEFAULT_MAILER_SCHEDULE = [
  { mailer: 1, days_after_flyer_complete: 7, label: '7 days after flyer campaign' },
  { mailer: 2, days_after_flyer_complete: 21, label: '14 days after mailer 1' },
  { mailer: 3, days_after_flyer_complete: 35, label: '14 days after mailer 2' },
];

const PIPELINE_STAGES = [
  { key: 'not_started', label: 'Not Started', color: 'bg-slate-400' },
  { key: 'flyer_in_progress', label: 'Flyer In Progress', color: 'bg-orange-400' },
  { key: 'flyer_complete', label: 'Flyer Complete', color: 'bg-green-400' },
  { key: 'mailer_in_progress', label: 'Mailer In Progress', color: 'bg-blue-400' },
  { key: 'mailer_complete', label: 'Mailer Complete', color: 'bg-blue-500' },
  { key: 'converted', label: 'Converted', color: 'bg-emerald-500' },
];

export default function CampaignSettings() {
  const [flyerSchedule, setFlyerSchedule] = useState(DEFAULT_FLYER_SCHEDULE);
  const [mailerSchedule, setMailerSchedule] = useState(DEFAULT_MAILER_SCHEDULE);
  const [pipelineData, setPipelineData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, pipelineRes] = await Promise.allSettled([
          api.get('/settings/campaign'),
          api.get('/properties/pipeline'),
        ]);

        if (settingsRes.status === 'fulfilled' && settingsRes.value.data) {
          const s = settingsRes.value.data;
          if (s.flyer_schedule) setFlyerSchedule(s.flyer_schedule);
          if (s.mailer_schedule) setMailerSchedule(s.mailer_schedule);
        }

        if (pipelineRes.status === 'fulfilled') {
          const pd = pipelineRes.value.data;
          setPipelineData(Array.isArray(pd) ? pd : pd.pipeline || []);
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings/campaign', {
        flyer_schedule: flyerSchedule,
        mailer_schedule: mailerSchedule,
      });
      toast.success('Campaign settings saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateFlyerDays = (index, value) => {
    const updated = [...flyerSchedule];
    updated[index] = { ...updated[index], days_after_import: parseInt(value, 10) || 0 };
    setFlyerSchedule(updated);
  };

  const updateMailerDays = (index, value) => {
    const updated = [...mailerSchedule];
    updated[index] = { ...updated[index], days_after_flyer_complete: parseInt(value, 10) || 0 };
    setMailerSchedule(updated);
  };

  const getPipelineCount = (key) => {
    const stage = pipelineData.find((s) => s.status === key || s.campaign_status === key);
    return stage?.count || 0;
  };

  const maxPipelineCount = Math.max(
    1,
    ...PIPELINE_STAGES.map((s) => getPipelineCount(s.key))
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Campaign Settings</h1>
              <p className="text-sm text-slate-500 mt-1">
                Configure flyer and mailer delivery schedules
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Flyer Drop Schedule</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set the interval (in days) between each flyer drop
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Drop</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Days After Import</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {flyerSchedule.map((item, i) => (
                    <tr key={i}>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-100 text-blue-700 font-semibold rounded-full text-xs">
                          {item.drop}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <input
                          type="number"
                          min="0"
                          value={item.days_after_import}
                          onChange={(e) => updateFlyerDays(i, e.target.value)}
                          className="w-20 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-3 text-slate-500">{item.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Mailer Schedule</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set the interval (in days) for mailers after flyer campaign completion
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Mailer</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Days After Flyer Complete</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mailerSchedule.map((item, i) => (
                    <tr key={i}>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center justify-center w-7 h-7 bg-purple-100 text-purple-700 font-semibold rounded-full text-xs">
                          {item.mailer}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <input
                          type="number"
                          min="0"
                          value={item.days_after_flyer_complete}
                          onChange={(e) => updateMailerDays(i, e.target.value)}
                          className="w-20 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-3 text-slate-500">{item.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Pipeline Overview</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Current distribution of properties across campaign stages
              </p>
            </div>
            <div className="p-6 space-y-3">
              {PIPELINE_STAGES.map((stage) => {
                const count = getPipelineCount(stage.key);
                const pct = maxPipelineCount > 0 ? (count / maxPipelineCount) * 100 : 0;
                return (
                  <div key={stage.key} className="flex items-center gap-3">
                    <div className="w-36 text-xs font-medium text-slate-600 text-right">
                      {stage.label}
                    </div>
                    <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden relative">
                      <div
                        className={`h-full ${stage.color} rounded-lg transition-all duration-500`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center pl-3 text-xs font-semibold text-slate-700">
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-center gap-1 pt-4 text-xs text-slate-400">
                {PIPELINE_STAGES.map((stage, i) => (
                  <React.Fragment key={stage.key}>
                    <span className={`px-2 py-0.5 rounded ${stage.color} text-white font-medium`}>
                      {stage.label.split(' ').slice(0, 2).join(' ')}
                    </span>
                    {i < PIPELINE_STAGES.length - 1 && <ArrowRight className="w-3 h-3 text-slate-300" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
