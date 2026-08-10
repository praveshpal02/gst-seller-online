import React, { useState, useEffect } from 'react';
import { MeeshoTransaction, StateGSTR1Summary, HSNSummary, ManualGSTR1Entry } from '../types';
import {
  FileText,
  Download,
  Printer,
  Plus,
  Code,
  Eye,
  Edit3,
  Trash2,
  X,
  Sparkles,
  Search,
  CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { NoDataState } from './NoDataState';
import { calculateGstr1Summary } from '../utils/gstr1Calculator';

interface GSTR1ReportProps {
  transactions: MeeshoTransaction[];
  gstin: string;
  periodMonth: string;
  periodYear: string;
  onGoToImport?: () => void;
}

const INDIAN_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '36': 'Telangana',
  '37': 'Andhra Pradesh'
};

const formatMonthName = (month: string) => {
  if (!month) return 'July';
  const monthMap: Record<string, string> = {
    '01': 'January', '02': 'February', '03': 'March', '04': 'April',
    '05': 'May', '06': 'June', '07': 'July', '08': 'August',
    '09': 'September', '10': 'October', '11': 'November', '12': 'December',
    january: 'January', february: 'February', march: 'March', april: 'April',
    may: 'May', june: 'June', july: 'July', august: 'August',
    september: 'September', october: 'October', november: 'November', december: 'December'
  };
  const key = month.toLowerCase().trim();
  return monthMap[key] || (month.charAt(0).toUpperCase() + month.slice(1));
};

interface EditingB2csRowState {
  stateCode: string;
  stateName: string;
  type: 'INTER' | 'INTRA';
  gstRate: number;
  taxableValue: number;
}

