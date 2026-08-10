import React, { useState } from 'react';
import { Search, AlertTriangle, Upload, CheckCircle2, ShoppingBag, ArrowRight, Trash2, Loader2 } from 'lucide-react';
import { PlatformItem, MeeshoTransaction } from '../types';
import { MeeshoImportModal } from './gst-online-seller/import/meesho/MeeshoImportModal';

interface ImportDataProps {
  importedCount: number;
  periodMonth: string;
  periodYear: string;
  sellerStateCode: string;
  gstin?: string;
  userId?: string;
  onDataImported: (transactions: MeeshoTransaction[]) => void;
  onDeleteMeeshoImport?: () => Promise<boolean> | void;
  onGoToManageData: () => void;
}

export const ImportData: React.FC<ImportDataProps> = ({
  importedCount,
  periodMonth,
  periodYear,
  sellerStateCode,
  gstin = '',
  userId = 'usr_default',
  onDataImported,
  onDeleteMeeshoImport,
  onGoToManageData
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Imported' | 'Pending'>('All');
  const [isMeeshoModalOpen, setIsMeeshoModalOpen] = useState(false);
  const [selectedPlatformForDemo, setSelectedPlatformForDemo] = useState<string | null>(null);

  // Delete modal state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (!onDeleteMeeshoImport) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const success = await onDeleteMeeshoImport();
      if (success !== false) {
        setIsDeleteConfirmOpen(false);
      } else {
        setDeleteError('Unable to delete Meesho data. Please try again.');
      }
    } catch (err) {
      setDeleteError('Unable to delete Meesho data. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const platforms: PlatformItem[] = [
    {
      id: 'meesho',
      name: 'Meesho',
      logo: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=100&auto=format&fit=crop&q=80',
      badge: 'B2C',
      domain: 'meesho.com',
      isAvailable: true,
      importedCount: importedCount
    },
    {
      id: 'amazon',
      name: 'Amazon',
      logo: 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=100&auto=format&fit=crop&q=80',
      badge: 'B2C',
      domain: 'amazon.in',
      isAvailable: true
    },
    {
      id: 'amazon_b2b',
      name: 'Amazon B2B',
      logo: 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=100&auto=format&fit=crop&q=80',
      badge: 'B2B',
      domain: 'amazon.in/b2b',
      isAvailable: true
    },
    {
      id: 'flipkart',
      name: 'Flipkart',
      logo: 'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=100&auto=format&fit=crop&q=80',
      badge: 'B2C / B2B',
      domain: 'seller.flipkart.com',
      isAvailable: true
    },
    {
      id: 'myntra',
      name: 'Myntra',
      logo: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=100&auto=format&fit=crop&q=80',
      badge: 'B2C',
      domain: 'myntra.com',
      isAvailable: true
    },
    {
      id: 'snapdeal',
      name: 'Snapdeal',
      logo: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=100&auto=format&fit=crop&q=80',
      badge: 'B2C',
      domain: 'snapdeal.com',
      isAvailable: true
    },
    {
      id: 'glowroad',
      name: 'Glowroad',
      logo: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=100&auto=format&fit=crop&q=80',
      badge: 'B2C',
      domain: 'glowroad.com',
      isAvailable: true
    },
    {
      id: 'limeroad',
      name: 'Limeroad',
      logo: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=100&auto=format&fit=crop&q=80',
      badge: 'B2C',
      domain: 'limeroad.com',
      isAvailable: true
    }
  ];

  const filteredPlatforms = platforms.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterType === 'Imported') return (p.importedCount || 0) > 0;
    if (filterType === 'Pending') return (p.importedCount || 0) === 0;
    return true;
  });

  const handlePlatformClick = (platformId: string) => {
    if (platformId === 'meesho') {
      setIsMeeshoModalOpen(true);
    } else {
      // For other platforms, also prompt Meesho or open quick notice
      setIsMeeshoModalOpen(true);
      setSelectedPlatformForDemo(platformId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Main Import Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        
        {/* Header Title + Stats Pill */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Import platform data</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload each marketplace's report, then review and generate GSTR-1
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-50 p-2 border border-slate-200/70 rounded-xl text-center">
            <div className="px-3 py-1 border-r border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400">Imported</div>
              <div className="text-sm font-extrabold text-emerald-600">{importedCount}</div>
            </div>
            <div className="px-3 py-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Period</div>
              <div className="text-xs font-bold text-slate-800">{periodMonth.substring(0, 3)} {periodYear}</div>
            </div>
          </div>
        </div>

        {/* Controls: Search & Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a platform..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {(['All', 'Imported', 'Pending'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterType === type
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Warning Banner matching Screenshot 1 */}
        <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-800 text-xs font-semibold flex items-center space-x-2 mb-6">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Avoid importing an edited file to prevent errors. Upload original reports from Seller Panels.</span>
        </div>

        {/* Imported Banner Alert if data exists */}
        {importedCount > 0 && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{importedCount} transactions currently loaded for {periodMonth} {periodYear}.</span>
            </div>
            <button
              onClick={onGoToManageData}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all flex items-center space-x-1"
            >
              <span>Manage & View Data</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* FAMOUS PLATFORMS Divider */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200/80"></div>
          </div>
          <span className="relative px-4 bg-white text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            FAMOUS PLATFORMS
          </span>
        </div>

        {/* Platforms Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPlatforms.map((plat) => {
            const isMeesho = plat.id === 'meesho';
            const hasData = (plat.importedCount || 0) > 0;

            return (
              <div
                key={plat.id}
                className={`rounded-2xl p-5 border text-center transition-all bg-white relative flex flex-col items-center justify-between min-h-[220px] ${
                  isMeesho
                    ? 'border-2 border-blue-500/80 shadow-md ring-2 ring-blue-500/10'
                    : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
                }`}
              >
                {/* Platform Badge */}
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                    {plat.badge}
                  </span>
                  {hasData && (
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ✓ Imported ({plat.importedCount})
                    </span>
                  )}
                </div>

                {/* Platform Logo / Icon */}
                <div className="my-2">
                  {isMeesho ? (
                    <div className="w-14 h-14 rounded-2xl bg-pink-600 flex items-center justify-center text-white font-black text-2xl shadow-md">
                      m
                    </div>
                  ) : plat.id.includes('amazon') ? (
                    <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center text-slate-900 font-black text-2xl shadow-md">
                      a
                    </div>
                  ) : plat.id === 'flipkart' ? (
                    <div className="w-14 h-14 rounded-2xl bg-yellow-400 flex items-center justify-center text-blue-900 font-black text-2xl shadow-md">
                      fk
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-rose-500 flex items-center justify-center text-white font-black text-xl shadow-md">
                      {plat.name.substring(0, 2)}
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="mb-4">
                  <h3 className="font-bold text-base text-slate-900">{plat.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{plat.domain}</p>
                </div>

                {/* Import & Delete Action Buttons */}
                {isMeesho && hasData ? (
                  <div className="w-full flex items-center space-x-2">
                    <button
                      onClick={() => handlePlatformClick(plat.id)}
                      className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import data</span>
                    </button>
                    <button
                      onClick={() => {
                        setDeleteError(null);
                        setIsDeleteConfirmOpen(true);
                      }}
                      title="Delete imported data"
                      className="py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      <span>Delete</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handlePlatformClick(plat.id)}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import data</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Meesho Dedicated Upload Modal */}
      <MeeshoImportModal
        isOpen={isMeeshoModalOpen}
        onClose={() => setIsMeeshoModalOpen(false)}
        gstin={gstin}
        periodMonth={periodMonth}
        periodYear={periodYear}
        sellerStateCode={sellerStateCode}
        userId={userId}
        onDataImported={onDataImported}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center space-x-3 text-red-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Meesho data?</h3>
                <p className="text-xs text-slate-500">Action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Are you sure you want to delete the imported Meesho data for{' '}
              <span className="font-bold text-slate-900">{periodMonth} {periodYear}</span>?
              This will remove the imported data for this period.
            </p>

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold mb-4 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
