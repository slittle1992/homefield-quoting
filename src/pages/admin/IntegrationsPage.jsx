import React, { useState, useEffect } from 'react';
import {
  Plug,
  Zap,
  Facebook,
  Mail,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import Layout from '../../components/Layout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Section 1: GoHighLevel
// ---------------------------------------------------------------------------
function GHLCard() {
  const [status, setStatus] = useState(null); // null = loading
  const [apiKey, setApiKey] = useState('');
  const [locationId, setLocationId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/ghl/status');
      setStatus(res.data);
    } catch {
      setStatus({ connected: false });
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnect = async () => {
    if (!apiKey || !locationId) {
      toast.error('API Key and Location ID are required');
      return;
    }
    setConnecting(true);
    try {
      await api.post('/ghl/connect', { api_key: apiKey, location_id: locationId });
      toast.success('GoHighLevel connected');
      setApiKey('');
      setLocationId('');
      await fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await api.post('/ghl/test');
      toast.success('Connection test successful');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.delete('/ghl/disconnect');
      toast.success('GoHighLevel disconnected');
      await fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  if (status === null) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  const connected = status.connected;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
            <Zap className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">GoHighLevel (GHL)</h2>
            <p className="text-xs text-slate-500">CRM & marketing automation</p>
          </div>
        </div>
        {connected ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">
            <XCircle className="w-3.5 h-3.5" />
            Not Connected
          </span>
        )}
      </div>

      <div className="p-6">
        {connected ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 disabled:bg-red-50 text-red-600 text-sm font-medium rounded-lg transition-colors"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your GHL API key"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location ID</label>
              <input
                type="text"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                placeholder="e.g. abc123XYZ"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plug className="w-4 h-4" />
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Meta / Facebook Ads
// ---------------------------------------------------------------------------
function MetaCard() {
  const [status, setStatus] = useState(null);
  const [accessToken, setAccessToken] = useState('');
  const [adAccountId, setAdAccountId] = useState('');
  const [pageId, setPageId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/meta/status')
      .then((res) => setStatus(res.data))
      .catch(() => setStatus({ connected: false }));
  }, []);

  const handleSave = async () => {
    if (!accessToken || !adAccountId) {
      toast.error('Access Token and Ad Account ID are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/meta/connect', {
        access_token: accessToken,
        ad_account_id: adAccountId,
        page_id: pageId,
      });
      toast.success('Meta credentials saved');
      setStatus({ connected: true });
      setAccessToken('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (status === null) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  const connected = status.connected;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Facebook className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Meta / Facebook Ads</h2>
            <p className="text-xs text-slate-500">Custom audiences & ad campaigns</p>
          </div>
        </div>
        {connected ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">
            <XCircle className="w-3.5 h-3.5" />
            Not Configured
          </span>
        )}
      </div>

      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Access Token</label>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={connected ? '********' : 'Enter your access token'}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ad Account ID</label>
            <input
              type="text"
              value={adAccountId}
              onChange={(e) => setAdAccountId(e.target.value)}
              placeholder="act_123456"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Page ID</label>
            <input
              type="text"
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <p className="text-xs text-slate-400 flex items-center gap-1">
          <ExternalLink className="w-3 h-3" />
          Get your access token at{' '}
          <a
            href="https://developers.facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            developers.facebook.com
          </a>
        </p>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Direct Mail (Lob)
// ---------------------------------------------------------------------------
function LobCard() {
  const [lobKey, setLobKey] = useState('');
  const [company, setCompany] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    website: '',
  });
  const [saving, setSaving] = useState(false);

  const updateField = (field, value) => {
    setCompany((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!lobKey) {
      toast.error('Lob API Key is required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/integrations/lob', {
        lob_api_key: lobKey,
        company_info: company,
      });
      toast.success('Lob settings saved & tested');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
          <Mail className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Direct Mail (Lob)</h2>
          <p className="text-xs text-slate-500">Postcards & direct mail campaigns</p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Lob API Key</label>
          <input
            type="password"
            value={lobKey}
            onChange={(e) => setLobKey(e.target.value)}
            placeholder="Enter your Lob API key"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-medium text-slate-700 mb-3">
            Sender Information (shown on postcards)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Company Name</label>
              <input
                type="text"
                value={company.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="PoolDrop LLC"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input
                type="text"
                value={company.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
              <input
                type="text"
                value={company.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="123 Main St"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
              <input
                type="text"
                value={company.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="Austin"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
                <input
                  type="text"
                  value={company.state}
                  onChange={(e) => updateField('state', e.target.value)}
                  placeholder="TX"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ZIP</label>
                <input
                  type="text"
                  value={company.zip}
                  onChange={(e) => updateField('zip', e.target.value)}
                  placeholder="78701"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Website</label>
              <input
                type="text"
                value={company.website}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder="https://pooldrop.com"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save & Test'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Permit Scraping
// ---------------------------------------------------------------------------
const DEFAULT_COUNTIES = [
  { id: 'williamson', label: 'Williamson County' },
  { id: 'travis', label: 'Travis County' },
  { id: 'hays', label: 'Hays County' },
  { id: 'bell', label: 'Bell County' },
  { id: 'bastrop', label: 'Bastrop County' },
];

function PermitScrapingCard() {
  const [enabled, setEnabled] = useState(false);
  const [selectedCounties, setSelectedCounties] = useState([]);
  const [scraping, setScraping] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/integrations/permits')
      .then((res) => {
        const d = res.data;
        setEnabled(d.enabled ?? false);
        setSelectedCounties(d.counties || []);
        setLastResult(d.last_result || null);
      })
      .catch(() => {
        // defaults are fine
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      await api.put('/integrations/permits', {
        enabled: next,
        counties: selectedCounties,
      });
      toast.success(next ? 'Permit scraping enabled' : 'Permit scraping disabled');
    } catch (err) {
      setEnabled(!next);
      toast.error(err.response?.data?.error || 'Failed to update');
    }
  };

  const handleCountyToggle = async (countyId) => {
    const next = selectedCounties.includes(countyId)
      ? selectedCounties.filter((c) => c !== countyId)
      : [...selectedCounties, countyId];
    setSelectedCounties(next);
    try {
      await api.put('/integrations/permits', { enabled, counties: next });
    } catch {
      // revert silently
      setSelectedCounties(selectedCounties);
    }
  };

  const handleScrapeNow = async () => {
    setScraping(true);
    try {
      const res = await api.post('/integrations/permits/scrape', {
        counties: selectedCounties,
      });
      setLastResult(res.data);
      toast.success(`Scrape complete — ${res.data.new_permits ?? 0} new permits found`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Scrape failed');
    } finally {
      setScraping(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Search className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Permit Scraping</h2>
            <p className="text-xs text-slate-500">Automatically find new pool permits</p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          className="flex items-center gap-2 text-sm font-medium"
          aria-label={enabled ? 'Disable permit scraping' : 'Enable permit scraping'}
        >
          {enabled ? (
            <ToggleRight className="w-8 h-8 text-blue-600" />
          ) : (
            <ToggleLeft className="w-8 h-8 text-slate-400" />
          )}
        </button>
      </div>

      <div className="p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Available Counties</label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_COUNTIES.map((county) => (
              <label
                key={county.id}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full border cursor-pointer transition-colors ${
                  selectedCounties.includes(county.id)
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-300 text-slate-600 hover:border-blue-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedCounties.includes(county.id)}
                  onChange={() => handleCountyToggle(county.id)}
                  className="sr-only"
                />
                {county.label}
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleScrapeNow}
          disabled={scraping || selectedCounties.length === 0}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${scraping ? 'animate-spin' : ''}`} />
          {scraping ? 'Scraping...' : 'Scrape Now'}
        </button>

        {lastResult && (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Last Scrape Results
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Date</p>
                <p className="font-medium text-slate-900">
                  {lastResult.scraped_at
                    ? new Date(lastResult.scraped_at).toLocaleDateString()
                    : '--'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">New Permits</p>
                <p className="font-medium text-slate-900">{lastResult.new_permits ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Scanned</p>
                <p className="font-medium text-slate-900">{lastResult.total_scanned ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Counties</p>
                <p className="font-medium text-slate-900">
                  {lastResult.counties_scraped ?? selectedCounties.length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function IntegrationsPage() {
  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
            <p className="text-sm text-slate-500 mt-1">
              Connect external services to power your marketing campaigns
            </p>
          </div>

          <GHLCard />
          <MetaCard />
          <LobCard />
          <PermitScrapingCard />
        </div>
      </div>
    </Layout>
  );
}
