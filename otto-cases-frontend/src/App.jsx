import React, { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CaseWizard from './pages/CaseWizard';

function App() {
  const [currentView, setCurrentView] = useState('login'); // 'login', 'dashboard', 'wizard'

  if (currentView === 'login') {
    return <Login onLoginComplete={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'wizard') {
    return <CaseWizard onBack={() => setCurrentView('dashboard')} />;
  }

  return (
    <Dashboard 
      onLogout={() => setCurrentView('login')} 
      onNewCase={() => setCurrentView('wizard')} 
    />
  );
}

export default App;
