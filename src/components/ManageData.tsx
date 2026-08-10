import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit,
  Eye,
  ArrowUpRight,
  ArrowDownLeft,
  Store,
  DollarSign,
  Receipt,
  Percent,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { MeeshoTransaction } from '../types';
import { calculateManageDataSummary } from '../utils/excelParser';
import { NoDataState } from './NoDataState';

interface ManageDataProps {
  transactions: MeeshoTransaction[];
  onDeleteTransaction: (id: string) => void;
  onUpdateTransaction: (tx: MeeshoTransaction) => void;
  onClearAll: () => void;
  onAddManualTransaction: (tx: MeeshoTransaction) => void;
  periodMonth: string;
  periodYear: string;
  gstin?: string;
  sellerStateCode?: string;
  onGoToImport?: () => void;
}

export const ManageData: React.FC<ManageDataProps> = ({
  transactions,
  onDeleteTransaction,
  onUpdateTransaction,
  onClearAll,
  onAddManualTransaction,
  periodMonth,
  periodYear,
  gstin = '',
  sellerStateCode = '07',
  onGoToImport
}) => {
  // Search & Filter state
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Sales' | 'Return'>('All');
  const [filterState, setFilterState] = useState<string>('All');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);

  // Modals state
  const [editingTransaction, setEditingTransaction] = useState<MeeshoTransaction | null>(null);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // Manual Add Form State
  const [addOrderId, setAddOrderId] = useState('');
  const [addType, setAddType] = useState<'Sales' | 'Return'>('Sales');
  const [addPosStateName, setAddPosStateName] = useState('Maharashtra');
  const [addHsnCode, setAddHsnCode] = useState('6109');
  const [addTaxableValue, setAddTaxableValue] = useState('500');
  const [addGstRate, setAddGstRate] = useState('5');
  const [addInvoiceDate, setAddInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Edit Form State
  const [editFormData, setEditFormData] = useState<MeeshoTransaction | null>(null);

  // Dynamic Summary Calculations using dedicated calculation function
  const summary = useMemo(() => {
    return calculateManageDataSummary(transactions);
  }, [transactions]);

  // Dynamic States List for Dropdown
  const statesList = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      if (t.posStateName) set.add(t.posStateName);
    });
    return Array.from(set).sort();
  }, [transactions]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.orderId.toLowerCase().includes(q) ||
        (t.subOrderId && t.subOrderId.toLowerCase().includes(q)) ||
        (t.invoiceNumber && t.invoiceNumber.toLowerCase().includes(q)) ||
        t.posStateName.toLowerCase().includes(q) ||
        t.hsnCode.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (filterType !== 'All' && t.type !== filterType) return false;
      if (filterState !== 'All' && t.posStateName !== filterState) return false;

      return true;
    });
  }, [transactions, search, filterType, filterState]);

  // Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTransactions = useMemo(() => {
    const start = (validCurrentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, validCurrentPage, itemsPerPage]);

  // Format currency helpers
  const formatCurr = (val: number) =>
    `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Handlers
  const handleOpenEditModal = (tx: MeeshoTransaction) => {
    setEditingTransaction(tx);
    setEditFormData({ ...tx });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData) return;
    onUpdateTransaction(editFormData);
    setEditingTransaction(null);
    setEditFormData(null);
  };

  const handleConfirmDeleteSingle = () => {
    if (deletingTxId) {
      onDeleteTransaction(deletingTxId);
      setDeletingTxId(null);
    }
  };

  const handleConfirmClearAll = () => {
    onClearAll();
    setIsClearAllConfirmOpen(false);
  };

  const handleCreateManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addOrderId.trim()) return;

    const rate = Number(addGstRate) || 5;
    const taxVal = Number(addTaxableValue) || 0;
    const stateMap: Record<string, { code: string; name: string }> = {
      Maharashtra: { code: '27', name: 'Maharashtra' },
      Delhi: { code: '07', name: 'Delhi' },
      Karnataka: { code: '29', name: 'Karnataka' },
      Gujarat: { code: '24', name: 'Gujarat' },
      'Uttar Pradesh': { code: '09', name: 'Uttar Pradesh' },
      'Tamil Nadu': { code: '33', name: 'Tamil Nadu' },
      'West Bengal': { code: '19', name: 'West Bengal' }
    };

    const targetState = stateMap[addPosStateName] || { code: '27', name: addPosStateName };
    const isInter = targetState.code !== sellerStateCode;
    const totalTax = Math.round((taxVal * (rate / 100)) * 100) / 100;
    const tcsVal = Math.round((taxVal * 0.01) * 100) / 100;

    const newTx: MeeshoTransaction = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId: addOrderId.trim(),
      subOrderId: `${addOrderId.trim()}-1`,
      orderDate: addInvoiceDate,
      invoiceDate: addInvoiceDate,
      type: addType,
      posStateCode: targetState.code,
      posStateName: targetState.name,
      isInterState: isInter,
      hsnCode: addHsnCode.trim() || '6109',
      quantity: 1,
      grossAmount: Math.round((taxVal + totalTax) * 100) / 100,
      taxableValue: taxVal,
      gstRate: rate,
      igstAmount: isInter ? totalTax : 0,
      cgstAmount: !isInter ? Math.round((totalTax / 2) * 100) / 100 : 0,
      sgstAmount: !isInter ? Math.round((totalTax / 2) * 100) / 100 : 0,
      tcsIgst: isInter ? tcsVal : 0,
      tcsCgst: !isInter ? Math.round((tcsVal / 2) * 100) / 100 : 0,
      tcsSgst: !isInter ? Math.round((tcsVal / 2) * 100) / 100 : 0,
      totalTcs: tcsVal,
      sourceFile: 'Manual Entry',
      sourceRow: 'N/A'
    };

    onAddManualTransaction(newTx);
    setIsAddModalOpen(false);
    setAddOrderId('');
  };

  if (transactions.length === 0) {
    const activePeriodStr = periodMonth && periodYear ? `${periodMonth} ${periodYear}` : 'this period';
    return (
      <NoDataState
        title={`No data imported for ${activePeriodStr} yet`}
        description="Import your sales reports for this period to build the GSTR1."
        periodMonth={periodMonth}
        periodYear={periodYear}
        gstin={gstin}
        onImportClick={onGoToImport || (() => {})}
        badgeText="Imported Data"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Summary Cards Header */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Platforms */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs transition-all">
          <div className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Platforms</span>
            <Store className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
            {summary.platforms}
          </div>
          <div className="text-[10px] text-slate-500 font-semibold mt-1">
            Active Marketplace
          </div>
        </div>

        {/* Gross Sales */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs transition-all">
          <div className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Gross Sales</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 mt-2 truncate">
            {formatCurr(summary.grossSales)}
          </div>
          <div className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-0.5">
            <ArrowUpRight className="w-3 h-3 shrink-0" />
            <span>{summary.salesCount} Orders</span>
          </div>
        </div>

        {/* Returns */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs transition-all">
          <div className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Returns</span>
            <Receipt className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-lg sm:text-xl font-black text-rose-600 mt-2 truncate">
            {formatCurr(summary.returns)}
          </div>
          <div className="text-[10px] text-rose-500 font-bold mt-1 flex items-center gap-0.5">
            <ArrowDownLeft className="w-3 h-3 shrink-0" />
            <span>{summary.returnsCount} Returns</span>
          </div>
        </div>

        {/* Net Taxable Sales */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-blue-200/80 bg-blue-50/10 shadow-2xs transition-all">
          <div className="text-[10px] sm:text-[11px] font-extrabold text-blue-700 uppercase tracking-wider flex items-center justify-between">
            <span>Net Taxable</span>
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-lg sm:text-xl font-black text-blue-600 mt-2 truncate">
            {formatCurr(summary.netTaxableSales)}
          </div>
          <div className="text-[10px] text-blue-600/80 font-bold mt-1">
            Sales - Returns
          </div>
        </div>

        {/* GST Tax Liability */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs transition-all">
          <div className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>GST Tax</span>
            <Percent className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 mt-2 truncate">
            {formatCurr(summary.gstTaxLiability)}
          </div>
          <div className="text-[10px] text-slate-500 font-semibold mt-1">
            IGST + CGST + SGST
          </div>
        </div>

        {/* TCS Claimable */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs transition-all">
          <div className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>TCS Claimable</span>
            <Receipt className="w-3.5 h-3.5 text-teal-500" />
          </div>
          <div className="text-lg sm:text-xl font-black text-teal-700 mt-2 truncate">
            {formatCurr(summary.tcsClaimable)}
          </div>
          <div className="text-[10px] text-teal-600 font-semibold mt-1">
            Sec 52 TCS Collected
          </div>
        </div>
      </div>

      {/* 2. Main Transactions Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
        {/* Marketplace Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Manage Meesho Transactions</span>
              {transactions.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                  {transactions.length} records
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing parsed records for period <span className="font-semibold text-slate-800">{periodMonth} {periodYear}</span>
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Invoice</span>
            </button>

            {transactions.length > 0 && (
              <button
                onClick={() => setIsClearAllConfirmOpen(true)}
                className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-all flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. Search and Filters Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search Order ID, Invoice, State, or HSN..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sales / Return Toggle */}
            <div className="bg-slate-100 p-1 rounded-xl text-xs font-semibold flex">
              {(['All', 'Sales', 'Return'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setFilterType(t);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    filterType === t ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* State Filter Dropdown */}
            {statesList.length > 0 && (
              <select
                value={filterState}
                onChange={(e) => {
                  setFilterState(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px] truncate"
              >
                <option value="All">All States ({statesList.length})</option>
                {statesList.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            )}

            {/* Per Page Dropdown */}
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>

        {/* 4. Table / Empty State */}
        {transactions.length === 0 ? (
          <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 space-y-3">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-slate-800">No Meesho transactions found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No data has been imported for <span className="font-semibold">{periodMonth} {periodYear}</span> yet. Upload your Meesho Excel reports to view transactions.
              </p>
            </div>
            {onGoToImport && (
              <button
                onClick={onGoToImport}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors mt-2"
              >
                <FileText className="w-4 h-4" />
                <span>Import Meesho Data</span>
              </button>
            )}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-slate-200 space-y-2">
            <Search className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No records match your filters</p>
            <button
              onClick={() => {
                setSearch('');
                setFilterType('All');
                setFilterState('All');
              }}
              className="text-xs text-blue-600 font-semibold hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border border-slate-200/80 rounded-2xl shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Order ID / Invoice</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Place of Supply</th>
                    <th className="px-4 py-3">HSN</th>
                    <th className="px-4 py-3 text-right">Taxable Value</th>
                    <th className="px-4 py-3 text-center">GST Rate</th>
                    <th className="px-4 py-3 text-right">IGST</th>
                    <th className="px-4 py-3 text-right">CGST / SGST</th>
                    <th className="px-4 py-3 text-right">TCS</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {paginatedTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            tx.type === 'Sales'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-900">{tx.orderId}</div>
                        {tx.invoiceNumber && (
                          <div className="text-[10px] text-slate-400 font-mono">Inv: {tx.invoiceNumber}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {tx.invoiceDate || tx.orderDate}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{tx.posStateName}</div>
                        <div className="text-[10px] text-slate-400">Code: {tx.posStateCode}</div>
                      </td>
                      <td className="px-4 py-3 font-mono">{tx.hsnCode}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        ₹{(tx.taxableValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-blue-600">
                        {tx.gstRate}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {tx.igstAmount > 0
                          ? `₹${tx.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {tx.cgstAmount + tx.sgstAmount > 0
                          ? `₹${(tx.cgstAmount + tx.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-teal-700 font-semibold">
                        ₹{(tx.totalTcs || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleOpenEditModal(tx)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View / Edit Transaction"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingTxId(tx.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 text-xs text-slate-500">
              <div>
                Showing{' '}
                <span className="font-bold text-slate-800">
                  {(validCurrentPage - 1) * itemsPerPage + 1}
                </span>{' '}
                to{' '}
                <span className="font-bold text-slate-800">
                  {Math.min(validCurrentPage * itemsPerPage, filteredTransactions.length)}
                </span>{' '}
                of <span className="font-bold text-slate-800">{filteredTransactions.length}</span> records
              </div>

              {totalPages > 1 && (
                <div className="flex items-center space-x-1">
                  <button
                    disabled={validCurrentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = i + 1;
                      if (totalPages > 5 && validCurrentPage > 3) {
                        pageNum = validCurrentPage - 3 + i;
                        if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-7 h-7 rounded-lg font-bold text-xs ${
                            validCurrentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    disabled={validCurrentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 5. View / Edit Transaction Modal */}
      {editingTransaction && editFormData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">View / Edit Transaction</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {editingTransaction.id}</p>
              </div>
              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setEditFormData(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Traceability Info Banner */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between font-mono">
              <div>
                <span className="font-semibold text-slate-500">Source File:</span>{' '}
                <span className="font-bold text-slate-800">{editingTransaction.sourceFile || 'Uploaded File'}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Source Row:</span>{' '}
                <span className="font-bold text-slate-800">{editingTransaction.sourceRow ?? 'N/A'}</span>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Type</label>
                  <select
                    value={editFormData.type}
                    onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  >
                    <option value="Sales">Sales</option>
                    <option value="Return">Return</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Order ID</label>
                  <input
                    type="text"
                    required
                    value={editFormData.orderId}
                    onChange={(e) => setEditFormData({ ...editFormData, orderId: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={editFormData.invoiceNumber || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, invoiceNumber: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editFormData.invoiceDate || editFormData.orderDate}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        invoiceDate: e.target.value,
                        orderDate: e.target.value
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Place of Supply (State)</label>
                  <input
                    type="text"
                    required
                    value={editFormData.posStateName}
                    onChange={(e) => setEditFormData({ ...editFormData, posStateName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    required
                    value={editFormData.hsnCode}
                    onChange={(e) => setEditFormData({ ...editFormData, hsnCode: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Taxable Value (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editFormData.taxableValue}
                    onChange={(e) => setEditFormData({ ...editFormData, taxableValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">GST Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editFormData.gstRate}
                    onChange={(e) => setEditFormData({ ...editFormData, gstRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">IGST (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.igstAmount}
                    onChange={(e) => setEditFormData({ ...editFormData, igstAmount: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">CGST (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.cgstAmount}
                    onChange={(e) => setEditFormData({ ...editFormData, cgstAmount: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">SGST (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.sgstAmount}
                    onChange={(e) => setEditFormData({ ...editFormData, sgstAmount: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">TCS Total (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editFormData.totalTcs}
                  onChange={(e) => setEditFormData({ ...editFormData, totalTcs: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono text-teal-800 font-bold"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTransaction(null);
                    setEditFormData(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Delete Single Record Modal */}
      {deletingTxId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-100 space-y-4 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete this transaction?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove this transaction record? This action will update all period totals immediately.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                onClick={() => setDeletingTxId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteSingle}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Clear All Confirmation Modal */}
      {isClearAllConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100 space-y-4 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Clear all Meesho transactions?</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                This will remove all imported transactions for{' '}
                <span className="font-bold text-slate-800">GSTIN: {gstin || 'Active GSTIN'}</span> for{' '}
                <span className="font-bold text-slate-800">{periodMonth} {periodYear}</span>. Other profiles and months will not be affected.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                onClick={() => setIsClearAllConfirmOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClearAll}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Clear All Transactions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Add Manual Invoice Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Manual Invoice</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManual} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Order ID / Invoice No</label>
                <input
                  type="text"
                  required
                  value={addOrderId}
                  onChange={(e) => setAddOrderId(e.target.value)}
                  placeholder="e.g. MEESHO-ORD-9081"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Type</label>
                  <select
                    value={addType}
                    onChange={(e) => setAddType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  >
                    <option value="Sales">Sales Order</option>
                    <option value="Return">Sales Return</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={addInvoiceDate}
                    onChange={(e) => setAddInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Taxable Value (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={addTaxableValue}
                    onChange={(e) => setAddTaxableValue(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">GST Rate (%)</label>
                  <select
                    value={addGstRate}
                    onChange={(e) => setAddGstRate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  >
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    required
                    value={addHsnCode}
                    onChange={(e) => setAddHsnCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Place of Supply (State)</label>
                  <select
                    value={addPosStateName}
                    onChange={(e) => setAddPosStateName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  >
                    <option value="Maharashtra">Maharashtra (27)</option>
                    <option value="Delhi">Delhi (07)</option>
                    <option value="Karnataka">Karnataka (29)</option>
                    <option value="Gujarat">Gujarat (24)</option>
                    <option value="Uttar Pradesh">Uttar Pradesh (09)</option>
                    <option value="Tamil Nadu">Tamil Nadu (33)</option>
                    <option value="West Bengal">West Bengal (19)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
