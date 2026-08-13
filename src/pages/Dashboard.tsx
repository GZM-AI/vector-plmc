/**
 * Vector Dashboard — hub for all PLM modules
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  CalendarClock,
  Factory,
  GitBranch,
  ArrowRight,
  Crosshair,
  Search,
  LayoutDashboard,
} from 'lucide-react';

const modules = [
  {
    title: 'System Architecture',
    description:
      'TAR™ silhouette with subsystem hotspots. Inspect structure, open constituents, and manage shared zone layout.',
    icon: Crosshair,
    path: '/system-architecture',
  },
  {
    title: 'System Registry',
    description:
      'Full product structure — system, subsystems, components, software, interfaces, and per-subsystem Vertical Integrators.',
    icon: Box,
    path: '/system-registry',
  },
  {
    title: 'Planning & Cost',
    description:
      'Development timeline, prospective costs, and rollups keyed to the same Registry entity IDs.',
    icon: CalendarClock,
    path: '/planning',
  },
  {
    title: 'Suppliers',
    description:
      'Master supplier directory linked to subsystems. Complements per-branch Vertical Integrators.',
    icon: Factory,
    path: '/suppliers',
  },
  {
    title: 'Change Control',
    description:
      'ECRs, impact, status, and traceability back into affected Registry entities.',
    icon: GitBranch,
    path: '/changes',
  },
  {
    title: 'Deep Research',
    description:
      'Company, product, cost, and manufacturing research via the same Grok / Claude (Bedrock) proxy as PID.',
    icon: Search,
    path: '/research',
  },
];

const Dashboard: React.FC = () => {
  return (
    <div className="p-8 max-w-6xl mx-auto bg-zinc-950 text-white min-h-screen">
      <div className="mb-10 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <LayoutDashboard className="text-blue-400 shrink-0" />
          Dashboard
        </h1>
        <p className="text-sm text-zinc-400 font-normal">
          TAR™ digital thread for unified system development
        </p>
      </div>

      <h2 className="text-lg font-medium text-zinc-300 mb-4">Modules</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.path}
              to={mod.path}
              className="bg-zinc-900 border border-zinc-800 hover:border-blue-600 rounded-3xl p-7 h-full transition group block"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-700 flex items-center justify-center">
                  <Icon className="text-blue-400" size={22} />
                </div>
                <ArrowRight
                  className="text-zinc-600 group-hover:text-blue-400 transition"
                  size={20}
                />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-300 transition">
                {mod.title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{mod.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;