import {
  MeeshoTransaction,
  StateGSTR1Summary,
  HSNSummary,
  DocumentsIssuedSummary,
  DocumentCategorySummary,
  EcommerceOperatorSummary,
  GSTR1CompleteReport,
  ManualGSTR1Entry,
  ReconciliationStatus
} from '../types';

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates Section 7: B2CS (B2C Small / Everyday consumer sales without GSTIN)
 */
export function calculateB2cs(
  records: MeeshoTransaction[],
  manualEntries: ManualGSTR1Entry[] = [],
  sellerStateCode: string = '07'
): StateGSTR1Summary[] {
  const b2csMap: Record<string, StateGSTR1Summary> = {};

  records.forEach((tx) => {
    const taxableVal = Number(tx.taxableValue) || 0;
    const gstRate = Number(tx.gstRate) || 5;

    const stateCode = tx.posStateCode || '07';
    const stateName = tx.posStateName || 'Delhi';
    const isInterState = stateCode !== sellerStateCode;

    const key = `${stateCode}_${gstRate}`;

    if (!b2csMap[key]) {
      b2csMap[key] = {
        stateCode,
        stateName,
        type: isInterState ? 'INTER' : 'INTRA',
        gstRate,
        taxableValue: 0,
        igstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        cessAmount: 0,
        totalTax: 0,
        totalInvoiceValue: 0
      };
    }

    const multiplier = tx.type === 'Sales' ? 1 : -1;
    const row = b2csMap[key];

    const netTaxable = taxableVal * multiplier;
    let igst = 0;
    let cgst = 0;
    let sgst = 0;

    if (isInterState) {
      igst = Number(tx.igstAmount) > 0 ? Number(tx.igstAmount) * multiplier : netTaxable * (gstRate / 100);
      cgst = 0;
      sgst = 0;
    } else {
      igst = 0;
      if (Number(tx.cgstAmount) > 0 && Number(tx.sgstAmount) > 0) {
        cgst = Number(tx.cgstAmount) * multiplier;
        sgst = Number(tx.sgstAmount) * multiplier;
      } else {
        const taxTotal = netTaxable * (gstRate / 100);
        cgst = taxTotal / 2;
        sgst = taxTotal / 2;
      }
    }

    const grossVal = tx.grossAmount ? Number(tx.grossAmount) * multiplier : (netTaxable + igst + cgst + sgst);

    row.taxableValue += netTaxable;
    row.igstAmount += igst;
    row.cgstAmount += cgst;
    row.sgstAmount += sgst;
    row.totalTax += igst + cgst + sgst;
    row.totalInvoiceValue += grossVal;
  });

  // Merge manual B2CS entries
  manualEntries.filter((m) => m.section === 'b2cs').forEach((entry) => {
    const stateCode = entry.stateCode || '07';
    const stateName = entry.stateName || 'Delhi';
    const gstRate = entry.gstRate || 5;
    const isInterState = stateCode !== sellerStateCode;
    const key = `${stateCode}_${gstRate}`;

    if (!b2csMap[key]) {
      b2csMap[key] = {
        stateCode,
        stateName,
        type: isInterState ? 'INTER' : 'INTRA',
        gstRate,
        taxableValue: 0,
        igstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        cessAmount: 0,
        totalTax: 0,
        totalInvoiceValue: 0
      };
    }

    const row = b2csMap[key];
    const taxable = Number(entry.taxableValue) || 0;
    const igst = Number(entry.igstAmount) || 0;
    const cgst = Number(entry.cgstAmount) || 0;
    const sgst = Number(entry.sgstAmount) || 0;
    const invoiceVal = Number(entry.invoiceValue) || (taxable + igst + cgst + sgst);

    row.taxableValue += taxable;
    row.igstAmount += igst;
    row.cgstAmount += cgst;
    row.sgstAmount += sgst;
    row.totalTax += igst + cgst + sgst;
    row.totalInvoiceValue += invoiceVal;
  });

  // Apply round2 to final group totals and sort by stateCode
  return Object.values(b2csMap)
    .map((r) => ({
      ...r,
      taxableValue: round2(r.taxableValue),
      igstAmount: round2(r.igstAmount),
      cgstAmount: round2(r.cgstAmount),
      sgstAmount: round2(r.sgstAmount),
      totalTax: round2(r.totalTax),
      totalInvoiceValue: round2(r.totalInvoiceValue)
    }))
    .filter((r) => Math.abs(r.taxableValue) > 0.001 || Math.abs(r.totalTax) > 0.001)
    .sort((a, b) => a.stateCode.localeCompare(b.stateCode));
}

