import { MeeshoTransaction, StateGSTR1Summary, HSNSummary, DocumentsIssuedSummary, EcommerceOperatorSummary, GSTR1CompleteReport, ManualGSTR1Entry } from '../types';

/**
 * Calculates Section 7: B2CS (B2C Small / Everyday consumer sales without GSTIN)
 */
export function calculateB2cs(
  records: MeeshoTransaction[],
  manualEntries: ManualGSTR1Entry[] = []
): StateGSTR1Summary[] {
  const b2csMap: Record<string, StateGSTR1Summary> = {};

  records.forEach((tx) => {
    // Validate numbers safely
    const taxableVal = Number(tx.taxableValue) || 0;
    const igstVal = Number(tx.igstAmount) || 0;
    const cgstVal = Number(tx.cgstAmount) || 0;
    const sgstVal = Number(tx.sgstAmount) || 0;
    const grossVal = Number(tx.grossAmount) || 0;
    const gstRate = Number(tx.gstRate) || 0;

    const stateCode = tx.posStateCode || '99';
    const stateName = tx.posStateName || 'Other State';

    const key = `${stateCode}_${gstRate}`;

    if (!b2csMap[key]) {
      b2csMap[key] = {
        stateCode,
        stateName,
        type: 'E', // E-Commerce
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
    row.taxableValue += taxableVal * multiplier;
    row.igstAmount += igstVal * multiplier;
    row.cgstAmount += cgstVal * multiplier;
    row.sgstAmount += sgstVal * multiplier;
    row.totalTax += (igstVal + cgstVal + sgstVal) * multiplier;
    row.totalInvoiceValue += grossVal * multiplier;
  });

  // Merge manual B2CS entries
  manualEntries.filter(m => m.section === 'b2cs').forEach((entry) => {
    const stateCode = entry.stateCode || '99';
    const stateName = entry.stateName || 'Other State';
    const gstRate = entry.gstRate || 5;
    const key = `${stateCode}_${gstRate}`;

    if (!b2csMap[key]) {
      b2csMap[key] = {
        stateCode,
        stateName,
        type: 'E',
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
    row.taxableValue += Number(entry.taxableValue) || 0;
    row.igstAmount += Number(entry.igstAmount) || 0;
    row.cgstAmount += Number(entry.cgstAmount) || 0;
    row.sgstAmount += Number(entry.sgstAmount) || 0;
    row.totalTax += (Number(entry.igstAmount) || 0) + (Number(entry.cgstAmount) || 0) + (Number(entry.sgstAmount) || 0);
    row.totalInvoiceValue += Number(entry.invoiceValue) || 0;
  });

  return Object.values(b2csMap).filter(r => Math.abs(r.taxableValue) > 0.001 || Math.abs(r.totalTax) > 0.001);
}

/**
 * Calculates Section 13: Documents Issued Summary
 */
export function calculateDocumentsIssued(
  records: MeeshoTransaction[],
  manualEntries: ManualGSTR1Entry[] = []
): DocumentsIssuedSummary {
  const salesCount = records.filter(r => r.type === 'Sales').length;
  const returnCount = records.filter(r => r.type === 'Return').length;
  const totalDocs = records.length;

  let manualDocs = 0;
  let manualCancelled = 0;

  manualEntries.filter(m => m.section === 'doc_issue').forEach(e => {
    manualDocs += Number(e.totalDocs) || 0;
    manualCancelled += Number(e.cancelledDocs) || 0;
  });

  const finalTotalDocs = totalDocs + manualDocs;
  const finalCancelledDocs = returnCount + manualCancelled;
  const netIssuedDocs = Math.max(0, finalTotalDocs - finalCancelledDocs);

  return {
    recordCount: totalDocs,
    totalDocs: finalTotalDocs,
    cancelledDocs: finalCancelledDocs,
    netIssuedDocs
  };
}

/**
 * Calculates Section 14: Supplies via E-Commerce Operators (u/s 52)
 */
export function calculateEcommerceOperator(
  records: MeeshoTransaction[],
  manualEntries: ManualGSTR1Entry[] = [],
  operatorGstin: string = '07AAGCM1234F1Z0',
  portalName: string = 'Meesho (Fashnear Technologies)'
): EcommerceOperatorSummary[] {
  let netTaxableValue = 0;
  let igstAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;

  records.forEach((tx) => {
    const multiplier = tx.type === 'Sales' ? 1 : -1;
    netTaxableValue += (Number(tx.taxableValue) || 0) * multiplier;
    igstAmount += (Number(tx.igstAmount) || 0) * multiplier;
    cgstAmount += (Number(tx.cgstAmount) || 0) * multiplier;
    sgstAmount += (Number(tx.sgstAmount) || 0) * multiplier;
  });

  // Adjust for manual section 14 entries
  manualEntries.filter(m => m.section === 'sec14').forEach(entry => {
    netTaxableValue += Number(entry.taxableValue) || 0;
    igstAmount += Number(entry.igstAmount) || 0;
    cgstAmount += Number(entry.cgstAmount) || 0;
    sgstAmount += Number(entry.sgstAmount) || 0;
  });

  const totalTax = igstAmount + cgstAmount + sgstAmount;

  return [{
    portalName,
    operatorGstin,
    recordCount: records.length,
    netTaxableValue,
    igstAmount,
    cgstAmount,
    sgstAmount,
    totalTax
  }];
}

/**
 * Calculates Section 12: HSN-Wise Summary
 */
export function calculateHsnSummary(
  records: MeeshoTransaction[],
  manualEntries: ManualGSTR1Entry[] = []
): HSNSummary[] {
  const hsnMap: Record<string, HSNSummary> = {};

  records.forEach((tx) => {
    const hsnCode = tx.hsnCode || '9999';
    const gstRate = Number(tx.gstRate) || 0;
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
    const gross = Number(tx.grossAmount) || 0;
    const taxVal = Number(tx.taxableValue) || 0;
    const igst = Number(tx.igstAmount) || 0;
    const cgst = Number(tx.cgstAmount) || 0;
    const sgst = Number(tx.sgstAmount) || 0;

    row.totalQty += qty * multiplier;
    row.totalValue += gross * multiplier;
    row.taxableValue += taxVal * multiplier;
    row.igstAmount += igst * multiplier;
    row.cgstAmount += cgst * multiplier;
    row.sgstAmount += sgst * multiplier;
    row.totalTax += (igst + cgst + sgst) * multiplier;
  });

  // Add manual HSN entries
  manualEntries.filter(m => m.section === 'hsn').forEach(entry => {
    const hsnCode = entry.hsnCode || '9999';
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
    row.taxableValue += Number(entry.taxableValue) || 0;
    row.totalValue += Number(entry.invoiceValue) || 0;
    row.igstAmount += Number(entry.igstAmount) || 0;
    row.cgstAmount += Number(entry.cgstAmount) || 0;
    row.sgstAmount += Number(entry.sgstAmount) || 0;
    row.totalTax += (Number(entry.igstAmount) || 0) + (Number(entry.cgstAmount) || 0) + (Number(entry.sgstAmount) || 0);
  });

  return Object.values(hsnMap).filter(h => Math.abs(h.taxableValue) > 0.001 || Math.abs(h.totalTax) > 0.001);
}

/**
 * Master GSTR-1 calculation function
 */
export function calculateGstr1Summary(
  records: MeeshoTransaction[],
  manualEntries: ManualGSTR1Entry[] = [],
  operatorGstin: string = '07AAGCM1234F1Z0'
): GSTR1CompleteReport {
  const b2csList = calculateB2cs(records, manualEntries);
  const docIssue = calculateDocumentsIssued(records, manualEntries);
  const ecoSummary = calculateEcommerceOperator(records, manualEntries, operatorGstin);
  const hsnList = calculateHsnSummary(records, manualEntries);

  const totalTaxable = b2csList.reduce((acc, curr) => acc + curr.taxableValue, 0);
  const totalIgst = b2csList.reduce((acc, curr) => acc + curr.igstAmount, 0);
  const totalCgst = b2csList.reduce((acc, curr) => acc + curr.cgstAmount, 0);
  const totalSgst = b2csList.reduce((acc, curr) => acc + curr.sgstAmount, 0);
  const totalInvoiceValue = b2csList.reduce((acc, curr) => acc + curr.totalInvoiceValue, 0);
  const totalTax = totalIgst + totalCgst + totalSgst;

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
    hsnList
  };
}
