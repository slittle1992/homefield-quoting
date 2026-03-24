import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Navigation,
  SkipForward,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import DropBadge from '../../components/DropBadge';
import api from '../../services/api';
import toast from 'react-hot-toast';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function DriverRoute() {
  const navigate = useNavigate();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const [drops, setDrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [delivering, setDelivering] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [distanceWarning, setDistanceWarning] = useState(null);

  const fetchDrops = useCallback(async () => {
    try {
      const res = await api.get('/deliveries/today');
      const data = Array.isArray(res.data) ? res.data : res.data.drops || [];
      setDrops(data);

      const firstPending = data.findIndex((d) => d.status !== 'delivered');
      setCurrentIndex(firstPending >= 0 ? firstPending : 0);
    } catch {
      toast.error('Failed to load route');
      setDrops([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrops();
  }, [fetchDrops]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainerRef.current || mapRef.current || drops.length === 0) return;

    let cancelled = false;

    import('mapbox-gl').then((mapboxgl) => {
      if (cancelled || mapRef.current) return;

      mapboxgl.default.accessToken = MAPBOX_TOKEN;

      const validDrops = drops.filter((d) => d.longitude && d.latitude);
      const center = validDrops.length > 0
        ? [validDrops[0].longitude, validDrops[0].latitude]
        : [-97.82, 30.51];

      const map = new mapboxgl.default.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center,
        zoom: 13,
      });

      map.addControl(
        new mapboxgl.default.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
        }),
        'top-left'
      );

      map.on('load', () => {
        if (cancelled) return;

        const routeCoords = validDrops.map((d) => [d.longitude, d.latitude]);
        if (routeCoords.length >= 2) {
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: routeCoords },
            },
          });
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 3,
              'line-dasharray': [2, 2],
            },
          });
        }

        validDrops.forEach((drop, i) => {
          const isDelivered = drop.status === 'delivered';

          const el = document.createElement('div');
          el.style.width = '32px';
          el.style.height = '32px';
          el.style.borderRadius = '50%';
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.style.fontSize = '13px';
          el.style.fontWeight = '700';
          el.style.color = 'white';
          el.style.backgroundColor = isDelivered ? '#22c55e' : '#3b82f6';
          el.style.border = '3px solid white';
          el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
          el.textContent = String(i + 1);

          const marker = new mapboxgl.default.Marker({ element: el })
            .setLngLat([drop.longitude, drop.latitude])
            .addTo(map);

          markersRef.current.push({ marker, element: el, dropId: drop.id });
        });

        if (validDrops.length > 0) {
          const bounds = new mapboxgl.default.LngLatBounds();
          validDrops.forEach((d) => bounds.extend([d.longitude, d.latitude]));
          map.fitBounds(bounds, { padding: 60 });
        }
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
    };
  }, [drops]);

  const updateMarkerColor = useCallback(async (dropId, color) => {
    const found = markersRef.current.find((m) => m.dropId === dropId);
    if (found) {
      found.element.style.backgroundColor = color;
    }
  }, []);

  const currentDrop = drops[currentIndex];
  const deliveredCount = drops.filter((d) => d.status === 'delivered').length;

  const handleDeliver = async () => {
    if (!currentDrop) return;
    setDelivering(true);
    setDistanceWarning(null);

    try {
      await api.post(`/deliveries/${currentDrop.id}/deliver`, {
        latitude: userLocation?.latitude || null,
        longitude: userLocation?.longitude || null,
      });

      toast.success('Delivered!');
      updateMarkerColor(currentDrop.id, '#22c55e');

      const updatedDrops = [...drops];
      updatedDrops[currentIndex] = { ...updatedDrops[currentIndex], status: 'delivered' };
      setDrops(updatedDrops);

      const nextPending = updatedDrops.findIndex(
        (d, i) => i > currentIndex && d.status !== 'delivered'
      );
      if (nextPending >= 0) {
        setCurrentIndex(nextPending);
        if (mapRef.current && updatedDrops[nextPending].longitude) {
          mapRef.current.flyTo({
            center: [updatedDrops[nextPending].longitude, updatedDrops[nextPending].latitude],
            zoom: 16,
            duration: 1000,
          });
        }
      }
    } catch (err) {
      if (err.response?.data?.distance_warning) {
        setDistanceWarning({
          distance: err.response.data.distance,
          dropId: currentDrop.id,
        });
      } else {
        toast.error(err.response?.data?.error || 'Failed to deliver');
      }
    } finally {
      setDelivering(false);
    }
  };

  const handleOverrideDeliver = async () => {
    if (!distanceWarning) return;
    setDelivering(true);
    try {
      await api.post(`/deliveries/${distanceWarning.dropId}/deliver`, {
        latitude: userLocation?.latitude || null,
        longitude: userLocation?.longitude || null,
        override_distance: true,
      });
      toast.success('Delivered (distance override)');
      updateMarkerColor(distanceWarning.dropId, '#22c55e');

      const updatedDrops = [...drops];
      updatedDrops[currentIndex] = { ...updatedDrops[currentIndex], status: 'delivered' };
      setDrops(updatedDrops);

      const nextPending = updatedDrops.findIndex(
        (d, i) => i > currentIndex && d.status !== 'delivered'
      );
      if (nextPending >= 0) {
        setCurrentIndex(nextPending);
      }
      setDistanceWarning(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to deliver');
    } finally {
      setDelivering(false);
    }
  };

  const handleSkip = () => {
    const nextPending = drops.findIndex(
      (d, i) => i > currentIndex && d.status !== 'delivered'
    );
    if (nextPending >= 0) {
      setCurrentIndex(nextPending);
      if (mapRef.current && drops[nextPending].longitude) {
        mapRef.current.flyTo({
          center: [drops[nextPending].longitude, drops[nextPending].latitude],
          zoom: 16,
          duration: 800,
        });
      }
    } else {
      toast('No more stops!');
    }
  };

  const handleNavigate = () => {
    if (!currentDrop) return;
    const addr = encodeURIComponent(
      `${currentDrop.address_street}, ${currentDrop.address_city || ''}, TX ${currentDrop.address_zip || ''}`
    );
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      window.open(`maps://maps.apple.com/?daddr=${addr}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${addr}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!MAPBOX_TOKEN) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/driver')} className="p-2 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-slate-900">Route Map</h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-sm text-center">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Map Not Available</h2>
            <p className="text-sm text-slate-500">
              Set <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">VITE_MAPBOX_TOKEN</code> in your .env file.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between z-10">
        <button
          onClick={() => navigate('/driver')}
          className="p-2 hover:bg-slate-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <span className="text-sm font-semibold text-slate-900">
          {deliveredCount}/{drops.length} delivered
        </span>
        <div className="w-9" />
      </header>

      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0" />
      </div>

      {currentDrop && (
        <div className="bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          {distanceWarning && (
            <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">
                  You are {distanceWarning.distance}m away
                </p>
                <p className="text-xs text-yellow-600">
                  The maximum distance is 50m. Deliver anyway?
                </p>
              </div>
              <button
                onClick={handleOverrideDeliver}
                disabled={delivering}
                className="px-3 py-1.5 text-xs font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
              >
                Override
              </button>
              <button
                onClick={() => setDistanceWarning(null)}
                className="px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 rounded-lg"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-100 rounded-full text-xs font-bold text-blue-700">
                {currentIndex + 1}
              </span>
              <DropBadge
                current={currentDrop.flyer_drops_completed || currentDrop.drop_number || 1}
                total={currentDrop.flyer_drops_total || 4}
                status={currentDrop.campaign_status || 'flyer_in_progress'}
              />
            </div>

            <p className="text-lg font-bold text-slate-900">{currentDrop.address_street}</p>
            <p className="text-sm text-slate-500 mb-4">
              {currentDrop.address_city}, TX {currentDrop.address_zip}
            </p>

            <div className="flex gap-2">
              {currentDrop.status === 'delivered' ? (
                <div className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-50 text-green-700 font-medium rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                  Delivered
                </div>
              ) : (
                <button
                  onClick={handleDeliver}
                  disabled={delivering}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold rounded-xl transition-colors text-base"
                >
                  {delivering ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Mark Delivered
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleNavigate}
                className="px-4 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
                title="Navigate"
              >
                <Navigation className="w-5 h-5" />
              </button>
              <button
                onClick={handleSkip}
                className="px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                title="Skip"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {drops.length > 0 && !currentDrop && (
        <div className="bg-white border-t border-slate-200 p-6 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-lg font-semibold text-slate-900">All deliveries complete!</p>
          <button
            onClick={() => navigate('/driver')}
            className="mt-3 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors text-sm"
          >
            Back to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
