import * as XLSX from 'xlsx';
import { GSTR1CompleteReport, EcommerceOperatorSummary } from '../types';

export const GST_TOOL_SHEETS = [
  'b2b,sez,de',
  'b2cl',
  'b2cs',
  'cdnr',
  'hsn',
  'hsn(b2b)',
  'hsn(b2c)',
  'exemp',
  'eco',
  'docs'
] as const;

export function formatPOS(stateCode: string, stateName: string): string {
  const code = String(stateCode || '07').padStart(2, '0');
  const cleanName = String(stateName || '').replace(/^\d+[\s-_]*/, '').trim() || 'Delhi';
  return `${code}-${cleanName}`;
}

export function buildGstr1Workbook(
  report: GSTR1CompleteReport,
  effectiveTable14: EcommerceOperatorSummary[],
  hsnToggle: boolean = true
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 1. b2b,sez,de
  const b2bHeaders = [
    'GSTIN/UIN of Recipient',
    'Receiver Name',
    'Invoice Number',
    'Invoice date',
    'Invoice Value',
    'Place Of Supply',
    'Reverse Charge',
    'Applicable % of Tax Rate',
    'Invoice Type',
    'E-Commerce GSTIN',
    'Rate',
    'Taxable Value',
    'Cess Amount'
  ];
  const b2bRows: (string | number)[][] = [];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([b2bHeaders, ...b2bRows]),
    'b2b,sez,de'
  );

  // 2. b2cl
  const b2clHeaders = [
    'Invoice Number',
    'Invoice date',
    'Invoice Value',
    'Place Of Supply',
    'Applicable % of Tax Rate',
    'Rate',
    'Taxable Value',
    'Cess Amount',
    'E-Commerce GSTIN'
  ];
  const b2clRows: (string | number)[][] = [];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([b2clHeaders, ...b2clRows]),
    'b2cl'
  );

  // 3. b2cs
  const b2csHeaders = [
    'Type',
    'Place Of Supply',
    'Applicable % of Tax Rate',
    'Rate',
    'Taxable Value',
    'Cess Amount',
    'E-Commerce GSTIN'
  ];
  const b2csRows: (string | number)[][] = (report.b2csList || []).map((b) => [
    'OE',
    formatPOS(b.stateCode, b.stateName),
    '',
    b.gstRate,
    b.taxableValue,
    b.cessAmount || 0,
    ''
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([b2csHeaders, ...b2csRows]),
    'b2cs'
  );

  // 4. cdnr
  const cdnrHeaders = [
    'GSTIN/UIN of Recipient',
    'Receiver Name',
    'Note/Refund Voucher Number',
    'Note/Refund Voucher date',
    'Note/Refund Voucher Type',
    'Place Of Supply',
    'Note/Refund Voucher Value',
    'Applicable % of Tax Rate',
    'Rate',
    'Taxable Value',
    'Cess Amount',
    'Pre GST'
  ];
  const cdnrRows: (string | number)[][] = [];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([cdnrHeaders, ...cdnrRows]),
    'cdnr'
  );

  // 5. hsn
  const hsnHeaders = [
    'HSN',
    'Description',
    'UQC',
    'Total Quantity',
    'Total Value',
    'Rate',
    'Taxable Value',
    'Integrated Tax Amount',
    'Central Tax Amount',
    'State/UT Tax Amount',
    'Cess Amount'
  ];
  const hsnRows: (string | number)[][] = hsnToggle
    ? (report.hsnList || []).map((h) => [
        h.hsnCode,
        h.description,
        h.uqc || 'OTH-OTHERS',
        h.totalQty,
        h.totalValue,
        h.gstRate || 5,
        h.taxableValue,
        h.igstAmount,
        h.cgstAmount,
        h.sgstAmount,
        0
      ])
    : [];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([hsnHeaders, ...hsnRows]),
    'hsn'
  );

  // 6. hsn(b2b)
  const hsnB2bHeaders = [
    'HSN',
    'Description',
    'UQC',
    'Total Quantity',
    'Total Value',
    'Rate',
    'Taxable Value',
    'Integrated Tax Amount',
    'Central Tax Amount',
    'State/UT Tax Amount',
    'Cess Amount'
  ];
  const hsnB2bRows: (string | number)[][] = [];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([hsnB2bHeaders, ...hsnB2bRows]),
    'hsn(b2b)'
  );

  // 7. hsn(b2c)
  const hsnB2cHeaders = [
    'HSN',
    'Description',
    'UQC',
    'Total Quantity',
    'Total Value',
    'Rate',
    'Taxable Value',
    'Integrated Tax Amount',
    'Central Tax Amount',
    'State/UT Tax Amount',
    'Cess Amount'
  ];
  const hsnB2cRows: (string | number)[][] = [];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([hsnB2cHeaders, ...hsnB2cRows]),
    'hsn(b2c)'
  );

  // 8. exemp
  const exempHeaders = [
    'Description',
    'Nil Rated Supplies',
    'Exempted(Other than Nil rated/non GST supply)',
    'Non-GST Supplies'
  ];
  const exempRows: (string | number)[][] = [];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([exempHeaders, ...exempRows]),
    'exemp'
  );

  // 9. eco
  const ecoHeaders = [
    'Nature of Supply',
    'GSTIN of E-Commerce Operator',
    'E-Commerce Operator Name',
    'Net value of supplies',
    'Integrated tax',
    'Central tax',
    'State/UT tax',
    'Cess'
  ];
  const ecoRows: (string | number)[][] = (effectiveTable14 || []).map((e) => [
    'Liable to collect tax u/s 52',
    e.operatorGstin || '07AARCM9332R1CQ',
    e.portalName || 'Meesho',
    e.netTaxableValue,
    e.igstAmount,
    e.cgstAmount,
    e.sgstAmount,
    0
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([ecoHeaders, ...ecoRows]),
    'eco'
  );

  // 10. docs
  const docsHeaders = [
    'Nature of Document',
    'Sr. No. From',
    'Sr. No. To',
    'Total Number',
    'Cancelled'
  ];
  let docsRows: (string | number)[][] = [];
  const categories = report.docIssue?.categories || [];
  if (categories.length > 0) {
    docsRows = categories.map((c) => [
      c.docType,
      c.from || '1',
      c.to || String(c.totalCount),
      c.totalCount,
      c.cancelledCount
    ]);
  } else {
    if (report.docIssue?.totalInvoices) {
      docsRows.push([
        'Invoices for outward supply',
        '1',
        String(report.docIssue.totalInvoices),
        report.docIssue.totalInvoices,
        report.docIssue.cancelledDocs || 0
      ]);
    }
    if (report.docIssue?.totalCreditNotes) {
      docsRows.push([
        'Credit Note',
        '1',
        String(report.docIssue.totalCreditNotes),
        report.docIssue.totalCreditNotes,
        0
      ]);
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([docsHeaders, ...docsRows]),
    'docs'
  );

  return wb;
}

export function exportGstr1Excel(
  report: GSTR1CompleteReport,
  effectiveTable14: EcommerceOperatorSummary[],
  gstin: string,
  periodMonth: string,
  periodYear: string,
  hsnToggle: boolean = true
): void {
  const wb = buildGstr1Workbook(report, effectiveTable14, hsnToggle);
  XLSX.writeFile(wb, `GSTR1_Report_${gstin || 'GSTIN'}_${periodMonth}_${periodYear}.xlsx`);
}
