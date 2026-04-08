import React, { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CaseWizard from './pages/CaseWizard';

function App() {
  const [currentView, setCurrentView] = useState('login'); // 'login', 'dashboard', 'wizard'
  const [activeCaseId, setActiveCaseId] = useState(null);

  if (currentView === 'login') {
    return <Login onLoginComplete={() => setCurrentView('dashboard')} />;
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
      onLogout={() => setCurrentView('login')} 
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

export default App;
