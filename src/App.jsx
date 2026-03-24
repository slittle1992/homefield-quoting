import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoadingSpinner from './components/LoadingSpinner';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import ImportPage from './pages/admin/ImportPage';
import PropertyList from './pages/admin/PropertyList';
import CampaignSettings from './pages/admin/CampaignSettings';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import ExportPage from './pages/admin/ExportPage';
import DriverDashboard from './pages/driver/DriverDashboard';
import DriverRoute from './pages/driver/DriverRoute';

function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, isAdmin, isDriver, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole === 'admin' && !isAdmin) {
    return <Navigate to="/driver" replace />;
  }

  if (requiredRole === 'driver' && !isDriver && !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RootRedirect() {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/driver" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#1e293b', color: '#f8fafc', fontSize: '14px' },
          success: { iconTheme: { primary: '#22c55e', secondary: '#f8fafc' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#f8fafc' } },
        }}
      />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/import" element={<ProtectedRoute requiredRole="admin"><ImportPage /></ProtectedRoute>} />
        <Route path="/admin/properties" element={<ProtectedRoute requiredRole="admin"><PropertyList /></ProtectedRoute>} />
        <Route path="/admin/campaigns" element={<ProtectedRoute requiredRole="admin"><CampaignSettings /></ProtectedRoute>} />
        <Route path="/admin/analytics" element={<ProtectedRoute requiredRole="admin"><AnalyticsPage /></ProtectedRoute>} />
        <Route path="/admin/export" element={<ProtectedRoute requiredRole="admin"><ExportPage /></ProtectedRoute>} />
        <Route path="/driver" element={<ProtectedRoute requiredRole="driver"><DriverDashboard /></ProtectedRoute>} />
        <Route path="/driver/route" element={<ProtectedRoute requiredRole="driver"><DriverRoute /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
