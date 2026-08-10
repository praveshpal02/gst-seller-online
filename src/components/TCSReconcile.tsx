import React, { useState, useRef } from 'react';
import { MeeshoTransaction } from '../types';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  X,
  Trash2,
  RefreshCw,
  ShieldCheck,
  ArrowUpRight,
  FileText,
  Store,
  DollarSign,
  Percent,
  Receipt
} from 'lucide-react';
import { parseGSTPortalTCSReport, GSTPortalTCSData } from '../utils/tcsPortalParser';
import { NoDataState } from './NoDataState';

interface TCSReconcileProps {
  transactions: MeeshoTransaction[];
  periodMonth: string;
  periodYear: string;
  gstin: string;
  onGoToGSTR1?: () => void;
  onGoToImport?: () => void;
}

export const TCSReconcile: React.FC<TCSReconcileProps> = ({
  transactions,
  periodMonth,
  periodYear,
  gstin,
  onGoToGSTR1,
  onGoToImport
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Portal upload state
  const [portalFile, setPortalFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [portalData, setPortalData] = useState<GSTPortalTCSData | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // 1. Tool Data Calculations (100% Dynamic from imported transactions)
  const salesList = transactions.filter((t) => t.type === 'Sales');
  const returnList = transactions.filter((t) => t.type === 'Return');

  const grossSales = salesList.reduce((acc, curr) => acc + (curr.taxableValue || 0), 0);
  const salesReturns = returnList.reduce((acc, curr) => acc + (curr.taxableValue || 0), 0);
  const netSales = grossSales - salesReturns;

  // Inter-State vs Intra-State breakdown
  const interStateSales = salesList
    .filter((t) => t.isInterState)
    .reduce((acc, curr) => acc + (curr.taxableValue || 0), 0);
  const interStateReturns = returnList
    .filter((t) => t.isInterState)
    .reduce((acc, curr) => acc + (curr.taxableValue || 0), 0);
  const interStateNetTaxable = interStateSales - interStateReturns;

  const intraStateSales = salesList
    .filter((t) => !t.isInterState)
    .reduce((acc, curr) => acc + (curr.taxableValue || 0), 0);
  const intraStateReturns = returnList
    .filter((t) => !t.isInterState)
    .reduce((acc, curr) => acc + (curr.taxableValue || 0), 0);
  const intraStateNetTaxable = intraStateSales - intraStateReturns;

  // Head-Wise TCS Calculations
  const interStateTcsIgst = Math.round(interStateNetTaxable * 0.01 * 100) / 100;
  const intraStateTcsCgst = Math.round(intraStateNetTaxable * 0.005 * 100) / 100;
  const intraStateTcsSgst = Math.round(intraStateNetTaxable * 0.005 * 100) / 100;
  const intraStateTotalTcs = Math.round((intraStateTcsCgst + intraStateTcsSgst) * 100) / 100;

  const totalToolTcsCollected = Math.round((interStateTcsIgst + intraStateTotalTcs) * 100) / 100;

  // 2. Reconciliation Status Calculations
  const isPortalUploaded = !!portalData && portalData.isValid;
  const portalTcsTotal = isPortalUploaded ? portalData.totalTcs : 0;
  const portalNetTaxable = isPortalUploaded ? portalData.netTaxableValue : 0;

  const tcsDifference = Math.round((totalToolTcsCollected - portalTcsTotal) * 100) / 100;
  const taxableDifference = Math.round((netSales - portalNetTaxable) * 100) / 100;

  const isReconciled = isPortalUploaded && Math.abs(tcsDifference) <= 1;

  // Format Currency Helper
  const formatCurr = (val: number) =>
    `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // File Upload Handlers
  const handleFileChange = async (file: File) => {
    if (!file) return;
    setPortalFile(file);
    setIsParsing(true);
    setPortalData(null);

    const parsed = await parseGSTPortalTCSReport(file);
    setPortalData(parsed);
    setIsParsing(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setPortalFile(null);
    setPortalData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (transactions.length === 0) {
    const activePeriodStr = periodMonth && periodYear ? `${periodMonth} ${periodYear}` : 'this period';
    return (
      <NoDataState
        title={`No data imported for ${activePeriodStr} yet`}
        description="Import your sales reports for this period before starting TCS reconciliation."
        periodMonth={periodMonth}
        periodYear={periodYear}
        gstin={gstin}
        onImportClick={onGoToImport || (() => {})}
        badgeText="TCS RECONCILIATION"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Page Sub-Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">TCS Reconciliation</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 uppercase">
              Section 52
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Match your tool data against the GST portal TCS report for{' '}
            <span className="font-semibold text-slate-800">
              {periodMonth} {periodYear}
            </span>{' '}
            ({gstin || 'Active GSTIN'})
          </p>
        </div>

        {onGoToGSTR1 && (
          <button
            onClick={onGoToGSTR1}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 self-start sm:self-auto"
          >
            <FileText className="w-4 h-4" />
            <span>Generate GSTR-1</span>
          </button>
        )}
      </div>

      {/* 2. Upload GST Portal TCS Report Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" />
              <span>Upload GST portal TCS report</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Path on GST Portal:{' '}
              <span className="font-mono text-slate-700 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                Services → Returns → TDS and TCS credit received → Select period → Preview draft (Excel / ZIP)
              </span>
            </p>
          </div>
        </div>

        {!portalFile ? (
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
                : 'border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.zip"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />

            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FileSpreadsheet className="w-6 h-6" />
            </div>

            <p className="text-xs font-bold text-slate-800">
              Click to upload or drag & drop GST Portal TCS Report
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports Excel (.xlsx, .xls), CSV (.csv), or ZIP archives from GST Portal
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* File Info Bar */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{portalFile.name}</div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{portalData?.fileSize || `${(portalFile.size / 1024).toFixed(1)} KB`}</span>
                    {portalData?.isValid && (
                      <>
                        <span>•</span>
                        <span className="font-semibold text-slate-700">{portalData.recordCount} records parsed</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {isParsing ? (
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Parsing report...</span>
                  </span>
                ) : portalData?.isValid ? (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-lg flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Validated</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-extrabold rounded-lg flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Invalid Structure</span>
                  </span>
                )}

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  Change file
                </button>

                <button
                  onClick={handleRemoveFile}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Remove file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Invalid Structure Warning Banner */}
            {portalData && !portalData.isValid && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Report Validation Error</span>
                </div>
                <p className="text-rose-700 pl-5 leading-relaxed">
                  {portalData.errorMessage ||
                    'Unable to identify the GST Portal TCS report structure. Please upload the report downloaded from GST Portal → Services → Returns → TDS and TCS credit received.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Four Dynamic Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Platforms */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Platforms</span>
            <Store className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {transactions.length > 0 ? 1 : 0}
          </div>
          <div className="text-[10px] font-semibold text-slate-500 mt-1">Active Marketplace</div>
        </div>

        {/* Tool Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Tool Total</span>
            <DollarSign className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-2 truncate">
            {formatCurr(netSales)}
          </div>
          <div className="text-[10px] font-bold text-purple-700 mt-1">
            TCS: {formatCurr(totalToolTcsCollected)}
          </div>
        </div>

        {/* Portal Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Portal Total</span>
            <Receipt className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-xl font-black text-teal-700 mt-2 truncate font-mono">
            {isPortalUploaded ? formatCurr(portalNetTaxable) : '—'}
          </div>
          <div className="text-[10px] font-semibold text-slate-500 mt-1">
            {isPortalUploaded ? `TCS: ${formatCurr(portalTcsTotal)}` : 'Awaiting Portal Report'}
          </div>
        </div>

        {/* Mismatched */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Mismatched</span>
            <Percent className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {!isPortalUploaded ? 0 : isReconciled ? 0 : 1}
          </div>
          <div className="text-[10px] font-bold mt-1">
            {!isPortalUploaded ? (
              <span className="text-slate-400">Pending Upload</span>
            ) : isReconciled ? (
              <span className="text-emerald-600">✓ 100% Reconciled</span>
            ) : (
              <span className="text-rose-600">Diff: {formatCurr(taxableDifference)}</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Platform Reconciliation Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Platform TCS Reconciliation</h2>
          {isPortalUploaded && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                isReconciled
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isReconciled ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>100% Reconciled</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Mismatch Found</span>
                </>
              )}
            </span>
          )}
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Marketplace</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3 text-right">GST Tool Net Taxable</th>
                <th className="px-4 py-3 text-right">GST Tool TCS</th>
                <th className="px-4 py-3 text-right">GST Portal Net Taxable</th>
                <th className="px-4 py-3 text-right">GST Portal TCS</th>
                <th className="px-4 py-3 text-right">TCS Difference</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              <tr>
                <td className="px-4 py-3 font-bold text-slate-900 flex items-center space-x-1.5">
                  <Store className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Meesho</span>
                </td>
                <td className="px-4 py-3 text-slate-600 font-semibold">
                  {periodMonth} {periodYear}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-900">
                  {formatCurr(netSales)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-purple-700">
                  {formatCurr(totalToolTcsCollected)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-700">
                  {isPortalUploaded ? formatCurr(portalNetTaxable) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-teal-700 font-bold">
                  {isPortalUploaded ? formatCurr(portalTcsTotal) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold">
                  {isPortalUploaded ? (
                    <span className={Math.abs(tcsDifference) <= 1 ? 'text-emerald-700' : 'text-rose-600'}>
                      {formatCurr(tcsDifference)}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {!isPortalUploaded ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                      Pending Upload
                    </span>
                  ) : isReconciled ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Matched
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                      Mismatched
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Tax Head-Wise TCS Summary */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Tax Head-Wise TCS Summary</h2>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Component / Tax Head</th>
                <th className="px-4 py-3 text-right">Taxable Net Sales</th>
                <th className="px-4 py-3 text-right">TCS IGST (1%)</th>
                <th className="px-4 py-3 text-right">TCS CGST (0.5%)</th>
                <th className="px-4 py-3 text-right">TCS SGST (0.5%)</th>
                <th className="px-4 py-3 text-right">Total TCS Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-800">Inter-State Outward Supplies</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                  {formatCurr(interStateNetTaxable)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-purple-700 font-bold">
                  {formatCurr(interStateTcsIgst)}
                </td>
                <td className="px-4 py-3 text-right text-slate-400">—</td>
                <td className="px-4 py-3 text-right text-slate-400">—</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                  {formatCurr(interStateTcsIgst)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-800">Intra-State Outward Supplies</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                  {formatCurr(intraStateNetTaxable)}
                </td>
                <td className="px-4 py-3 text-right text-slate-400">—</td>
                <td className="px-4 py-3 text-right font-mono text-purple-700 font-bold">
                  {formatCurr(intraStateTcsCgst)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-purple-700 font-bold">
                  {formatCurr(intraStateTcsSgst)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                  {formatCurr(intraStateTotalTcs)}
                </td>
              </tr>
              <tr className="bg-slate-50 font-bold text-slate-900">
                <td className="px-4 py-3">Total Consolidated Net TCS</td>
                <td className="px-4 py-3 text-right font-mono text-blue-900">{formatCurr(netSales)}</td>
                <td className="px-4 py-3 text-right font-mono text-purple-700">
                  {formatCurr(interStateTcsIgst)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-purple-700">
                  {formatCurr(intraStateTcsCgst)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-purple-700">
                  {formatCurr(intraStateTcsSgst)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-purple-900 text-sm">
                  {formatCurr(totalToolTcsCollected)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* How to Claim TCS Guide Box */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-xs space-y-2 text-emerald-950">
          <div className="font-bold text-emerald-900 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>How to claim this TCS Credit on GST Portal (`gst.gov.in`):</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1 leading-relaxed">
            <li>
              Log in to the GST Portal → Go to <strong>Services → Returns → TDS and TCS credit received</strong>.
            </li>
            <li>
              Select Return Period: <strong>{periodMonth} {periodYear}</strong>.
            </li>
            <li>
              Open <strong>Table 4: TCS Credit Received</strong> to view Meesho's filed TCS report.
            </li>
            <li>
              Verify total TCS matches <strong>{formatCurr(totalToolTcsCollected)}</strong>, select all entries and click <strong>ACCEPT</strong>.
            </li>
            <li>
              File the return with EVC/OTP. The amount will be credited directly to your <strong>Electronic Cash Ledger</strong> to pay future GST liabilities!
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};
