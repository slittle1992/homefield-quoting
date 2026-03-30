import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Satellite, MousePointer2, MapPin, X } from 'lucide-react';
import Layout from '../../components/Layout';
import Sidebar from '../../components/Sidebar';
import PropertyPopup from '../../components/PropertyPopup';
import api from '../../services/api';
import toast from 'react-hot-toast';

const DEFAULT_CENTER = [-97.82, 30.51];
const DEFAULT_ZOOM = 12;

const STATUS_COLORS = {
  mls_not_started: '#ef4444',
  queued_today: '#eab308',
  flyer_complete: '#22c55e',
  mailer_complete: '#22c55e',
  converted: '#22c55e',
  cold_not_started: '#3b82f6',
  manual_not_started: '#3b82f6',
  flyer_in_progress: '#f97316',
  mailer_in_progress: '#f97316',
  do_not_drop: '#6b7280',
  not_started: '#3b82f6',
};

function getMarkerColor(property) {
  if (property.campaign_status === 'do_not_drop') return STATUS_COLORS.do_not_drop;
  if (property.queued_today) return STATUS_COLORS.queued_today;
  if (property.campaign_status === 'flyer_in_progress') return STATUS_COLORS.flyer_in_progress;
  if (property.campaign_status === 'mailer_in_progress') return STATUS_COLORS.mailer_in_progress;
  if (['flyer_complete', 'mailer_complete', 'converted'].includes(property.campaign_status)) return STATUS_COLORS.flyer_complete;
  if (property.lead_source === 'mls_lead') return STATUS_COLORS.mls_not_started;
  return STATUS_COLORS.not_started;
}

