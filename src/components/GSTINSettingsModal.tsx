import React, { useState, useEffect } from 'react';
import { GSTINProfile } from '../types';
import { Settings, X, Check } from 'lucide-react';

interface GSTINSettingsModalProps {
  isOpen: boolean;
  profile: GSTINProfile | null;
  onClose: () => void;
  onSavePartyName: (profileId: string, partyName: string) => void;
}

export const GSTINSettingsModal: React.FC<GSTINSettingsModalProps> = ({
  isOpen,
  profile,
  onClose,
  onSavePartyName
}) => {
  const [partyName, setPartyName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile && isOpen) {
      setPartyName(profile.partyName || '');
      setSuccessMsg(null);
      setIsSaving(false);
    }
  }, [profile, isOpen]);

  if (!isOpen || !profile) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const trimmed = partyName.trim().slice(0, 32);

    setTimeout(() => {
      onSavePartyName(profile.id, trimmed);
      setIsSaving(false);
      setSuccessMsg('Name saved successfully.');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 400);
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-md overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">GSTIN settings</h3>
              <p className="text-xs text-slate-500 mt-0.5">Give this GSTIN a name you'll recognise</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-emerald-50 border-b border-emerald-100 p-3 px-5 text-xs font-bold text-emerald-800 flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* GSTIN Field (Read-only) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              GSTIN
            </label>
            <input
              type="text"
              value={profile.gstin}
              readOnly
              className="w-full px-3.5 py-2.5 bg-slate-100 text-sm font-mono font-bold text-slate-700 border border-slate-200 rounded-xl cursor-not-allowed select-all"
            />
          </div>

          {/* PARTY NAME Field */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              PARTY NAME
            </label>
            <input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value.slice(0, 32))}
              placeholder="Enter party name"
              maxLength={32}
              disabled={isSaving}
              className="w-full px-3.5 py-2.5 bg-white text-sm font-semibold text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Shown instead of the GSTIN in your saved list. Max 32 characters.
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save name'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
