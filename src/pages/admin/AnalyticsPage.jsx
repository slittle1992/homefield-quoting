import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { TrendingUp, Building2, Target, Zap, BarChart3 } from 'lucide-react';
import Layout from '../../components/Layout';
import StatsCard from '../../components/StatsCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PIE_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899'];

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [dailyDeliveries, setDailyDeliveries] = useState([]);
  const [pipelineData, setPipelineData] = useState([]);
  const [conversionByChannel, setConversionByChannel] = useState([]);
  const [leadSourceBreakdown, setLeadSourceBreakdown] = useState([]);
  const [subdivisionData, setSubdivisionData] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, dailyRes, pipeRes, convRes, leadRes, subRes] = await Promise.allSettled([
          api.get('/analytics/stats'),
          api.get('/analytics/daily-deliveries'),
          api.get('/properties/pipeline'),
          api.get('/analytics/conversion-by-channel'),
          api.get('/analytics/lead-source-breakdown'),
          api.get('/analytics/by-subdivision'),
        ]);

        if (statsRes.status === 'fulfilled') {
          setStats(statsRes.value.data || {});
        }
        if (dailyRes.status === 'fulfilled') {
          const dd = dailyRes.value.data;
          setDailyDeliveries(Array.isArray(dd) ? dd : dd.data || []);
        }
        if (pipeRes.status === 'fulfilled') {
          const pd = pipeRes.value.data;
          setPipelineData(Array.isArray(pd) ? pd : pd.pipeline || []);
        }
        if (convRes.status === 'fulfilled') {
          const cd = convRes.value.data;
          setConversionByChannel(Array.isArray(cd) ? cd : cd.data || []);
        }
        if (leadRes.status === 'fulfilled') {
          const ld = leadRes.value.data;
          setLeadSourceBreakdown(Array.isArray(ld) ? ld : ld.data || []);
        }
        if (subRes.status === 'fulfilled') {
          const sd = subRes.value.data;
          setSubdivisionData(Array.isArray(sd) ? sd : sd.data || []);
        }
      } catch {
        toast.error('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  const pipelineChartData = pipelineData.map((item) => ({
    name: (item.status || item.campaign_status || '').replace(/_/g, ' '),
    count: item.count || 0,
  }));

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
            <p className="text-sm text-slate-500 mt-1">Performance overview and campaign insights</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatsCard
              icon={Building2}
              label="Total Properties"
              value={stats.totalProperties || stats.total_properties || 0}
            />
            <StatsCard
              icon={Target}
              label="Active Campaigns"
              value={stats.activeCampaigns || stats.active_campaigns || 0}
            />
            <StatsCard
              icon={TrendingUp}
              label="Completed"
              value={stats.completedCampaigns || stats.completed_campaigns || 0}
            />
            <StatsCard
              icon={Zap}
              label="Conversion Rate"
              value={`${stats.conversionRate || stats.conversion_rate || 0}%`}
            />
            <StatsCard
              icon={BarChart3}
              label="Avg Drops to Convert"
              value={stats.avgDropsToConvert || stats.avg_drops_to_convert || '--'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Daily Deliveries (Last 30 Days)">
              {dailyDeliveries.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dailyDeliveries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString()}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </ChartCard>

            <ChartCard title="Campaign Pipeline">
              {pipelineChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={pipelineChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={120}
                      tickFormatter={(val) =>
                        val
                          .split(' ')
                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(' ')
                      }
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {pipelineChartData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </ChartCard>

            <ChartCard title="Conversion by Channel">
              {conversionByChannel.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={conversionByChannel}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={{ strokeWidth: 1 }}
                    >
                      {conversionByChannel.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </ChartCard>

            <ChartCard title="Lead Source Breakdown">
              {leadSourceBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={leadSourceBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={{ strokeWidth: 1 }}
                    >
                      {leadSourceBreakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </ChartCard>

            <ChartCard title="Properties by Subdivision" className="lg:col-span-2">
              {subdivisionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={subdivisionData.slice(0, 15)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, angle: -35 }}
                      height={80}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </ChartCard>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function ChartCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
      <div className="px-6 py-4 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[280px] flex items-center justify-center">
      <p className="text-sm text-slate-400">No data available</p>
    </div>
  );
}
