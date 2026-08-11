import * as XLSX from 'xlsx';
import type { MeeshoTransaction, MeeshoDocumentReference } from '../types';
import { analyzeWorksheetHeaders, SheetHeaderAnalysis } from '../components/gst-online-seller/import/meesho/MeeshoFileValidator';

export interface UploadedFilesMap {
  tcsSales?: File;
  tcsSalesReturn?: File;
  taxInvoice?: File;
}

const ID_KEY_PATTERNS = [
  'order', 'suborder', 'creditnote', 'invoiceno', 'invoicenumber',
  'invoiceid', 'taxinvoiceno', 'gstin', 'arn', 'irn', 'tracking',
  'shipment', 'sku', 'date', 'state', 'customer', 'supplier', 'document',
  'reference', 'awb', 'trackingnumber'
];

const NUMERIC_IDENTIFIER_EXACT = new Set([
  'id', 'orderno', 'ordernumber', 'orderid', 'suborderno', 'subordernumber',
  'suborderid', 'creditnoteno', 'creditnotenumber', 'invoiceno',
  'invoicenumber', 'invoiceid', 'taxinvoiceno', 'taxinvoicenumber',
  'awb', 'awbno', 'trackingno', 'trackingnumber', 'documentno', 'documentnumber'
]);

function normalizeKey(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isIdKey(keyClean: string): boolean {
  if (NUMERIC_IDENTIFIER_EXACT.has(keyClean)) return true;
  return ID_KEY_PATTERNS.some((p) => keyClean.includes(p));
}

function isNumericIdentifierHeader(rawKey: string): boolean {
  const clean = normalizeKey(rawKey);
  if (NUMERIC_IDENTIFIER_EXACT.has(clean)) return true;
  return /^(?:creditnote|suborder|order|invoice|taxinvoice|document)(?:no|number|id|ref|reference)$/.test(clean);
}

/**
 * Safely parses any number value from Excel cells (including currency formatting, string floats, etc.)
 */
export function parseNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  // Filter out dates (e.g. 2026-07-15) or hyphenated IDs (e.g. MEESHO-ORD-123)
  if (str.includes('-') && str.length > 7 && !str.startsWith('-')) return 0;
  // Filter out order IDs / GSTINs that are long digit strings (> 12 digits without decimal)
  if (/^\d{13,}$/.test(str)) return 0;
  // Filter out GSTIN alphanumeric patterns (e.g. 07AAAAA0000A1Z5)
  if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(str)) return 0;

  const cleanStr = str.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleanStr);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Safely extracts a string or numeric value from a row using aliases.
 * Uses exact clean key match first, then partial clean key match for specific aliases.
 */
function getValueFromRow(row: Record<string, any>, aliases: string[], isNumericField = false): any {
  if (!row) return '';

  const keys = Object.keys(row);
  const candidates: Array<{ value: any; score: number; key: string }> = [];

  for (const key of keys) {
    const keyClean = normalizeKey(key);
    if (!keyClean) continue;

    if (isNumericField && (isIdKey(keyClean) || isNumericIdentifierHeader(key))) continue;

    // Filter out supplier/seller/vendor/dispatch/origin state headers when extracting customer/POS state
    if (!isNumericField && (
      keyClean.includes('supplier') ||
      keyClean.includes('seller') ||
      keyClean.includes('vendor') ||
      keyClean.includes('dispatch') ||
      keyClean.includes('origin') ||
      keyClean.includes('pickup') ||
      keyClean.includes('fromstate') ||
      keyClean.includes('gstinstate')
    )) {
      continue;
    }

    for (const alias of aliases) {
      const aliasClean = normalizeKey(alias);
      if (!aliasClean) continue;

      let score = -1;
      if (keyClean === aliasClean) {
        score = 10000 + aliasClean.length;
      } else if (keyClean.startsWith(aliasClean) && aliasClean.length >= 5) {
        score = 7000 + aliasClean.length;
      } else if (keyClean.endsWith(aliasClean) && aliasClean.length >= 5) {
        score = 6500 + aliasClean.length;
      } else if (keyClean.includes(aliasClean) && aliasClean.length >= 5) {
        score = 5000 + aliasClean.length;
      }

      if (score >= 0) {
        const val = row[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          candidates.push({ value: val, score, key });
        }
      }
    }
  }

  if (candidates.length === 0) return '';
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].value;
}

export function getAllSheetsAnalysis(workbook: XLSX.WorkBook): SheetHeaderAnalysis[] {
  if (!workbook || workbook.SheetNames.length === 0) return [];

  const sheets: SheetHeaderAnalysis[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const analysis = analyzeWorksheetHeaders(sheet, sheetName);
    if (analysis && analysis.rows.length > 0 && analysis.rawHeaders.length > 0) {
      sheets.push(analysis);
    }
  }
  return sheets;
}

export function getBestSheetAnalysis(workbook: XLSX.WorkBook): SheetHeaderAnalysis | null {
  const sheets = getAllSheetsAnalysis(workbook);
  if (sheets.length === 0) return null;
  return sheets.reduce((best, curr) => (curr.rawHeaders.length > best.rawHeaders.length ? curr : best), sheets[0]);
}

