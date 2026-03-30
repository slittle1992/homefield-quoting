import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit3,
  ArrowRightCircle,
  Ban,
  X,
  Check,
  Trash2,
} from 'lucide-react';
import Layout from '../../components/Layout';
import LoadingSpinner from '../../components/LoadingSpinner';
import DropBadge from '../../components/DropBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PAGE_SIZE = 25;

const STATUS_LABELS = {
  not_started: 'Not Started',
  flyer_in_progress: 'Flyer In Progress',
  flyer_complete: 'Flyer Complete',
  mailer_in_progress: 'Mailer In Progress',
  mailer_complete: 'Mailer Complete',
  converted: 'Converted',
  do_not_drop: 'Do Not Drop',
};

export default function PropertyList() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterZip, setFilterZip] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [confirmDoNotDrop, setConfirmDoNotDrop] = useState(null);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: PAGE_SIZE,
        sort: sortField,
        order: sortDir,
      };
      if (search) params.search = search;
      if (filterSource) params.lead_source = filterSource;
      if (filterStatus) params.campaign_status = filterStatus;
      if (filterZip) params.zip = filterZip;

      const res = await api.get('/properties', { params });
      const data = res.data;
      setProperties(Array.isArray(data) ? data : data.properties || []);
      setTotalCount(data.total || (Array.isArray(data) ? data.length : 0));
    } catch {
      toast.error('Failed to load properties');
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortDir, search, filterSource, filterStatus, filterZip]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    setPage(1);
  }, [search, filterSource, filterStatus, filterZip]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-blue-600" />
    ) : (
      <ChevronDown className="w-3 h-3 text-blue-600" />
    );
  };

  const handleDoNotDrop = async (prop) => {
    try {
      const newStatus = prop.campaign_status === 'do_not_drop' ? 'not_started' : 'do_not_drop';
      await api.patch(`/properties/${prop.id}`, { campaign_status: newStatus });
      toast.success(newStatus === 'do_not_drop' ? 'Marked Do Not Drop' : 'Removed Do Not Drop');
      fetchProperties();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    }
  };

  const handleConvert = async (prop) => {
    try {
      await api.patch(`/properties/${prop.id}`, { campaign_status: 'converted' });
      toast.success('Marked as converted');
      fetchProperties();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to convert');
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Properties</h1>
            <p className="text-sm text-slate-500 mt-1">{totalCount} properties total</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4">
            <div className="p-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search address, owner, subdivision..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Sources</option>
                <option value="wcad_import">WCAD Import</option>
                <option value="mls_lead">MLS Lead</option>
                <option value="manual_spotted">Manual Spotted</option>
                <option value="referral">Referral</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="ZIP code"
                value={filterZip}
                onChange={(e) => setFilterZip(e.target.value)}
                className="w-28 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-12">
                <LoadingSpinner size="lg" className="py-8" />
              </div>
            ) : properties.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm text-slate-400">No properties found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {[
                          { field: 'address_street', label: 'Address' },
                          { field: 'owner_name', label: 'Owner' },
                          { field: 'subdivision', label: 'Subdivision' },
                          { field: 'pool_type', label: 'Pool Type' },
                          { field: 'campaign_status', label: 'Status' },
                          { field: 'flyer_drops_completed', label: 'Drops' },
                          { field: 'lead_source', label: 'Source' },
                          { field: 'created_at', label: 'Created' },
                        ].map(({ field, label }) => (
                          <th
                            key={field}
                            onClick={() => toggleSort(field)}
                            className="text-left px-4 py-3 font-medium text-slate-600 cursor-pointer hover:text-slate-900 select-none"
                          >
                            <span className="inline-flex items-center gap-1">
                              {label}
                              <SortIcon field={field} />
                            </span>
                          </th>
                        ))}
                        <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {properties.map((prop) => (
                        <tr
                          key={prop.id}
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => setSelectedProperty(prop)}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{prop.address_street}</p>
                            <p className="text-xs text-slate-500">
                              {prop.address_city}, TX {prop.address_zip}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{prop.owner_name || '--'}</td>
                          <td className="px-4 py-3 text-slate-600">{prop.subdivision || '--'}</td>
                          <td className="px-4 py-3 text-slate-600 capitalize">
                            {(prop.pool_type || '--').replace(/_/g, ' ')}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                prop.campaign_status === 'converted'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : prop.campaign_status === 'do_not_drop'
                                  ? 'bg-red-100 text-red-700'
                                  : prop.campaign_status === 'not_started'
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {STATUS_LABELS[prop.campaign_status] || prop.campaign_status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <DropBadge
                              current={prop.flyer_drops_completed || 0}
                              total={prop.flyer_drops_total || 4}
                              status={prop.campaign_status}
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-600 capitalize text-xs">
                            {(prop.lead_source || '--').replace(/_/g, ' ')}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {prop.created_at
                              ? new Date(prop.created_at).toLocaleDateString()
                              : '--'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setSelectedProperty(prop)}
                                className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleConvert(prop)}
                                className="p-1.5 hover:bg-green-50 text-green-600 rounded-lg transition-colors"
                                title="Convert"
                              >
                                <ArrowRightCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setConfirmDoNotDrop(prop)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  prop.campaign_status === 'do_not_drop'
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                    : 'hover:bg-red-50 text-slate-400 hover:text-red-600'
                                }`}
                                title={prop.campaign_status === 'do_not_drop' ? 'Remove DND' : 'Do Not Drop'}
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                  <p className="text-xs text-slate-500">
                    Showing {(page - 1) * PAGE_SIZE + 1}--
                    {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="p-1.5 hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-600">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {selectedProperty && (
        <PropertyDetailSlideOver
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onRefresh={fetchProperties}
        />
      )}

      <ConfirmDialog
        open={!!confirmDoNotDrop}
        onClose={() => setConfirmDoNotDrop(null)}
        onConfirm={() => confirmDoNotDrop && handleDoNotDrop(confirmDoNotDrop)}
        title={
          confirmDoNotDrop?.campaign_status === 'do_not_drop'
            ? 'Remove Do Not Drop'
            : 'Mark as Do Not Drop'
        }
        message={
          confirmDoNotDrop?.campaign_status === 'do_not_drop'
            ? `Remove Do Not Drop status from ${confirmDoNotDrop?.address_street}?`
            : `Mark ${confirmDoNotDrop?.address_street} as Do Not Drop? This will stop all future deliveries.`
        }
        confirmText={confirmDoNotDrop?.campaign_status === 'do_not_drop' ? 'Remove' : 'Mark DND'}
        variant={confirmDoNotDrop?.campaign_status === 'do_not_drop' ? 'primary' : 'danger'}
      />
    </Layout>
  );
}

function PropertyDetailSlideOver({ property, onClose, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ ...property });
  const [deliveries, setDeliveries] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get(`/properties/${property.id}/deliveries`)
      .then((res) => setDeliveries(Array.isArray(res.data) ? res.data : res.data.deliveries || []))
      .catch(() => setDeliveries([]));
  }, [property.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/properties/${property.id}`, {
        owner_name: formData.owner_name,
        campaign_status: formData.campaign_status,
        lead_source: formData.lead_source,
      });
      toast.success('Property updated');
      setEditing(false);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${property.address_street || property.address}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/properties/${property.id}`);
      toast.success('Property deleted');
      onClose();
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-slate-900">Property Details</h2>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setFormData({ ...property });
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-3">Address</h3>
            <p className="font-medium text-slate-900">{property.address_street}</p>
            <p className="text-sm text-slate-600">
              {property.address_city}, {property.address_state || 'TX'} {property.address_zip}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DetailField label="Owner" editing={editing}>
              {editing ? (
                <input
                  value={formData.owner_name || ''}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              ) : (
                <span>{property.owner_name || '--'}</span>
              )}
            </DetailField>
            <DetailField label="Subdivision">
              <span>{property.subdivision || '--'}</span>
            </DetailField>
            <DetailField label="Pool Type">
              <span className="capitalize">{(property.pool_type || '--').replace(/_/g, ' ')}</span>
            </DetailField>
            <DetailField label="Property Value">
              <span>
                {property.property_value
                  ? `$${Number(property.property_value).toLocaleString()}`
                  : '--'}
              </span>
            </DetailField>
            <DetailField label="Lead Source" editing={editing}>
              {editing ? (
                <select
                  value={formData.lead_source || ''}
                  onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="wcad_import">WCAD Import</option>
                  <option value="mls_lead">MLS Lead</option>
                  <option value="manual_spotted">Manual Spotted</option>
                  <option value="referral">Referral</option>
                </select>
              ) : (
                <span className="capitalize">
                  {(property.lead_source || '--').replace(/_/g, ' ')}
                </span>
              )}
            </DetailField>
            <DetailField label="Campaign Status" editing={editing}>
              {editing ? (
                <select
                  value={formData.campaign_status || ''}
                  onChange={(e) => setFormData({ ...formData, campaign_status: e.target.value })}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              ) : (
                <DropBadge
                  current={property.flyer_drops_completed || 0}
                  total={property.flyer_drops_total || 4}
                  status={property.campaign_status}
                />
              )}
            </DetailField>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-3">Delivery History</h3>
            {deliveries.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No deliveries recorded</p>
            ) : (
              <div className="space-y-2">
                {deliveries.map((d, i) => (
                  <div
                    key={d.id || i}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        Drop {d.drop_number || i + 1}
                      </p>
                      <p className="text-xs text-slate-500">
                        {d.delivered_at
                          ? new Date(d.delivered_at).toLocaleString()
                          : 'Pending'}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        d.status === 'delivered'
                          ? 'bg-green-100 text-green-700'
                          : d.status === 'skipped'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {d.status || 'pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
      <div className="text-sm text-slate-900">{children}</div>
    </div>
  );
}
