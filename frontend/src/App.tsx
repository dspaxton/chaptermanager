import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import MemberProfile from './pages/MemberProfile';
import Rides from './pages/Rides';
import RideCreate from './pages/RideCreate';
import RideEdit from './pages/RideEdit';
import RideDetail from './pages/RideDetail';
import Meetings from './pages/Meetings';
import MeetingDetail from './pages/MeetingDetail';
import Minutes from './pages/Minutes';
import AIAssistant from './pages/AIAssistant';
import Settings from './pages/Settings';
import AuthCallback from './pages/AuthCallback';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="members" element={<Members />} />
        <Route path="members/:id" element={<MemberProfile />} />
        <Route path="rides" element={<Rides />} />
        <Route path="rides/new" element={<RideCreate />} />
        <Route path="rides/:id/edit" element={<RideEdit />} />
        <Route path="rides/:id" element={<RideDetail />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="meetings/:id" element={<MeetingDetail />} />
        <Route path="minutes" element={<Minutes />} />
        <Route path="ai" element={<AIAssistant />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
