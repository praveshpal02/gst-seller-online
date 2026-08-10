import React, { useState } from 'react';
import { X, Upload, FileCheck, Download, AlertTriangle, Sparkles, CheckCircle, Loader2 } from 'lucide-react';
import { UploadedFilesMap, parseMeeshoExcelFiles } from '../utils/excelParser';
import { MeeshoTransaction } from '../types';
import { generateSampleMeeshoTransactions } from '../data/sampleMeeshoData';

interface MeeshoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodMonth: string;
  periodYear: string;
  sellerStateCode: string;
  onDataImported: (transactions: MeeshoTransaction[]) => void;
}

export const MeeshoUploadModal: React.FC<MeeshoUploadModalProps> = ({
  isOpen,
  onClose,
  periodMonth,
  periodYear,
  sellerStateCode,
  onDataImported
}) => {
  const [tcsSalesFile, setTcsSalesFile] = useState<File | null>(null);
  const [tcsReturnFile, setTcsReturnFile] = useState<File | null>(null);
  const [taxInvoiceFile, setTaxInvoiceFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProcessUpload = async () => {
    if (!tcsSalesFile && !tcsReturnFile && !taxInvoiceFile) {
      alert('Please select at least one Meesho report Excel file to upload, or use the Sample Data button.');
      return;
    }

    setIsProcessing(true);
    setUploadSuccessMsg(null);

    try {
      const filesMap: UploadedFilesMap = {
        tcsSales: tcsSalesFile || undefined,
        tcsSalesReturn: tcsReturnFile || undefined,
        taxInvoice: taxInvoiceFile || undefined
      };

      const parsed = await parseMeeshoExcelFiles(filesMap, sellerStateCode);
      
      if (parsed.length > 0) {
        onDataImported(parsed);
        setUploadSuccessMsg(`Successfully imported ${parsed.length} Meesho transactions!`);
        setTimeout(() => {
          setIsProcessing(false);
          onClose();
        }, 1200);
      } else {
        setIsProcessing(false);
        alert('Could not detect valid data rows in uploaded files. Click "Load Meesho Sample Data" for a instant demo test.');
      }
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      alert('Error reading Excel files. Please ensure you uploaded unzipped .xlsx files from Meesho Panel.');
    }
  };

  const handleLoadSampleData = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const sampleData = generateSampleMeeshoTransactions();
      onDataImported(sampleData);
      setIsProcessing(false);
      setUploadSuccessMsg(`Loaded ${sampleData.length} Meesho sample records for ${periodMonth}-${periodYear}!`);
      setTimeout(() => {
        onClose();
      }, 1000);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header matching Screenshot 3 */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-pink-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
              m
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-900">Meesho</h3>
                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                  B2C
                </span>
              </div>
              <p className="text-xs text-slate-500">meesho.com · GST reports (TCS sales)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Selected Period Banner */}
          <div className="border border-slate-200 rounded-xl py-2.5 px-4 text-center font-bold text-blue-700 bg-white text-sm shadow-2xs">
            {periodMonth} Data
          </div>

          {/* Download Path 1 */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              DOWNLOAD PATH
            </label>
            <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-3 text-xs text-slate-800 flex items-center space-x-2 font-medium">
              <Download className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Meesho Panel → Payments → Download GST Reports</span>
            </div>
          </div>

          {/* File Inputs Group 1 */}
          <div className="space-y-3">
            <label className="block text-[11px] font-bold text-rose-600 uppercase tracking-wider">
              UPLOAD FILES: ({periodMonth.toUpperCase()}-{periodYear})
            </label>

            {/* Input 1: tcs_sales.xlsx */}
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
              <span className="w-48 px-3.5 py-2.5 bg-slate-100 border-r border-slate-200 text-xs font-semibold text-slate-700 shrink-0">
                tcs_sales.xlsx
              </span>
              <label className="flex-1 px-3 py-2 text-xs text-slate-600 cursor-pointer flex items-center justify-between">
                <span className="truncate">
                  {tcsSalesFile ? tcsSalesFile.name : 'No file chosen'}
                </span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setTcsSalesFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <span className="px-3 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50">
                  Choose File
                </span>
              </label>
            </div>

            {/* Input 2: tcs_sales_return.xlsx */}
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
              <span className="w-48 px-3.5 py-2.5 bg-slate-100 border-r border-slate-200 text-xs font-semibold text-slate-700 shrink-0">
                tcs_sales_return.xlsx
              </span>
              <label className="flex-1 px-3 py-2 text-xs text-slate-600 cursor-pointer flex items-center justify-between">
                <span className="truncate">
                  {tcsReturnFile ? tcsReturnFile.name : 'No file chosen'}
                </span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setTcsReturnFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <span className="px-3 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50">
                  Choose File
                </span>
              </label>
            </div>
          </div>

          {/* Download Path 2 */}
          <div className="space-y-2 pt-1">
            <div className="text-xs font-semibold text-teal-600 hover:underline flex items-center gap-1 cursor-pointer">
              <span>Download Path: (Meesho Panel → Payments → Tax Invoice).</span>
            </div>

            {/* Input 3: Tax_invoice_details.xlsx */}
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
              <span className="w-48 px-3.5 py-2.5 bg-slate-100 border-r border-slate-200 text-xs font-semibold text-slate-700 shrink-0">
                Tax_invoice_details.xlsx
              </span>
              <label className="flex-1 px-3 py-2 text-xs text-slate-600 cursor-pointer flex items-center justify-between">
                <span className="truncate">
                  {taxInvoiceFile ? taxInvoiceFile.name : 'No file chosen'}
                </span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv, .zip"
                  onChange={(e) => setTaxInvoiceFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <span className="px-3 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50">
                  Choose File
                </span>
              </label>
            </div>

            <p className="text-xs font-semibold text-teal-600">
              Unzip the file and upload only the Excel (Tax_invoice_details.xlsx) file.
            </p>
          </div>

          {/* Action Row */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleProcessUpload}
                disabled={isProcessing}
                className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Files...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload & Process Data</span>
                  </>
                )}
              </button>

              <button
                onClick={handleLoadSampleData}
                disabled={isProcessing}
                className="py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5"
                title="Instantly test with pre-filled Meesho sales & return records"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Load Sample Data ({periodMonth})</span>
              </button>
            </div>

            {uploadSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center space-x-2 animate-in fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>{uploadSuccessMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-6 bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