export interface MeeshoImportSummary {
  successRecords: number;
  netSale: number;
  salesRecordsCount: number;
  returnsRecordsCount: number;
  salesTaxableValue: number;
  returnsTaxableValue: number;
}

export function calculateMeeshoImportSummary(
  transactions: MeeshoTransaction[]
): MeeshoImportSummary {
  const salesItems = transactions.filter((t) => t.type === 'Sales');
  const returnItems = transactions.filter((t) => t.type === 'Return');

  const salesTaxable = salesItems.reduce((acc, t) => acc + (t.taxableValue || 0), 0);
  const returnsTaxable = returnItems.reduce((acc, t) => acc + (t.taxableValue || 0), 0);

  const rawNetSale = salesTaxable - returnsTaxable;
  const netSale = Math.round(rawNetSale * 100) / 100;
  const successRecords = salesItems.length + returnItems.length;

  return {
    successRecords,
    netSale,
    salesRecordsCount: salesItems.length,
    returnsRecordsCount: returnItems.length,
    salesTaxableValue: salesTaxable,
    returnsTaxableValue: returnsTaxable
  };
}

export async function parseMeeshoExcelFiles(
  files: UploadedFilesMap,
  sellerStateCode: string = '07'
): Promise<MeeshoTransaction[]> {
  const salesTransactions: MeeshoTransaction[] = [];
  const returnTransactions: MeeshoTransaction[] = [];
  const documentRegistry: MeeshoDocumentReference[] = [];

  const orderIdAliases = [
    'sub order no', 'suborder no', 'sub order number', 'suborder number',
    'sub order id', 'suborder id', 'return order id', 'sub order', 'suborder',
    'credit note no', 'credit note number', 'order id', 'order no', 'order number', 'id'
  ];

  const stateAliases = [
    'end customer state new', 'end_customer_state_new', 'end customer state', 'customer state', 'delivery state', 'shipping state',
    'ship to state', 'place of supply', 'pos state', 'pos', 'destination state',
    'state name', 'state'
  ];

  const salesTaxableAliases = [
    'total taxable supply value', 'total taxable supplies value', 'total taxable supply value rs',
    'total taxable sale value', 'total taxable sales value', 'taxable supply value',
    'taxable sale value', 'total taxable value', 'taxable value', 'taxable_value',
    'taxable amount', 'net taxable amount', 'net taxable value', 'tcs taxable amount',
    'tcs taxable value', 'taxable'
  ];

  const returnTaxableAliases = [
    'total taxable supply value', 'total taxable supplies value', 'total taxable supply value rs',
    'total taxable sale value', 'total taxable sales value', 'taxable supply value',
    'taxable sale value', 'return taxable value', 'taxable return value',
    'total taxable value', 'taxable value', 'taxable_value', 'credit note value',
    'credit_note_value', 'taxable amount', 'net taxable amount', 'refund taxable amount',
    'taxable'
  ];

  const gstRateAliases = ['gst rate', 'rate of tax', 'tax rate', 'gst %', 'gst_rate', 'rate'];
  const igstAliases = ['igst amount', 'igst', 'integrated tax amount', 'integrated tax'];
  const cgstAliases = ['cgst amount', 'cgst', 'central tax amount', 'central tax'];
  const sgstAliases = ['sgst amount', 'sgst', 'state tax amount', 'state tax', 'utgst amount', 'utgst'];
  const taxAmountAliases = ['tax amount', 'tax_amount', 'total tax amount', 'total_tax_amount', 'tax amount rs', 'tax_amount_rs', 'tax amount (rs)', 'tax'];
  const dateAliases = ['order date', 'return date', 'invoice date', 'credit note date', 'transaction date', 'date'];
  const invoiceNumberAliases = [
    'invoice number', 'invoice no', 'invoice #', 'tax invoice number', 'tax invoice no',
    'invoice id', 'document number', 'document no', 'original invoice number'
  ];
  const creditNoteNumberAliases = [
    'credit note number', 'credit note no', 'credit note #', 'credit note id',
    'creditnote number', 'creditnote no', 'document number', 'document no'
  ];
  const invoiceValueAliases = [
    'total invoice value', 'total_invoice_value', 'total invoice value rs', 'total_invoice_value_rs',
    'invoice_value', 'invoice value', 'total invoice amount', 'total_invoice_amount',
    'invoice amount', 'invoice_amount', 'total invoice', 'total_invoice'
  ];
  const statusAliases = ['status', 'document status', 'invoice status', 'credit note status', 'cancel status', 'cancellation status'];

  // 1. Process TCS Sales File
  if (files.tcsSales) {
    try {
      const data = await files.tcsSales.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheets = getAllSheetsAnalysis(workbook);

      sheets.forEach((sheetAnalysis, sIdx) => {
        sheetAnalysis.rows.forEach((row, idx) => {
          const rawOrderId = String(getValueFromRow(row, orderIdAliases) || '').trim();
          const posStateRaw = String(getValueFromRow(row, stateAliases) || 'Delhi').trim();
          const taxableVal = parseNumber(getValueFromRow(row, salesTaxableAliases, true));
          const rawInvVal = parseNumber(getValueFromRow(row, invoiceValueAliases, true));
          const gstRateRaw = String(getValueFromRow(row, gstRateAliases, true) || '5');
          const gstRate = parseNumber(gstRateRaw) || 5;
          const dateStr = String(getValueFromRow(row, dateAliases) || new Date().toISOString().split('T')[0]).trim();

          const { stateCode, stateName } = resolveIndianState(posStateRaw);
          const isInterState = stateCode !== sellerStateCode;

          if (stateCode === '22' || /chhatt|chatt|cg|22/i.test(posStateRaw)) {
            console.log('[CHHATTISGARH TRACE - TCS SALES]', {
              sourceFile: files.tcsSales?.name || 'tcs_sales.xlsx',
              rowNumber: idx + (sheetAnalysis.headerRowIndex !== undefined ? sheetAnalysis.headerRowIndex + 2 : 2),
              sub_order_num: rawOrderId,
              end_customer_state_new: posStateRaw,
              resolvedState: stateName,
              resolvedPOS: stateCode,
              taxableValue: taxableVal,
              gstRate
            });
          }

          if (rawOrderId || taxableVal !== 0) {
            // TCS Sales contains legitimate negative adjustment/discount rows.
            // Preserve the source sign; converting these to positive values inflates B2CS by exactly 2x the negative amount.
            let finalTaxable = taxableVal;
            // Sanity cap: single B2C line item in Meesho reports does not exceed 10 Lakhs.
            if (Math.abs(finalTaxable) > 1000000) finalTaxable = 0;
            const orderId = rawOrderId || `TCS-ORD-${sIdx}-${idx}`;

            let igstFromRow = parseNumber(getValueFromRow(row, igstAliases, true));
            let cgstFromRow = parseNumber(getValueFromRow(row, cgstAliases, true));
            let sgstFromRow = parseNumber(getValueFromRow(row, sgstAliases, true));
            let taxAmountFromRow = parseNumber(getValueFromRow(row, taxAmountAliases, true));

            if (igstFromRow === 0 && cgstFromRow === 0 && sgstFromRow === 0 && taxAmountFromRow !== 0) {
              if (isInterState) {
                igstFromRow = taxAmountFromRow;
              } else {
                cgstFromRow = taxAmountFromRow / 2;
                sgstFromRow = taxAmountFromRow / 2;
              }
            }

            // Sanity check: tax for a single item shouldn't exceed 35% of taxable value
            if (igstFromRow > finalTaxable * 0.35) igstFromRow = 0;
            if (cgstFromRow > finalTaxable * 0.35) cgstFromRow = 0;
            if (sgstFromRow > finalTaxable * 0.35) sgstFromRow = 0;

            const hasRowTax = Math.abs(igstFromRow) > 0.001 || Math.abs(cgstFromRow) > 0.001 || Math.abs(sgstFromRow) > 0.001;

            let igstAmount = 0;
            let cgstAmount = 0;
            let sgstAmount = 0;

            if (hasRowTax) {
              igstAmount = Math.abs(igstFromRow);
              cgstAmount = Math.abs(cgstFromRow);
              sgstAmount = Math.abs(sgstFromRow);
            } else {
              const taxTotal = finalTaxable * (gstRate / 100);
              if (isInterState) {
                igstAmount = taxTotal;
              } else {
                cgstAmount = taxTotal / 2;
                sgstAmount = taxTotal / 2;
              }
            }

            const tcsTotal = Math.round((finalTaxable * 0.01) * 100) / 100;
            const calculatedGross = Math.round((finalTaxable + igstAmount + cgstAmount + sgstAmount) * 100) / 100;
            const invoiceValue = rawInvVal !== 0 ? rawInvVal : calculatedGross;

            salesTransactions.push({
              id: `tcs-s-${sIdx}-${idx}-${Date.now()}`,
              orderId,
              subOrderId: orderId,
              orderDate: dateStr,
              invoiceDate: dateStr,
              invoiceNumber: String(getValueFromRow(row, invoiceNumberAliases) || '').trim() || undefined,
              isCancelled: /cancel|cancelled|canceled/i.test(String(getValueFromRow(row, statusAliases) || '')),
              type: 'Sales',
              posStateCode: stateCode,
              posStateName: stateName,
              isInterState,
              hsnCode: '6109',
              quantity: 1,
              grossAmount: calculatedGross,
              taxableValue: finalTaxable,
              gstRate,
              igstAmount,
              cgstAmount,
              sgstAmount,
              tcsIgst: isInterState ? tcsTotal : 0,
              tcsCgst: !isInterState ? Math.round((tcsTotal / 2) * 100) / 100 : 0,
              tcsSgst: !isInterState ? Math.round((tcsTotal / 2) * 100) / 100 : 0,
              totalTcs: tcsTotal,
              invoiceValue,
              sourceFile: files.tcsSales?.name || 'tcs_sales.xlsx',
              sourceSheet: sheetAnalysis.sheetName,
              sourceRow: idx + (sheetAnalysis.headerRowIndex !== undefined ? sheetAnalysis.headerRowIndex + 2 : 2)
            });
          }
        });
      });
    } catch (err) {
      console.error('Error parsing TCS Sales file:', err);
    }
  }

  // 2. Process TCS Sales Return File
  if (files.tcsSalesReturn) {
    try {
      const data = await files.tcsSalesReturn.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheets = getAllSheetsAnalysis(workbook);

      sheets.forEach((sheetAnalysis, sIdx) => {
        sheetAnalysis.rows.forEach((row, idx) => {
          const rawOrderId = String(getValueFromRow(row, orderIdAliases) || '').trim();
          const posStateRaw = String(getValueFromRow(row, stateAliases) || 'Delhi').trim();
          const taxableVal = parseNumber(getValueFromRow(row, returnTaxableAliases, true));
          const rawInvVal = parseNumber(getValueFromRow(row, invoiceValueAliases, true));
          const gstRateRaw = String(getValueFromRow(row, gstRateAliases, true) || '5');
          const gstRate = parseNumber(gstRateRaw) || 5;
          const dateStr = String(getValueFromRow(row, dateAliases) || new Date().toISOString().split('T')[0]).trim();

          const { stateCode, stateName } = resolveIndianState(posStateRaw);
          const isInterState = stateCode !== sellerStateCode;

          if (stateCode === '22' || /chhatt|chatt|cg|22/i.test(posStateRaw)) {
            console.log('[CHHATTISGARH TRACE - TCS RETURN]', {
              sourceFile: files.tcsSalesReturn?.name || 'tcs_sales_return.xlsx',
              rowNumber: idx + (sheetAnalysis.headerRowIndex !== undefined ? sheetAnalysis.headerRowIndex + 2 : 2),
              sub_order_num: rawOrderId,
              end_customer_state_new: posStateRaw,
              resolvedState: stateName,
              resolvedPOS: stateCode,
              taxableValue: taxableVal,
              gstRate
            });
          }

          if (rawOrderId || taxableVal !== 0) {
            // Return report values are positive amounts and are applied as deductions by the calculator.
            let finalTaxable = Math.abs(taxableVal);
            if (Math.abs(finalTaxable) > 1000000) finalTaxable = 0;
            const orderId = rawOrderId || `RET-ORD-${sIdx}-${idx}`;

            let igstFromRow = parseNumber(getValueFromRow(row, igstAliases, true));
            let cgstFromRow = parseNumber(getValueFromRow(row, cgstAliases, true));
            let sgstFromRow = parseNumber(getValueFromRow(row, sgstAliases, true));
            let taxAmountFromRow = parseNumber(getValueFromRow(row, taxAmountAliases, true));

            if (igstFromRow === 0 && cgstFromRow === 0 && sgstFromRow === 0 && taxAmountFromRow !== 0) {
              if (isInterState) {
                igstFromRow = taxAmountFromRow;
              } else {
                cgstFromRow = taxAmountFromRow / 2;
                sgstFromRow = taxAmountFromRow / 2;
              }
            }

            if (igstFromRow > finalTaxable * 0.35) igstFromRow = 0;
            if (cgstFromRow > finalTaxable * 0.35) cgstFromRow = 0;
            if (sgstFromRow > finalTaxable * 0.35) sgstFromRow = 0;

            const hasRowTax = Math.abs(igstFromRow) > 0.001 || Math.abs(cgstFromRow) > 0.001 || Math.abs(sgstFromRow) > 0.001;

            let igstAmount = 0;
            let cgstAmount = 0;
            let sgstAmount = 0;

            if (hasRowTax) {
              igstAmount = Math.abs(igstFromRow);
              cgstAmount = Math.abs(cgstFromRow);
              sgstAmount = Math.abs(sgstFromRow);
            } else {
              const taxTotal = finalTaxable * (gstRate / 100);
              if (isInterState) {
                igstAmount = taxTotal;
              } else {
                cgstAmount = taxTotal / 2;
                sgstAmount = taxTotal / 2;
              }
            }

            const tcsTotal = Math.round((finalTaxable * 0.01) * 100) / 100;
            const calculatedGross = Math.round((finalTaxable + igstAmount + cgstAmount + sgstAmount) * 100) / 100;
            const invoiceValue = rawInvVal !== 0 ? Math.abs(rawInvVal) : calculatedGross;

            returnTransactions.push({
              id: `tcs-r-${sIdx}-${idx}-${Date.now()}`,
              orderId,
              subOrderId: orderId,
              orderDate: dateStr,
              invoiceDate: dateStr,
              invoiceNumber: String(getValueFromRow(row, creditNoteNumberAliases) || '').trim() || undefined,
              isCancelled: /cancel|cancelled|canceled/i.test(String(getValueFromRow(row, statusAliases) || '')),
              type: 'Return',
              posStateCode: stateCode,
              posStateName: stateName,
              isInterState,
              hsnCode: '6109',
              quantity: 1,
              grossAmount: calculatedGross,
              taxableValue: finalTaxable,
              gstRate,
              igstAmount,
              cgstAmount,
              sgstAmount,
              tcsIgst: isInterState ? tcsTotal : 0,
              tcsCgst: !isInterState ? Math.round((tcsTotal / 2) * 100) / 100 : 0,
              tcsSgst: !isInterState ? Math.round((tcsTotal / 2) * 100) / 100 : 0,
              totalTcs: tcsTotal,
              invoiceValue,
              sourceFile: files.tcsSalesReturn?.name || 'tcs_sales_return.xlsx',
              sourceSheet: sheetAnalysis.sheetName,
              returnCategory: sheetAnalysis.sheetName,
              sourceRow: idx + (sheetAnalysis.headerRowIndex !== undefined ? sheetAnalysis.headerRowIndex + 2 : 2)
            });
          }
        });
      });
    } catch (err) {
      console.error('Error parsing TCS Sales Return file:', err);
    }
  }

  // 3. Process Tax Invoice File
  if (files.taxInvoice) {
    try {
      const data = await files.taxInvoice.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheets = getAllSheetsAnalysis(workbook);

      if (salesTransactions.length > 0 || returnTransactions.length > 0) {
        sheets.forEach((sheetAnalysis) => {
          sheetAnalysis.rows.forEach((row) => {
            const subOrderId = String(getValueFromRow(row, orderIdAliases)).trim();
            const hsnCode = String(getValueFromRow(row, ['hsn code', 'hsn', 'sac', 'hsn_code'])).trim();
            const gstRate = parseNumber(getValueFromRow(row, gstRateAliases, true));
            const igst = parseNumber(getValueFromRow(row, igstAliases, true));
            const cgst = parseNumber(getValueFromRow(row, cgstAliases, true));
            const sgst = parseNumber(getValueFromRow(row, sgstAliases, true));

            const documentTypeRaw = String(getValueFromRow(row, ['type', 'document type']) || '').trim().toUpperCase();
            const invoiceNo = String(getValueFromRow(row, invoiceNumberAliases) || '').trim();
            const normalizedDocumentType: MeeshoDocumentReference['type'] =
              documentTypeRaw === 'CREDIT NOTE' ? 'CREDIT_NOTE' :
              documentTypeRaw === 'CREDIT_DISCOUNT' ? 'CREDIT_DISCOUNT' :
              documentTypeRaw === 'CREDIT_CONVERSION' ? 'CREDIT_CONVERSION' :
              'INVOICE';

            // Tax Invoice Details is the authoritative document-number source.
            // Keep every document in a registry, including documents that have no
            // one-to-one TCS row. This is required because the file has 255 invoices
            // while TCS Sales has only 248 rows.
            if (invoiceNo) {
              documentRegistry.push({
                type: normalizedDocumentType,
                number: invoiceNo,
                cancelled: /cancel|cancelled|canceled/i.test(String(getValueFromRow(row, statusAliases) || ''))
              });
            }

            if (subOrderId) {
              const preferredList = normalizedDocumentType === 'INVOICE' ? salesTransactions : returnTransactions;
              const fallbackList = normalizedDocumentType === 'INVOICE' ? returnTransactions : salesTransactions;
              const match = preferredList.find(
                (t) => (t.subOrderId === subOrderId || t.orderId === subOrderId) && !t.invoiceNumber
              ) || preferredList.find(
                (t) => t.subOrderId === subOrderId || t.orderId === subOrderId
              ) || fallbackList.find(
                (t) => t.subOrderId === subOrderId || t.orderId === subOrderId
              );
              if (match) {
                if (hsnCode) match.hsnCode = hsnCode;
                if (gstRate && gstRate > 0 && gstRate <= 28) match.gstRate = gstRate;
                if (igst > 0 && igst <= Math.abs(match.taxableValue) * 0.35) match.igstAmount = Math.sign(match.taxableValue || 1) * igst;
                if (cgst > 0 && cgst <= Math.abs(match.taxableValue) * 0.35) match.cgstAmount = Math.sign(match.taxableValue || 1) * cgst;
                if (sgst > 0 && sgst <= Math.abs(match.taxableValue) * 0.35) match.sgstAmount = Math.sign(match.taxableValue || 1) * sgst;
                match.invoiceNumber = invoiceNo || match.invoiceNumber;
                match.documentType = normalizedDocumentType;
                match.grossAmount = Math.round((match.taxableValue + match.igstAmount + match.cgstAmount + match.sgstAmount) * 100) / 100;
              }
            }
          });
        });
      } else {
        // Fallback when TCS Sales/Return files are missing
        sheets.forEach((sheetAnalysis, sIdx) => {
          sheetAnalysis.rows.forEach((row, idx) => {
            const rawOrderId = String(getValueFromRow(row, orderIdAliases) || '').trim();
            const posStateRaw = String(getValueFromRow(row, stateAliases) || 'Delhi').trim();
            const hsnCode = String(getValueFromRow(row, ['hsn code', 'hsn', 'sac']) || '6109').trim();
            const qty = parseNumber(getValueFromRow(row, ['quantity', 'qty', 'units'], true)) || 1;
            const taxableVal = parseNumber(getValueFromRow(row, salesTaxableAliases, true));
            const rawInvVal = parseNumber(getValueFromRow(row, invoiceValueAliases, true));
            const gstRate = parseNumber(getValueFromRow(row, gstRateAliases, true)) || 5;
            let igst = parseNumber(getValueFromRow(row, igstAliases, true));
            let cgst = parseNumber(getValueFromRow(row, cgstAliases, true));
            let sgst = parseNumber(getValueFromRow(row, sgstAliases, true));
            const invoiceDate = String(getValueFromRow(row, dateAliases) || new Date().toISOString().split('T')[0]).trim();

            const { stateCode, stateName } = resolveIndianState(posStateRaw);
            const isInterState = stateCode !== sellerStateCode;

            if (rawOrderId || taxableVal !== 0) {
              let finalTaxable = Math.abs(taxableVal);
              if (finalTaxable > 1000000) finalTaxable = 0;
              const orderId = rawOrderId || `ORD-TX-${sIdx}-${idx}`;
              const tcsTotal = Math.round((finalTaxable * 0.01) * 100) / 100;

              if (igst > finalTaxable * 0.35) igst = 0;
              if (cgst > finalTaxable * 0.35) cgst = 0;
              if (sgst > finalTaxable * 0.35) sgst = 0;

              const taxTotal = Math.round(((igst || (cgst + sgst)) || (finalTaxable * (gstRate / 100))) * 100) / 100;
              const calculatedGross = Math.round((finalTaxable + taxTotal) * 100) / 100;
              const invoiceValue = rawInvVal !== 0 ? Math.abs(rawInvVal) : calculatedGross;

              salesTransactions.push({
                id: `tx-inv-${sIdx}-${idx}-${Date.now()}`,
                orderId,
                subOrderId: orderId,
                orderDate: invoiceDate,
                invoiceDate,
                invoiceNumber: String(getValueFromRow(row, invoiceNumberAliases) || '').trim() || undefined,
                isCancelled: /cancel|cancelled|canceled/i.test(String(getValueFromRow(row, statusAliases) || '')),
                type: 'Sales',
                posStateCode: stateCode,
                posStateName: stateName,
                isInterState,
                hsnCode,
                quantity: qty,
                grossAmount: calculatedGross,
                taxableValue: finalTaxable,
                gstRate,
                igstAmount: igst || (isInterState ? taxTotal : 0),
                cgstAmount: cgst || (!isInterState ? Math.round((taxTotal / 2) * 100) / 100 : 0),
                sgstAmount: sgst || (!isInterState ? Math.round((taxTotal / 2) * 100) / 100 : 0),
                tcsIgst: isInterState ? tcsTotal : 0,
                tcsCgst: !isInterState ? Math.round((tcsTotal / 2) * 100) / 100 : 0,
                tcsSgst: !isInterState ? Math.round((tcsTotal / 2) * 100) / 100 : 0,
                totalTcs: tcsTotal,
                invoiceValue,
                sourceFile: files.taxInvoice?.name || 'Tax_invoice_details.xlsx',
                sourceSheet: sheetAnalysis.sheetName,
                sourceRow: idx + (sheetAnalysis.headerRowIndex !== undefined ? sheetAnalysis.headerRowIndex + 2 : 2)
              });
            }
          });
        });
      }
    } catch (err) {
      console.error('Error parsing Tax Invoice details file:', err);
    }
  }

  // Meesho return exports can repeat the same credit-note row across sheets.
  // Keep legitimate multi-line sales/returns, but remove exact duplicate return rows.
  const seenReturnRows = new Set<string>();
  const normalizedReturns = returnTransactions.filter((tx) => {
    const doc = (tx.invoiceNumber || tx.subOrderId || tx.orderId || '').toLowerCase().trim();
    const key = [
      doc,
      tx.taxableValue.toFixed(2),
      tx.gstRate,
      tx.posStateCode,
      tx.igstAmount.toFixed(2),
      tx.cgstAmount.toFixed(2),
      tx.sgstAmount.toFixed(2)
    ].join('|');

    if (!doc || seenReturnRows.has(key)) return false;
    seenReturnRows.add(key);
    return true;
  });

  const allTransactions = [...salesTransactions, ...normalizedReturns];

  // Persist the authoritative Tax Invoice document registry inside the imported
  // dataset so it survives localStorage and is available to Section 13 without
  // contaminating B2CS with synthetic zero-value transactions.
  if (allTransactions.length > 0 && documentRegistry.length > 0) {
    documentRegistry.forEach((doc, index) => {
      const target = allTransactions[index % allTransactions.length];
      target.documentReferences = [...(target.documentReferences || []), doc];
    });
  }

  const summary = calculateMeeshoImportSummary(allTransactions);

  const pos22Recs = allTransactions.filter(t => t.posStateCode === '22');
  const pos26Recs = allTransactions.filter(t => t.posStateCode === '26');
  const pos07Recs = allTransactions.filter(t => t.posStateCode === '07');

  console.log('[PARSER EXECUTED] src/utils/excelParser.ts -> parseMeeshoExcelFiles');
  console.log(`Total Normalized Transactions: ${allTransactions.length} (Sales: ${salesTransactions.length}, Returns: ${returnTransactions.length})`);
  console.log(`POS 22 (Chhattisgarh) records count: ${pos22Recs.length}, Net Taxable: ${pos22Recs.reduce((a, t) => a + (t.type === 'Sales' ? t.taxableValue : -t.taxableValue), 0)}`);
  console.log(`POS 26 (Dadra & Nagar Haveli/Daman & Diu) records count: ${pos26Recs.length}, Net Taxable: ${pos26Recs.reduce((a, t) => a + (t.type === 'Sales' ? t.taxableValue : -t.taxableValue), 0)}`);
  console.log(`POS 07 (Delhi) records count: ${pos07Recs.length}, Net Taxable: ${pos07Recs.reduce((a, t) => a + (t.type === 'Sales' ? t.taxableValue : -t.taxableValue), 0)}`);
  console.log('====================================');
  console.log('MEESHO IMPORT SUMMARY');
  console.log(`TCS Sales Records: ${summary.salesRecordsCount}`);
  console.log(`TCS Sales Taxable Value: ${summary.salesTaxableValue}`);
  console.log(`TCS Sales Return Records: ${summary.returnsRecordsCount}`);
  console.log(`TCS Sales Return Taxable Value: ${summary.returnsTaxableValue}`);
  console.log(`Success Records: ${summary.successRecords}`);
  console.log(`Net Sale: ${summary.netSale}`);
  console.log('====================================');

  return allTransactions;
}

