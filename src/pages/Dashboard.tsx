import React from 'react';
import { Link } from 'react-router-dom';
import { Box, CalendarClock, Factory, GitBranch, ArrowRight } from 'lucide-react';

const cards = [
  {
    title: 'System Registry',
    description:
      'Full hierarchical view of the TAR™ — systems, subsystems, components, interfaces, and vertical integrators.',
    icon: Box,
    path: '/system-registry',
    ready: true,
  },
  {
    title: 'Planning & Cost',
    description:
      'Per-subcomponent schedule, NRE/unit cost estimates, Gantt-ready data, and roll-ups to the platform level.',
    icon: CalendarClock,
    path: '/planning',
    ready: false,
  },
  {
    title: 'Suppliers',
    description:
      'Candidate companies and products, make-vs-buy decisions, engagement status, and sourcing risk.',
    icon: Factory,
    path: '/suppliers',
    ready: false,
  },
  {
    title: 'Change Control',
    description:
      'Formal change records, impact analysis, baselines, and configuration effectivity.',
    icon: GitBranch,
    path: '/changes',
    ready: false,
  },
];

const Dashboard: React.FC = () => {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-white">
          Product Lifecycle Management Console
        </h1>
        <p className="text-zinc-400 mt-2 text-lg">
          Digital Thread · Trajectory Adjusting Rifle (TAR™)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          const content = (
            <div
              className={
                'bg-zinc-900 border rounded-3xl p-7 h-full transition ' +
                (card.ready
                  ? 'border-zinc-800 hover:border-blue-600 cursor-pointer group'
                  : 'border-zinc-800/60 opacity-60')
              }
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-700 flex items-center justify-center">
                  <Icon className="text-blue-400" size={22} />
                </div>
                {card.ready ? (
                  <ArrowRight
                    className="text-zinc-600 group-hover:text-blue-400 transition"
                    size={20}
                  />
                ) : (
                  <span className="text-[10px] uppercase tracking-wider text-zinc-600 border border-zinc-700 px-2 py-1 rounded-lg">
                    Next
                  </span>
                )}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{card.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{card.description}</p>
            </div>
          );

          return card.ready ? (
            <Link key={card.path} to={card.path}>
              {content}
            </Link>
          ) : (
            <div key={card.path}>{content}</div>
          );
        })}
      </div>

      <div className="mt-12 bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        <h2 className="text-lg font-medium text-blue-400 mb-3">Platform Focus</h2>
        <p className="text-zinc-300 leading-relaxed">
          This console tracks the complete Advanced Weapons Systems — Trajectory Adjusting
          Rifle (TAR™) product structure from architecture definition through custom
          manufacturing, supplier engagement, and system integration. Each subcomponent is
          an independent instance with its own schedule, cost, and vertical-integrator
          candidates.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;