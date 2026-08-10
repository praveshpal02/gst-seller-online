import React, { useState } from 'react';
import { MeeshoTransaction, StateGSTR1Summary, HSNSummary, ManualGSTR1Entry } from '../types';
import {
  FileText,
  Download,
  Printer,
  CheckCircle,
  Plus,
  Code,
  Eye,
  Edit3,
  Trash2,
  X,
  Check,
  Building2,
  Calendar,
  Layers,
  ShoppingBag,
  HelpCircle,
  Sliders,
  Sparkles,
  Search
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { NoDataState } from './NoDataState';
import {
  calculateGstr1Summary,
  calculateB2cs,
  calculateDocumentsIssued,
  calculateEcommerceOperator,
  calculateHsnSummary
} from '../utils/gstr1Calculator';

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
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '36': 'Telangana',
  '37': 'Andhra Pradesh'
};

export const GSTR1Report: React.FC<GSTR1ReportProps> = ({
  transactions,
  gstin,
  periodMonth,
  periodYear,
  onGoToImport
}) => {
  const [isGenerated, setIsGenerated] = useState<boolean>(false);
  const [hsnToggle, setHsnToggle] = useState<boolean>(true);
  const [operatorGstin, setOperatorGstin] = useState<string>('07AAGCM1234F1Z0');
  const [manualEntries, setManualEntries] = useState<ManualGSTR1Entry[]>([]);

  // Modal States
  const [isAddEntryModalOpen, setIsAddEntryModalOpen] = useState<boolean>(false);
  const [viewSectionModal, setViewSectionModal] = useState<'b2cs' | 'doc_issue' | 'sec14' | 'hsn' | null>(null);
  const [isEditEcoModalOpen, setIsEditEcoModalOpen] = useState<boolean>(false);

  // Filter state for View Section Modal
  const [modalSearch, setModalSearch] = useState<string>('');
  const [selectedB2csKey, setSelectedB2csKey] = useState<string | null>(null);

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
  const report = calculateGstr1Summary(transactions, manualEntries, operatorGstin);

  // Format Helper
  const formatCurr = (val: number) => {
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Auto-fill taxes on manual B2CS entry change
  const handleTaxableChange = (valStr: string) => {
    setEntryTaxable(valStr);
    const num = parseFloat(valStr) || 0;
    const rate = entryGstRate;
    const sellerStateCode = gstin ? gstin.substring(0, 2) : '07';
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
    // Reset Form
    setEntryTaxable('');
    setEntryIgst('');
    setEntryCgst('');
    setEntrySgst('');
    setEntryInvoiceVal('');
    setEntryNotes('');
  };

  const handleDeleteManualEntry = (id: string) => {
    setManualEntries(prev => prev.filter(e => e.id !== id));
  };

  // Export JSON (GST Portal format)
  const handleExportJSON = () => {
    const payload = {
      gstin: gstin || '07AAAAA0000A1Z5',
      fp: `${periodMonth.substring(0, 3)}${periodYear}`,
      gt: report.totalTaxable,
      cur_gt: report.totalTaxable,
      b2cs: report.b2csList.map(item => ({
        sply_ty: item.stateCode === (gstin ? gstin.substring(0, 2) : '07') ? 'INTRA' : 'INTER',
        pos: item.stateCode,
        typ: 'E', // E-Commerce
        rt: item.gstRate,
        txval: item.taxableValue,
        iamt: item.igstAmount,
        camt: item.cgstAmount,
        samt: item.sgstAmount,
        csamt: 0
      })),
      doc_issue: {
        doc_det: [
          {
            doc_num: 1,
            doc_typ: "Invoices for outward supply",
            num: report.docIssue.totalDocs,
            to: report.docIssue.totalDocs,
            from: 1,
            totnum: report.docIssue.totalDocs,
            cancel: report.docIssue.cancelledDocs,
            net_issue: report.docIssue.netIssuedDocs
          }
        ]
      },
      sec14: {
        eco_det: report.ecoSummary.map(eco => ({
          gstin_eco: eco.operatorGstin,
          name_eco: eco.portalName,
          supplies_val: eco.netTaxableValue,
          iamt: eco.igstAmount,
          camt: eco.cgstAmount,
          samt: eco.sgstAmount
        }))
      },
      ...(hsnToggle ? {
        hsn: {
          data: report.hsnList.map((hsn, idx) => ({
            num: idx + 1,
            hsn_sc: hsn.hsnCode,
            desc: hsn.description,
            uqc: hsn.uqc,
            qty: hsn.totalQty,
            val: hsn.totalValue,
            txval: hsn.taxableValue,
            iamt: hsn.igstAmount,
            camt: hsn.cgstAmount,
            samt: hsn.sgstAmount,
            csamt: 0
          }))
        }
      } : {})
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `GSTR1_${gstin || 'GSTIN'}_${periodMonth}_${periodYear}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. B2CS Sheet
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

    // 2. Documents Issued
    const docSheetData = [{
      'Document Type': 'Invoices / Credit Notes Outward',
      'Total Documents': report.docIssue.totalDocs,
      'Cancelled / Credit Notes': report.docIssue.cancelledDocs,
      'Net Issued Documents': report.docIssue.netIssuedDocs
    }];
    const docSheet = XLSX.utils.json_to_sheet(docSheetData);
    XLSX.utils.book_append_sheet(wb, docSheet, 'Documents Issued (Sec 13)');

    // 3. Section 14 ECO
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

    // 4. HSN Summary if enabled
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

  const handlePrint = () => {
    window.print();
  };

  // 1. Initial State - No imported data
  if (transactions.length === 0) {
    const activePeriodStr = periodMonth && periodYear ? `${periodMonth} ${periodYear}` : 'this period';
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

  // 2. Pre-Generation State - Data imported but report not clicked yet
  if (!isGenerated) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 text-center shadow-xs flex flex-col items-center justify-center space-y-6 max-w-3xl mx-auto my-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center border border-blue-100 shadow-xs">
            <FileText className="w-8 h-8 stroke-[1.75]" />
          </div>

          <div className="space-y-2 max-w-lg">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              Data ready for GSTR-1
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Your imported data is ready for <strong className="text-slate-800 font-semibold">{periodMonth} {periodYear}</strong> ({gstin || 'Active GSTIN'}). Click below to generate your official GSTR-1 report.
            </p>
          </div>

          {/* Dynamic summary calculated from actual records */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 border border-slate-200/80 p-5 rounded-2xl max-w-lg w-full text-left shadow-2xs">
            <div className="space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Records</div>
              <div className="text-lg font-extrabold text-slate-900">{report.recordCount} records</div>
              <div className="text-[10px] text-slate-500 font-medium">Outward Marketplace Sales</div>
            </div>
            <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Net Taxable</div>
              <div className="text-lg font-extrabold text-slate-900 font-mono">
                {formatCurr(report.totalTaxable)}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">B2CS Outward Supplies</div>
            </div>
            <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Tax</div>
              <div className="text-lg font-extrabold text-blue-600 font-mono">
                {formatCurr(report.totalTax)}
              </div>
              <div className="text-[10px] text-blue-500 font-semibold">IGST + CGST + SGST</div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsGenerated(true)}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-2"
            >
              <CheckCircle className="w-4.5 h-4.5" />
              <span>Generate GSTR-1 Report</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Generated GSTR-1 View
  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">GSTR-1 Outward Supply Summary</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 uppercase">
                Ready to File
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Filing Period: <strong className="text-slate-800">{periodMonth} {periodYear}</strong> | GSTIN: <strong className="font-mono text-slate-800">{gstin || 'Unspecified'}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsAddEntryModalOpen(true)}
              className="py-2.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Entry</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="py-2.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5"
              title="Download JSON file for GST Portal"
            >
              <Code className="w-4 h-4" />
              <span>GSTR1 JSON Download</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5"
              title="Download Excel spreadsheet"
            >
              <Download className="w-4 h-4" />
              <span>GSTR1 Excel Download</span>
            </button>

            <button
              onClick={handlePrint}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center space-x-1"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Ribbon Grand Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50 p-4 border border-slate-200 rounded-xl">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Records</span>
            <div className="text-base font-extrabold text-slate-900 mt-0.5">{report.recordCount} rows</div>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Taxable Value</span>
            <div className="text-base font-extrabold text-slate-900 font-mono mt-0.5">{formatCurr(report.totalTaxable)}</div>
          </div>
          <div>
            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Integrated Tax (IGST)</span>
            <div className="text-base font-extrabold text-blue-700 font-mono mt-0.5">{formatCurr(report.totalIgst)}</div>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Central Tax (CGST)</span>
            <div className="text-base font-extrabold text-slate-800 font-mono mt-0.5">{formatCurr(report.totalCgst)}</div>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">State Tax (SGST)</span>
            <div className="text-base font-extrabold text-slate-800 font-mono mt-0.5">{formatCurr(report.totalSgst)}</div>
          </div>
        </div>
      </div>

      {/* Manual Entries Banner if exists */}
      {manualEntries.length > 0 && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>{manualEntries.length} Manual Adjustment Entry(s)</strong> active in this report calculations.
            </span>
          </div>
          <button
            onClick={() => setManualEntries([])}
            className="text-xs text-amber-700 hover:text-amber-900 font-bold underline"
          >
            Clear Manual Adjustments
          </button>
        </div>
      )}

      {/* SECTION 7: B2CS (Others) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">
                7 - B2CS (Others)
              </h3>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-extrabold text-[10px] rounded">
                Section 7
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Everyday sales to consumers (no GST number)
            </p>
          </div>

          <button
            onClick={() => {
              setViewSectionModal('b2cs');
              setSelectedB2csKey(null);
            }}
            className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center space-x-1"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View / Edit</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Place of Supply (POS)</th>
                <th className="px-4 py-3">Supply Type</th>
                <th className="px-4 py-3">Rate (%)</th>
                <th className="px-4 py-3 text-right">Taxable (₹)</th>
                <th className="px-4 py-3 text-right">IGST (₹)</th>
                <th className="px-4 py-3 text-right">CGST (₹)</th>
                <th className="px-4 py-3 text-right">SGST (₹)</th>
                <th className="px-4 py-3 text-right">Invoice (₹)</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {report.b2csList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-slate-400 font-normal">
                    No B2CS transactions in selected period.
                  </td>
                </tr>
              ) : (
                report.b2csList.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-slate-900 mr-1.5">[{row.stateCode}]</span>
                      <span>{row.stateName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                        {row.type} (E-Comm)
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-blue-600">{row.gstRate}%</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {formatCurr(row.taxableValue)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {row.igstAmount > 0 ? formatCurr(row.igstAmount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {row.cgstAmount > 0 ? formatCurr(row.cgstAmount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {row.sgstAmount > 0 ? formatCurr(row.sgstAmount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {formatCurr(row.totalInvoiceValue)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => {
                          setViewSectionModal('b2cs');
                          setSelectedB2csKey(`${row.stateCode}_${row.gstRate}`);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
              <tr className="bg-slate-50 font-bold text-slate-900">
                <td className="px-4 py-3" colSpan={3}>B2CS Total</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurr(report.totalTaxable)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurr(report.totalIgst)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurr(report.totalCgst)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurr(report.totalSgst)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-blue-700">
                  {formatCurr(report.totalInvoiceValue)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 13: Documents Issued */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">
                13 - Documents Issued
              </h3>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-extrabold text-[10px] rounded">
                Section 13
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Invoices and credit notes issued during period
            </p>
          </div>

          <button
            onClick={() => setViewSectionModal('doc_issue')}
            className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center space-x-1"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View / Edit</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Nature of Document</th>
                <th className="px-4 py-3 text-center">Records</th>
                <th className="px-4 py-3 text-center">Total Documents</th>
                <th className="px-4 py-3 text-center">Cancelled / Returns</th>
                <th className="px-4 py-3 text-center">Net Issued</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-3 font-bold text-slate-900">
                  Invoices for outward supply (Outward B2C Sales)
                </td>
                <td className="px-4 py-3 text-center font-mono font-semibold">{report.docIssue.recordCount}</td>
                <td className="px-4 py-3 text-center font-mono font-bold">{report.docIssue.totalDocs}</td>
                <td className="px-4 py-3 text-center font-mono text-rose-600 font-bold">{report.docIssue.cancelledDocs}</td>
                <td className="px-4 py-3 text-center font-mono text-emerald-600 font-extrabold">{report.docIssue.netIssuedDocs}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setViewSectionModal('doc_issue')}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline"
                  >
                    View / Edit
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 14: Supplies via E-Commerce Operators (u/s 52) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">
                14 - Supplies via E-Commerce Operators (u/s 52)
              </h3>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-extrabold text-[10px] rounded">
                Section 14
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Outward supplies made through e-commerce portals
            </p>
          </div>

          <button
            onClick={() => setIsEditEcoModalOpen(true)}
            className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center space-x-1"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Operator GSTIN</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Portal Name</th>
                <th className="px-4 py-3">GSTIN of E-Commerce Operator</th>
                <th className="px-4 py-3 text-right">Net Value of Supplies (₹)</th>
                <th className="px-4 py-3 text-right">Integrated Tax (₹)</th>
                <th className="px-4 py-3 text-right">Central Tax (₹)</th>
                <th className="px-4 py-3 text-right">State/UT Tax (₹)</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {report.ecoSummary.map((eco, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-900">{eco.portalName}</td>
                  <td className="px-4 py-3 font-mono font-bold text-blue-700">{eco.operatorGstin}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{formatCurr(eco.netTaxableValue)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{formatCurr(eco.igstAmount)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{formatCurr(eco.cgstAmount)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{formatCurr(eco.sgstAmount)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setIsEditEcoModalOpen(true)}
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
      </div>

      {/* SECTION 12: B2C HSN Summary */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">
                12 - HSN-Wise Summary of Outward Supplies
              </h3>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-extrabold text-[10px] rounded">
                Section 12
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              HSN code disclosure for textile, apparel, and goods
            </p>
          </div>

          {/* B2C HSN Toggle */}
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

      {/* MODAL 1: ADD MANUAL ENTRY */}
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

      {/* MODAL 2: EDIT OPERATOR GSTIN */}
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
                Default GSTIN for Meesho operator is <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">07AAGCM1234F1Z0</code>.
              </p>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setIsEditEcoModalOpen(false)}
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW / EDIT UNDERLYING RECORDS */}
      {viewSectionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {viewSectionModal === 'b2cs' && 'Section 7: B2CS Underlying Records'}
                  {viewSectionModal === 'doc_issue' && 'Section 13: Documents Issued Details'}
                  {viewSectionModal === 'sec14' && 'Section 14: E-Commerce Supplies'}
                  {viewSectionModal === 'hsn' && 'Section 12: HSN Summary Records'}
                </h3>
                <p className="text-xs text-slate-500">
                  Showing imported transactions and manual entries contributing to GSTR-1 calculation.
                </p>
              </div>
              <button onClick={() => setViewSectionModal(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter / Search Bar */}
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by State, Sub-Order ID, or HSN..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium"
                />
              </div>
            </div>

            {/* Content Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              {viewSectionModal === 'b2cs' && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200 sticky top-0 bg-white">
                    <tr>
                      <th className="px-3 py-2.5">Sub-Order ID</th>
                      <th className="px-3 py-2.5">POS</th>
                      <th className="px-3 py-2.5">Type</th>
                      <th className="px-3 py-2.5">Rate</th>
                      <th className="px-3 py-2.5 text-right">Taxable</th>
                      <th className="px-3 py-2.5 text-right">IGST</th>
                      <th className="px-3 py-2.5 text-right">CGST / SGST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {transactions
                      .filter(t => {
                        if (selectedB2csKey) {
                          return `${t.posStateCode}_${t.gstRate}` === selectedB2csKey;
                        }
                        return true;
                      })
                      .filter(t => {
                        if (!modalSearch) return true;
                        return (
                          t.subOrderId?.toLowerCase().includes(modalSearch.toLowerCase()) ||
                          t.posStateName.toLowerCase().includes(modalSearch.toLowerCase())
                        );
                      })
                      .map((tx, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono font-bold text-slate-900">{tx.subOrderId || tx.orderId}</td>
                          <td className="px-3 py-2">[{tx.posStateCode}] {tx.posStateName}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tx.type === 'Sales' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-blue-600">{tx.gstRate}%</td>
                          <td className="px-3 py-2 text-right font-mono font-bold">
                            {formatCurr(tx.taxableValue * (tx.type === 'Sales' ? 1 : -1))}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {formatCurr(tx.igstAmount * (tx.type === 'Sales' ? 1 : -1))}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {formatCurr((tx.cgstAmount + tx.sgstAmount) * (tx.type === 'Sales' ? 1 : -1))}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}

              {viewSectionModal === 'doc_issue' && (
                <div className="p-4 space-y-4 text-xs">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Total Invoices</div>
                      <div className="text-xl font-extrabold text-slate-900">{report.docIssue.totalDocs}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Credit Notes / Cancelled</div>
                      <div className="text-xl font-extrabold text-rose-600">{report.docIssue.cancelledDocs}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Net Active Issued</div>
                      <div className="text-xl font-extrabold text-emerald-600">{report.docIssue.netIssuedDocs}</div>
                    </div>
                  </div>
                </div>
              )}
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
    </div>
  );
};