interface StateMapEntry {
  code: string;
  name: string;
  aliases: string[];
}

const INDIAN_STATES: StateMapEntry[] = [
  { code: '01', name: 'Jammu & Kashmir', aliases: ['jammu', 'kashmir', 'j&k', 'jk'] },
  { code: '02', name: 'Himachal Pradesh', aliases: ['himachal', 'hp'] },
  { code: '03', name: 'Punjab', aliases: ['punjab', 'pb'] },
  { code: '04', name: 'Chandigarh', aliases: ['chandigarh', 'ch'] },
  { code: '05', name: 'Uttarakhand', aliases: ['uttarakhand', 'uttaranchal', 'uk', 'ua'] },
  { code: '06', name: 'Haryana', aliases: ['haryana', 'hr'] },
  { code: '07', name: 'Delhi', aliases: ['delhi', 'dl', 'nct', 'new delhi'] },
  { code: '08', name: 'Rajasthan', aliases: ['rajasthan', 'rj'] },
  { code: '09', name: 'Uttar Pradesh', aliases: ['uttar pradesh', 'up'] },
  { code: '10', name: 'Bihar', aliases: ['bihar', 'br'] },
  { code: '11', name: 'Sikkim', aliases: ['sikkim', 'sk'] },
  { code: '12', name: 'Arunachal Pradesh', aliases: ['arunachal', 'ar'] },
  { code: '13', name: 'Nagaland', aliases: ['nagaland', 'nl'] },
  { code: '14', name: 'Manipur', aliases: ['manipur', 'mn'] },
  { code: '15', name: 'Mizoram', aliases: ['mizoram', 'mz'] },
  { code: '16', name: 'Tripura', aliases: ['tripura', 'tr'] },
  { code: '17', name: 'Meghalaya', aliases: ['meghalaya', 'ml'] },
  { code: '18', name: 'Assam', aliases: ['assam', 'as'] },
  { code: '19', name: 'West Bengal', aliases: ['west bengal', 'wb', 'bengal'] },
  { code: '20', name: 'Jharkhand', aliases: ['jharkhand', 'jh'] },
  { code: '21', name: 'Odisha', aliases: ['odisha', 'orissa', 'od', 'or'] },
  { code: '22', name: 'Chhattisgarh', aliases: ['chhattisgarh', 'chattisgarh', 'chhatisgarh', 'chatisgarh', 'cg', 'ct', '22', 'chhattisgarh22', 'chattisgarh22', 'chhatisgarh22', 'chhattisgarh-22', 'chattisgarh-22'] },
  { code: '23', name: 'Madhya Pradesh', aliases: ['madhya pradesh', 'mp'] },
  { code: '24', name: 'Gujarat', aliases: ['gujarat', 'gj'] },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu', aliases: ['daman', 'diu', 'dadra', 'nagar haveli', 'dnh', 'dd', 'dn'] },
  { code: '27', name: 'Maharashtra', aliases: ['maharashtra', 'mh'] },
  { code: '29', name: 'Karnataka', aliases: ['karnataka', 'ka'] },
  { code: '30', name: 'Goa', aliases: ['goa', 'ga'] },
  { code: '31', name: 'Lakshadweep', aliases: ['lakshadweep', 'ld'] },
  { code: '32', name: 'Kerala', aliases: ['kerala', 'kl'] },
  { code: '33', name: 'Tamil Nadu', aliases: ['tamil nadu', 'tamilnadu', 'tn'] },
  { code: '34', name: 'Puducherry', aliases: ['puducherry', 'pondicherry', 'py'] },
  { code: '35', name: 'Andaman and Nicobar Islands', aliases: ['andaman', 'nicobar', 'a&n', 'an'] },
  { code: '36', name: 'Telangana', aliases: ['telangana', 'ts', 'tg'] },
  { code: '37', name: 'Andhra Pradesh', aliases: ['andhra pradesh', 'andhra', 'ap'] },
  { code: '38', name: 'Ladakh', aliases: ['ladakh', 'la'] }
];

