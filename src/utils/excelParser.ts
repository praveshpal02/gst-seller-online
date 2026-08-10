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
 * Uses exact clean key match first, then partial clean key match.
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
    if (!aliasClean) continue;
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

function getBestSheetAnalysis(workbook: XLSX.WorkBook): SheetHeaderAnalysis | null {
  if (!workbook || workbook.SheetNames.length === 0) return null;

  let best: SheetHeaderAnalysis | null = null;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const analysis = analyzeWorksheetHeaders(sheet, sheetName);
    if (!best || analysis.rawHeaders.length > best.rawHeaders.length) {
      best = analysis;
    }
  }
  return best;
}

export interface MeeshoImportSummary {
  successRecords: number;
  netSale: number;
  salesRecordsCount: number;
  returnsRecordsCount: number;
  salesTaxableValue: number;
  returnsTaxableValue: number;
}

/**
 * Calculates dynamic Meesho import summary metrics from parsed transactions.
 * Formula:
 *  - successRecords = salesRecordsCount + returnsRecordsCount
 *  - netSale = sum(raw sales total_taxable_sale_value) - sum(raw return total_taxable_sale_value) rounded to 2 decimal places
 */
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

  let tcsSalesRowsCount = 0;
  let tcsSalesReturnRowsCount = 0;
  let taxInvoiceRowsCount = 0;

  // 1. Process TCS Sales File
  if (files.tcsSales) {
    try {
      const data = await files.tcsSales.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const bestSheet = getBestSheetAnalysis(workbook);

      if (bestSheet && bestSheet.rows.length > 0) {
        tcsSalesRowsCount = bestSheet.rows.length;
        bestSheet.rows.forEach((row, idx) => {
          const orderId = String(
            getValueFromRow(row, ['sub order no', 'sub order', 'suborder id', 'order id', 'suborder no', 'order no', 'id']) || `TCS-ORD-${idx}`
          ).trim();

          const posStateRaw = String(
            getValueFromRow(row, ['customer state', 'delivery state', 'state', 'place of supply', 'pos', 'state name']) || 'Delhi'
          ).trim();

          const taxableVal = parseNumber(
            getValueFromRow(row, [
              'total_taxable_sale_value',
              'total taxable sale value',
              'total taxable value',
              'taxable sale value',
              'taxable value',
              'gross sales amount',
              'tcs taxable amount',
              'gross sales',
              'net taxable amount',
              'taxable amount',
              'sales amount',
              'total value',
              'order value',
              'amount',
              'value'
            ])
          );

          const gstRateRaw = String(getValueFromRow(row, ['gst rate', 'tax rate', 'rate', 'gst %']) || '5');
          const gstRate = parseNumber(gstRateRaw) || 5;

          const dateStr = String(
            getValueFromRow(row, ['order date', 'invoice date', 'date', 'transaction date']) || new Date().toISOString().split('T')[0]
          ).trim();

          const { stateCode, stateName } = resolveIndianState(posStateRaw);
          const isInterState = stateCode !== sellerStateCode;

          if (orderId || taxableVal > 0) {
            const finalTaxable = Math.abs(taxableVal);
            const tcsTotal = Math.round(finalTaxable * 0.01 * 100) / 100;
            const taxTotal = Math.round(finalTaxable * (gstRate / 100) * 100) / 100;

            salesTransactions.push({
              id: `tcs-s-${idx}-${Date.now()}`,
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
              grossAmount: Math.round((finalTaxable + taxTotal) * 100) / 100,
              taxableValue: finalTaxable,
              gstRate,
              igstAmount: isInterState ? taxTotal : 0,
              cgstAmount: !isInterState ? Math.round((taxTotal / 2) * 100) / 100 : 0,
              sgstAmount: !isInterState ? Math.round((taxTotal / 2) * 100) / 100 : 0,
              tcsIgst: isInterState ? tcsTotal : 0,
              tcsCgst: !isInterState ? Math.round((tcsTotal / 2) * 100) / 100 : 0,
              tcsSgst: !isInterState ? Math.round((tcsTotal / 2) * 100) / 100 : 0,
              totalTcs: tcsTotal,
              sourceFile: files.tcsSales?.name || 'tcs_sales.xlsx',
              sourceRow: idx + (bestSheet.headerRowIndex !== undefined ? bestSheet.headerRowIndex + 2 : 2)
            });
          }
        });
      }
    } catch (err) {
      console.error('Error parsing TCS Sales file:', err);
    }
  }

  // 2. Process TCS Sales Return File
  if (files.tcsSalesReturn) {
    try {
      const data = await files.tcsSalesReturn.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const bestSheet = getBestSheetAnalysis(workbook);

      if (bestSheet && bestSheet.rows.length > 0) {
        tcsSalesReturnRowsCount = bestSheet.rows.length;
        bestSheet.rows.forEach((row, idx) => {
          const orderId = String(
            getValueFromRow(row, ['sub order no', 'return order id', 'sub order', 'suborder id', 'order id', 'order no', 'id']) || `RET-ORD-${idx}`
          ).trim();

          const posStateRaw = String(
            getValueFromRow(row, ['customer state', 'delivery state', 'state', 'place of supply', 'pos', 'state name']) || 'Delhi'
          ).trim();

          const taxableVal = Math.abs(
            parseNumber(
              getValueFromRow(row, [
                'total_taxable_sale_value',
                'total taxable sale value',
                'total taxable value',
                'return taxable value',
                'taxable return value',
                'taxable value',
                'return amount',
                'total return value',
                'net return amount',
                'refund amount',
                'gross return',
                'amount',
                'value'
              ])
            )
          );

          const gstRateRaw = String(getValueFromRow(row, ['gst rate', 'tax rate', 'rate', 'gst %']) || '5');
          const gstRate = parseNumber(gstRateRaw) || 5;

          const dateStr = String(
            getValueFromRow(row, ['return date', 'order date', 'date', 'transaction date']) || new Date().toISOString().split('T')[0]
          ).trim();

          const { stateCode, stateName } = resolveIndianState(posStateRaw);
          const isInterState = stateCode !== sellerStateCode;

          if (orderId || taxableVal > 0) {
            const tcsTotal = Math.round(taxableVal * 0.01 * 100) / 100;
            const taxTotal = Math.round(taxableVal * (gstRate / 100) * 100) / 100;

            returnTransactions.push({
              id: `tcs-r-${idx}-${Date.now()}`,
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
              grossAmount: Math.round((taxableVal + taxTotal) * 100) / 100,
              taxableValue: taxableVal,
              gstRate,
              igstAmount: isInterState ? taxTotal : 0,
              cgstAmount: !isInterState ? Math.round((taxTotal / 2) * 100) / 100 : 0,
              sgstAmount: !isInterState ? Math.round((taxTotal / 2) * 100) / 100 : 0,
              tcsIgst: isInterState ? tcsTotal : 0,
              tcsCgst: !isInterState ? Math.round((tcsTotal / 2) * 100) / 100 : 0,
              tcsSgst: !isInterState ? Math.round((tcsTotal / 2) * 100) / 100 : 0,
              totalTcs: tcsTotal,
              sourceFile: files.tcsSalesReturn?.name || 'tcs_sales_return.xlsx',
              sourceRow: idx + (bestSheet.headerRowIndex !== undefined ? bestSheet.headerRowIndex + 2 : 2)
            });
          }
        });
      }
    } catch (err) {
      console.error('Error parsing TCS Sales Return file:', err);
    }
  }

  // 3. Process Tax Invoice File
  if (files.taxInvoice) {
    try {
      const data = await files.taxInvoice.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const bestSheet = getBestSheetAnalysis(workbook);

      if (bestSheet && bestSheet.rows.length > 0) {
        taxInvoiceRowsCount = bestSheet.rows.length;

        // If TCS Sales were already parsed, enrich existing sales transactions with HSN / tax details from Tax Invoice Details
        if (salesTransactions.length > 0) {
          bestSheet.rows.forEach((row) => {
            const subOrderId = String(
              getValueFromRow(row, ['sub order no', 'sub order', 'suborder id', 'order id', 'order no'])
            ).trim();

            const hsnCode = String(getValueFromRow(row, ['hsn code', 'hsn', 'sac'])).trim();
            const gstRate = parseNumber(getValueFromRow(row, ['gst rate', 'tax rate', 'rate', 'gst %']));
            const igst = parseNumber(getValueFromRow(row, ['igst amount', 'igst']));
            const cgst = parseNumber(getValueFromRow(row, ['cgst amount', 'cgst']));
            const sgst = parseNumber(getValueFromRow(row, ['sgst amount', 'sgst']));

            if (subOrderId) {
              const match = salesTransactions.find(
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
        } else {
          // If TCS Sales file was absent, use Tax Invoice Details directly as sales source
          bestSheet.rows.forEach((row, idx) => {
            const orderId = String(
              getValueFromRow(row, ['sub order no', 'sub order', 'suborder id', 'order id', 'id']) || `ORD-TX-${idx}`
            ).trim();

            const subOrderId = String(
              getValueFromRow(row, ['sub order no', 'suborder id', 'sub order']) || orderId
            ).trim();

            const posStateRaw = String(
              getValueFromRow(row, ['customer state', 'delivery state', 'state', 'place of supply', 'pos']) || 'Delhi'
            ).trim();

            const hsnCode = String(getValueFromRow(row, ['hsn code', 'hsn', 'sac']) || '6109').trim();
            const qty = parseNumber(getValueFromRow(row, ['quantity', 'qty', 'units'])) || 1;

            const taxableVal = parseNumber(
              getValueFromRow(row, ['total_taxable_sale_value', 'taxable value', 'taxable amount', 'net amount', 'sales amount', 'total taxable amount', 'amount', 'value'])
            );

            const gstRate = parseNumber(getValueFromRow(row, ['gst rate', 'tax rate', 'rate', 'gst %'])) || 5;
            const igst = parseNumber(getValueFromRow(row, ['igst amount', 'igst']));
            const cgst = parseNumber(getValueFromRow(row, ['cgst amount', 'cgst']));
            const sgst = parseNumber(getValueFromRow(row, ['sgst amount', 'sgst']));

            const invoiceDate = String(
              getValueFromRow(row, ['invoice date', 'order date', 'date']) || new Date().toISOString().split('T')[0]
            ).trim();

            const { stateCode, stateName } = resolveIndianState(posStateRaw);
            const isInterState = stateCode !== sellerStateCode;

            if (orderId || taxableVal > 0) {
              const finalTaxable = Math.abs(taxableVal);
              const tcsTotal = Math.round(finalTaxable * 0.01 * 100) / 100;
              const taxTotal = igst || (cgst + sgst) || Math.round(finalTaxable * (gstRate / 100) * 100) / 100;

              salesTransactions.push({
                id: `tx-inv-${idx}-${Date.now()}`,
                orderId,
                subOrderId,
                orderDate: invoiceDate,
                invoiceDate,
                type: 'Sales',
                posStateCode: stateCode,
                posStateName: stateName,
                isInterState,
                hsnCode,
                quantity: qty,
                grossAmount: Math.round((finalTaxable + taxTotal) * 100) / 100,
                taxableValue: finalTaxable,
                gstRate,
                igstAmount: igst || (isInterState ? taxTotal : 0),
                cgstAmount: cgst || (!isInterState ? Math.round((taxTotal / 2) * 100) / 100 : 0),
                sgstAmount: sgst || (!isInterState ? Math.round((taxTotal / 2) * 100) / 100 : 0),
                tcsIgst: isInterState ? tcsTotal : 0,
                tcsCgst: !isInterState ? Math.round((tcsTotal / 2) * 100) / 100 : 0,
                tcsSgst: !isInterState ? Math.round((tcsTotal / 2) * 100) / 100 : 0,
                totalTcs: tcsTotal,
                sourceFile: files.taxInvoice?.name || 'Tax_invoice_details.xlsx',
                sourceRow: idx + (bestSheet.headerRowIndex !== undefined ? bestSheet.headerRowIndex + 2 : 2)
              });
            }
          });
        }
      }
    } catch (err) {
      console.error('Error parsing Tax Invoice details file:', err);
    }
  }

  const allTransactions = [...salesTransactions, ...returnTransactions];
  const summary = calculateMeeshoImportSummary(allTransactions);

  // Developer summary log as requested in Step 14 & instructions
  console.log('====================================');
  console.log('MEESHO IMPORT SUMMARY');
  console.log('');
  console.log(`TCS Sales Records: ${summary.salesRecordsCount}`);
  console.log(`TCS Sales Taxable Value: ${summary.salesTaxableValue}`);
  console.log('');
  console.log(`TCS Sales Return Records: ${summary.returnsRecordsCount}`);
  console.log(`TCS Sales Return Taxable Value: ${summary.returnsTaxableValue}`);
  console.log('');
  console.log(`Success Records: ${summary.successRecords}`);
  console.log('');
  console.log(`Net Sale: ${summary.netSale}`);
  console.log('====================================');

  return allTransactions;
}

export function resolveIndianState(stateInput: string): { stateCode: string; stateName: string } {
  const clean = stateInput.trim().toLowerCase();

  const stateMap: Record<string, { code: string; name: string }> = {
    'jammu and kashmir': { code: '01', name: 'Jammu & Kashmir' },
    'himachal pradesh': { code: '02', name: 'Himachal Pradesh' },
    'punjab': { code: '03', name: 'Punjab' },
    'chandigarh': { code: '04', name: 'Chandigarh' },
    'uttarakhand': { code: '05', name: 'Uttarakhand' },
    'haryana': { code: '06', name: 'Haryana' },
    'delhi': { code: '07', name: 'Delhi' },
    'rajasthan': { code: '08', name: 'Rajasthan' },
    'uttar pradesh': { code: '09', name: 'Uttar Pradesh' },
    'up': { code: '09', name: 'Uttar Pradesh' },
    'bihar': { code: '10', name: 'Bihar' },
    'sikkim': { code: '11', name: 'Sikkim' },
    'arunachal pradesh': { code: '12', name: 'Arunachal Pradesh' },
    'nagaland': { code: '13', name: 'Nagaland' },
    'manipur': { code: '14', name: 'Manipur' },
    'mizoram': { code: '15', name: 'Mizoram' },
    'tripura': { code: '16', name: 'Tripura' },
    'meghalaya': { code: '17', name: 'Meghalaya' },
    'assam': { code: '18', name: 'Assam' },
    'west bengal': { code: '19', name: 'West Bengal' },
    'wb': { code: '19', name: 'West Bengal' },
    'jharkhand': { code: '20', name: 'Jharkhand' },
    'odisha': { code: '21', name: 'Odisha' },
    'chhattisgarh': { code: '22', name: 'Chhattisgarh' },
    'madhya pradesh': { code: '23', name: 'Madhya Pradesh' },
    'mp': { code: '23', name: 'Madhya Pradesh' },
    'gujarat': { code: '24', name: 'Gujarat' },
    'daman and diu': { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
    'maharashtra': { code: '27', name: 'Maharashtra' },
    'andhra pradesh': { code: '37', name: 'Andhra Pradesh' },
    'karnataka': { code: '29', name: 'Karnataka' },
    'goa': { code: '30', name: 'Goa' },
    'lakshadweep': { code: '31', name: 'Lakshadweep' },
    'kerala': { code: '32', name: 'Kerala' },
    'tamil nadu': { code: '33', name: 'Tamil Nadu' },
    'tn': { code: '33', name: 'Tamil Nadu' },
    'puducherry': { code: '34', name: 'Puducherry' },
    'telangana': { code: '36', name: 'Telangana' }
  };

  for (const [key, val] of Object.entries(stateMap)) {
    if (clean.includes(key)) {
      return { stateCode: val.code, stateName: val.name };
    }
  }

  const codeMatch = clean.match(/^(\d{2})/);
  if (codeMatch) {
    const code = codeMatch[1];
    const match = Object.values(stateMap).find((s) => s.code === code);
    if (match) return { stateCode: match.code, stateName: match.name };
  }

  return { stateCode: '07', stateName: stateInput || 'Delhi' };
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
