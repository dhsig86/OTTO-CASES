import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import CaseWizard from './pages/CaseWizard';
import { AuthProvider, useAuth } from './auth/ottoContext';

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

  if (status === 'no-shell') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center border border-slate-100">
          <div className="bg-red-100 p-3 rounded-full inline-block mb-4 text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
          <p className="text-slate-600 mb-6">O módulo OTTO Cases deve ser carregado através do ecossistema principal.</p>
          <a href="https://pwa.otto.med.br" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg w-full block">
            Acessar pelo OTTO PWA
          </a>
        </div>
      </div>
    );
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
