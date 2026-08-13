import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import SystemRegistry from './pages/SystemRegistry';
import SystemArchitecture from './pages/SystemArchitecture';
import PlanningCost from './pages/PlanningCost';
import Suppliers from './pages/Suppliers';
import ChangeControl from './pages/ChangeControl';
import DeepResearch from './pages/DeepResearch';

/**
 * Auth is temporarily bypassed until Amplify backend is initialized.
 * When ready: wrap with <Authenticator> again and pass user/signOut to Sidebar.
 */
const App: React.FC = () => {
  return (
    <Router>
      <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
        <Sidebar user={{ username: 'Zedekiah' }} />
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
            {/* old path redirect */}
            <Route path="/system-map" element={<Navigate to="/system-architecture" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;