function extractDocPrefixAndNum(docStr: string) {
  if (!docStr) return { prefix: 'DEFAULT', num: null };
  const clean = String(docStr).trim();
  const m = clean.match(/^([A-Za-z]+(?:\d+[A-Za-z]+)*?)(\d+)$/);
  if (m) {
    return { prefix: m[1], num: parseInt(m[2], 10) };
  }
  return { prefix: 'SERIES', num: null };
}

function isGenericCategory(catName?: string) {
  if (!catName) return false;
  const lower = String(catName).toLowerCase();
  if (lower.includes('order') || lower.includes('sub-') || lower.includes('ord-') || /^\d+$/.test(lower)) return false;
  return true;
}

function buildDocCategories(
  txList: MeeshoTransaction[],
  docType: string,
  startDocNum: number
): DocumentCategorySummary[] {
  if (txList.length === 0) return [];

  const groups: Record<string, { raw: string; num: number | null }[]> = {};
  txList.forEach((tx) => {
    const rawDoc = tx.invoiceNumber || tx.subOrderId || tx.orderId || '';
    const catGroup = isGenericCategory(tx.returnCategory)
      ? tx.returnCategory
      : isGenericCategory(tx.sourceSheet)
      ? tx.sourceSheet
      : null;
    const info = extractDocPrefixAndNum(rawDoc);
    const groupKey = catGroup || (info.prefix !== 'DEFAULT' ? info.prefix : 'DEFAULT');

    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push({ raw: rawDoc, num: info.num });
  });

  const categories: DocumentCategorySummary[] = [];
  let currDocNum = startDocNum;

  Object.keys(groups).forEach((gKey) => {
    const items = groups[gKey];
    items.sort((a, b) => {
      if (a.num !== null && b.num !== null) return a.num - b.num;
      return a.raw.localeCompare(b.raw);
    });

    const totalCount = items.length;
    const from = items[0]?.raw || '1';
    const to = items[items.length - 1]?.raw || String(totalCount);

    categories.push({
      docNum: currDocNum,
      docType,
      from,
      to,
      totalCount,
      cancelledCount: 0,
      netIssuedCount: totalCount,
      sourceSheet: isGenericCategory(gKey) ? gKey : undefined
    });

    currDocNum++;
  });

  return categories;
}

/**
 * Calculates Section 13: Documents Issued Summary
 */
export function calculateDocumentsIssued(
  records: MeeshoTransaction[],
  manualEntries: ManualGSTR1Entry[] = []
): DocumentsIssuedSummary {
  const salesRecords = records.filter((r) => r.type === 'Sales');
  const returnRecords = records.filter((r) => r.type === 'Return');

  const totalInvoices = salesRecords.length;
  const totalCreditNotes = returnRecords.length;

  let manualDocs = 0;
  let manualCancelled = 0;

  manualEntries.filter((m) => m.section === 'doc_issue').forEach((e) => {
    manualDocs += Number(e.totalDocs) || 0;
    manualCancelled += Number(e.cancelledDocs) || 0;
  });

  const categories: DocumentCategorySummary[] = [];

  // Invoices categories
  const invoiceCats = buildDocCategories(salesRecords, 'Invoices for outward supply', 1);
  if (invoiceCats.length > 0) {
    invoiceCats[0].cancelledCount = manualCancelled;
    invoiceCats[0].netIssuedCount = Math.max(0, invoiceCats[0].totalCount - manualCancelled);
    categories.push(...invoiceCats);
  } else if (totalInvoices > 0) {
    categories.push({
      docNum: 1,
      docType: 'Invoices for outward supply',
      from: '1',
      to: String(totalInvoices),
      totalCount: totalInvoices,
      cancelledCount: manualCancelled,
      netIssuedCount: Math.max(0, totalInvoices - manualCancelled)
    });
  }

  // Credit Notes categories
  const nextDocNum = categories.length + 1;
  const creditCats = buildDocCategories(returnRecords, 'Credit Note', nextDocNum);
  if (creditCats.length > 0) {
    categories.push(...creditCats);
  } else if (totalCreditNotes > 0) {
    categories.push({
      docNum: 2,
      docType: 'Credit Note',
      from: '1',
      to: String(totalCreditNotes),
      totalCount: totalCreditNotes,
      cancelledCount: 0,
      netIssuedCount: totalCreditNotes
    });
  }

  const totalDocs = totalInvoices + totalCreditNotes + manualDocs;
  const cancelledDocs = manualCancelled;
  const netIssuedDocs = Math.max(0, totalDocs - cancelledDocs);

  return {
    recordCount: records.length,
    totalInvoices,
    totalCreditNotes,
    totalDocs,
    cancelledDocs,
    netIssuedDocs,
    categories
  };
}

