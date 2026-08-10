import React from 'react';
import { X, ExternalLink, Download, ShieldCheck, CheckCircle2, FileText } from 'lucide-react';

interface HelpGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpGuide: React.FC<HelpGuideProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold">Meesho GST Download & Filing Guide</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs text-slate-700 leading-relaxed">
          
          {/* Step 1 */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
              <span>How to Download TCS Reports from Meesho Panel</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 font-medium">
              <p>1. Log in to your Meesho Supplier Panel (<span className="text-blue-600 font-mono">supplier.meesho.com</span>).</p>
              <p>2. Go to <strong>Payments</strong> tab in the left sidebar menu.</p>
              <p>3. Click on <strong>GST Reports</strong>.</p>
              <p>4. Select Return Period (e.g., <strong>July 2026</strong>) and click <strong>Download Reports</strong>.</p>
              <p className="text-rose-600 font-bold">5. You will receive <span className="font-mono">tcs_sales.xlsx</span> and <span className="font-mono">tcs_sales_return.xlsx</span>.</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
              <span>How to Download Tax Invoice Details</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 font-medium">
              <p>1. In Meesho Supplier Panel, navigate to <strong>Payments → Tax Invoice</strong>.</p>
              <p>2. Download the Zip file for the selected return month.</p>
              <p>3. Unzip the file on your computer to get <strong>Tax_invoice_details.xlsx</strong>.</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
              <span>Import & Generate GSTR-1 File</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 font-medium">
              <p>1. In this GST Online Seller tool, open <strong>Import Data → Meesho</strong>.</p>
              <p>2. Choose the 3 downloaded Excel files and click <strong>Upload & Process Data</strong>.</p>
              <p>3. Go to <strong>GSTR1 Report</strong> tab and click <strong>Export GST Portal JSON</strong>.</p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">4</span>
              <span>Upload to Government GST Portal (`gst.gov.in`)</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1.5 text-emerald-950 font-medium">
              <p>1. Open <a href="https://gst.gov.in" target="_blank" rel="noreferrer" className="text-emerald-700 font-bold underline">gst.gov.in</a> and log in to your account.</p>
              <p>2. Go to <strong>Services → Returns → Returns Dashboard</strong>.</p>
              <p>3. Select Financial Year and Month → Click <strong>GSTR-1 Prepare Offline</strong>.</p>
              <p>4. Upload the JSON file exported from this tool. All B2CS state-wise sales and HSN entries will be auto-filled!</p>
            </div>
          </div>

        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
          >
            Got it, Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
