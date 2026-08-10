import React, { useState } from 'react';
import { X, Download, Upload, AlertTriangle, CheckCircle, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { MeeshoFileUpload } from './MeeshoFileUpload';
import { validateTcsSales, validateTcsSalesReturn, validateTaxInvoiceDetails, FileValidationResult } from './MeeshoFileValidator';
import { parseMeeshoExcelFiles, calculateMeeshoImportSummary } from '../../../../utils/excelParser';
import { MeeshoTransaction } from '../../../../types';
import { generateSampleMeeshoTransactions } from '../../../../data/sampleMeeshoData';

interface MeeshoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  gstin: string;
  periodMonth: string;
  periodYear: string;
  sellerStateCode: string;
  userId?: string;
  onDataImported: (transactions: MeeshoTransaction[]) => void;
}

export const MeeshoImportModal: React.FC<MeeshoImportModalProps> = ({
  isOpen,
  onClose,
  gstin,
  periodMonth,
  periodYear,
  sellerStateCode,
  userId = 'usr_default',
  onDataImported
}) => {
  // File states
  const [tcsSalesFile, setTcsSalesFile] = useState<File | null>(null);
  const [tcsReturnFile, setTcsReturnFile] = useState<File | null>(null);
  const [taxInvoiceFile, setTaxInvoiceFile] = useState<File | null>(null);

  // Validation states
  const [tcsSalesValidation, setTcsSalesValidation] = useState<FileValidationResult | null>(null);
  const [tcsReturnValidation, setTcsReturnValidation] = useState<FileValidationResult | null>(null);
  const [taxInvoiceValidation, setTaxInvoiceValidation] = useState<FileValidationResult | null>(null);

  // Validating loading states
  const [validatingTcsSales, setValidatingTcsSales] = useState(false);
  const [validatingTcsReturn, setValidatingTcsReturn] = useState(false);
  const [validatingTaxInvoice, setValidatingTaxInvoice] = useState(false);

  // Process states
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'IDLE' | 'UPLOADING' | 'SUCCESS' | 'DUPLICATE' | 'ERROR'>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<{
    successRecords: number;
    netSale: number;
  } | null>(null);

  if (!isOpen) return null;

  // Handle file selections with real-time validation
  const handleSelectTcsSales = async (file: File) => {
    setTcsSalesFile(file);
    setTcsSalesValidation(null);
    setValidatingTcsSales(true);
    setUploadStatus('IDLE');
    setStatusMessage(null);
    setUploadSummary(null);
    try {
      const res = await validateTcsSales(file);
      setTcsSalesValidation(res);
    } catch (err: any) {
      setTcsSalesValidation({
        isValid: false,
        fileType: 'tcs_sales',
        fileName: file.name,
        fileSizeFormatted: `${(file.size / 1024).toFixed(1)} KB`,
        error: err?.message || 'Failed to validate TCS Sales file'
      });
    } finally {
      setValidatingTcsSales(false);
    }
  };

  const handleSelectTcsReturn = async (file: File) => {
    setTcsReturnFile(file);
    setTcsReturnValidation(null);
    setValidatingTcsReturn(true);
    setUploadStatus('IDLE');
    setStatusMessage(null);
    setUploadSummary(null);
    try {
      const res = await validateTcsSalesReturn(file);
      setTcsReturnValidation(res);
    } catch (err: any) {
      setTcsReturnValidation({
        isValid: false,
        fileType: 'tcs_sales_return',
        fileName: file.name,
        fileSizeFormatted: `${(file.size / 1024).toFixed(1)} KB`,
        error: err?.message || 'Failed to validate TCS Sales Return file'
      });
    } finally {
      setValidatingTcsReturn(false);
    }
  };

  const handleSelectTaxInvoice = async (file: File) => {
    setTaxInvoiceFile(file);
    setTaxInvoiceValidation(null);
    setValidatingTaxInvoice(true);
    setUploadStatus('IDLE');
    setStatusMessage(null);
    setUploadSummary(null);
    try {
      const res = await validateTaxInvoiceDetails(file);
      setTaxInvoiceValidation(res);
    } catch (err: any) {
      setTaxInvoiceValidation({
        isValid: false,
        fileType: 'tax_invoice_details',
        fileName: file.name,
        fileSizeFormatted: `${(file.size / 1024).toFixed(1)} KB`,
        error: err?.message || 'Failed to validate Tax Invoice Details file'
      });
    } finally {
      setValidatingTaxInvoice(false);
    }
  };

  const handleRemoveTcsSales = () => {
    setTcsSalesFile(null);
    setTcsSalesValidation(null);
    setUploadStatus('IDLE');
    setUploadSummary(null);
  };

  const handleRemoveTcsReturn = () => {
    setTcsReturnFile(null);
    setTcsReturnValidation(null);
    setUploadStatus('IDLE');
    setUploadSummary(null);
  };

  const handleRemoveTaxInvoice = () => {
    setTaxInvoiceFile(null);
    setTaxInvoiceValidation(null);
    setUploadStatus('IDLE');
    setUploadSummary(null);
  };

  // Check if all 3 required files are selected AND valid
  const isAllFilesSelected = Boolean(tcsSalesFile && tcsReturnFile && taxInvoiceFile);
  const isAllFilesValid = Boolean(
    tcsSalesValidation?.isValid &&
    tcsReturnValidation?.isValid &&
    taxInvoiceValidation?.isValid
  );
  const isValidatingAny = validatingTcsSales || validatingTcsReturn || validatingTaxInvoice;

  const canUpload = isAllFilesSelected && isAllFilesValid && !isValidatingAny;

  // Perform upload to backend / process files
  const handleProcessUpload = async () => {
    if (!canUpload) return;

    setIsProcessing(true);
    setUploadStatus('UPLOADING');
    setStatusMessage('Uploading... Validating Meesho files...');
    setUploadSummary(null);

    try {
      // 1. Send request to backend endpoint `/api/meesho-import`
      const backendResponse = await fetch('/api/meesho-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          gstin,
          periodMonth,
          periodYear,
          marketplace: 'MEESHO',
          filesMeta: {
            tcsSales: tcsSalesFile?.name,
            tcsSalesReturn: tcsReturnFile?.name,
            taxInvoice: taxInvoiceFile?.name
          }
        })
      });

      const resData = await backendResponse.json();

      // Check for duplicate upload response
      if (resData.isDuplicate) {
        setIsProcessing(false);
        setUploadStatus('DUPLICATE');
        setStatusMessage(resData.message || `This Meesho report has already been uploaded for ${periodMonth} ${periodYear}.`);
        return;
      }

      // 2. Parse client-side transactions from Excel
      const parsedTransactions = await parseMeeshoExcelFiles(
        {
          tcsSales: tcsSalesFile || undefined,
          tcsSalesReturn: tcsReturnFile || undefined,
          taxInvoice: taxInvoiceFile || undefined
        },
        sellerStateCode
      );

      if (!parsedTransactions || parsedTransactions.length === 0) {
        setIsProcessing(false);
        setUploadStatus('ERROR');
        setStatusMessage('No valid transaction records found in the uploaded Meesho reports.');
        return;
      }

      const summary = calculateMeeshoImportSummary(parsedTransactions);

      setUploadSummary({
        successRecords: summary.successRecords,
        netSale: summary.netSale
      });

      setIsProcessing(false);
      setUploadStatus('SUCCESS');
      setStatusMessage('File uploaded successfully');

      // Notify parent app
      onDataImported(parsedTransactions);

    } catch (err: any) {
      console.error('Meesho import error:', err);
      setIsProcessing(false);
      setUploadStatus('ERROR');
      setStatusMessage(err?.message || 'Error processing Meesho files. Please check file formatting.');
    }
  };

  // Demo / Sample Data loader helper
  const handleLoadSampleData = () => {
    setIsProcessing(true);
    setUploadStatus('UPLOADING');
    setStatusMessage('Loading demo Meesho records...');
    setUploadSummary(null);

    setTimeout(() => {
      const sample = generateSampleMeeshoTransactions();
      const summary = calculateMeeshoImportSummary(sample);

      setUploadSummary({
        successRecords: summary.successRecords,
        netSale: summary.netSale
      });

      onDataImported(sample);
      setIsProcessing(false);
      setUploadStatus('SUCCESS');
      setStatusMessage('File uploaded successfully');
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-pink-600 flex items-center justify-center text-white font-black text-xl shadow-md">
              m
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-900">Meesho</h3>
                <span className="bg-blue-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
                  B2C
                </span>
              </div>
              <p className="text-xs text-slate-500">meesho.com · GST reports (TCS sales)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
            title="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-slate-800">
          
          {/* Selected Return Period Banner */}
          <div className="border border-slate-200 rounded-xl py-2.5 px-4 text-center font-bold text-blue-700 bg-white text-sm shadow-2xs">
            {periodMonth} Data
          </div>

          {/* Download Path 1 */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              DOWNLOAD PATH
            </label>
            <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-3 text-xs text-slate-800 flex items-center space-x-2 font-medium">
              <Download className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Meesho Panel → Payments → Download GST Reports</span>
            </div>
          </div>

          {/* Upload Files Group */}
          <div className="space-y-4">
            <label className="block text-[11px] font-extrabold text-rose-600 uppercase tracking-wider">
              UPLOAD FILES: ({periodMonth.toUpperCase()}-{periodYear})
            </label>

            {/* File 1: tcs_sales.xlsx */}
            <MeeshoFileUpload
              fileType="tcs_sales"
              fileLabel="tcs_sales.xlsx"
              expectedFileName="tcs_sales.xlsx"
              file={tcsSalesFile}
              validationResult={tcsSalesValidation}
              isValidating={validatingTcsSales}
              onFileSelect={handleSelectTcsSales}
              onFileRemove={handleRemoveTcsSales}
            />

            {/* File 2: tcs_sales_return.xlsx */}
            <MeeshoFileUpload
              fileType="tcs_sales_return"
              fileLabel="tcs_sales_return.xlsx"
              expectedFileName="tcs_sales_return.xlsx"
              file={tcsReturnFile}
              validationResult={tcsReturnValidation}
              isValidating={validatingTcsReturn}
              onFileSelect={handleSelectTcsReturn}
              onFileRemove={handleRemoveTcsReturn}
            />

            {/* File 3: Tax_invoice_details.xlsx */}
            <MeeshoFileUpload
              fileType="tax_invoice_details"
              fileLabel="Tax_invoice_details.xlsx"
              expectedFileName="Tax_invoice_details.xlsx"
              file={taxInvoiceFile}
              validationResult={taxInvoiceValidation}
              isValidating={validatingTaxInvoice}
              onFileSelect={handleSelectTaxInvoice}
              onFileRemove={handleRemoveTaxInvoice}
              topInstructionText="Download Path: Meesho Panel → Payments → Tax Invoice"
              instructionText="Unzip the file and upload only the Excel (Tax_invoice_details.xlsx) file."
            />
          </div>

          {/* Validation Warnings if files missing */}
          {!canUpload && uploadStatus === 'IDLE' && (
            <div className="bg-slate-50 p-3.5 border border-slate-200 rounded-xl text-xs space-y-1">
              <div className="font-bold text-slate-700 flex items-center space-x-1.5 mb-1">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Upload Requirements Checklist:</span>
              </div>
              {!tcsSalesFile && (
                <div className="text-amber-700 font-medium">⚠ tcs_sales.xlsx is required.</div>
              )}
              {!tcsReturnFile && (
                <div className="text-amber-700 font-medium">⚠ tcs_sales_return.xlsx is required.</div>
              )}
              {!taxInvoiceFile && (
                <div className="text-amber-700 font-medium">⚠ Tax_invoice_details.xlsx is required.</div>
              )}
              {isAllFilesSelected && !isAllFilesValid && (
                <div className="text-rose-600 font-bold">
                  ⚠ Please fix invalid files above before proceeding.
                </div>
              )}
            </div>
          )}

          {/* Status Message Banners */}
          {uploadStatus === 'UPLOADING' && (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-800 flex items-center space-x-2.5 animate-pulse">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {uploadStatus === 'DUPLICATE' && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-amber-900 space-y-2">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{statusMessage}</span>
              </div>
              <p className="text-[11px] text-amber-800 font-normal">
                You have already imported Meesho records for this return period ({periodMonth} {periodYear}).
              </p>
            </div>
          )}

          {/* Action Row */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleProcessUpload}
                disabled={!canUpload || isProcessing}
                className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload</span>
                  </>
                )}
              </button>

              <button
                onClick={handleLoadSampleData}
                disabled={isProcessing}
                className="py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5"
                title="Test instantly with pre-filled Meesho sample data"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Load Sample Data ({periodMonth})</span>
              </button>
            </div>
          </div>

          {/* SUCCESS STATE DISPLAY (BELOW UPLOAD BUTTON) */}
          {uploadStatus === 'SUCCESS' && (
            <div className="space-y-3 pt-2 animate-in fade-in duration-200">
              {/* Large Green Success Alert */}
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center space-x-3 shadow-2xs">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-bold text-sm text-emerald-900">File uploaded successfully</span>
              </div>

              {/* Particulars & Info Summary Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="grid grid-cols-2 bg-slate-50 border-b border-slate-200 px-4 py-2.5 font-extrabold text-xs text-slate-700 uppercase tracking-wider">
                  <div>Particulars</div>
                  <div>Info</div>
                </div>
                <div className="divide-y divide-slate-100 text-xs font-semibold text-slate-800">
                  <div className="grid grid-cols-2 px-4 py-3 items-center">
                    <span className="text-slate-600 font-medium">Success Record</span>
                    <span className="font-bold text-slate-900 flex items-center space-x-1.5 font-mono">
                      <span>{uploadSummary?.successRecords ?? 0}</span>
                      <CheckCircle className="w-4 h-4 text-emerald-600 inline shrink-0" />
                    </span>
                  </div>
                  <div className="grid grid-cols-2 px-4 py-3 items-center">
                    <span className="text-slate-600 font-medium">Net Sale</span>
                    <span className="font-bold text-slate-900 font-mono text-sm">
                      {uploadSummary && uploadSummary.netSale !== undefined
                        ? `₹${uploadSummary.netSale.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ERROR STATE DISPLAY */}
          {uploadStatus === 'ERROR' && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center space-x-2.5 mt-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <div className="text-sm font-bold text-rose-900">File upload failed</div>
                <div className="text-xs font-normal text-rose-700 mt-0.5">{statusMessage}</div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-6 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-2xs transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
