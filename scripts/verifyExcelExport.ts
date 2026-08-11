import * as XLSX from 'xlsx';
import { calculateGstr1Summary } from '../src/utils/gstr1Calculator';
import { buildGstr1Workbook, GST_TOOL_SHEETS } from '../src/utils/gstr1Exporter';
import { GSTR1CompleteReport } from '../src/types';

console.log('=== VERIFYING GST TOOL EXCEL EXPORT ===');

// Test 1: Structure & Headers verification on a Report with exact Verified Values
const verifiedReport: GSTR1CompleteReport = {
  recordCount: 336,
  totalTaxable: 36036.96,
  totalIgst: 1764.86,
  totalCgst: 18.50,
  totalSgst: 18.50,
  totalTax: 1801.86,
  totalInvoiceValue: 37838.82,
  b2csList: [
    { stateCode: '01', stateName: 'Jammu And Kashmir', type: 'INTER', gstRate: 5, taxableValue: 1092.71, igstAmount: 54.64, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 54.64, totalInvoiceValue: 1147.35 },
    { stateCode: '02', stateName: 'Himachal Pradesh', type: 'INTER', gstRate: 5, taxableValue: 176.87, igstAmount: 8.84, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 8.84, totalInvoiceValue: 185.71 },
    { stateCode: '03', stateName: 'Punjab', type: 'INTER', gstRate: 5, taxableValue: 898.89, igstAmount: 44.95, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 44.95, totalInvoiceValue: 943.84 },
    { stateCode: '05', stateName: 'Uttarakhand', type: 'INTER', gstRate: 5, taxableValue: 914.29, igstAmount: 45.71, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 45.71, totalInvoiceValue: 960.00 },
    { stateCode: '06', stateName: 'Haryana', type: 'INTER', gstRate: 5, taxableValue: 1151.43, igstAmount: 57.57, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 57.57, totalInvoiceValue: 1209.00 },
    { stateCode: '07', stateName: 'Delhi', type: 'INTRA', gstRate: 5, taxableValue: 740.13, igstAmount: 0, cgstAmount: 18.50, sgstAmount: 18.50, cessAmount: 0, totalTax: 37.00, totalInvoiceValue: 777.13 },
    { stateCode: '08', stateName: 'Rajasthan', type: 'INTER', gstRate: 5, taxableValue: 2121.82, igstAmount: 106.09, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 106.09, totalInvoiceValue: 2227.91 },
    { stateCode: '09', stateName: 'Uttar Pradesh', type: 'INTER', gstRate: 5, taxableValue: 9837.83, igstAmount: 491.89, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 491.89, totalInvoiceValue: 10329.72 },
    { stateCode: '10', stateName: 'Bihar', type: 'INTER', gstRate: 5, taxableValue: 4532.91, igstAmount: 226.65, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 226.65, totalInvoiceValue: 4759.56 },
    { stateCode: '18', stateName: 'Assam', type: 'INTER', gstRate: 5, taxableValue: 817.79, igstAmount: 40.89, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 40.89, totalInvoiceValue: 858.68 },
    { stateCode: '19', stateName: 'West Bengal', type: 'INTER', gstRate: 5, taxableValue: 1263.98, igstAmount: 63.20, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 63.20, totalInvoiceValue: 1327.18 },
    { stateCode: '20', stateName: 'Jharkhand', type: 'INTER', gstRate: 5, taxableValue: 1301.71, igstAmount: 65.09, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 65.09, totalInvoiceValue: 1366.80 },
    { stateCode: '21', stateName: 'Odisha', type: 'INTER', gstRate: 5, taxableValue: 958.65, igstAmount: 47.93, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 47.93, totalInvoiceValue: 1006.58 },
    { stateCode: '22', stateName: 'Chhattisgarh', type: 'INTER', gstRate: 5, taxableValue: 1211.62, igstAmount: 60.58, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 60.58, totalInvoiceValue: 1272.20 },
    { stateCode: '23', stateName: 'Madhya Pradesh', type: 'INTER', gstRate: 5, taxableValue: 1631.20, igstAmount: 81.56, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 81.56, totalInvoiceValue: 1712.76 },
    { stateCode: '24', stateName: 'Gujarat', type: 'INTER', gstRate: 5, taxableValue: 722.48, igstAmount: 36.12, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 36.12, totalInvoiceValue: 758.60 },
    { stateCode: '26', stateName: 'Dadra And Nagar Haveli And Daman And Diu', type: 'INTER', gstRate: 5, taxableValue: 176.76, igstAmount: 8.84, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 8.84, totalInvoiceValue: 185.60 },
    { stateCode: '27', stateName: 'Maharashtra', type: 'INTER', gstRate: 5, taxableValue: 3098.37, igstAmount: 154.92, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 154.92, totalInvoiceValue: 3253.29 },
    { stateCode: '29', stateName: 'Karnataka', type: 'INTER', gstRate: 5, taxableValue: 209.52, igstAmount: 10.48, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 10.48, totalInvoiceValue: 220.00 },
    { stateCode: '32', stateName: 'Kerala', type: 'INTER', gstRate: 5, taxableValue: 393.33, igstAmount: 19.67, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 19.67, totalInvoiceValue: 413.00 },
    { stateCode: '33', stateName: 'Tamil Nadu', type: 'INTER', gstRate: 5, taxableValue: 1188.75, igstAmount: 59.44, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 59.44, totalInvoiceValue: 1248.19 },
    { stateCode: '36', stateName: 'Telangana', type: 'INTER', gstRate: 5, taxableValue: 614.92, igstAmount: 30.75, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 30.75, totalInvoiceValue: 645.67 },
    { stateCode: '37', stateName: 'Andhra Pradesh', type: 'INTER', gstRate: 5, taxableValue: 981.00, igstAmount: 49.05, cgstAmount: 0, sgstAmount: 0, cessAmount: 0, totalTax: 49.05, totalInvoiceValue: 1030.05 }
  ],
  docIssue: {
    recordCount: 3,
    totalInvoices: 255,
    totalCreditNotes: 88,
    totalDocs: 343,
    cancelledDocs: 0,
    netIssuedDocs: 343,
    categories: [
      { docNum: 1, docType: 'Invoices for outward supply', from: 'awixc271', to: 'awixc27304', totalCount: 255, cancelledCount: 0, netIssuedCount: 255 },
      { docNum: 2, docType: 'Credit Note', from: 'awixc27C1', to: 'awixc27C74', totalCount: 67, cancelledCount: 0, netIssuedCount: 67 },
      { docNum: 3, docType: 'Credit Note', from: 'awixc27CM1', to: 'awixc27CM14', totalCount: 14, cancelledCount: 0, netIssuedCount: 14 }
    ]
  },
  ecoSummary: [
    {
      portalName: 'Meesho (Fashnear Technologies Private Limited)',
      operatorGstin: '07AARCM9332R1CQ',
      recordCount: 336,
      netTaxableValue: 36036.96,
      igstAmount: 1764.85,
      cgstAmount: 18.50,
      sgstAmount: 18.50,
      totalTax: 1801.85
    }
  ],
  hsnList: [
    { hsnCode: '6109', description: 'T-Shirts & Apparel', uqc: 'OTH-OTHERS', totalQty: 336, totalValue: 37838.82, taxableValue: 36036.96, igstAmount: 1764.86, cgstAmount: 18.50, sgstAmount: 18.50, totalTax: 1801.86, gstRate: 5 }
  ]
};

