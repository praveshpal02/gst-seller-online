import React from 'react';
import { CheckCircle2, AlertCircle, Upload, Trash2, FileSpreadsheet, Loader2 } from 'lucide-react';
import { FileValidationResult, MeeshoFileType } from './MeeshoFileValidator';

interface MeeshoFileUploadProps {
  fileType: MeeshoFileType;
  fileLabel: string;
  expectedFileName: string;
  file: File | null;
  validationResult: FileValidationResult | null;
  isValidating: boolean;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  instructionText?: string;
  topInstructionText?: string;
}

export const MeeshoFileUpload: React.FC<MeeshoFileUploadProps> = ({
  fileType,
  fileLabel,
  expectedFileName,
  file,
  validationResult,
  isValidating,
  onFileSelect,
  onFileRemove,
  instructionText,
  topInstructionText
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  return (
    <div className="space-y-1.5">
      {topInstructionText && (
        <div className="text-xs font-semibold text-teal-600 flex items-center gap-1">
          <span>{topInstructionText}</span>
        </div>
      )}

      <div className={`border rounded-xl p-3.5 transition-all ${
        validationResult && !validationResult.isValid
          ? 'border-rose-300 bg-rose-50/40'
          : validationResult?.isValid
          ? 'border-emerald-300 bg-emerald-50/30'
          : 'border-slate-200 bg-slate-50/80 hover:border-slate-300'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* File Label / Name & Status Info */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              validationResult?.isValid
                ? 'bg-emerald-100 text-emerald-700'
                : validationResult && !validationResult.isValid
                ? 'bg-rose-100 text-rose-700'
                : file
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-200/80 text-slate-600'
            }`}>
              {isValidating ? (
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              ) : (
                <FileSpreadsheet className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-slate-800 tracking-tight truncate">
                  {file ? file.name : fileLabel}
                </span>

                {isValidating && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                    <span>Validating...</span>
                  </span>
                )}

                {!isValidating && validationResult?.isValid && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>✓ Valid</span>
                  </span>
                )}

                {!isValidating && validationResult && !validationResult.isValid && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    <span>✕ Invalid</span>
                  </span>
                )}
              </div>

              {file ? (
                <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 mt-0.5 font-medium truncate">
                  <span className="text-slate-700 font-semibold truncate">{file.name}</span>
                  <span>·</span>
                  <span className="font-mono">{validationResult?.fileSizeFormatted}</span>
                  {validationResult?.rowCount !== undefined && validationResult.isValid && (
                    <>
                      <span>·</span>
                      <span className="text-emerald-700 font-bold">{validationResult.rowCount} rows</span>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                  Accepted: .xlsx (Excel)
                </div>
              )}
            </div>
          </div>

          {/* Controls: Change or Delete / Choose File */}
          <div className="flex items-center space-x-2 shrink-0 justify-end">
            {file ? (
              <div className="flex items-center space-x-2">
                <label className="cursor-pointer px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-[11px] font-bold text-slate-700 shadow-2xs transition-colors flex items-center space-x-1">
                  <span>Change</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleInputChange}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={onFileRemove}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Delete selected file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer px-4 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 shadow-2xs transition-all flex items-center space-x-1.5">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Choose File</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleInputChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Validation Error Banner */}
        {!isValidating && validationResult && !validationResult.isValid && (
          <div className="mt-3 bg-[#ee436b] text-white p-3.5 rounded-xl shadow-sm space-y-1 animate-in fade-in slide-in-from-top-1">
            <div className="text-xs font-semibold leading-relaxed whitespace-pre-wrap break-words">
              {validationResult.error}
            </div>
          </div>
        )}
      </div>

      {instructionText && (
        <p className="text-[11px] font-semibold text-teal-600 pl-1">
          {instructionText}
        </p>
      )}
    </div>
  );
};
