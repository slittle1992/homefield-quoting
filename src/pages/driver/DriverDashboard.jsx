import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, CheckCircle2, Clock, Route, LogOut, Droplets, Navigation } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import DropBadge from '../../components/DropBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function DriverDashboard() {
  const [drops, setDrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [delivering, setDelivering] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const fetchDrops = useCallback(async () => {
    try {
      const res = await api.get('/deliveries/today');
      const data = res.data;
      setDrops(Array.isArray(data) ? data : data.drops || []);
    } catch {
      toast.error('Failed to load today\'s route');
      setDrops([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrops();
  }, [fetchDrops]);

  const deliveredCount = drops.filter((d) => d.status === 'delivered').length;
  const totalCount = drops.length;
  const progressPct = totalCount > 0 ? (deliveredCount / totalCount) * 100 : 0;

  const handleMarkDelivered = async (drop) => {
    setDelivering(drop.id);

    let latitude = null;
    let longitude = null;

    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch {
      // GPS not available, continue without it
    }

    try {
      await api.post(`/deliveries/${drop.id}/deliver`, {
        latitude,
        longitude,
      });
      toast.success(`Delivered: ${drop.address_street || drop.address}`);
      await fetchDrops();
      // Auto-scroll to next undelivered drop
      setTimeout(() => {
        const nextCard = document.querySelector('[data-next-drop]');
        if (nextCard) nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to mark delivered';
      if (err.response?.data?.distance_warning) {
        const proceed = window.confirm(
          `You are ${err.response.data.distance}m away from this address. Mark as delivered anyway?`
        );
        if (proceed) {
          try {
            await api.post(`/deliveries/${drop.id}/deliver`, {
              latitude,
              longitude,
              override_distance: true,
            });
            toast.success(`Delivered: ${drop.address_street}`);
            fetchDrops();
          } catch (err2) {
            toast.error(err2.response?.data?.error || 'Failed to mark delivered');
          }
        }
      } else {
        toast.error(errMsg);
      }
    } finally {
      setDelivering(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets className="w-6 h-6 text-blue-600" />
          <span className="text-lg font-bold text-slate-900">PoolDrop</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{user?.name || 'Driver'}</span>
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 px-4 py-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-sm text-slate-500">Drops Available</p>
            <p className="text-3xl font-bold text-slate-900">
              {deliveredCount}{' '}
              <span className="text-lg font-normal text-slate-400">/ {totalCount}</span>
            </p>
          </div>
          <button
            onClick={() => navigate('/driver/route')}
            disabled={totalCount === 0}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium rounded-xl transition-colors text-sm"
          >
            <Route className="w-5 h-5" />
            Start Route
          </button>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-1 text-right">
          {Math.round(progressPct)}% complete
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {drops.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No drops scheduled for today</p>
            <p className="text-xs text-slate-300 mt-1">Check back later or contact your admin</p>
          </div>
        ) : (
          drops.map((drop, index) => {
            const isDelivered = drop.status === 'delivered';
            const isNextDrop = !isDelivered && !drops.slice(0, index).some(d => d.status !== 'delivered');
            return (
              <div
                key={drop.id || index}
                {...(isNextDrop ? { 'data-next-drop': true } : {})}
                className={`bg-white rounded-xl border shadow-sm p-4 transition-colors ${
                  isDelivered ? 'border-green-200 bg-green-50/50' : isNextDrop ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 rounded-full text-xs font-semibold text-slate-600">
                        {index + 1}
                      </span>
                      <DropBadge
                        current={drop.flyer_drops_completed || drop.drop_number || 1}
                        total={drop.flyer_drops_total || 4}
                        status={drop.campaign_status || 'flyer_in_progress'}
                      />
                    </div>
                    <p className="font-semibold text-slate-900 text-base">{drop.address_street}</p>
                    <p className="text-sm text-slate-500">
                      {drop.address_city}, TX {drop.address_zip}
                    </p>
                  </div>
                </div>
                {isDelivered ? (
                  <div className="flex items-center gap-1.5 text-green-600 mt-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Delivered</span>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-3">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        `${drop.address_street || drop.address}, ${drop.address_city || drop.city}, TX ${drop.address_zip || drop.zip}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors text-sm"
                    >
                      <Navigation className="w-5 h-5" />
                      Navigate
                    </a>
                    <button
                      onClick={() => handleMarkDelivered(drop)}
                      disabled={delivering === drop.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-xl transition-colors text-sm"
                    >
                      {delivering === drop.id ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          Delivered
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
