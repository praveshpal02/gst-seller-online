import * as XLSX from 'xlsx';
import { MeeshoTransaction } from '../types';
import { analyzeWorksheetHeaders, SheetHeaderAnalysis } from '../components/gst-online-seller/import/meesho/MeeshoFileValidator';

export interface UploadedFilesMap {
  tcsSales?: File;
  tcsSalesReturn?: File;
  taxInvoice?: File;
}

/**
 * Safely parses any number value from Excel cells (including currency formatting, string floats, etc.)
 */
export function parseNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Safely extracts a string or numeric value from a row using aliases.
 * Uses exact clean key match first, then partial clean key match for specific aliases.
 */
function getValueFromRow(row: Record<string, any>, aliases: string[]): any {
  if (!row) return '';
  const keys = Object.keys(row);

  // 1. First pass: exact clean key match
  for (const alias of aliases) {
    const aliasClean = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!aliasClean) continue;
    for (const key of keys) {
      const keyClean = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (keyClean === aliasClean) {
        const val = row[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return val;
        }
      }
    }
  }

  // 2. Second pass: partial clean key match (.includes)
  for (const alias of aliases) {
    const aliasClean = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!aliasClean || aliasClean.length < 3) continue;
    for (const key of keys) {
      const keyClean = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (keyClean.includes(aliasClean)) {
        const val = row[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return val;
        }
      }
    }
  }

  return '';
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

  const orderIdAliases = [
    'sub order no', 'suborder no', 'sub order number', 'suborder number',
    'sub order id', 'suborder id', 'return order id', 'sub order', 'suborder',
    'credit note no', 'credit note number', 'order id', 'order no', 'order number', 'id'
  ];

  const stateAliases = [
    'end customer state', 'customer state', 'delivery state', 'shipping state',
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
  const dateAliases = ['order date', 'return date', 'invoice date', 'credit note date', 'transaction date', 'date'];

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
          const taxableVal = parseNumber(getValueFromRow(row, salesTaxableAliases));
          const gstRateRaw = String(getValueFromRow(row, gstRateAliases) || '5');
          const gstRate = parseNumber(gstRateRaw) || 5;
          const dateStr = String(getValueFromRow(row, dateAliases) || new Date().toISOString().split('T')[0]).trim();

          const { stateCode, stateName } = resolveIndianState(posStateRaw);
          const isInterState = stateCode !== sellerStateCode;

          if (rawOrderId || taxableVal !== 0) {
            const finalTaxable = Math.abs(taxableVal);
            const orderId = rawOrderId || `TCS-ORD-${sIdx}-${idx}`;

            const igstFromRow = parseNumber(getValueFromRow(row, igstAliases));
            const cgstFromRow = parseNumber(getValueFromRow(row, cgstAliases));
            const sgstFromRow = parseNumber(getValueFromRow(row, sgstAliases));

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

            const tcsTotal = finalTaxable * 0.01;

            salesTransactions.push({
              id: `tcs-s-${sIdx}-${idx}-${Date.now()}`,
              orderId,
              subOrderId: orderId,
              orderDate: dateStr,
              invoiceDate: dateStr,
              type: 'Sales',
              posStateCode: stateCode,
              posStateName: stateName,
              isInterState,
              hsnCode: '6109',
              quantity: 1,
              grossAmount: finalTaxable + igstAmount + cgstAmount + sgstAmount,
              taxableValue: finalTaxable,
              gstRate,
              igstAmount,
              cgstAmount,
              sgstAmount,
              tcsIgst: isInterState ? tcsTotal : 0,
              tcsCgst: !isInterState ? tcsTotal / 2 : 0,
              tcsSgst: !isInterState ? tcsTotal / 2 : 0,
              totalTcs: tcsTotal,
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
          const taxableVal = parseNumber(getValueFromRow(row, returnTaxableAliases));
          const gstRateRaw = String(getValueFromRow(row, gstRateAliases) || '5');
          const gstRate = parseNumber(gstRateRaw) || 5;
          const dateStr = String(getValueFromRow(row, dateAliases) || new Date().toISOString().split('T')[0]).trim();

          const { stateCode, stateName } = resolveIndianState(posStateRaw);
          const isInterState = stateCode !== sellerStateCode;

          if (rawOrderId || taxableVal !== 0) {
            const finalTaxable = Math.abs(taxableVal);
            const orderId = rawOrderId || `RET-ORD-${sIdx}-${idx}`;

            const igstFromRow = parseNumber(getValueFromRow(row, igstAliases));
            const cgstFromRow = parseNumber(getValueFromRow(row, cgstAliases));
            const sgstFromRow = parseNumber(getValueFromRow(row, sgstAliases));

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

            const tcsTotal = finalTaxable * 0.01;

            returnTransactions.push({
              id: `tcs-r-${sIdx}-${idx}-${Date.now()}`,
              orderId,
              subOrderId: orderId,
              orderDate: dateStr,
              invoiceDate: dateStr,
              type: 'Return',
              posStateCode: stateCode,
              posStateName: stateName,
              isInterState,
              hsnCode: '6109',
              quantity: 1,
              grossAmount: finalTaxable + igstAmount + cgstAmount + sgstAmount,
              taxableValue: finalTaxable,
              gstRate,
              igstAmount,
              cgstAmount,
              sgstAmount,
              tcsIgst: isInterState ? tcsTotal : 0,
              tcsCgst: !isInterState ? tcsTotal / 2 : 0,
              tcsSgst: !isInterState ? tcsTotal / 2 : 0,
              totalTcs: tcsTotal,
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
            const gstRate = parseNumber(getValueFromRow(row, gstRateAliases));
            const igst = parseNumber(getValueFromRow(row, igstAliases));
            const cgst = parseNumber(getValueFromRow(row, cgstAliases));
            const sgst = parseNumber(getValueFromRow(row, sgstAliases));

            if (subOrderId) {
              const match = salesTransactions.find(
                (t) => t.subOrderId === subOrderId || t.orderId === subOrderId
              ) || returnTransactions.find(
                (t) => t.subOrderId === subOrderId || t.orderId === subOrderId
              );
              if (match) {
                if (hsnCode) match.hsnCode = hsnCode;
                if (gstRate) match.gstRate = gstRate;
                if (igst) match.igstAmount = igst;
                if (cgst) match.cgstAmount = cgst;
                if (sgst) match.sgstAmount = sgst;
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
            const qty = parseNumber(getValueFromRow(row, ['quantity', 'qty', 'units'])) || 1;
            const taxableVal = parseNumber(getValueFromRow(row, salesTaxableAliases));
            const gstRate = parseNumber(getValueFromRow(row, gstRateAliases)) || 5;
            const igst = parseNumber(getValueFromRow(row, igstAliases));
            const cgst = parseNumber(getValueFromRow(row, cgstAliases));
            const sgst = parseNumber(getValueFromRow(row, sgstAliases));
            const invoiceDate = String(getValueFromRow(row, dateAliases) || new Date().toISOString().split('T')[0]).trim();

            const { stateCode, stateName } = resolveIndianState(posStateRaw);
            const isInterState = stateCode !== sellerStateCode;

            if (rawOrderId || taxableVal !== 0) {
              const finalTaxable = Math.abs(taxableVal);
              const orderId = rawOrderId || `ORD-TX-${sIdx}-${idx}`;
              const tcsTotal = finalTaxable * 0.01;
              const taxTotal = igst || (cgst + sgst) || (finalTaxable * (gstRate / 100));

              salesTransactions.push({
                id: `tx-inv-${sIdx}-${idx}-${Date.now()}`,
                orderId,
                subOrderId: orderId,
                orderDate: invoiceDate,
                invoiceDate,
                type: 'Sales',
                posStateCode: stateCode,
                posStateName: stateName,
                isInterState,
                hsnCode,
                quantity: qty,
                grossAmount: finalTaxable + taxTotal,
                taxableValue: finalTaxable,
                gstRate,
                igstAmount: igst || (isInterState ? taxTotal : 0),
                cgstAmount: cgst || (!isInterState ? taxTotal / 2 : 0),
                sgstAmount: sgst || (!isInterState ? taxTotal / 2 : 0),
                tcsIgst: isInterState ? tcsTotal : 0,
                tcsCgst: !isInterState ? tcsTotal / 2 : 0,
                tcsSgst: !isInterState ? tcsTotal / 2 : 0,
                totalTcs: tcsTotal,
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

  const allTransactions = [...salesTransactions, ...returnTransactions];
  const summary = calculateMeeshoImportSummary(allTransactions);

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
  { code: '22', name: 'Chhattisgarh', aliases: ['chhattisgarh', 'chhatisgarh', 'cg', 'ct'] },
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
  const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Code match: search for 2-digit state code anywhere in input
  const codeMatch = raw.match(/\b(0[1-9]|[1-3][0-8])\b/) || raw.match(/^(\d{2})/);
  if (codeMatch) {
    const code = codeMatch[1];
    const match = INDIAN_STATES.find((s) => s.code === code);
    if (match) return { stateCode: match.code, stateName: match.name };
  }

  // 2. Exact match on clean name
  for (const s of INDIAN_STATES) {
    if (s.name.toLowerCase().replace(/[^a-z0-9]/g, '') === clean) {
      return { stateCode: s.code, stateName: s.name };
    }
  }

  // 3. Match full name or longer aliases (> 2 chars) contained in clean input
  for (const s of INDIAN_STATES) {
    const cleanName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.includes(cleanName)) {
      return { stateCode: s.code, stateName: s.name };
    }
    for (const alias of s.aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanAlias.length > 2 && clean.includes(cleanAlias)) {
        return { stateCode: s.code, stateName: s.name };
      }
    }
  }

  // 4. Standalone short alias match (<= 2 chars) using word boundary
  const words = raw.toLowerCase().split(/[^a-z0-9]+/);
  for (const s of INDIAN_STATES) {
    for (const alias of s.aliases) {
      if (alias.length <= 2 && words.includes(alias.toLowerCase())) {
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
