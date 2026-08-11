import React, { useState, useEffect } from 'react';
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
import { authFetch, removeStoredSessionId } from './utils/api';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [profiles, setProfiles] = useState<GSTINProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<GSTINProfile | null>(null);
  const [activeTab, setActiveTab] = useState<string>('import');
  const [transactions, setTransactions] = useState<MeeshoTransaction[]>([]);
  const [isHelpGuideOpen, setIsHelpGuideOpen] = useState<boolean>(false);

  // 1. Check existing authenticated session on startup
  useEffect(() => {
    let isMounted = true;
    authFetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        if (isMounted) setUser(null);
      })
      .finally(() => {
        if (isMounted) setIsAuthChecking(false);
      });

    return () => { isMounted = false; };
  }, []);

  // 2. Load user profiles from DB when authenticated
  useEffect(() => {
    if (!user) {
      setProfiles([]);
      setActiveProfile(null);
      setTransactions([]);
      return;
    }

    let isMounted = true;

    const loadUserData = async () => {
      try {
        const res = await authFetch('/api/profiles');
        const data = await res.json();
        if (!isMounted) return;

        if (data.success && Array.isArray(data.profiles) && data.profiles.length > 0) {
          const fetchedProfiles: GSTINProfile[] = data.profiles;
          setProfiles(fetchedProfiles);
          const active = fetchedProfiles.find((p) => p.isActive) || fetchedProfiles[0];
          setActiveProfile(active);
        } else {
          // If the authenticated user has no GST profiles, keep state clean (0 profiles)
          setProfiles([]);
          setActiveProfile(null);
        }
      } catch (err) {
        console.error('Failed loading seller profiles from database:', err);
        if (isMounted) {
          setProfiles([]);
          setActiveProfile(null);
        }
      }
    };

    loadUserData();

    return () => { isMounted = false; };
  }, [user?.id]);

  // 4. Load transactions for activeProfile from DB (Source of Truth)
  useEffect(() => {
    if (!user || !activeProfile?.gstin || !activeProfile?.periodMonth || !activeProfile?.periodYear) {
      setTransactions([]);
      return;
    }

    let isMounted = true;
    const query = new URLSearchParams({
      gstin: activeProfile.gstin,
      periodMonth: activeProfile.periodMonth,
      periodYear: activeProfile.periodYear
    });

    authFetch(`/api/transactions?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
        } else {
          setTransactions([]);
        }
      })
      .catch((err) => {
        console.error('Failed fetching transactions from database:', err);
        if (isMounted) setTransactions([]);
      });

    return () => { isMounted = false; };
  }, [user?.id, activeProfile?.gstin, activeProfile?.periodMonth, activeProfile?.periodYear]);

  // Handle imported transactions
  const handleDataImported = async (imported: MeeshoTransaction[]) => {
    setTransactions(imported);

    let targetProfile = activeProfile;

    // If no active profile exists, auto-create a default active profile for the logged in user
    if (!targetProfile) {
      targetProfile = {
        id: `gstin_${Date.now()}`,
        gstin: '07AARCM9332R1CQ',
        tradeName: user?.businessName || user?.name || 'Zenith Traders',
        partyName: user?.name,
        returnType: 'Monthly',
        periodMonth: 'July',
        periodYear: '2026',
        isActive: true,
        addedDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        lastUsedDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        stateCode: '07',
        stateName: 'Delhi'
      };
      setProfiles([targetProfile]);
      setActiveProfile(targetProfile);

      try {
        await authFetch('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile: targetProfile }),
        });
      } catch (e) {
        console.error('Failed auto-creating profile for import:', e);
      }
    }

    try {
      await authFetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gstin: targetProfile.gstin,
          periodMonth: targetProfile.periodMonth,
          periodYear: targetProfile.periodYear,
          marketplace: 'MEESHO',
          transactions: imported,
          overwrite: true
        })
      });
    } catch (e) {
      console.error('Failed saving transactions to database:', e);
    }
  };

  // Handle delete import session
  const handleDeleteMeeshoImport = async (): Promise<boolean> => {
    if (!activeProfile?.gstin || !activeProfile?.periodMonth || !activeProfile?.periodYear) {
      return false;
    }

    try {
      const response = await authFetch('/api/meesho-import', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gstin: activeProfile.gstin,
          periodMonth: activeProfile.periodMonth,
          periodYear: activeProfile.periodYear,
          marketplace: 'MEESHO'
        })
      });

      if (!response.ok) return false;

      const resData = await response.json();
      if (resData.success) {
        setTransactions([]);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to delete Meesho import session:', e);
      return false;
    }
  };

  // Delete single transaction
  const handleDeleteTransaction = async (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    try {
      await authFetch('/api/transactions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch (e) {
      console.error('Failed to delete transaction from DB:', e);
    }
  };

  // Clear all transactions for session
  const handleClearAllTransactions = async () => {
    setTransactions([]);
    if (!activeProfile?.gstin || !activeProfile?.periodMonth || !activeProfile?.periodYear) return;

    try {
      await authFetch('/api/transactions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gstin: activeProfile.gstin,
          periodMonth: activeProfile.periodMonth,
          periodYear: activeProfile.periodYear
        })
      });
    } catch (e) {
      console.error('Error clearing backend transactions:', e);
    }
  };

  // Update single transaction
  const handleUpdateTransaction = async (updatedTx: MeeshoTransaction) => {
    setTransactions((prev) => prev.map((t) => (t.id === updatedTx.id ? updatedTx : t)));
    if (!activeProfile?.gstin || !activeProfile?.periodMonth || !activeProfile?.periodYear) return;

    try {
      await authFetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gstin: activeProfile.gstin,
          periodMonth: activeProfile.periodMonth,
          periodYear: activeProfile.periodYear,
          marketplace: 'MEESHO',
          transactions: [updatedTx],
          overwrite: false
        })
      });
    } catch (e) {
      console.error('Failed to update transaction in DB:', e);
    }
  };

  // Add manual transaction
  const handleAddManualTransaction = async (tx: MeeshoTransaction) => {
    setTransactions((prev) => [tx, ...prev]);
    if (!activeProfile?.gstin || !activeProfile?.periodMonth || !activeProfile?.periodYear) return;

    try {
      await authFetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gstin: activeProfile.gstin,
          periodMonth: activeProfile.periodMonth,
          periodYear: activeProfile.periodYear,
          marketplace: 'MEESHO',
          transactions: [tx],
          overwrite: false
        })
      });
    } catch (e) {
      console.error('Failed to add manual transaction in DB:', e);
    }
  };

  // Save profile
  const handleSaveProfile = async (profileToSave: GSTINProfile) => {
    const updatedProfile = { ...profileToSave, isActive: true };
    setProfiles((prev) => {
      const exists = prev.some((p) => p.id === profileToSave.id || p.gstin === profileToSave.gstin);
      if (exists) {
        return prev.map((p) =>
          p.id === profileToSave.id || p.gstin === profileToSave.gstin
            ? updatedProfile
            : { ...p, isActive: false }
        );
      }
      return [updatedProfile, ...prev.map((p) => ({ ...p, isActive: false }))];
    });
    setActiveProfile(updatedProfile);

    try {
      await authFetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: updatedProfile }),
      });

      // If transactions exist in memory, save them to DB for this profile
      if (transactions.length > 0) {
        await authFetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gstin: updatedProfile.gstin,
            periodMonth: updatedProfile.periodMonth,
            periodYear: updatedProfile.periodYear,
            marketplace: 'MEESHO',
            transactions: transactions,
            overwrite: true
          })
        });
      }
    } catch (e) {
      console.error('Failed to save profile in DB:', e);
    }
  };

  // Select profile
  const handleSelectProfile = async (prof: GSTINProfile) => {
    const updatedProf = {
      ...prof,
      isActive: true,
      lastUsedDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-')
    };

    setProfiles((prev) =>
      prev.map((p) => ({
        ...p,
        isActive: p.id === prof.id,
        lastUsedDate: p.id === prof.id ? updatedProf.lastUsedDate : p.lastUsedDate
      }))
    );
    setActiveProfile(updatedProf);

    try {
      await authFetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: updatedProf }),
      });
    } catch (e) {
      console.error('Failed to select profile in DB:', e);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    }
    removeStoredSessionId();
    setUser(null);
    setProfiles([]);
    setActiveProfile(null);
    setTransactions([]);
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-slate-300">Connecting to GST Database Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col">
      {/* Auth Modal if user is logged out */}
      {!user && <AuthModal onLoginSuccess={(u) => setUser(u)} />}

      {/* Top Header */}
      <Navbar
        activeProfile={activeProfile}
        activeTab={activeTab}
        user={user}
        onLogout={handleLogout}
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
                Neon PostgreSQL Database Active
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
