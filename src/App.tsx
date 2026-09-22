import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Authenticator, ThemeProvider, Theme } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import SystemRegistry from './pages/SystemRegistry';
import SystemArchitecture from './pages/SystemArchitecture';
import PlanningCost from './pages/PlanningCost';
import Suppliers from './pages/Suppliers';
import ChangeControl from './pages/ChangeControl';
import DeepResearch from './pages/DeepResearch';
import Baselines from './pages/Baselines';

const theme: Theme = {
  name: 'vector-dark',
  tokens: {
    colors: {
      background: { primary: { value: '#09090b' }, secondary: { value: '#18181b' } },
      font: { primary: { value: '#fafafa' }, secondary: { value: '#a1a1aa' } },
      brand: {
        primary: {
          10: { value: '#172554' },
          80: { value: '#2563eb' },
          90: { value: '#3b82f6' },
          100: { value: '#60a5fa' },
        },
      },
    },
  },
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme} colorMode="dark">
      <Authenticator
        hideSignUp
        loginMechanisms={['email']}
        variation="modal"
      >
        {({ signOut, user }) => (
          <Router>
            <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
              <Sidebar
                user={{ username: user?.signInDetails?.loginId || user?.username || 'user' }}
                signOut={signOut}
              />
              <div className="flex-1 overflow-auto">
                <Routes>
                  <Route path="/" element={<Navigate to="/system-architecture" replace />} />
                  <Route path="/system-architecture" element={<SystemArchitecture />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/system-registry" element={<SystemRegistry />} />
                  <Route path="/planning" element={<PlanningCost />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/changes" element={<ChangeControl />} />
                  <Route path="/research" element={<DeepResearch />} />
                  <Route path="/baselines" element={<Baselines />} />
                  <Route path="/system-map" element={<Navigate to="/system-architecture" replace />} />
                </Routes>
              </div>
            </div>
          </Router>
        )}
      </Authenticator>
    </ThemeProvider>
  );
};

export default App;