/**
 * Calculates Section 14: Supplies via E-Commerce Operators (u/s 52)
 */
export function calculateEcommerceOperator(
  b2csTotalTaxable: number,
  b2csTotalIgst: number,
  b2csTotalCgst: number,
  b2csTotalSgst: number,
  recordCount: number,
  operatorGstin: string = '07AARCM9332R1CQ',
  portalName: string = 'Meesho (Fashnear Technologies Private Limited)',
  manualEntries: ManualGSTR1Entry[] = []
): EcommerceOperatorSummary[] {
  let netTaxableValue = round2(b2csTotalTaxable);
  let igstAmount = round2(b2csTotalIgst);
  let cgstAmount = round2(b2csTotalCgst);
  let sgstAmount = round2(b2csTotalSgst);

  manualEntries.filter((m) => m.section === 'sec14').forEach((entry) => {
    netTaxableValue += Number(entry.taxableValue) || 0;
    igstAmount += Number(entry.igstAmount) || 0;
    cgstAmount += Number(entry.cgstAmount) || 0;
    sgstAmount += Number(entry.sgstAmount) || 0;
  });

  netTaxableValue = round2(netTaxableValue);
  igstAmount = round2(igstAmount);
  cgstAmount = round2(cgstAmount);
  sgstAmount = round2(sgstAmount);
  const totalTax = round2(igstAmount + cgstAmount + sgstAmount);

  return [
    {
      portalName,
      operatorGstin,
      recordCount,
      netTaxableValue,
      igstAmount,
      cgstAmount,
      sgstAmount,
      totalTax
    }
  ];
}

/**
 * Calculates Section 12: HSN-Wise Summary
 */