const wb = buildGstr1Workbook(verifiedReport, verifiedReport.ecoSummary, true);

// 1. Check Sheet Names & Order
const generatedSheets = wb.SheetNames;
console.log('Generated Sheets:', generatedSheets);

let sheetMatch = true;
if (generatedSheets.length !== GST_TOOL_SHEETS.length) {
  sheetMatch = false;
  console.error(`Mismatch in sheet count! Expected ${GST_TOOL_SHEETS.length}, got ${generatedSheets.length}`);
} else {
  GST_TOOL_SHEETS.forEach((expectedSheet, idx) => {
    if (generatedSheets[idx] !== expectedSheet) {
      sheetMatch = false;
      console.error(`Sheet mismatch at index ${idx}: expected '${expectedSheet}', got '${generatedSheets[idx]}'`);
    }
  });
}

if (sheetMatch) {
  console.log('✅ Sheet names and order match GST Tool specifications perfectly!');
}

// 2. Check Headers for All 10 Sheets
const expectedHeaders: Record<string, string[]> = {
  'b2b,sez,de': [
    'GSTIN/UIN of Recipient', 'Receiver Name', 'Invoice Number', 'Invoice date',
    'Invoice Value', 'Place Of Supply', 'Reverse Charge', 'Applicable % of Tax Rate',
    'Invoice Type', 'E-Commerce GSTIN', 'Rate', 'Taxable Value', 'Cess Amount'
  ],
  'b2cl': [
    'Invoice Number', 'Invoice date', 'Invoice Value', 'Place Of Supply',
    'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount', 'E-Commerce GSTIN'
  ],
  'b2cs': [
    'Type', 'Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value',
    'Cess Amount', 'E-Commerce GSTIN'
  ],
  'cdnr': [
    'GSTIN/UIN of Recipient', 'Receiver Name', 'Note/Refund Voucher Number',
    'Note/Refund Voucher date', 'Note/Refund Voucher Type', 'Place Of Supply',
    'Note/Refund Voucher Value', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value',
    'Cess Amount', 'Pre GST'
  ],
  'hsn': [
    'HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Rate',
    'Taxable Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount'
  ],
  'hsn(b2b)': [
    'HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Rate',
    'Taxable Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount'
  ],
  'hsn(b2c)': [
    'HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Rate',
    'Taxable Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount'
  ],
  'exemp': [
    'Description', 'Nil Rated Supplies', 'Exempted(Other than Nil rated/non GST supply)', 'Non-GST Supplies'
  ],
  'eco': [
    'Nature of Supply', 'GSTIN of E-Commerce Operator', 'E-Commerce Operator Name',
    'Net value of supplies', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess'
  ],
  'docs': [
    'Nature of Document', 'Sr. No. From', 'Sr. No. To', 'Total Number', 'Cancelled'
  ]
};

