import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
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

/**
 * Forced Cognito sign-in for team / real-world use.
 * Required for ITAR-adjacent document Storage (authenticated only).
 * Create users in Cognito console, or set hideSignUp={false} to allow self-register.
 */
const App: React.FC = () => {
  return (
    <Authenticator
      loginMechanisms={['email']}
      hideSignUp={true}
      components={{
        Header() {
          return (
            <div className="text-center py-6">
              <h1 className="text-xl font-semibold text-white">Vector PLM</h1>
              <p className="text-sm text-zinc-400 mt-1">Sign in to continue</p>
            </div>
          );
        },
      }}
    >
      {({ signOut, user }) => (
        <Router>
          <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
            <Sidebar
              user={{
                username:
                  user?.signInDetails?.loginId ||
                  user?.username ||
                  'User',
              }}
              signOut={signOut}
            />
            <div className="flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
  );
};

export default App;