export default function AdminDashboard() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const popupRef = useRef(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filters, setFilters] = useState({ leadSource: '', campaignStatus: '', subdivision: '' });
  const [todayDrops, setTodayDrops] = useState([]);
  const [stats, setStats] = useState({});
  const [properties, setProperties] = useState([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isSatellite, setIsSatellite] = useState(false);
  const [spottingMode, setSpottingMode] = useState(false);
  const [spottedCount, setSpottedCount] = useState(0);
  const [spotPopup, setSpotPopup] = useState(null);
  const [mapboxToken, setMapboxToken] = useState(import.meta.env.VITE_MAPBOX_TOKEN || '');

  useEffect(() => {
    if (!mapboxToken) {
      api.get('/config').then(res => {
        if (res.data.mapboxToken) setMapboxToken(res.data.mapboxToken);
      }).catch(() => {});
    }
  }, [mapboxToken]);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/properties/stats');
      setStats(res.data);
    } catch {
      setStats({ totalProperties: 0, todayDrops: 0, activeCampaigns: 0, conversionRate: 0 });
    }
  }, []);

  const loadTodayDrops = useCallback(async () => {
    try {
      const res = await api.get('/deliveries/today');
      setTodayDrops(Array.isArray(res.data) ? res.data : res.data.drops || []);
    } catch {
      setTodayDrops([]);
    }
  }, []);

  const loadProperties = useCallback(async () => {
    try {
      const params = {};
      if (filters.leadSource) params.lead_source = filters.leadSource;
      if (filters.campaignStatus) params.campaign_status = filters.campaignStatus;
      if (filters.subdivision) params.subdivision = filters.subdivision;
      const res = await api.get('/properties/map', { params });
      setProperties(Array.isArray(res.data) ? res.data : res.data.properties || []);
    } catch {
      setProperties([]);
    }
  }, [filters]);

  useEffect(() => {
    loadStats();
    loadTodayDrops();
  }, [loadStats, loadTodayDrops]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    if (!mapboxToken || !mapContainerRef.current || mapRef.current) return;

    let cancelled = false;

    import('mapbox-gl').then((mapboxgl) => {
      if (cancelled || mapRef.current) return;

      mapboxgl.default.accessToken = mapboxToken;

      const map = new mapboxgl.default.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
      });

      map.addControl(new mapboxgl.default.NavigationControl(), 'top-left');
      map.addControl(
        new mapboxgl.default.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
        }),
        'top-left'
      );

      map.on('load', () => {
        if (!cancelled) setMapLoaded(true);
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
    };
  }, [mapboxToken]);

  const renderMarkers = useCallback(async () => {
    if (!mapRef.current || !mapLoaded) return;

    const mapboxgl = await import('mapbox-gl');

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    properties.forEach((prop) => {
      if (!prop.longitude || !prop.latitude) return;

      const color = getMarkerColor(prop);

      const el = document.createElement('div');
      el.className = 'pooldrop-marker';
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';

      if (prop.is_known) {
        el.style.boxShadow = `0 0 0 3px ${color}44, 0 1px 4px rgba(0,0,0,0.3)`;
      }

      const marker = new mapboxgl.default.Marker({ element: el })
        .setLngLat([prop.longitude, prop.latitude])
        .addTo(mapRef.current);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (popupRef.current) popupRef.current.remove();

        const popupContainer = document.createElement('div');
        const root = createRoot(popupContainer);
        root.render(
          <PropertyPopup
            property={prop}
            onViewDetails={() => {
              toast.success(`Viewing ${prop.address_street}`);
            }}
            onAddToToday={async () => {
              try {
                await api.post(`/deliveries/queue/${prop.id}`);
                toast.success('Added to today\'s list');
                loadTodayDrops();
                loadStats();
              } catch (err) {
                toast.error(err.response?.data?.error || 'Failed to add');
              }
            }}
            onMarkDoNotDrop={async () => {
              try {
                await api.patch(`/properties/${prop.id}`, { campaign_status: 'do_not_drop' });
                toast.success('Marked as Do Not Drop');
                loadProperties();
              } catch (err) {
                toast.error(err.response?.data?.error || 'Failed to update');
              }
            }}
          />
        );

        const popup = new mapboxgl.default.Popup({ offset: 12, maxWidth: '300px' })
          .setLngLat([prop.longitude, prop.latitude])
          .setDOMContent(popupContainer)
          .addTo(mapRef.current);

        popupRef.current = popup;
      });

      markersRef.current.push(marker);
    });
  }, [properties, mapLoaded, loadTodayDrops, loadStats, loadProperties]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  const toggleSatellite = useCallback(() => {
    if (!mapRef.current) return;
    const nextSat = !isSatellite;
    setIsSatellite(nextSat);
    mapRef.current.setStyle(
      nextSat
        ? 'mapbox://styles/mapbox/satellite-streets-v12'
        : 'mapbox://styles/mapbox/streets-v12'
    );
    mapRef.current.once('style.load', () => {
      renderMarkers();
    });
  }, [isSatellite, renderMarkers]);

  const toggleSpottingMode = useCallback(() => {
    if (!mapRef.current) return;
    const next = !spottingMode;
    setSpottingMode(next);
    if (next) {
      if (!isSatellite) {
        setIsSatellite(true);
        mapRef.current.setStyle('mapbox://styles/mapbox/satellite-streets-v12');
        mapRef.current.once('style.load', () => renderMarkers());
      }
      mapRef.current.getCanvas().style.cursor = 'crosshair';
    } else {
      mapRef.current.getCanvas().style.cursor = '';
      setSpotPopup(null);
    }
  }, [spottingMode, isSatellite, renderMarkers]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const handleClick = async (e) => {
      if (!spottingMode) return;
      const { lng, lat } = e.lngLat;
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&limit=1`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          const context = feature.context || [];
          const getCtx = (type) => {
            const item = context.find((c) => c.id.startsWith(type));
            return item ? item.text : '';
          };
          const houseNum = feature.address || '';
          const street = feature.text || '';
          const fullStreet = houseNum ? `${houseNum} ${street}` : feature.place_name;

          setSpotPopup({
            lng, lat,
            address: {
              address_street: fullStreet,
              address_city: getCtx('place') || getCtx('locality'),
              address_state: getCtx('region') || 'TX',
              address_zip: getCtx('postcode'),
            },
          });
        } else {
          throw new Error('No results');
        }
      } catch {
        setSpotPopup({
          lng,
          lat,
          address: {
            address_street: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            address_city: '',
            address_state: 'TX',
            address_zip: '',
          },
        });
      }
    };

    const map = mapRef.current;
    map.on('click', handleClick);
    return () => map.off('click', handleClick);
  }, [spottingMode, mapLoaded]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!spotPopup) return;
      if (e.key === 'Enter') {
        confirmSpottedPool();
      } else if (e.key === 'Escape') {
        setSpotPopup(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const confirmSpottedPool = async () => {
    if (!spotPopup) return;
    try {
      await api.post('/properties', {
        address_street: spotPopup.address.address_street,
        address_city: spotPopup.address.address_city || 'Cedar Park',
        address_state: spotPopup.address.address_state || 'TX',
        address_zip: spotPopup.address.address_zip || '',
        latitude: spotPopup.lat,
        longitude: spotPopup.lng,
        lead_source: 'manual_spotted',
        has_pool: true,
      });
      setSpottedCount((c) => c + 1);
      toast.success('Pool added to list');
      loadProperties();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add property');
    }
    setSpotPopup(null);
  };

  const handleGenerateRoute = async () => {
    try {
      await api.post('/deliveries/generate-route');
      toast.success('Route generated');
      loadTodayDrops();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate route');
    }
  };

  if (!mapboxToken) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center bg-slate-100">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-md text-center">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Map Not Configured</h2>
            <p className="text-sm text-slate-500">
              Set <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">VITE_MAPBOX_TOKEN</code> in your <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">.env</code> file to enable maps.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex-1 flex overflow-hidden relative" style={{ minHeight: 'calc(100vh - 3.5rem)' }}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          filters={filters}
          onFiltersChange={setFilters}
          todayDrops={todayDrops}
          onGenerateRoute={handleGenerateRoute}
          stats={stats}
        />

        <div className="flex-1 relative">
          <div ref={mapContainerRef} className="absolute inset-0" style={{ minHeight: '500px' }} />

          <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
            <button
              onClick={toggleSatellite}
              className={`px-3 py-2 text-xs font-medium rounded-lg shadow-md transition-colors ${
                isSatellite
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Satellite className="w-4 h-4 inline mr-1" />
              Satellite
            </button>
            <button
              onClick={toggleSpottingMode}
              className={`px-3 py-2 text-xs font-medium rounded-lg shadow-md transition-colors ${
                spottingMode
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {spottingMode ? (
                <>
                  <X className="w-4 h-4 inline mr-1" />
                  Exit Spotting
                </>
              ) : (
                <>
                  <MousePointer2 className="w-4 h-4 inline mr-1" />
                  Spot Pools
                </>
              )}
            </button>
          </div>

          {spottingMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-yellow-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-md">
              Pools spotted: {spottedCount} this session
            </div>
          )}

          {spotPopup && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-white rounded-xl shadow-xl border border-slate-200 p-4 min-w-[280px]">
              <h3 className="font-semibold text-slate-900 text-sm mb-1">Add Pool?</h3>
              <p className="text-xs text-slate-600 mb-3">
                {spotPopup.address.address_street}
                {spotPopup.address.address_city && `, ${spotPopup.address.address_city}`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmSpottedPool}
                  className="flex-1 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add to Pool List
                </button>
                <button
                  onClick={() => setSpotPopup(null)}
                  className="px-3 py-2 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                Enter to confirm, Escape to cancel
              </p>
            </div>
          )}

          <div className="absolute bottom-3 right-3 z-10 flex gap-2">
            <div className="bg-white rounded-lg shadow-md border border-slate-200 px-3 py-2 flex items-center gap-3 text-[10px] text-slate-600">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> MLS</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Cold</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" /> Queued</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> In Progress</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Complete</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-500 inline-block" /> DND</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