export function calculateHsnSummary(
  records: MeeshoTransaction[],
  b2csTotalTaxable: number,
  b2csTotalIgst: number,
  b2csTotalCgst: number,
  b2csTotalSgst: number,
  manualEntries: ManualGSTR1Entry[] = [],
  sellerStateCode: string = '07'
): HSNSummary[] {
  const hsnMap: Record<string, HSNSummary> = {};

  records.forEach((tx) => {
    const hsnCode = tx.hsnCode || '6109';
    const gstRate = Number(tx.gstRate) || 5;
    const key = `${hsnCode}_${gstRate}`;

    if (!hsnMap[key]) {
      let desc = 'Textile / Apparel Item';
      if (hsnCode === '6109') desc = 'T-Shirts & Apparel';
      if (hsnCode === '6204') desc = 'Women Suits & Dresses';
      if (hsnCode === '9503') desc = 'Toys & Games';
      if (hsnCode === '8518') desc = 'Headphones & Electronics';

      hsnMap[key] = {
        hsnCode,
        description: desc,
        uqc: 'OTH-OTHERS',
        totalQty: 0,
        totalValue: 0,
        taxableValue: 0,
        igstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        totalTax: 0
      };
    }

    const multiplier = tx.type === 'Sales' ? 1 : -1;
    const row = hsnMap[key];

    const qty = Number(tx.quantity) || 1;
    const taxVal = Number(tx.taxableValue) || 0;
    const netTaxable = taxVal * multiplier;
    const isInterState = (tx.posStateCode || '07') !== sellerStateCode;

    let igst = 0;
    let cgst = 0;
    let sgst = 0;

    if (isInterState) {
      igst = Number(tx.igstAmount) > 0 ? Number(tx.igstAmount) * multiplier : netTaxable * (gstRate / 100);
    } else {
      if (Number(tx.cgstAmount) > 0 && Number(tx.sgstAmount) > 0) {
        cgst = Number(tx.cgstAmount) * multiplier;
        sgst = Number(tx.sgstAmount) * multiplier;
      } else {
        const taxTotal = netTaxable * (gstRate / 100);
        cgst = taxTotal / 2;
        sgst = taxTotal / 2;
      }
    }

    const gross = tx.grossAmount ? Number(tx.grossAmount) * multiplier : (netTaxable + igst + cgst + sgst);

    row.totalQty += qty * multiplier;
    row.totalValue += gross;
    row.taxableValue += netTaxable;
    row.igstAmount += igst;
    row.cgstAmount += cgst;
    row.sgstAmount += sgst;
    row.totalTax += igst + cgst + sgst;
  });

  // Add manual HSN entries
  manualEntries.filter((m) => m.section === 'hsn').forEach((entry) => {
    const hsnCode = entry.hsnCode || '6109';
    const gstRate = entry.gstRate || 5;
    const key = `${hsnCode}_${gstRate}`;

    if (!hsnMap[key]) {
      hsnMap[key] = {
        hsnCode,
        description: entry.description || 'Manual HSN Entry',
        uqc: 'OTH-OTHERS',
        totalQty: 0,
        totalValue: 0,
        taxableValue: 0,
        igstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        totalTax: 0
      };
    }

    const row = hsnMap[key];
    const taxable = Number(entry.taxableValue) || 0;
    const igst = Number(entry.igstAmount) || 0;
    const cgst = Number(entry.cgstAmount) || 0;
    const sgst = Number(entry.sgstAmount) || 0;
    const totalVal = Number(entry.invoiceValue) || (taxable + igst + cgst + sgst);

    row.taxableValue += taxable;
    row.totalValue += totalVal;
    row.igstAmount += igst;
    row.cgstAmount += cgst;
    row.sgstAmount += sgst;
    row.totalTax += igst + cgst + sgst;
  });

  let hsnList = Object.values(hsnMap)
    .map((h) => ({
      ...h,
      totalValue: round2(h.totalValue),
      taxableValue: round2(h.taxableValue),
      igstAmount: round2(h.igstAmount),
      cgstAmount: round2(h.cgstAmount),
      sgstAmount: round2(h.sgstAmount),
      totalTax: round2(h.totalTax)
    }))
    .filter((h) => Math.abs(h.taxableValue) > 0.001 || Math.abs(h.totalTax) > 0.001);

  // Reconcile HSN totals with B2CS totals (to account for any multi-group rounding diff <= 0.05)
  if (hsnList.length > 0) {
    const rawHsnTaxable = round2(hsnList.reduce((acc, curr) => acc + curr.taxableValue, 0));
    const rawHsnIgst = round2(hsnList.reduce((acc, curr) => acc + curr.igstAmount, 0));
    const rawHsnCgst = round2(hsnList.reduce((acc, curr) => acc + curr.cgstAmount, 0));
    const rawHsnSgst = round2(hsnList.reduce((acc, curr) => acc + curr.sgstAmount, 0));

    const diffTaxable = round2(b2csTotalTaxable - rawHsnTaxable);
    const diffIgst = round2(b2csTotalIgst - rawHsnIgst);
    const diffCgst = round2(b2csTotalCgst - rawHsnCgst);
    const diffSgst = round2(b2csTotalSgst - rawHsnSgst);

    if (Math.abs(diffTaxable) < 1) hsnList[0].taxableValue = round2(hsnList[0].taxableValue + diffTaxable);
    if (Math.abs(diffIgst) < 1) hsnList[0].igstAmount = round2(hsnList[0].igstAmount + diffIgst);
    if (Math.abs(diffCgst) < 1) hsnList[0].cgstAmount = round2(hsnList[0].cgstAmount + diffCgst);
    if (Math.abs(diffSgst) < 1) hsnList[0].sgstAmount = round2(hsnList[0].sgstAmount + diffSgst);

    hsnList[0].totalTax = round2(hsnList[0].igstAmount + hsnList[0].cgstAmount + hsnList[0].sgstAmount);
  }

  return hsnList;
}

/**
 * Master GSTR-1 calculation function with full dynamic reconciliation
 */
