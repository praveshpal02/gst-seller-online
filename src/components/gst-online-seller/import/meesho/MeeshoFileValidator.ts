import * as XLSX from 'xlsx';

export type MeeshoFileType = 'tcs_sales' | 'tcs_sales_return' | 'tax_invoice_details';

export interface FileValidationResult {
  isValid: boolean;
  fileType: MeeshoFileType;
  fileName: string;
  fileSizeFormatted: string;
  error?: string;
  rowCount?: number;
}

export interface SheetHeaderAnalysis {
  sheetName: string;
  headerRowIndex: number;
  rawHeaders: string[];
  normalizedHeaders: string[];
  rows: Record<string, any>[];
  totalDataRows: number;
}

/**
 * Format bytes into human readable size string (e.g. 1.2 MB or 450 KB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Dynamically detects the header row in a worksheet by scanning top rows for header-like keywords.
 */
export function analyzeWorksheetHeaders(sheet: XLSX.WorkSheet, sheetName: string): SheetHeaderAnalysis {
  const rawMatrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

  if (!rawMatrix || rawMatrix.length === 0) {
    return {
      sheetName,
      headerRowIndex: 0,
      rawHeaders: [],
      normalizedHeaders: [],
      rows: [],
      totalDataRows: 0
    };
  }

  const headerKeywords = [
    'order', 'sub order', 'suborder', 'invoice', 'hsn', 'taxable',
    'gst', 'state', 'date', 'return', 'quantity', 'qty', 'rate',
    'amount', 'tcs', 'igst', 'cgst', 'sgst', 'supplier', 'gstin',
    'credit', 'customer', 'delivery', 'value', 'gross'
  ];

  let bestRowIndex = 0;
  let maxScore = -1;

  const maxScanRows = Math.min(15, rawMatrix.length);
  for (let i = 0; i < maxScanRows; i++) {
    const row = rawMatrix[i];
    if (!Array.isArray(row)) continue;

    let keywordHits = 0;
    let nonBlankTextCells = 0;

    for (const cell of row) {
      const cellStr = String(cell || '').trim();
      const cellLower = cellStr.toLowerCase();

      if (cellStr.length > 0 && isNaN(Number(cellStr))) {
        nonBlankTextCells++;
      }

      if (headerKeywords.some((kw) => cellLower.includes(kw))) {
        keywordHits += 2;
      }
    }

    const currentScore = keywordHits + nonBlankTextCells;
    if (currentScore > maxScore && nonBlankTextCells >= 2) {
      maxScore = currentScore;
      bestRowIndex = i;
    }
  }

  const rawHeaders = (rawMatrix[bestRowIndex] || []).map((c) => String(c || '').trim());
  const normalizedHeaders = rawHeaders.map((h) =>
    h.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  );

  // Extract non-empty data rows after the header row
  const rows: Record<string, any>[] = [];
  for (let r = bestRowIndex + 1; r < rawMatrix.length; r++) {
    const rowCells = rawMatrix[r];
    if (!Array.isArray(rowCells)) continue;

    const hasData = rowCells.some((c) => String(c || '').trim() !== '');
    if (!hasData) continue;

    const rowObj: Record<string, any> = {};
    rawHeaders.forEach((header, colIdx) => {
      if (header) {
        rowObj[header] = rowCells[colIdx] !== undefined ? rowCells[colIdx] : '';
      }
    });
    rows.push(rowObj);
  }

  return {
    sheetName,
    headerRowIndex: bestRowIndex,
    rawHeaders,
    normalizedHeaders,
    rows,
    totalDataRows: rows.length
  };
}

/**
 * Validates a file against required Meesho structure for a specific file type.
 */
