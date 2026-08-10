import React from 'react';
import { GSTINProfile, UserProfile } from '../types';
import { Store, Calendar, LogOut, ChevronRight, FileText, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  activeProfile: GSTINProfile | null;
  activeTab: string;
  user: UserProfile | null;
  onLogout: () => void;
  onSelectProfileClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeProfile,
  activeTab,
  user,
  onLogout,
  onSelectProfileClick
}) => {
  const getTabLabel = (tab: string) => {
    switch (tab) {
      case 'profile': return 'GST Profile';
      case 'import': return 'Import Data';
      case 'manage': return 'Manage Data';
      case 'reconcile': return 'TCS Reconcile';
      case 'gstr1': return 'GSTR1 Report';
      default: return 'Dashboard';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 flex items-center justify-between px-6 md:px-8 shadow-2xs z-30 sticky top-0">
      {/* Left Breadcrumbs */}
      <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
        <span className="hover:text-slate-800 transition-colors">Home</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="hover:text-slate-800 transition-colors">GST Tool</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-900 font-bold">{getTabLabel(activeTab)}</span>
      </div>

      {/* Right Profile & User Controls */}
      <div className="flex items-center space-x-4">
        {activeProfile ? (
          <div
            onClick={onSelectProfileClick}
            className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 cursor-pointer transition-all shadow-2xs group"
            title="Switch GST Profile or Period"
          >
            <div className="w-6 h-6 rounded bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px] group-hover:bg-blue-600 group-hover:text-white transition-colors">
              GST
            </div>
            <div className="flex flex-col text-left">
              <span className="font-mono font-bold text-slate-900 text-[11px] leading-none">
                {activeProfile.partyName ? `${activeProfile.partyName} (${activeProfile.gstin})` : activeProfile.gstin}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 leading-none">
                {activeProfile.periodMonth}-{activeProfile.periodYear} ({activeProfile.tradeName})
              </span>
            </div>
          </div>
        ) : (
          <div
            onClick={onSelectProfileClick}
            className="flex items-center space-x-2 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg px-3 py-1.5 text-xs text-amber-900 cursor-pointer transition-all shadow-2xs group"
            title="Click to select or create GST Profile"
          >
            <div className="w-6 h-6 rounded bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[10px]">
              GST
            </div>
            <div className="flex flex-col text-left">
              <span className="font-mono font-bold text-amber-900 text-[11px] leading-none">
                GSTIN: No GSTIN selected
              </span>
              <span className="text-[10px] text-amber-700 mt-0.5 leading-none font-medium">
                Period: No period selected
              </span>
            </div>
          </div>
        )}

        {user && (
          <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">
                {user.name.split(' ').map(n => n[0]).join('')}
              </div>
              <span className="text-xs font-semibold text-slate-800 hidden sm:inline">{user.name}</span>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