let headersMatch = true;
GST_TOOL_SHEETS.forEach((sheetName) => {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.error(`Missing sheet: ${sheetName}`);
    headersMatch = false;
    return;
  }
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const actualHeader = rows[0] || [];
  const expected = expectedHeaders[sheetName];
  if (JSON.stringify(actualHeader) !== JSON.stringify(expected)) {
    headersMatch = false;
    console.error(`Header mismatch on sheet '${sheetName}':`);
    console.error(' Expected:', expected);
    console.error(' Actual:  ', actualHeader);
  }
});

if (headersMatch) {
  console.log('✅ All 10 sheet headers and column ordering match GST Tool specifications!');
}

// 3. Check B2CS Data Values
const b2csSheet = wb.Sheets['b2cs'];
const b2csRows: any[][] = XLSX.utils.sheet_to_json(b2csSheet, { header: 1 });
let totalB2csTaxable = 0;
b2csRows.slice(1).forEach((row) => {
  totalB2csTaxable += Number(row[4]) || 0;
});
totalB2csTaxable = Math.round(totalB2csTaxable * 100) / 100;
console.log('B2CS Row Count:', b2csRows.length - 1);
console.log('B2CS Total Taxable Value:', totalB2csTaxable);

// 4. Check ECO Data Values
const ecoSheet = wb.Sheets['eco'];
const ecoRows: any[][] = XLSX.utils.sheet_to_json(ecoSheet, { header: 1 });
const ecoNetTaxable = Number(ecoRows[1][3]);
const ecoIgst = Number(ecoRows[1][4]);
const ecoCgst = Number(ecoRows[1][5]);
const ecoSgst = Number(ecoRows[1][6]);
console.log(`ECO Values -> Net Taxable: ${ecoNetTaxable}, IGST: ${ecoIgst}, CGST: ${ecoCgst}, SGST: ${ecoSgst}`);

// 5. Check Docs Data Values
const docsSheet = wb.Sheets['docs'];
const docsRows: any[][] = XLSX.utils.sheet_to_json(docsSheet, { header: 1 });
console.log('Docs Rows:');
docsRows.forEach((r, i) => console.log(`  Row ${i}:`, r));

// 6. Check HSN Data Values
const hsnSheet = wb.Sheets['hsn'];
const hsnRows: any[][] = XLSX.utils.sheet_to_json(hsnSheet, { header: 1 });
console.log('HSN Rows:');
hsnRows.forEach((r, i) => console.log(`  Row ${i}:`, r));

const isB2csValid = Math.abs(totalB2csTaxable - 36036.96) < 0.05;
const isEcoValid =
  Math.abs(ecoNetTaxable - 36036.96) < 0.01 &&
  Math.abs(ecoIgst - 1764.85) < 0.01 &&
  Math.abs(ecoCgst - 18.5) < 0.01 &&
  Math.abs(ecoSgst - 18.5) < 0.01;

if (sheetMatch && headersMatch && isB2csValid && isEcoValid) {
  console.log('🎉 ALL VALIDATION CHECKS PASSED SUCCESSFULLY!');
} else {
  console.error('❌ SOME VALIDATION CHECKS FAILED');
  process.exit(1);
}
