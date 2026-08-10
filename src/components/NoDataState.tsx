import React from 'react';
import { Inbox, Upload, FileSpreadsheet, ArrowRight, FileText, Calendar, Building2 } from 'lucide-react';

interface NoDataStateProps {
  title: string;
  description: string;
  periodMonth?: string;
  periodYear?: string;
  gstin?: string;
  onImportClick: () => void;
  onChangeGstinClick?: () => void;
  onOpenHelpGuide?: () => void;
  icon?: React.ReactNode;
  badgeText?: string;
}

export const NoDataState: React.FC<NoDataStateProps> = ({
  title,
  description,
  periodMonth = '',
  periodYear = '',
  gstin = '',
  onImportClick,
  onChangeGstinClick,
  onOpenHelpGuide,
  icon,
  badgeText
}) => {
  const periodText = periodMonth && periodYear ? `${periodMonth} ${periodYear}` : periodMonth || periodYear;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 text-center shadow-xs flex flex-col items-center justify-center max-w-3xl mx-auto space-y-6 my-4">
      {/* Icon Circle */}
      <div className="relative">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shadow-xs border border-blue-100">
          {icon || <Inbox className="w-8 h-8 text-blue-600 stroke-[1.75]" />}
        </div>
        {badgeText && (
          <span className="absolute -bottom-2 -right-2 px-2 py-0.5 bg-blue-600 text-white text-[9px] font-extrabold rounded-full uppercase tracking-wider">
            {badgeText}
          </span>
        )}
      </div>

      {/* Text Content */}
      <div className="space-y-2 max-w-lg">
        <h3 className="text-xl font-bold text-slate-900 tracking-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Active GSTIN + Period Context Badges */}
      {(gstin || periodText) && (
        <div className="inline-flex flex-wrap items-center justify-center gap-2 bg-slate-50 border border-slate-200/80 p-2 rounded-xl text-xs font-semibold text-slate-700">
          {gstin && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-[11px] font-bold shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{gstin}</span>
            </span>
          )}

          {periodText && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 text-[11px] font-bold shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>{periodText}</span>
            </span>
          )}

          {onChangeGstinClick && (
            <button
              onClick={onChangeGstinClick}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 transition-colors"
            >
              Change
            </button>
          )}
        </div>
      )}

      {/* Action Button */}
      <div className="pt-2">
        <button
          onClick={onImportClick}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-2"
        >
          <Upload className="w-4 h-4" />
          <span>Import data</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      {/* Need Help Footer */}
      <div className="pt-4 border-t border-slate-100 w-full flex items-center justify-center space-x-3 text-xs text-slate-400">
        <span>Need Help?</span>
        {onOpenHelpGuide ? (
          <button
            onClick={onOpenHelpGuide}
            className="font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1 hover:underline transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            <span>Read the Guide</span>
          </button>
        ) : (
          <span className="font-semibold text-slate-500">Read the Guide</span>
        )}
      </div>
    </div>
  );
};