export async function validateMeeshoFile(
  file: File,
  expectedType: MeeshoFileType
): Promise<FileValidationResult> {
  const fileName = file.name;
  const fileSizeFormatted = formatFileSize(file.size);

  // 1. Check extension
  const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  if (extension !== '.xlsx' && extension !== '.xls') {
    return {
      isValid: false,
      fileType: expectedType,
      fileName,
      fileSizeFormatted,
      error: `Invalid file format (${extension || 'unknown'}). Only .xlsx Excel files are accepted.`
    };
  }

  // 2. Read file and inspect Excel structure
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    if (!workbook || workbook.SheetNames.length === 0) {
      return {
        isValid: false,
        fileType: expectedType,
        fileName,
        fileSizeFormatted,
        error: 'Empty or corrupted Excel workbook.'
      };
    }

    // Inspect all worksheets to find the best candidate sheet
    let bestAnalysis: SheetHeaderAnalysis | null = null;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const analysis = analyzeWorksheetHeaders(sheet, sheetName);
      if (!bestAnalysis || analysis.rawHeaders.length > bestAnalysis.rawHeaders.length) {
        bestAnalysis = analysis;
      }
    }

    if (!bestAnalysis || bestAnalysis.rawHeaders.length === 0) {
      return {
        isValid: false,
        fileType: expectedType,
        fileName,
        fileSizeFormatted,
        error: 'Unable to detect header row in Excel workbook.'
      };
    }

    const { sheetName, headerRowIndex, rawHeaders, normalizedHeaders, rows } = bestAnalysis;
    const rawHeadersLower = rawHeaders.map((h) => h.toLowerCase().trim());

    // Validation schemas per file type
    let isValid = false;
    let missingDetail = '';

    if (expectedType === 'tcs_sales') {
      const hasOrderCol = rawHeadersLower.some((h) =>
        h.includes('order') || h.includes('sub') || h.includes('sr') || h.includes('id') || h.includes('no')
      );
      const hasValueCol = rawHeadersLower.some((h) =>
        h.includes('taxable') || h.includes('gross') || h.includes('sales') || h.includes('amount') || h.includes('tcs') || h.includes('value')
      );

      if (hasOrderCol && hasValueCol) {
        isValid = true;
      } else {
        missingDetail = 'Required columns for TCS Sales (Sub Order No / Order ID and Taxable Value / TCS Amount) were not found.';
      }
    } else if (expectedType === 'tcs_sales_return') {
      const hasReturnOrOrder = rawHeadersLower.some((h) =>
        h.includes('order') || h.includes('sub') || h.includes('return') || h.includes('credit') || h.includes('refund') || h.includes('id')
      );
      const hasValueCol = rawHeadersLower.some((h) =>
        h.includes('return') || h.includes('taxable') || h.includes('amount') || h.includes('value') || h.includes('tcs') || h.includes('sales')
      );

      if (hasReturnOrOrder && hasValueCol) {
        isValid = true;
      } else {
        missingDetail = 'Required columns for TCS Sales Return (Return Order ID and Taxable Return Value) were not found.';
      }
    } else if (expectedType === 'tax_invoice_details') {
      const hasOrderCol = rawHeadersLower.some((h) =>
        h.includes('order') || h.includes('sub') || h.includes('invoice') || h.includes('no') || h.includes('id')
      );
      const hasInvoiceDetailCol = rawHeadersLower.some((h) =>
        h.includes('hsn') || h.includes('state') || h.includes('rate') || h.includes('taxable') || h.includes('qty') || h.includes('quantity') || h.includes('customer') || h.includes('delivery') || h.includes('value')
      );

      if (hasOrderCol && hasInvoiceDetailCol) {
        isValid = true;
      } else {
        missingDetail = 'Required columns for Tax Invoice Details (Sub Order No, HSN, Taxable Value, GST Rate) were not found.';
      }
    }

    // Developer logging
    console.log('[Meesho Validation]', {
      fileName,
      expectedType,
      sheetName,
      detectedHeaderRow: headerRowIndex + 1,
      detectedHeaders: rawHeaders,
      normalizedHeaders,
      rowCount: rows.length,
      isValid,
      missingDetail
    });

    if (!isValid) {
      return {
        isValid: false,
        fileType: expectedType,
        fileName,
        fileSizeFormatted,
        error: `Invalid Meesho report: ${missingDetail}\n\nHeaders found on row ${headerRowIndex + 1}: ${rawHeaders.join(', ')}`
      };
    }

    return {
      isValid: true,
      fileType: expectedType,
      fileName,
      fileSizeFormatted,
      rowCount: rows.length
    };
  } catch (err: any) {
    return {
      isValid: false,
      fileType: expectedType,
      fileName,
      fileSizeFormatted,
      error: `Excel parsing error: ${err?.message || 'Unreadable file structure'}`
    };
  }
}

export async function validateTcsSales(file: File): Promise<FileValidationResult> {
  return validateMeeshoFile(file, 'tcs_sales');
}

export async function validateTcsSalesReturn(file: File): Promise<FileValidationResult> {
  return validateMeeshoFile(file, 'tcs_sales_return');
}

export async function validateTaxInvoiceDetails(file: File): Promise<FileValidationResult> {
  return validateMeeshoFile(file, 'tax_invoice_details');
}
