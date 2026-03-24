import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Filter,
  List,
  Route,
  Droplets
} from 'lucide-react';
import StatsCard from './StatsCard';
import DropBadge from './DropBadge';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Sidebar({
  collapsed,
  onToggle,
  filters,
  onFiltersChange,
  todayDrops,
  onGenerateRoute,
  stats
}) {
  const [leadSources] = useState([
    { value: '', label: 'All Sources' },
    { value: 'wcad_import', label: 'WCAD Import' },
    { value: 'mls_lead', label: 'MLS Lead' },
    { value: 'manual_spotted', label: 'Manual Spotted' },
    { value: 'referral', label: 'Referral' }
  ]);

  const [campaignStatuses] = useState([
    { value: '', label: 'All Statuses' },
    { value: 'not_started', label: 'Not Started' },
    { value: 'flyer_in_progress', label: 'Flyer In Progress' },
    { value: 'flyer_complete', label: 'Flyer Complete' },
    { value: 'mailer_in_progress', label: 'Mailer In Progress' },
    { value: 'mailer_complete', label: 'Mailer Complete' },
    { value: 'converted', label: 'Converted' },
    { value: 'do_not_drop', label: 'Do Not Drop' }
  ]);

  if (collapsed) {
    return (
      <div className="w-12 bg-white border-r border-slate-200 flex flex-col items-center py-4">
        <button
          onClick={onToggle}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <h2 className="font-semibold text-slate-900">Dashboard</h2>
        <button
          onClick={onToggle}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatsCard
            icon={Home}
            label="Total Properties"
            value={stats.totalProperties || 0}
          />
          <StatsCard
            icon={Droplets}
            label="Today's Drops"
            value={stats.todayDrops || 0}
          />
          <StatsCard
            icon={Route}
            label="Active Campaigns"
            value={stats.activeCampaigns || 0}
          />
          <StatsCard
            icon={List}
            label="Conversion Rate"
            value={stats.conversionRate ? `${stats.conversionRate}%` : '0%'}
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            Today's Drop List ({todayDrops.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {todayDrops.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No drops queued for today</p>
            ) : (
              todayDrops.map((drop) => (
                <div
                  key={drop.id}
                  className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{drop.address_street}</p>
                    <p className="text-slate-500">{drop.address_city}</p>
                  </div>
                  <DropBadge
                    current={drop.flyer_drops_completed || 0}
                    total={drop.flyer_drops_total || 4}
                    status={drop.campaign_status}
                  />
                </div>
              ))
            )}
          </div>
          <button
            onClick={onGenerateRoute}
            className="mt-3 w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Generate Today's Route
          </button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Filters
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Lead Source</label>
              <select
                value={filters.leadSource || ''}
                onChange={(e) => onFiltersChange({ ...filters, leadSource: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {leadSources.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Campaign Status</label>
              <select
                value={filters.campaignStatus || ''}
                onChange={(e) => onFiltersChange({ ...filters, campaignStatus: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {campaignStatuses.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Subdivision</label>
              <input
                type="text"
                placeholder="Filter by subdivision..."
                value={filters.subdivision || ''}
                onChange={(e) => onFiltersChange({ ...filters, subdivision: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
