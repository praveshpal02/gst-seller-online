import React, { useState } from 'react';
import { UserProfile, GSTINProfile, MeeshoTransaction } from './types';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { GSTProfile } from './components/GSTProfile';
import { ImportData } from './components/ImportData';
import { ManageData } from './components/ManageData';
import { TCSReconcile } from './components/TCSReconcile';
import { GSTR1Report } from './components/GSTR1Report';
import { AuthModal } from './components/AuthModal';
import { HelpGuide } from './components/HelpGuide';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>({
    id: 'usr_default',
    name: 'Pravesh Pal',
    email: 'praveshpal02@gmail.com',
    businessName: 'Zenith E-Commerce Traders',
    isLoggedIn: true
  });

  const [profiles, setProfiles] = useState<GSTINProfile[]>(() => {
    try {
      const saved = localStorage.getItem('gstin_profiles');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [activeProfile, setActiveProfile] = useState<GSTINProfile | null>(() => {
    try {
      const savedProfiles = localStorage.getItem('gstin_profiles');
      const profilesArr: GSTINProfile[] = savedProfiles ? JSON.parse(savedProfiles) : [];
      const activeId = localStorage.getItem('active_gstin_id');
      return profilesArr.find(p => p.id === activeId || p.isActive) || null;
    } catch (e) {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<string>('import');
  const [transactions, setTransactions] = useState<MeeshoTransaction[]>([]);
  const [isHelpGuideOpen, setIsHelpGuideOpen] = useState<boolean>(false);

  const getTxStorageKey = (gstin?: string, month?: string, year?: string, marketplace = 'MEESHO') => {
    if (!gstin || !month || !year) return null;
    return `gst_tx_${gstin}_${month.toLowerCase()}_${year}_${marketplace.toUpperCase()}`;
  };

  React.useEffect(() => {
    if (activeProfile?.gstin && activeProfile?.periodMonth && activeProfile?.periodYear) {
      const key = getTxStorageKey(activeProfile.gstin, activeProfile.periodMonth, activeProfile.periodYear, 'MEESHO');
      if (key) {
        try {
          const saved = localStorage.getItem(key);
          if (saved) {
            setTransactions(JSON.parse(saved));
            return;
          }
        } catch (e) {
          console.error('Error loading transactions:', e);
        }
      }
    }
    setTransactions([]);
  }, [activeProfile?.gstin, activeProfile?.periodMonth, activeProfile?.periodYear]);

  const handleDataImported = (imported: MeeshoTransaction[]) => {
    setTransactions(imported);
    if (activeProfile?.gstin && activeProfile?.periodMonth && activeProfile?.periodYear) {
      const key = getTxStorageKey(activeProfile.gstin, activeProfile.periodMonth, activeProfile.periodYear, 'MEESHO');
      if (key) {
        try {
          localStorage.setItem(key, JSON.stringify(imported));
        } catch (e) {
          console.error('Error storing transactions:', e);
        }
      }
    }
  };

  const handleDeleteMeeshoImport = async (): Promise<boolean> => {
    if (!activeProfile?.gstin || !activeProfile?.periodMonth || !activeProfile?.periodYear) {
      return false;
    }

    try {
      const response = await fetch('/api/meesho-import', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || 'usr_default',
          gstin: activeProfile.gstin,
          periodMonth: activeProfile.periodMonth,
          periodYear: activeProfile.periodYear,
          marketplace: 'MEESHO'
        })
      });

      if (!response.ok) {
        return false;
      }

      const resData = await response.json();
      if (resData.success) {
        const key = getTxStorageKey(activeProfile.gstin, activeProfile.periodMonth, activeProfile.periodYear, 'MEESHO');
        if (key) {
          localStorage.removeItem(key);
        }
        setTransactions([]);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to delete Meesho import session:', e);
      return false;
    }
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      if (activeProfile?.gstin && activeProfile?.periodMonth && activeProfile?.periodYear) {
        const key = getTxStorageKey(activeProfile.gstin, activeProfile.periodMonth, activeProfile.periodYear, 'MEESHO');
        if (key) {
          try {
            if (updated.length > 0) {
              localStorage.setItem(key, JSON.stringify(updated));
            } else {
              localStorage.removeItem(key);
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
      return updated;
    });
  };

  const handleClearAllTransactions = async () => {
    if (activeProfile?.gstin && activeProfile?.periodMonth && activeProfile?.periodYear) {
      const key = getTxStorageKey(activeProfile.gstin, activeProfile.periodMonth, activeProfile.periodYear, 'MEESHO');
      if (key) {
        localStorage.removeItem(key);
      }
      try {
        await fetch('/api/meesho-import', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id || 'usr_default',
            gstin: activeProfile.gstin,
            periodMonth: activeProfile.periodMonth,
            periodYear: activeProfile.periodYear,
            marketplace: 'MEESHO'
          })
        });
      } catch (e) {
        console.error('Error clearing backend import:', e);
      }
    }
    setTransactions([]);
  };

  const handleUpdateTransaction = (updatedTx: MeeshoTransaction) => {
    setTransactions((prev) => {
      const updated = prev.map((t) => (t.id === updatedTx.id ? updatedTx : t));
      if (activeProfile?.gstin && activeProfile?.periodMonth && activeProfile?.periodYear) {
        const key = getTxStorageKey(activeProfile.gstin, activeProfile.periodMonth, activeProfile.periodYear, 'MEESHO');
        if (key) {
          try {
            localStorage.setItem(key, JSON.stringify(updated));
          } catch (e) {
            console.error(e);
          }
        }
      }
      return updated;
    });
  };

  const handleAddManualTransaction = (tx: MeeshoTransaction) => {
    setTransactions((prev) => {
      const updated = [tx, ...prev];
      if (activeProfile?.gstin && activeProfile?.periodMonth && activeProfile?.periodYear) {
        const key = getTxStorageKey(activeProfile.gstin, activeProfile.periodMonth, activeProfile.periodYear, 'MEESHO');
        if (key) {
          try {
            localStorage.setItem(key, JSON.stringify(updated));
          } catch (e) {
            console.error(e);
          }
        }
      }
      return updated;
    });
  };

  const handleSaveProfile = (profileToSave: GSTINProfile) => {
    setProfiles((prev) => {
      const exists = prev.some((p) => p.id === profileToSave.id || p.gstin === profileToSave.gstin);
      let updatedList: GSTINProfile[];
      if (exists) {
        updatedList = prev.map((p) =>
          p.id === profileToSave.id || p.gstin === profileToSave.gstin
            ? { ...profileToSave, isActive: true }
            : { ...p, isActive: false }
        );
      } else {
        updatedList = [
          { ...profileToSave, isActive: true },
          ...prev.map((p) => ({ ...p, isActive: false }))
        ];
      }
      try {
        localStorage.setItem('gstin_profiles', JSON.stringify(updatedList));
        localStorage.setItem('active_gstin_id', profileToSave.id);
      } catch (e) {
        console.error(e);
      }
      return updatedList;
    });
    setActiveProfile({ ...profileToSave, isActive: true });
  };

  const handleSelectProfile = (prof: GSTINProfile) => {
    setProfiles((prev) => {
      const updated = prev.map((p) => ({
        ...p,
        isActive: p.id === prof.id,
        lastUsedDate: p.id === prof.id ? new Date().toLocaleDateString('en-GB').replace(/\//g, '-') : p.lastUsedDate
      }));
      try {
        localStorage.setItem('gstin_profiles', JSON.stringify(updated));
        localStorage.setItem('active_gstin_id', prof.id);
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    setActiveProfile({ ...prof, isActive: true, lastUsedDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-') });
  };

  // Calculate dynamic high-density KPIs
  const grossSales = transactions
    .filter(t => t.type === 'Sales')
    .reduce((acc, t) => acc + t.grossAmount, 0);

  const totalGstLiability = transactions
    .filter(t => t.type === 'Sales')
    .reduce((acc, t) => acc + t.igstAmount + t.cgstAmount + t.sgstAmount, 0);

  const totalReturnsValue = transactions
    .filter(t => t.type === 'Return')
    .reduce((acc, t) => acc + t.grossAmount, 0);

  const totalTcsClaimable = transactions.reduce((acc, t) => {
    const net = t.type === 'Sales' ? (t.tcsIgst + t.tcsCgst + t.tcsSgst) : -(t.tcsIgst + t.tcsCgst + t.tcsSgst);
    return acc + net;
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col">
      {/* Auth Modal if user is logged out */}
      {!user && <AuthModal onLoginSuccess={(u) => setUser(u)} />}

      {/* Top Header */}
      <Navbar
        activeProfile={activeProfile}
        activeTab={activeTab}
        user={user}
        onLogout={() => setUser(null)}
        onSelectProfileClick={() => setActiveTab('profile')}
      />

      {/* High Density Main Content Layout */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-6">
        
        {/* Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          importedCount={transactions.length}
        />

        {/* Central Work Area */}
        <main className="flex-1 flex flex-col space-y-6 min-w-0">
          
          {/* High Density Summary KPI Cards Header Banner (Only when active profile and transactions exist) */}
          {activeProfile && transactions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Gross Sales ({activeProfile ? `${activeProfile.periodMonth} ${activeProfile.periodYear}` : 'No Period'})
                </span>
                <div className="text-xl md:text-2xl font-extrabold text-slate-900 mt-2 font-mono">
                  ₹{grossSales.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 font-medium">
                  {transactions.filter(t => t.type === 'Sales').length} Outward Sales
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider">
                  Returns Deducted
                </span>
                <div className="text-xl md:text-2xl font-extrabold text-rose-600 mt-2 font-mono">
                  ₹{totalReturnsValue.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 font-medium">
                  {transactions.filter(t => t.type === 'Return').length} Credit Notes
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">
                  GST Tax Liability
                </span>
                <div className="text-xl md:text-2xl font-extrabold text-blue-700 mt-2 font-mono">
                  ₹{totalGstLiability.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-blue-500 mt-1 font-medium">
                  IGST + CGST + SGST
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider">
                  TCS Claimable (1%)
                </span>
                <div className="text-xl md:text-2xl font-extrabold text-purple-700 mt-2 font-mono">
                  ₹{totalTcsClaimable.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-purple-500 mt-1 font-medium">
                  Cash Ledger Credit
                </span>
              </div>
            </div>
          )}

          {/* Active Tab Component */}
          <div className="flex-1">
            {activeTab === 'profile' && (
              <GSTProfile
                profiles={profiles}
                activeProfile={activeProfile}
                onSelectProfile={handleSelectProfile}
                onSaveProfile={handleSaveProfile}
                onOpenHelpGuide={() => setIsHelpGuideOpen(true)}
              />
            )}

            {activeTab === 'import' && (
              <ImportData
                importedCount={transactions.length}
                periodMonth={activeProfile ? activeProfile.periodMonth : ''}
                periodYear={activeProfile ? activeProfile.periodYear : ''}
                sellerStateCode={activeProfile ? activeProfile.stateCode : ''}
                gstin={activeProfile ? activeProfile.gstin : ''}
                userId={user ? user.id : 'usr_default'}
                onDataImported={handleDataImported}
                onDeleteMeeshoImport={handleDeleteMeeshoImport}
                onGoToManageData={() => setActiveTab('manage')}
              />
            )}

            {activeTab === 'manage' && (
              <ManageData
                transactions={transactions}
                onDeleteTransaction={handleDeleteTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                onClearAll={handleClearAllTransactions}
                onAddManualTransaction={handleAddManualTransaction}
                periodMonth={activeProfile ? activeProfile.periodMonth : ''}
                periodYear={activeProfile ? activeProfile.periodYear : ''}
                gstin={activeProfile ? activeProfile.gstin : ''}
                sellerStateCode={activeProfile ? activeProfile.stateCode : '07'}
                onGoToImport={() => setActiveTab('import')}
              />
            )}

            {activeTab === 'reconcile' && (
              <TCSReconcile
                transactions={transactions}
                periodMonth={activeProfile ? activeProfile.periodMonth : ''}
                periodYear={activeProfile ? activeProfile.periodYear : ''}
                gstin={activeProfile ? activeProfile.gstin : ''}
                onGoToGSTR1={() => setActiveTab('gstr1')}
                onGoToImport={() => setActiveTab('import')}
              />
            )}

            {activeTab === 'gstr1' && (
              <GSTR1Report
                transactions={transactions}
                gstin={activeProfile ? activeProfile.gstin : ''}
                periodMonth={activeProfile ? activeProfile.periodMonth : ''}
                periodYear={activeProfile ? activeProfile.periodYear : ''}
                onGoToImport={() => setActiveTab('import')}
              />
            )}
          </div>

          {/* Footer Status Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center space-x-3 text-slate-600">
              <span className="flex items-center text-xs font-semibold text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2"></span>
                Meesho GST Engine Connected
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 font-mono text-[11px]">
                GSTIN: {activeProfile?.gstin || 'No GSTIN selected'}
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsHelpGuideOpen(true)}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                View Filing Guide
              </button>
              <button
                onClick={() => setActiveTab('gstr1')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-all"
              >
                Generate Final GSTR-1
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Help & Guide Modal */}
      <HelpGuide
        isOpen={isHelpGuideOpen}
        onClose={() => setIsHelpGuideOpen(false)}
      />
    </div>
  );
}
