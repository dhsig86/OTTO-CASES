import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import CaseWizard from './pages/CaseWizard';
import { AuthProvider, useAuth } from './auth/ottoContext';

function StandaloneLogin() {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async () => {
    setLoading(true);
    await loginWithGoogle();
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center border border-slate-100">
        <div className="mb-6">
          <span className="text-4xl">🩺</span>
          <h1 className="text-2xl font-bold text-slate-800 mt-2">OTTO Cases</h1>
          <p className="text-slate-500 text-sm mt-1">Relatos de caso científicos em ORL</p>
        </div>
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-xl transition-all shadow-sm disabled:opacity-60"
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l6-6C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.9 5.1C14.9 16.1 19.1 13 24 13c3 0 5.7 1.1 7.8 2.9l6-6C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.5 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.8 13.6-4.8l-6.3-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.5-3.4-11.1-8H6.2C9.6 38.9 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.5 4.6-4.6 6l6.3 5.2C40.6 36 44 30.4 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          {loading ? 'Entrando...' : 'Entrar com Google'}
        </button>
        <p className="text-xs text-slate-400 mt-4">
          Use a mesma conta do OTTO PWA
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'wizard'
  const [activeCaseId, setActiveCaseId] = useState(null);
  
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p>Aguardando integração segura com o OTTO PWA...</p>
      </div>
    );
  }

  if (status === 'standalone-login' || status === 'no-shell') {
    return <StandaloneLogin />;
  }

  if (currentView === 'wizard') {
    return <CaseWizard 
      caseId={activeCaseId}
      onBack={() => {
        setActiveCaseId(null);
        setCurrentView('dashboard');
      }} 
    />;
  }

  return (
    <Dashboard 
      onLogout={() => { /* Logout não gerenciado localmente com SSO, idealmente avisa o PWA */ }} 
      onNewCase={() => {
        setActiveCaseId(null);
        setCurrentView('wizard');
      }} 
      onOpenCase={(id) => {
        setActiveCaseId(id);
        setCurrentView('wizard');
      }}
    />
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
