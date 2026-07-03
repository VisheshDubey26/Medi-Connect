import { useState, useEffect } from 'react';
import Login from './components/Login.tsx';
import RoleSelector from './components/RoleSelector.tsx';
import PatientDashboard from './components/PatientDashboard.tsx';
import DoctorDashboard from './components/DoctorDashboard.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';

interface UserSession {
  email: string;
  name: string;
  uid: string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [user, setUser] = useState<UserSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('caresync_token');
    const savedRole = localStorage.getItem('caresync_role');
    const savedUser = localStorage.getItem('caresync_user');

    if (savedToken && savedRole && savedUser) {
      try {
        setToken(savedToken);
        setRole(savedRole);
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error('Failed to restore CareSync session:', err);
        handleSignOut();
      }
    }
    setIsInitializing(false);
  }, []);

  const handleLoginSuccess = (newToken: string, newRole: string, newUser: UserSession) => {
    setToken(newToken);
    setRole(newRole);
    setUser(newUser);

    localStorage.setItem('caresync_token', newToken);
    localStorage.setItem('caresync_role', newRole);
    localStorage.setItem('caresync_user', JSON.stringify(newUser));
  };

  const handleRoleBypassChange = (newRole: string) => {
    setRole(newRole);
    localStorage.setItem('caresync_role', newRole);
    
    // Dynamically adjust mock tokens to align with bypassed role
    let adjustedToken = token;
    if (token?.startsWith('mock_') || token?.startsWith('demo_')) {
      adjustedToken = `mock_${newRole}_token`;
      setToken(adjustedToken);
      localStorage.setItem('caresync_token', adjustedToken);
    }
  };

  const handleSignOut = () => {
    setToken(null);
    setRole(null);
    setUser(null);

    localStorage.removeItem('caresync_token');
    localStorage.removeItem('caresync_role');
    localStorage.removeItem('caresync_user');
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-gray-500 font-semibold tracking-wide">Initializing Secure Sessions...</p>
        </div>
      </div>
    );
  }

  // If there is no active session, show the login screen
  if (!token || !role || !user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-gray-800 antialiased font-sans flex flex-col">
      {/* Interactive CareSync Header bar */}
      <RoleSelector
        currentRole={role}
        onRoleChange={handleRoleBypassChange}
        userEmail={user.email}
        userName={user.name}
        token={token}
        onSignOut={handleSignOut}
      />

      {/* Main Panel Content Render */}
      <main className="flex-1">
        {role === 'patient' && <PatientDashboard token={token} />}
        {role === 'doctor' && <DoctorDashboard token={token} />}
        {role === 'admin' && <AdminDashboard token={token} />}
      </main>

      {/* Modern, elegant footbar */}
      <footer className="border-t border-gray-100 bg-white py-6 text-center text-xs text-gray-400 font-medium mt-12">
        <p>© 2026 MediConnect Healthcare Systems. Engineered with enterprise-grade auth locks, Firebase client tokens, and Google AI.</p>
      </footer>
    </div>
  );
}