export const GSTR1Report: React.FC<GSTR1ReportProps> = ({
  transactions,
  gstin,
  periodMonth,
  periodYear,
  onGoToImport
}) => {
  const storageKey = `gstr1_hsn_toggle_${gstin || 'default'}_${periodMonth}_${periodYear}`;
  const [hsnToggle, setHsnToggle] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(hsnToggle));
    } catch {
      // ignore
    }
  }, [hsnToggle, storageKey]);
  const [operatorGstin, setOperatorGstin] = useState<string>('07AARCM9332R1CQ');
  const [manualEntries, setManualEntries] = useState<ManualGSTR1Entry[]>([]);

  // Modals State
  const [isAddEntryModalOpen, setIsAddEntryModalOpen] = useState<boolean>(false);
  const [viewSectionModal, setViewSectionModal] = useState<'b2cs' | 'doc_issue' | 'sec14' | 'hsn' | null>(null);
  const [isEditEcoModalOpen, setIsEditEcoModalOpen] = useState<boolean>(false);

  // B2CS State-Row Edit Modal State
  const [editingB2csRow, setEditingB2csRow] = useState<EditingB2csRowState | null>(null);
  const [editTaxableInput, setEditTaxableInput] = useState<string>('');
  const [editGstRateInput, setEditGstRateInput] = useState<number>(5);
  const [editTypeInput, setEditTypeInput] = useState<'INTER' | 'INTRA'>('INTER');
  const [editStateCodeInput, setEditStateCodeInput] = useState<string>('37');

  // Filter search for B2CS records modal
  const [modalSearch, setModalSearch] = useState<string>('');

  // Manual Entry Form State
  const [entrySection, setEntrySection] = useState<'b2cs' | 'doc_issue' | 'sec14' | 'hsn'>('b2cs');
  const [entryStateCode, setEntryStateCode] = useState<string>('27');
  const [entryGstRate, setEntryGstRate] = useState<number>(5);
  const [entryTaxable, setEntryTaxable] = useState<string>('');
  const [entryIgst, setEntryIgst] = useState<string>('');
  const [entryCgst, setEntryCgst] = useState<string>('');
  const [entrySgst, setEntrySgst] = useState<string>('');
  const [entryInvoiceVal, setEntryInvoiceVal] = useState<string>('');
  const [entryHsnCode, setEntryHsnCode] = useState<string>('6109');
  const [entryHsnDesc, setEntryHsnDesc] = useState<string>('Textile / Apparel Item');
  const [entryTotalDocs, setEntryTotalDocs] = useState<string>('');
  const [entryCancelledDocs, setEntryCancelledDocs] = useState<string>('');
  const [entryNotes, setEntryNotes] = useState<string>('');

  // 1. Calculate Master GSTR-1 Dataset dynamically
  const sellerStateCode = gstin ? gstin.substring(0, 2) : '07';
  const report = calculateGstr1Summary(transactions, manualEntries, operatorGstin, sellerStateCode);

  // Currency Helper
  const formatCurr = (val: number) => {
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Helper to format filing period as MMYYYY (e.g. 072026)
  const formatFilingPeriod = (month: string, year: string) => {
    const monthMap: Record<string, string> = {
      january: '01', feb: '02', february: '02', mar: '03', march: '03',
      apr: '04', april: '04', may: '05', jun: '06', june: '06',
      jul: '07', july: '07', aug: '08', august: '08', sep: '09', september: '09',
      oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12'
    };
    const cleanMonth = String(month || '').trim().toLowerCase();
    const m = monthMap[cleanMonth] || cleanMonth.padStart(2, '0');
    const y = String(year || '2026').trim();
    return `${m}${y}`;
  };

  // Export JSON (GST Portal official format)
  const handleExportJSON = () => {
    const sellerState = gstin ? gstin.substring(0, 2) : '07';
    const fpStr = formatFilingPeriod(periodMonth, periodYear);

    const payload = {
      gstin: gstin || '07RAZPK0261B1ZC',
      fp: fpStr,
      gt: Number(report.totalTaxable.toFixed(2)),
      cur_gt: Number(report.totalTaxable.toFixed(2)),
      b2cs: report.b2csList.map((item) => ({
        sply_ty: item.stateCode === sellerState ? 'INTRA' : 'INTER',
        pos: item.stateCode,
        typ: 'OE',
        rt: item.gstRate,
        txval: Number(item.taxableValue.toFixed(2)),
        iamt: Number(item.igstAmount.toFixed(2)),
        camt: Number(item.cgstAmount.toFixed(2)),
        samt: Number(item.sgstAmount.toFixed(2)),
        csamt: 0
      })),
      supeco: {
        clttx: [
          {
            etin: operatorGstin || '07AARCM9332R1CQ',
            suppval: Number((report.ecoSummary[0]?.netTaxableValue || 0).toFixed(2)),
            igst: Number((report.ecoSummary[0]?.igstAmount || 0).toFixed(2)),
            cgst: Number((report.ecoSummary[0]?.cgstAmount || 0).toFixed(2)),
            sgst: Number((report.ecoSummary[0]?.sgstAmount || 0).toFixed(2)),
            cess: 0
          }
        ]
      },
      doc_issue: {
        doc_det:
          report.docIssue.categories && report.docIssue.categories.length > 0
            ? report.docIssue.categories.map((cat, idx) => ({
                doc_num: cat.docNum || idx + 1,
                doc_typ: cat.docType,
                docs: [
                  {
                    num: 1,
                    from: cat.from || '1',
                    to: cat.to || String(cat.totalCount),
                    totnum: cat.totalCount,
                    cancel: cat.cancelledCount,
                    net_issue: cat.netIssuedCount
                  }
                ]
              }))
            : [
                {
                  doc_num: 1,
                  doc_typ: 'Invoices for outward supply',
                  docs: [
                    {
                      num: 1,
                      from: '1',
                      to: String(report.docIssue.totalInvoices),
                      totnum: report.docIssue.totalInvoices,
                      cancel: report.docIssue.cancelledDocs,
                      net_issue: report.docIssue.totalInvoices - report.docIssue.cancelledDocs
                    }
                  ]
                },
                {
                  doc_num: 2,
                  doc_typ: 'Credit Note',
                  docs: [
                    {
                      num: 1,
                      from: '1',
                      to: String(report.docIssue.totalCreditNotes),
                      totnum: report.docIssue.totalCreditNotes,
                      cancel: 0,
                      net_issue: report.docIssue.totalCreditNotes
                    }
                  ]
                }
              ]
      },
      ...(hsnToggle
        ? {
            hsn: {
              data: report.hsnList.map((hsn, idx) => ({
                num: idx + 1,
                hsn_sc: hsn.hsnCode,
                desc: hsn.description,
                uqc: hsn.uqc || 'OTH-OTHERS',
                qty: hsn.totalQty,
                val: Number(hsn.totalValue.toFixed(2)),
                txval: Number(hsn.taxableValue.toFixed(2)),
                iamt: Number(hsn.igstAmount.toFixed(2)),
                camt: Number(hsn.cgstAmount.toFixed(2)),
                samt: Number(hsn.sgstAmount.toFixed(2)),
                csamt: 0
              }))
            }
          }
        : {})
    };

    console.log('[JSON EXPORT EXECUTED] src/components/GSTR1Report.tsx -> handleExportJSON');
    console.log('Filing Period:', fpStr);
    console.log('GSTIN:', payload.gstin);
    console.log('gt / cur_gt:', payload.gt);
    console.log('b2cs records count in JSON:', payload.b2cs.length);
    console.log('doc_issue categories count in JSON:', payload.doc_issue.doc_det.length);
    console.log('doc_issue details:', JSON.stringify(payload.doc_issue.doc_det, null, 2));

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `GSTR1_${gstin || 'GSTIN'}_${periodMonth}_${periodYear}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // B2CS Sheet
    const b2csSheetData = report.b2csList.map(b => ({
      'State Code': b.stateCode,
      'Place of Supply (State)': b.stateName,
      'Supply Type': b.type,
      'GST Rate (%)': b.gstRate,
      'Taxable Value (₹)': b.taxableValue,
      'IGST Amount (₹)': b.igstAmount,
      'CGST Amount (₹)': b.cgstAmount,
      'SGST Amount (₹)': b.sgstAmount,
      'Total Tax (₹)': b.totalTax,
      'Invoice Value (₹)': b.totalInvoiceValue
    }));
    const b2csSheet = XLSX.utils.json_to_sheet(b2csSheetData);
    XLSX.utils.book_append_sheet(wb, b2csSheet, 'B2CS Summary (Sec 7)');

    // Documents Issued
    const docSheetData = [{
      'Document Type': 'Invoices / Credit Notes Outward',
      'Total Documents': report.docIssue.totalDocs,
      'Cancelled / Credit Notes': report.docIssue.cancelledDocs,
      'Net Issued Documents': report.docIssue.netIssuedDocs
    }];
    const docSheet = XLSX.utils.json_to_sheet(docSheetData);
    XLSX.utils.book_append_sheet(wb, docSheet, 'Documents Issued (Sec 13)');

    // Section 14 ECO
    const ecoSheetData = report.ecoSummary.map(e => ({
      'Marketplace / ECO': e.portalName,
      'Operator GSTIN': e.operatorGstin,
      'Net Taxable Supplies (₹)': e.netTaxableValue,
      'IGST (₹)': e.igstAmount,
      'CGST (₹)': e.cgstAmount,
      'SGST (₹)': e.sgstAmount,
      'Total Tax (₹)': e.totalTax
    }));
    const ecoSheet = XLSX.utils.json_to_sheet(ecoSheetData);
    XLSX.utils.book_append_sheet(wb, ecoSheet, 'ECO Supplies (Sec 14)');

    // HSN Summary if enabled
    if (hsnToggle) {
      const hsnSheetData = report.hsnList.map(h => ({
        'HSN Code': h.hsnCode,
        'Description': h.description,
        'UQC': h.uqc,
        'Total Qty': h.totalQty,
        'Total Value (₹)': h.totalValue,
        'Taxable Value (₹)': h.taxableValue,
        'IGST (₹)': h.igstAmount,
        'CGST (₹)': h.cgstAmount,
        'SGST (₹)': h.sgstAmount
      }));
      const hsnSheet = XLSX.utils.json_to_sheet(hsnSheetData);
      XLSX.utils.book_append_sheet(wb, hsnSheet, 'HSN Summary (Sec 12)');
    }

    XLSX.writeFile(wb, `GSTR1_Report_${gstin || 'GSTIN'}_${periodMonth}_${periodYear}.xlsx`);
  };

  // Auto-fill taxes on manual B2CS entry modal
  const handleTaxableChange = (valStr: string) => {
    setEntryTaxable(valStr);
    const num = parseFloat(valStr) || 0;
    const rate = entryGstRate;
    const isInterState = entryStateCode !== sellerStateCode;

    const totalTax = (num * rate) / 100;
    if (isInterState) {
      setEntryIgst(totalTax.toFixed(2));
      setEntryCgst('0.00');
      setEntrySgst('0.00');
    } else {
      setEntryIgst('0.00');
      setEntryCgst((totalTax / 2).toFixed(2));
      setEntrySgst((totalTax / 2).toFixed(2));
    }
    setEntryInvoiceVal((num + totalTax).toFixed(2));
  };

  const handleAddManualEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: ManualGSTR1Entry = {
      id: `manual_${Date.now()}`,
      section: entrySection,
      stateCode: entryStateCode,
      stateName: INDIAN_STATES[entryStateCode] || 'Other State',
      gstRate: entryGstRate,
      taxableValue: parseFloat(entryTaxable) || 0,
      igstAmount: parseFloat(entryIgst) || 0,
      cgstAmount: parseFloat(entryCgst) || 0,
      sgstAmount: parseFloat(entrySgst) || 0,
      invoiceValue: parseFloat(entryInvoiceVal) || 0,
      hsnCode: entryHsnCode,
      description: entryHsnDesc,
      totalDocs: parseInt(entryTotalDocs) || 0,
      cancelledDocs: parseInt(entryCancelledDocs) || 0,
      notes: entryNotes
    };

    setManualEntries(prev => [...prev, newEntry]);
    setIsAddEntryModalOpen(false);
    setEntryTaxable('');
    setEntryIgst('');
    setEntryCgst('');
    setEntrySgst('');
    setEntryInvoiceVal('');
    setEntryNotes('');
  };

  // Open Edit Dialog for a B2CS row
  const handleOpenEditB2csRow = (row: StateGSTR1Summary) => {
    setEditingB2csRow({
      stateCode: row.stateCode,
      stateName: row.stateName,
      type: row.type,
      gstRate: row.gstRate,
      taxableValue: row.taxableValue
    });
    setEditStateCodeInput(row.stateCode);
    setEditTypeInput(row.type);
    setEditGstRateInput(row.gstRate);
    setEditTaxableInput(row.taxableValue.toFixed(2));
  };

  // Save changes for B2CS state row edit
  const handleSaveB2csRowEdit = () => {
    if (!editingB2csRow) return;

    const newTaxable = parseFloat(editTaxableInput) || 0;
    const newRate = editGstRateInput;
    const newType = editTypeInput;
    const stateCode = editStateCodeInput;
    const stateName = INDIAN_STATES[stateCode] || editingB2csRow.stateName;

    const isInter = stateCode !== sellerStateCode || newType === 'INTER';

    // Base raw imported transactions for this state & rate (excluding manual entries)
    const baseTxs = transactions.filter(
      (t) => (t.posStateCode || '07') === stateCode && (Number(t.gstRate) || 5) === newRate
    );

    let baseTaxable = 0;
    let baseIgst = 0;
    let baseCgst = 0;
    let baseSgst = 0;
    let baseInvoiceVal = 0;

    baseTxs.forEach((tx) => {
      const mult = tx.type === 'Sales' ? 1 : -1;
      const taxVal = Number(tx.taxableValue) || 0;
      const netTaxable = taxVal * mult;
      baseTaxable += netTaxable;

      const isTxInter = (tx.posStateCode || '07') !== sellerStateCode;
      if (isTxInter) {
        baseIgst += Number(tx.igstAmount) > 0 ? Number(tx.igstAmount) * mult : netTaxable * (newRate / 100);
      } else {
        if (Number(tx.cgstAmount) > 0 && Number(tx.sgstAmount) > 0) {
          baseCgst += Number(tx.cgstAmount) * mult;
          baseSgst += Number(tx.sgstAmount) * mult;
        } else {
          const taxTotal = netTaxable * (newRate / 100);
          baseCgst += taxTotal / 2;
          baseSgst += taxTotal / 2;
        }
      }
      baseInvoiceVal += tx.grossAmount ? Number(tx.grossAmount) * mult : (netTaxable + (isTxInter ? (Number(tx.igstAmount) || netTaxable * (newRate / 100)) : (netTaxable * (newRate / 100))));
    });

    // Calculate required target taxes dynamically
    const totalTax = (newTaxable * newRate) / 100;
    const targetIgst = isInter ? totalTax : 0;
    const targetCgst = isInter ? 0 : totalTax / 2;
    const targetSgst = isInter ? 0 : totalTax / 2;
    const targetInvoiceVal = newTaxable + totalTax;

    // Delta required
    const deltaTaxable = newTaxable - baseTaxable;
    const deltaIgst = targetIgst - baseIgst;
    const deltaCgst = targetCgst - baseCgst;
    const deltaSgst = targetSgst - baseSgst;
    const deltaInvoiceVal = targetInvoiceVal - baseInvoiceVal;

    const entryId = `manual_b2cs_${stateCode}_${newRate}`;

    const manualEntry: ManualGSTR1Entry = {
      id: entryId,
      section: 'b2cs',
      stateCode,
      stateName,
      gstRate: newRate,
      taxableValue: deltaTaxable,
      igstAmount: deltaIgst,
      cgstAmount: deltaCgst,
      sgstAmount: deltaSgst,
      invoiceValue: deltaInvoiceVal,
      notes: 'State row edit adjustment'
    };

    setManualEntries((prev) => [
      ...prev.filter((e) => e.id !== entryId && !(e.section === 'b2cs' && e.stateCode === stateCode && e.gstRate === newRate)),
      manualEntry
    ]);

    setEditingB2csRow(null);
  };

  // Delete override for a B2CS row
  const handleDeleteB2csRowOverride = () => {
    if (!editingB2csRow) return;

    const entryId = `manual_b2cs_${editingB2csRow.stateCode}_${editingB2csRow.gstRate}`;
    setManualEntries((prev) =>
      prev.filter(
        (e) =>
          e.id !== entryId &&
          !(e.section === 'b2cs' && e.stateCode === editingB2csRow.stateCode && e.gstRate === editingB2csRow.gstRate)
      )
    );
    setEditingB2csRow(null);
  };

  // 1. Initial State - No imported data
  if (transactions.length === 0) {
    const activePeriodStr = periodMonth && periodYear ? `${formatMonthName(periodMonth)} ${periodYear}` : 'this period';
    return (
      <NoDataState
        title={`No data available for ${activePeriodStr}`}
        description="No imported data available for this period. Import your sales reports to generate GSTR-1."
        periodMonth={periodMonth}
        periodYear={periodYear}
        gstin={gstin}
        onImportClick={onGoToImport || (() => {})}
        badgeText="GSTR-1 REPORT"
      />
    );
  }

  // 2. SINGLE-SCREEN GSTR-1 Report Page
  return (
    <div className="space-y-6">
      {/* HEADER AREA */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">GSTR1 Report</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Generated GSTR1 report, download it in Excel or JSON format.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsAddEntryModalOpen(true)}
            className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add entry</span>
          </button>
        </div>
      </div>

      {/* Header Reconciliation Status Banner */}
      {report.reconciliation && (
        <div
          className={`rounded-xl p-4 border text-xs shadow-2xs ${
            report.reconciliation.isReconciled
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2
                className={`w-4 h-4 flex-shrink-0 ${
                  report.reconciliation.isReconciled ? 'text-emerald-600' : 'text-rose-600'
                }`}
              />
              <div>
                <span className="font-bold">
                  {report.reconciliation.isReconciled
                    ? '100% Dynamic Source Reconciliation Reconciled'
                    : 'Reconciliation Alert: Differences Detected'}
                </span>
                <p className="mt-0.5 text-[11px] opacity-90 font-mono">
                  B2CS Taxable ({formatCurr(report.reconciliation.details.b2csTaxable)}) == ECO Taxable ({formatCurr(report.reconciliation.details.ecoTaxable)}) == HSN Taxable ({formatCurr(report.reconciliation.details.hsnTaxable)}) == Source Net ({formatCurr(report.reconciliation.details.sourceNetTaxable)})
                </p>
              </div>
            </div>
            <div className="text-right text-[11px] font-mono font-semibold">
              <div>Invoices: {report.reconciliation.details.docTotalInvoices}</div>
              <div>Credit Notes: {report.reconciliation.details.docTotalCreditNotes}</div>
            </div>
          </div>
          {!report.reconciliation.isReconciled && report.reconciliation.errors.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-rose-200 space-y-1 text-[11px]">
              {report.reconciliation.errors.map((err, i) => (
                <div key={i} className="text-rose-700 font-medium">• {err}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual Entries Banner if active */}
      {manualEntries.length > 0 && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 flex items-center justify-between text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>{manualEntries.length} Manual Adjustment Entry(s)</strong> active in GSTR-1 report calculations.
            </span>
          </div>
          <button
            onClick={() => setManualEntries([])}
            className="text-xs text-amber-700 hover:text-amber-900 font-bold underline"
          >
            Clear Adjustments
          </button>
        </div>
      )}

      {/* SECTION 7: B2CS (Others) CARD */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              7 - B2CS (Others)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Everyday sales to consumers (no GST number)
            </p>
          </div>

          <button
            onClick={() => {
              setViewSectionModal('b2cs');
              setModalSearch('');
            }}
            className="px-3.5 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center space-x-1"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View / Edit</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">RECORDS</th>
                <th className="px-4 py-3 text-right">TAXABLE (₹)</th>
                <th className="px-4 py-3 text-right">IGST (₹)</th>
                <th className="px-4 py-3 text-right">CGST (₹)</th>
                <th className="px-4 py-3 text-right">SGST (₹)</th>
                <th className="px-4 py-3 text-right">INVOICE (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-3.5 font-bold font-mono text-slate-900">
                  {report.b2csList.length}
                </td>
                <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                  {formatCurr(report.totalTaxable)}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-slate-700">
                  {formatCurr(report.totalIgst)}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-slate-700">
                  {formatCurr(report.totalCgst)}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-slate-700">
                  {formatCurr(report.totalSgst)}
                </td>
                <td className="px-4 py-3.5 text-right font-mono font-bold text-blue-700">
                  {formatCurr(report.totalInvoiceValue)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 13: DOCUMENTS ISSUED CARD */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              13 - Documents Issued
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Invoice / note number ranges issued
            </p>
          </div>

          <button
            onClick={() => setViewSectionModal('doc_issue')}
            className="px-3.5 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center space-x-1"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View / Edit</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-center">RECORDS</th>
                <th className="px-4 py-3 text-center">TOTAL DOCUMENTS</th>
                <th className="px-4 py-3 text-center">CANCELLED</th>
                <th className="px-4 py-3 text-center">NET ISSUED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-900">
                  {report.docIssue.totalDocs}
                </td>
                <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-900">
                  {report.docIssue.totalDocs}
                </td>
                <td className="px-4 py-3.5 text-center font-mono font-bold text-rose-600">
                  {report.docIssue.cancelledDocs}
                </td>
                <td className="px-4 py-3.5 text-center font-mono font-extrabold text-emerald-600">
                  {report.docIssue.netIssuedDocs}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 14: SUPPLIES VIA E-COMMERCE OPERATORS CARD */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              14 - Supplies via E-Commerce Operators (u/s 52)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Outward supplies made through e-commerce portals
            </p>
          </div>

          <button
            onClick={() => setViewSectionModal('sec14')}
            className="px-3.5 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center space-x-1"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View / Edit</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">PORTAL</th>
                <th className="px-4 py-3">GSTIN OF ECOMMERCE</th>
                <th className="px-4 py-3 text-right">NET VALUE OF SUPPLIES (₹)</th>
                <th className="px-4 py-3 text-right">INTEGRATED TAX (₹)</th>
                <th className="px-4 py-3 text-right">CENTRAL TAX (₹)</th>
                <th className="px-4 py-3 text-right">STATE/UT TAX (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {report.ecoSummary.map((eco, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3.5 font-bold text-slate-900">{eco.portalName}</td>
                  <td className="px-4 py-3.5 font-mono font-bold text-blue-700">{eco.operatorGstin}</td>
                  <td className="px-4 py-3.5 text-right font-mono font-bold">{formatCurr(eco.netTaxableValue)}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-700">{formatCurr(eco.igstAmount)}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-700">{formatCurr(eco.cgstAmount)}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-700">{formatCurr(eco.sgstAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 12: B2C HSN SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              12 - HSN-Wise Summary of Outward Supplies
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              HSN code disclosure for textile, apparel, and goods
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">Enable B2C HSN Disclosure</span>
            <button
              onClick={() => setHsnToggle(!hsnToggle)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                hsnToggle ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-4 h-4 bg-white rounded-full shadow-md transform transition-transform" />
            </button>
          </div>
        </div>

        {hsnToggle ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">HSN Code</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">UQC</th>
                  <th className="px-4 py-3 text-right">Total Qty</th>
                  <th className="px-4 py-3 text-right">Total Invoice Value (₹)</th>
                  <th className="px-4 py-3 text-right">Taxable Value (₹)</th>
                  <th className="px-4 py-3 text-right">IGST (₹)</th>
                  <th className="px-4 py-3 text-right">CGST / SGST (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {report.hsnList.map((hsn, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{hsn.hsnCode}</td>
                    <td className="px-4 py-3 text-slate-700">{hsn.description}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{hsn.uqc}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{hsn.totalQty}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{formatCurr(hsn.totalValue)}</td>
                    <td className="px-4 py-3 text-right font-mono text-blue-700">{formatCurr(hsn.taxableValue)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurr(hsn.igstAmount)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurr(hsn.cgstAmount + hsn.sgstAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
            HSN disclosure section is currently disabled. Toggle switch above to include HSN summary.
          </div>
        )}
      </div>

      {/* RETURN DOWNLOAD AREA (AT BOTTOM) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Return of {formatMonthName(periodMonth)} - {periodYear || '2026'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Download your finalized GSTR1 return data for filing on the GST Portal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportExcel}
            className="py-3 px-5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>GSTR1 Excel Download</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="py-3 px-5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-2"
          >
            <Code className="w-4 h-4" />
            <span>GSTR1 JSON Download</span>
          </button>
        </div>
      </div>

      {/* ================================================== */}
      {/* MODAL 1: B2CS VIEW / EDIT MODAL                    */}
      {/* ================================================== */}
      {viewSectionModal === 'b2cs' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  7 — B2C (Others)
                </h3>
                <p className="text-xs text-slate-500">
                  Consolidated state-wise, aggregated by state & rate
                </p>
              </div>
              <button
                onClick={() => setViewSectionModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TOP SUMMARY BAR */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">States</span>
                <div className="text-sm font-extrabold text-slate-900 mt-0.5">{report.b2csList.length}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taxable</span>
                <div className="text-sm font-extrabold text-slate-900 font-mono mt-0.5">{formatCurr(report.totalTaxable)}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Tax</span>
                <div className="text-sm font-extrabold text-blue-700 font-mono mt-0.5">{formatCurr(report.totalTax)}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Invoice</span>
                <div className="text-sm font-extrabold text-slate-900 font-mono mt-0.5">{formatCurr(report.totalInvoiceValue)}</div>
              </div>
            </div>

            {/* STATE-WISE TABLE */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200 sticky top-0 bg-slate-50 z-10">
                  <tr>
                    <th className="px-4 py-3">STATE</th>
                    <th className="px-4 py-3">TYPE</th>
                    <th className="px-4 py-3">RATE</th>
                    <th className="px-4 py-3 text-right">TAXABLE</th>
                    <th className="px-4 py-3 text-right">IGST</th>
                    <th className="px-4 py-3 text-right">CGST</th>
                    <th className="px-4 py-3 text-right">SGST</th>
                    <th className="px-4 py-3 text-right">INVOICE</th>
                    <th className="px-4 py-3 text-center">EDIT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {report.b2csList.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {row.stateName}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-blue-600">{row.gstRate}%</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {formatCurr(row.taxableValue)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {row.igstAmount > 0 ? formatCurr(row.igstAmount) : '₹0.00'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {row.cgstAmount > 0 ? formatCurr(row.cgstAmount) : '₹0.00'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {row.sgstAmount > 0 ? formatCurr(row.sgstAmount) : '₹0.00'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {formatCurr(row.totalInvoiceValue)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleOpenEditB2csRow(row)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Row"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewSectionModal(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* MODAL 1A: B2CS EDIT ROW SECONDARY MODAL            */}
      {/* ================================================== */}
      {editingB2csRow && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <span>Edit B2CS State Entry</span>
              </h3>
              <button
                onClick={() => setEditingB2csRow(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">State</label>
                <select
                  value={editStateCodeInput}
                  onChange={(e) => setEditStateCodeInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800"
                >
                  {Object.entries(INDIAN_STATES).map(([code, name]) => (
                    <option key={code} value={code}>[{code}] {name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">GST Rate (%)</label>
                  <select
                    value={editGstRateInput}
                    onChange={(e) => setEditGstRateInput(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800"
                  >
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Type</label>
                  <select
                    value={editTypeInput}
                    onChange={(e) => setEditTypeInput(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800"
                  >
                    <option value="INTER">Inter</option>
                    <option value="INTRA">Intra</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Taxable Value (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editTaxableInput}
                  onChange={(e) => setEditTaxableInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-900"
                />
              </div>

              {/* Dynamic Tax Preview */}
              {(() => {
                const taxNum = parseFloat(editTaxableInput) || 0;
                const isInter = editStateCodeInput !== sellerStateCode || editTypeInput === 'INTER';
                const totalTax = (taxNum * editGstRateInput) / 100;
                const igstP = isInter ? totalTax : 0;
                const cgstP = isInter ? 0 : totalTax / 2;
                const sgstP = isInter ? 0 : totalTax / 2;
                const invP = taxNum + totalTax;

                return (
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between text-slate-600">
                      <span>Calculated Tax ({editGstRateInput}%):</span>
                      <span>{formatCurr(totalTax)}</span>
                    </div>
                    {isInter ? (
                      <div className="flex justify-between text-blue-600 font-semibold">
                        <span>IGST:</span>
                        <span>{formatCurr(igstP)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-slate-700">
                          <span>CGST:</span>
                          <span>{formatCurr(cgstP)}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>SGST:</span>
                          <span>{formatCurr(sgstP)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                      <span>Calculated Invoice Value:</span>
                      <span>{formatCurr(invP)}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleDeleteB2csRowOverride}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl flex items-center space-x-1"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingB2csRow(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveB2csRowEdit}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs"
                  >
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* MODAL 2: SECTION 13 DOCUMENTS ISSUED MODAL          */}
      {/* ================================================== */}
      {viewSectionModal === 'doc_issue' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  13 — Documents Issued
                </h3>
                <p className="text-xs text-slate-500">
                  Invoice / note number ranges issued
                </p>
              </div>
              <button onClick={() => setViewSectionModal(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Documents</div>
                <div className="text-xl font-extrabold text-slate-900">{report.docIssue.totalDocs}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Cancelled / Returns</div>
                <div className="text-xl font-extrabold text-rose-600">{report.docIssue.cancelledDocs}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Net Active Issued</div>
                <div className="text-xl font-extrabold text-emerald-600">{report.docIssue.netIssuedDocs}</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">DOC NO.</th>
                    <th className="px-4 py-3">TYPE OF DOCUMENT</th>
                    <th className="px-4 py-3 text-center">TOTAL COUNT</th>
                    <th className="px-4 py-3 text-center">CANCELLED</th>
                    <th className="px-4 py-3 text-center">NET ISSUED</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {report.docIssue.categories?.map((cat) => (
                    <tr key={`${cat.docNum}-${cat.from}-${cat.to}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{cat.docNum}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{cat.docType}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{cat.from} → {cat.to}</div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold">{cat.totalCount}</td>
                      <td className="px-4 py-3 text-center font-mono text-rose-600 font-bold">{cat.cancelledCount}</td>
                      <td className="px-4 py-3 text-center font-mono text-emerald-600 font-extrabold">{cat.netIssuedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewSectionModal(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* MODAL 3: SECTION 14 E-COMMERCE SUPPLIES MODAL       */}
      {/* ================================================== */}
      {viewSectionModal === 'sec14' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  14 — Supplies via E-Commerce Operators (u/s 52)
                </h3>
                <p className="text-xs text-slate-500">
                  Outward supplies made through e-commerce operators
                </p>
              </div>
              <button onClick={() => setViewSectionModal(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">PORTAL</th>
                    <th className="px-4 py-3">GSTIN OF ECOMMERCE</th>
                    <th className="px-4 py-3 text-right">NET VALUE OF SUPPLIES (₹)</th>
                    <th className="px-4 py-3 text-right">INTEGRATED TAX (₹)</th>
                    <th className="px-4 py-3 text-right">CENTRAL TAX (₹)</th>
                    <th className="px-4 py-3 text-right">STATE/UT TAX (₹)</th>
                    <th className="px-4 py-3 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {report.ecoSummary.map((eco, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900">{eco.portalName}</td>
                      <td className="px-4 py-3 font-mono font-bold text-blue-700">{eco.operatorGstin}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{formatCurr(eco.netTaxableValue)}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{formatCurr(eco.igstAmount)}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{formatCurr(eco.cgstAmount)}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{formatCurr(eco.sgstAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setViewSectionModal(null);
                            setIsEditEcoModalOpen(true);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewSectionModal(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* MODAL 4: ADD MANUAL ENTRY MODAL                    */}
      {/* ================================================== */}
      {isAddEntryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <span>Add Manual GSTR-1 Entry</span>
              </h3>
              <button
                onClick={() => setIsAddEntryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddManualEntry} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">GSTR-1 Section</label>
                <select
                  value={entrySection}
                  onChange={(e) => setEntrySection(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800"
                >
                  <option value="b2cs">7 - B2CS (Others / Consumer Sales)</option>
                  <option value="doc_issue">13 - Documents Issued Adjustment</option>
                  <option value="sec14">14 - Supplies via E-Commerce Operators</option>
                  <option value="hsn">12 - HSN Summary Adjustment</option>
                </select>
              </div>

              {entrySection === 'b2cs' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Place of Supply (State)</label>
                      <select
                        value={entryStateCode}
                        onChange={(e) => setEntryStateCode(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800"
                      >
                        {Object.entries(INDIAN_STATES).map(([code, name]) => (
                          <option key={code} value={code}>[{code}] {name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">GST Rate (%)</label>
                      <select
                        value={entryGstRate}
                        onChange={(e) => setEntryGstRate(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800"
                      >
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Taxable Value (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={entryTaxable}
                      onChange={(e) => handleTaxableChange(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">IGST (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={entryIgst}
                        onChange={(e) => setEntryIgst(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">CGST (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={entryCgst}
                        onChange={(e) => setEntryCgst(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">SGST (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={entrySgst}
                        onChange={(e) => setEntrySgst(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Total Invoice Value (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={entryInvoiceVal}
                      onChange={(e) => setEntryInvoiceVal(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-800"
                    />
                  </div>
                </>
              )}

              {entrySection === 'doc_issue' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Additional Documents Issued</label>
                    <input
                      type="number"
                      value={entryTotalDocs}
                      onChange={(e) => setEntryTotalDocs(e.target.value)}
                      placeholder="e.g. 10"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Additional Cancelled Docs</label>
                    <input
                      type="number"
                      value={entryCancelledDocs}
                      onChange={(e) => setEntryCancelledDocs(e.target.value)}
                      placeholder="e.g. 2"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                    />
                  </div>
                </div>
              )}

              {entrySection === 'hsn' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">HSN Code</label>
                      <input
                        type="text"
                        value={entryHsnCode}
                        onChange={(e) => setEntryHsnCode(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Taxable Value (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={entryTaxable}
                        onChange={(e) => setEntryTaxable(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={entryHsnDesc}
                      onChange={(e) => setEntryHsnDesc(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Note / Remarks</label>
                <input
                  type="text"
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  placeholder="Reason for manual adjustment"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddEntryModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* MODAL 5: EDIT E-COMMERCE OPERATOR DETAILS           */}
      {/* ================================================== */}
      {isEditEcoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Edit E-Commerce Operator Details
              </h3>
              <button onClick={() => setIsEditEcoModalOpen(false)} className="text-slate-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Operator GSTIN</label>
                <input
                  type="text"
                  value={operatorGstin}
                  onChange={(e) => setOperatorGstin(e.target.value.toUpperCase())}
                  maxLength={15}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-900 uppercase"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Default GSTIN for Meesho operator is <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">07AARCM9332R1CQ</code>.
              </p>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setIsEditEcoModalOpen(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};