export function resolveIndianState(stateInput: string): { stateCode: string; stateName: string } {
  if (!stateInput) return { stateCode: '07', stateName: 'Delhi' };
  const raw = String(stateInput).trim();
  if (!raw) return { stateCode: '07', stateName: 'Delhi' };

  const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Exact clean match on state code, state name, or any alias
  for (const s of INDIAN_STATES) {
    if (s.code === clean || s.code === clean.padStart(2, '0')) {
      return { stateCode: s.code, stateName: s.name };
    }
    const cleanName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanName === clean) {
      return { stateCode: s.code, stateName: s.name };
    }
    for (const alias of s.aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanAlias === clean) {
        return { stateCode: s.code, stateName: s.name };
      }
    }
  }

  // 2. Code match: search for 2-digit state code anywhere in input
  const codeMatch = raw.match(/\b(0[1-9]|[1-3][0-8])\b/) || raw.match(/^(\d{2})/);
  if (codeMatch) {
    const code = codeMatch[1].padStart(2, '0');
    const match = INDIAN_STATES.find((s) => s.code === code);
    if (match) return { stateCode: match.code, stateName: match.name };
  }

  // 3. Match full name or longer aliases (>= 4 chars) contained in clean input
  for (const s of INDIAN_STATES) {
    const cleanName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanName.length >= 4 && clean.includes(cleanName)) {
      return { stateCode: s.code, stateName: s.name };
    }
    for (const alias of s.aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanAlias.length >= 4 && clean.includes(cleanAlias)) {
        return { stateCode: s.code, stateName: s.name };
      }
    }
  }

  // 4. Standalone short alias match (<= 3 chars) using word boundary
  const words = raw.toLowerCase().split(/[^a-z0-9]+/);
  for (const s of INDIAN_STATES) {
    for (const alias of s.aliases) {
      const aliasLower = alias.toLowerCase();
      if (aliasLower.length <= 3 && words.includes(aliasLower)) {
        return { stateCode: s.code, stateName: s.name };
      }
    }
  }

  return { stateCode: '07', stateName: raw || 'Delhi' };
}

