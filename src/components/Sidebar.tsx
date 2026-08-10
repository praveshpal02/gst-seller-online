import React from 'react';
import { Store, Upload, Table, RefreshCw, FileText, BarChart2, ShieldCheck } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  importedCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, importedCount }) => {
  const navItems = [
    { id: 'profile', label: 'GST Profile', icon: Store },
    { id: 'import', label: 'Import Data', icon: Upload, badge: importedCount > 0 ? importedCount : undefined },
    { id: 'manage', label: 'Manage Data', icon: Table },
    { id: 'reconcile', label: 'TCS Reconcile', icon: RefreshCw },
    { id: 'gstr1', label: 'GSTR1 Report', icon: FileText },
  ];

  return (
    <aside className="w-full md:w-60 bg-slate-900 text-white flex flex-col border-r border-slate-800 rounded-xl overflow-hidden shadow-sm shrink-0">
      {/* App Branding */}
      <div className="p-5 border-b border-slate-800">
        <h1 className="text-lg font-bold tracking-tight text-blue-400 flex items-center justify-between">
          <span>TaxFlow</span>
          <span className="text-[10px] uppercase bg-blue-900/60 text-blue-300 font-extrabold px-2 py-0.5 rounded border border-blue-700/50">
            Meesho
          </span>
        </h1>
        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
          E-Commerce GST Filing & TCS
        </p>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 space-y-1">
        <div className="px-5 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
          Main Menu
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-5 py-3 text-xs font-semibold transition-colors text-left ${
                isActive
                  ? 'bg-blue-600 text-white border-r-4 border-blue-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isActive ? 'bg-blue-800 text-white' : 'bg-slate-800 text-slate-300'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Info Box */}
      <div className="p-4 border-t border-slate-800 mt-auto">
        <div className="p-3 bg-slate-800/80 rounded-lg text-xs space-y-1 border border-slate-700/50">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Plan:</span>
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Pro Active
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Filing Period:</span>
            <span className="font-bold text-white">July 2026</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