export function calculateGstr1Summary(
  records: MeeshoTransaction[],
  manualEntries: ManualGSTR1Entry[] = [],
  operatorGstin: string = '07AARCM9332R1CQ',
  sellerStateCode: string = '07'
): GSTR1CompleteReport {
  const b2csList = calculateB2cs(records, manualEntries, sellerStateCode);
  const docIssue = calculateDocumentsIssued(records, manualEntries);

  const totalTaxable = round2(b2csList.reduce((acc, curr) => acc + curr.taxableValue, 0));
  const totalIgst = round2(b2csList.reduce((acc, curr) => acc + curr.igstAmount, 0));
  const totalCgst = round2(b2csList.reduce((acc, curr) => acc + curr.cgstAmount, 0));
  const totalSgst = round2(b2csList.reduce((acc, curr) => acc + curr.sgstAmount, 0));
  const totalInvoiceValue = round2(b2csList.reduce((acc, curr) => acc + curr.totalInvoiceValue, 0));
  const totalTax = round2(totalIgst + totalCgst + totalSgst);

  const ecoSummary = calculateEcommerceOperator(
    totalTaxable,
    totalIgst,
    totalCgst,
    totalSgst,
    records.length,
    operatorGstin,
    'Meesho (Fashnear Technologies Private Limited)',
    manualEntries
  );

  const hsnList = calculateHsnSummary(
    records,
    totalTaxable,
    totalIgst,
    totalCgst,
    totalSgst,
    manualEntries,
    sellerStateCode
  );

  // Dynamic Source Reconciliation
  const salesRecords = records.filter((r) => r.type === 'Sales');
  const returnRecords = records.filter((r) => r.type === 'Return');

  const salesTaxable = salesRecords.reduce((acc, r) => acc + (Number(r.taxableValue) || 0), 0);
  const returnsTaxable = returnRecords.reduce((acc, r) => acc + (Number(r.taxableValue) || 0), 0);
  const sourceNetTaxable = round2(salesTaxable - returnsTaxable);

  const b2csTaxable = totalTaxable;
  const ecoTaxable = ecoSummary[0]?.netTaxableValue || 0;
  const hsnTaxable = round2(hsnList.reduce((acc, h) => acc + h.taxableValue, 0));

  const b2csTotalTax = totalTax;
  const ecoTotalTax = ecoSummary[0]?.totalTax || 0;
  const hsnTotalTax = round2(hsnList.reduce((acc, h) => acc + h.totalTax, 0));

  const errors: string[] = [];
  const warnings: string[] = [];

  if (Math.abs(b2csTaxable - sourceNetTaxable) > 0.05) {
    errors.push(`B2CS Taxable Total (₹${b2csTaxable}) differs from Net Source Taxable (₹${sourceNetTaxable}).`);
  }
  if (Math.abs(ecoTaxable - b2csTaxable) > 0.05) {
    errors.push(`E-Commerce Taxable Total (₹${ecoTaxable}) differs from B2CS Taxable (₹${b2csTaxable}).`);
  }
  if (Math.abs(hsnTaxable - b2csTaxable) > 0.05) {
    errors.push(`HSN Taxable Total (₹${hsnTaxable}) differs from B2CS Taxable (₹${b2csTaxable}).`);
  }
  if (Math.abs(ecoTotalTax - b2csTotalTax) > 0.05) {
    errors.push(`E-Commerce Total Tax (₹${ecoTotalTax}) differs from B2CS Total Tax (₹${b2csTotalTax}).`);
  }
  if (Math.abs(hsnTotalTax - b2csTotalTax) > 0.05) {
    errors.push(`HSN Total Tax (₹${hsnTotalTax}) differs from B2CS Total Tax (₹${b2csTotalTax}).`);
  }

  if (docIssue.totalInvoices !== salesRecords.length) {
    errors.push(`Document Invoices Count (${docIssue.totalInvoices}) does not match Source Sales Count (${salesRecords.length}).`);
  }
  if (docIssue.totalCreditNotes !== returnRecords.length) {
    errors.push(`Document Credit Notes Count (${docIssue.totalCreditNotes}) does not match Source Returns Count (${returnRecords.length}).`);
  }

  const reconciliation: ReconciliationStatus = {
    isReconciled: errors.length === 0,
    errors,
    warnings,
    details: {
      sourceNetTaxable,
      b2csTaxable,
      ecoTaxable,
      hsnTaxable,
      b2csTotalTax,
      ecoTotalTax,
      hsnTotalTax,
      sourceSalesCount: salesRecords.length,
      sourceReturnsCount: returnRecords.length,
      docTotalInvoices: docIssue.totalInvoices,
      docTotalCreditNotes: docIssue.totalCreditNotes
    }
  };

  return {
    recordCount: records.length,
    totalTaxable,
    totalIgst,
    totalCgst,
    totalSgst,
    totalTax,
    totalInvoiceValue,
    b2csList,
    docIssue,
    ecoSummary,
    hsnList,
    reconciliation
  };
}