export interface ManageDataSummary {
  platforms: number;
  grossSales: number;
  returns: number;
  netTaxableSales: number;
  gstTaxLiability: number;
  tcsClaimable: number;
  salesCount: number;
  returnsCount: number;
}

export function calculateManageDataSummary(transactions: MeeshoTransaction[]): ManageDataSummary {
  if (!transactions || transactions.length === 0) {
    return {
      platforms: 0,
      grossSales: 0,
      returns: 0,
      netTaxableSales: 0,
      gstTaxLiability: 0,
      tcsClaimable: 0,
      salesCount: 0,
      returnsCount: 0
    };
  }

  const sales = transactions.filter((t) => t.type === 'Sales');
  const returns = transactions.filter((t) => t.type === 'Return');

  const grossSales = sales.reduce((acc, t) => acc + (t.taxableValue || 0), 0);
  const returnsVal = returns.reduce((acc, t) => acc + (t.taxableValue || 0), 0);
  const netTaxableSales = Math.round((grossSales - returnsVal) * 100) / 100;

  const salesGst = sales.reduce((acc, t) => acc + (t.igstAmount || 0) + (t.cgstAmount || 0) + (t.sgstAmount || 0), 0);
  const returnsGst = returns.reduce((acc, t) => acc + (t.igstAmount || 0) + (t.cgstAmount || 0) + (t.sgstAmount || 0), 0);
  const gstTaxLiability = Math.round((salesGst - returnsGst) * 100) / 100;

  const salesTcs = sales.reduce((acc, t) => acc + (t.totalTcs || 0), 0);
  const returnsTcs = returns.reduce((acc, t) => acc + (t.totalTcs || 0), 0);
  const tcsClaimable = Math.round((salesTcs - returnsTcs) * 100) / 100;

  return {
    platforms: transactions.length > 0 ? 1 : 0,
    grossSales,
    returns: returnsVal,
    netTaxableSales,
    gstTaxLiability,
    tcsClaimable,
    salesCount: sales.length,
    returnsCount: returns.length
  };
}