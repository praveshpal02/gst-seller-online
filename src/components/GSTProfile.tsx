import React, { useState, useEffect } from 'react';
import { GSTINProfile } from '../types';
import { CheckCircle2, FileText, Settings, Plus, Building2, AlertCircle } from 'lucide-react';
import { GSTINSettingsModal } from './GSTINSettingsModal';

interface GSTProfileProps {
  profiles: GSTINProfile[];
  activeProfile: GSTINProfile | null;
  onSelectProfile: (profile: GSTINProfile) => void;
  onSaveProfile: (profile: GSTINProfile) => void;
  onOpenHelpGuide: () => void;
}

function getStateName(code: string): string {
  const stateMap: Record<string, string> = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
    '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
    '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
    '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
    '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '28': 'Andhra Pradesh',
    '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
    '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana',
    '37': 'Andhra Pradesh (New)', '38': 'Ladakh'
  };
  return stateMap[code] || `State (${code})`;
}

export const GSTProfile: React.FC<GSTProfileProps> = ({
  profiles,
  activeProfile,
  onSelectProfile,
  onSaveProfile,
  onOpenHelpGuide
}) => {
  const [gstinInput, setGstinInput] = useState('');
  const [tradeNameInput, setTradeNameInput] = useState('');
  const [returnType, setReturnType] = useState<'Monthly' | 'Quarterly'>('Monthly');
  const [periodMonth, setPeriodMonth] = useState('July');
  const [periodYear, setPeriodYear] = useState('2026');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Settings modal for Party Name
  const [settingsModalProfile, setSettingsModalProfile] = useState<GSTINProfile | null>(null);

  // Form visibility state when no profile exists
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (activeProfile && !editingProfileId) {
      setGstinInput(activeProfile.gstin);
      setTradeNameInput(activeProfile.tradeName || '');
      setReturnType(activeProfile.returnType || 'Monthly');
      setPeriodMonth(activeProfile.periodMonth || 'July');
      setPeriodYear(activeProfile.periodYear || '2026');
    }
  }, [activeProfile]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleEditClick = (prof: GSTINProfile) => {
    setEditingProfileId(prof.id);
    setGstinInput(prof.gstin);
    setTradeNameInput(prof.tradeName);
    setReturnType(prof.returnType);
    setPeriodMonth(prof.periodMonth);
    setPeriodYear(prof.periodYear);
    setValidationError(null);
  };

  const handleResetForm = () => {
    setEditingProfileId(null);
    setGstinInput('');
    setTradeNameInput('');
    setReturnType('Monthly');
    setPeriodMonth('July');
    setPeriodYear('2026');
    setValidationError(null);
  };

  const handleSavePartyName = (profileId: string, partyName: string) => {
    const target = profiles.find((p) => p.id === profileId);
    if (target) {
      const updated: GSTINProfile = { ...target, partyName };
      onSaveProfile(updated);
    }
  };

  const handleSubmitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedGstin = gstinInput.trim().toUpperCase();
    const trimmedTradeName = tradeNameInput.trim();

    // 1. Business / Trade Name Validation
    if (!trimmedTradeName) {
      setValidationError('Business / Trade Name is required.');
      return;
    }

    // 2. GSTIN Validation
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!trimmedGstin || trimmedGstin.length !== 15 || !gstinRegex.test(trimmedGstin)) {
      setValidationError('Invalid GSTIN. Please enter a valid 15-character GSTIN.');
      return;
    }

    const stateCode = trimmedGstin.substring(0, 2);
    const stateName = getStateName(stateCode);

    // Find existing profile if editing or re-adding
    const existing = profiles.find(p => p.id === editingProfileId || p.gstin === trimmedGstin);

    const profileToSave: GSTINProfile = {
      id: existing ? existing.id : `gstin_${Date.now()}`,
      gstin: trimmedGstin,
      tradeName: trimmedTradeName,
      partyName: existing ? existing.partyName : undefined,
      returnType,
      periodMonth,
      periodYear,
      isActive: true,
      addedDate: existing ? existing.addedDate : new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      lastUsedDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      stateCode,
      stateName
    };

    onSaveProfile(profileToSave);
    setEditingProfileId(null);
  };

  const currentSlotsInUse = profiles.length;
  const maxSlots = 20;

  if (profiles.length === 0 && !showAddForm && !editingProfileId) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 text-center shadow-xs flex flex-col items-center justify-center space-y-4">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100">
            <Building2 className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">GST Profile</h2>
            <p className="text-sm font-bold text-slate-700 mt-2">No GST profile added yet.</p>
            <p className="text-xs text-slate-500">Add your GSTIN and business/party name to get started.</p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add GSTIN</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. GST Profile Selection Form */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">GST profile</h2>
            <p className="text-xs text-slate-500 mt-0.5">Choose the GSTIN and the return period you want to work on</p>
          </div>
          {activeProfile ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              GSTIN selected: {activeProfile.gstin}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/60">
              No GSTIN selected
            </span>
          )}
        </div>

        <form onSubmit={handleSubmitProfile} className="bg-slate-50/70 border border-slate-200/70 rounded-2xl p-5 space-y-4">
          
          {/* Validation Alert */}
          {validationError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* GST NUMBER Input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                GST NUMBER <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={gstinInput}
                  onChange={(e) => {
                    setGstinInput(e.target.value.toUpperCase());
                    setValidationError(null);
                  }}
                  placeholder="Enter GSTIN (e.g. 07RAZPK0261B1ZC)"
                  maxLength={15}
                  className="w-full pl-10 pr-4 py-2.5 bg-white text-sm font-mono font-semibold text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* BUSINESS / TRADE NAME Input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                BUSINESS / TRADE NAME <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={tradeNameInput}
                onChange={(e) => {
                  setTradeNameInput(e.target.value);
                  setValidationError(null);
                }}
                placeholder="Enter business / trade name"
                className="w-full px-4 py-2.5 bg-white text-sm font-semibold text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end pt-2">
            {/* RETURN TYPE Toggle */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                RETURN TYPE
              </label>
              <div className="grid grid-cols-2 gap-1 bg-slate-200/60 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setReturnType('Monthly')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    returnType === 'Monthly'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setReturnType('Quarterly')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    returnType === 'Quarterly'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Quarterly
                </button>
              </div>
            </div>

            {/* PERIOD Month Dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                PERIOD
              </label>
              <select
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white text-xs font-semibold text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {months.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* YEAR Dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                YEAR
              </label>
              <select
                value={periodYear}
                onChange={(e) => setPeriodYear(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white text-xs font-semibold text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="2026">2026 (Return Year)</option>
                <option value="2025">2025 (Return Year)</option>
                <option value="2024">2024 (Return Year)</option>
              </select>
            </div>

            {/* Submit GSTIN Action Button */}
            <div>
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{editingProfileId ? 'Update GST Profile' : 'Select GSTIN'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {editingProfileId && (
              <button
                type="button"
                onClick={handleResetForm}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 underline"
              >
                Cancel Editing
              </button>
            )}

            <button
              type="button"
              onClick={onOpenHelpGuide}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors ml-auto"
            >
              <span>Need Help ? Read the Guide</span>
              <FileText className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* 2. Saved GSTINs Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Saved GSTINs</h3>
            <p className="text-xs text-slate-500 mt-0.5">Pick a saved GSTIN to set it as active profile</p>
          </div>

          {/* Slot Progress Bar */}
          <div className="w-full sm:w-48 bg-slate-50 p-2.5 border border-slate-200/60 rounded-xl text-[11px]">
            <div className="flex justify-between font-bold text-slate-700 mb-1">
              <span>{currentSlotsInUse}/{maxSlots} slots</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all"
                style={{ width: `${(currentSlotsInUse / maxSlots) * 100}%` }}
              ></div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {currentSlotsInUse} in use · {maxSlots - currentSlotsInUse} available
            </div>
          </div>
        </div>

        {/* GSTIN Cards Grid */}
        {profiles.length === 0 ? (
          <div className="py-8 text-center text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl">
            <p className="text-sm font-bold text-slate-700">No GST profiles added yet.</p>
            <p className="text-xs text-slate-400 mt-1">Fill out the form above to add your first GST profile.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profiles.map((prof) => {
              const isSelected = activeProfile?.id === prof.id;
              const hasPartyName = Boolean(prof.partyName && prof.partyName.trim());
              const cardPrimaryTitle = hasPartyName ? prof.partyName!.trim() : (prof.tradeName || prof.gstin);

              return (
                <div
                  key={prof.id}
                  className={`rounded-2xl p-5 border transition-all ${
                    isSelected
                      ? 'border-2 border-blue-600 bg-blue-50/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-slate-900 text-sm truncate pr-2">
                      {cardPrimaryTitle}
                    </h4>
                    {isSelected && (
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider shrink-0">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="font-mono font-bold text-slate-700 text-xs mb-1">
                    {prof.gstin} {hasPartyName && prof.tradeName ? `(${prof.tradeName})` : ''}
                  </div>

                  <div className="text-[11px] text-slate-500 mb-4">
                    Added: {prof.addedDate}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectProfile(prof)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isSelected ? 'Selected' : 'Select'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettingsModalProfile(prof)}
                      className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                      title="GSTIN settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add New GSTIN Card Slot */}
            <div
              onClick={handleResetForm}
              className="rounded-2xl p-5 border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20 cursor-pointer transition-all flex flex-col items-center justify-center text-center min-h-[130px]"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-800">Add Another GSTIN</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Connect multiple GST accounts</span>
            </div>
          </div>
        )}
      </div>

      {/* GSTIN Settings / Party Name Modal */}
      <GSTINSettingsModal
        isOpen={!!settingsModalProfile}
        profile={settingsModalProfile}
        onClose={() => setSettingsModalProfile(null)}
        onSavePartyName={handleSavePartyName}
      />
    </div>
  );
};

