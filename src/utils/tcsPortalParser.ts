import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { parseNumber } from './excelParser';

export interface GSTPortalTCSData {
  isValid: boolean;
  errorMessage?: string;
  fileName: string;
  fileSize: string;
  recordCount: number;
  grossValue: number;
  salesReturn: number;
  netTaxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalTcs: number;
  collectorGstin?: string;
  collectorName?: string;
  period?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const cleanHeaders = headers.map((h) =>
    String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanAlias) continue;

    // Exact match
    const exactIdx = cleanHeaders.findIndex((h) => h === cleanAlias);
    if (exactIdx !== -1) return exactIdx;

    // Partial match
    const partialIdx = cleanHeaders.findIndex((h) => h.includes(cleanAlias));
    if (partialIdx !== -1) return partialIdx;
  }

  return -1;
}

export async function parseGSTPortalTCSReport(file: File): Promise<GSTPortalTCSData> {
  const fileName = file.name;
  const fileSize = formatFileSize(file.size);

  try {
    let workbook: XLSX.WorkBook | null = null;

    if (fileName.toLowerCase().endsWith('.zip')) {
      // Handle ZIP file
      const zip = new JSZip();
      const unzipped = await zip.loadAsync(file);
      let targetBuffer: ArrayBuffer | null = null;

      for (const relativePath of Object.keys(unzipped.files)) {
        const lower = relativePath.toLowerCase();
        if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
          targetBuffer = await unzipped.files[relativePath].async('arraybuffer');
          break;
        }
      }

      if (!targetBuffer) {
        return {
          isValid: false,
          errorMessage:
            'Unable to identify the GST Portal TCS report structure. Please upload the report downloaded from GST Portal → Services → Returns → TDS and TCS credit received.',
          fileName,
          fileSize,
          recordCount: 0,
          grossValue: 0,
          salesReturn: 0,
          netTaxableValue: 0,
          igstAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          totalTcs: 0
        };
      }

      workbook = XLSX.read(targetBuffer, { type: 'array' });
    } else {
      // Handle Excel / CSV file
      const buffer = await file.arrayBuffer();
      workbook = XLSX.read(buffer, { type: 'array' });
    }

    if (!workbook || workbook.SheetNames.length === 0) {
      return {
        isValid: false,
        errorMessage:
          'Unable to identify the GST Portal TCS report structure. Please upload the report downloaded from GST Portal → Services → Returns → TDS and TCS credit received.',
        fileName,
        fileSize,
        recordCount: 0,
        grossValue: 0,
        salesReturn: 0,
        netTaxableValue: 0,
        igstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        totalTcs: 0
      };
    }

    let bestResult: GSTPortalTCSData | null = null;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
      if (!rows || rows.length === 0) continue;

      // Scan first 20 rows to locate header row
      let headerRowIdx = -1;
      let grossColIdx = -1;
      let netColIdx = -1;
      let igstColIdx = -1;
      let cgstColIdx = -1;
      let sgstColIdx = -1;
      let tcsColIdx = -1;
      let returnColIdx = -1;
      let gstinColIdx = -1;
      let nameColIdx = -1;

      for (let r = 0; r < Math.min(25, rows.length); r++) {
        const row = rows[r];
        if (!Array.isArray(row) || row.length === 0) continue;

        const rowStrArr = row.map((c) => String(c || '').trim());

        // Check if row contains core TCS portal keywords
        grossColIdx = findColumnIndex(rowStrArr, [
          'gross value of supplies',
          'gross value',
          'gross sales',
          'gross amount',
          'gross'
        ]);

        netColIdx = findColumnIndex(rowStrArr, [
          'net amount liable to tcs',
          'net taxable value',
          'net amount',
          'net value',
          'taxable value'
        ]);

        igstColIdx = findColumnIndex(rowStrArr, ['integrated tax', 'igst amount', 'igst']);
        cgstColIdx = findColumnIndex(rowStrArr, ['central tax', 'cgst amount', 'cgst']);
        sgstColIdx = findColumnIndex(rowStrArr, ['state/ut tax', 'sgst amount', 'sgst', 'utgst']);
        tcsColIdx = findColumnIndex(rowStrArr, ['total tcs', 'tcs amount', 'total tax']);
        returnColIdx = findColumnIndex(rowStrArr, [
          'value of supplies returned',
          'sales return',
          'return value',
          'returns'
        ]);
        gstinColIdx = findColumnIndex(rowStrArr, [
          'gstin of collector',
          'gstin of ecommerce operator',
          'collector gstin',
          'gstin'
        ]);
        nameColIdx = findColumnIndex(rowStrArr, [
          'trade name',
          'legal name',
          'collector name',
          'ecommerce operator name'
        ]);

        // Require at least net or gross or (igst/cgst/sgst/tcs) columns
        if (
          netColIdx !== -1 ||
          grossColIdx !== -1 ||
          (igstColIdx !== -1 && cgstColIdx !== -1) ||
          tcsColIdx !== -1
        ) {
          headerRowIdx = r;
          break;
        }
      }

      if (headerRowIdx === -1) continue;

      let totalGross = 0;
      let totalReturn = 0;
      let totalNet = 0;
      let totalIgst = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalTcs = 0;
      let recordCount = 0;
      let extractedGstin = '';
      let extractedName = '';

      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row) || row.length === 0) continue;

        // Skip total/summary rows
        const firstCell = String(row[0] || '').toLowerCase().trim();
        if (firstCell.startsWith('total') || firstCell.startsWith('sum')) continue;

        const gVal = grossColIdx !== -1 ? parseNumber(row[grossColIdx]) : 0;
        const rVal = returnColIdx !== -1 ? parseNumber(row[returnColIdx]) : 0;
        let nVal = netColIdx !== -1 ? parseNumber(row[netColIdx]) : 0;
        if (nVal === 0 && (gVal !== 0 || rVal !== 0)) {
          nVal = gVal - rVal;
        }

        const igst = igstColIdx !== -1 ? parseNumber(row[igstColIdx]) : 0;
        const cgst = cgstColIdx !== -1 ? parseNumber(row[cgstColIdx]) : 0;
        const sgst = sgstColIdx !== -1 ? parseNumber(row[sgstColIdx]) : 0;
        let tcs = tcsColIdx !== -1 ? parseNumber(row[tcsColIdx]) : 0;
        if (tcs === 0 && (igst !== 0 || cgst !== 0 || sgst !== 0)) {
          tcs = igst + cgst + sgst;
        }

        if (gstinColIdx !== -1 && !extractedGstin && row[gstinColIdx]) {
          extractedGstin = String(row[gstinColIdx]).trim();
        }
        if (nameColIdx !== -1 && !extractedName && row[nameColIdx]) {
          extractedName = String(row[nameColIdx]).trim();
        }

        // Only count rows that have non-zero or valid data
        if (gVal !== 0 || rVal !== 0 || nVal !== 0 || tcs !== 0 || igst !== 0 || cgst !== 0 || sgst !== 0) {
          totalGross += gVal;
          totalReturn += rVal;
          totalNet += nVal;
          totalIgst += igst;
          totalCgst += cgst;
          totalSgst += sgst;
          totalTcs += tcs;
          recordCount++;
        }
      }

      if (recordCount > 0 || totalNet !== 0 || totalTcs !== 0) {
        const res: GSTPortalTCSData = {
          isValid: true,
          fileName,
          fileSize,
          recordCount,
          grossValue: Math.round(totalGross * 100) / 100,
          salesReturn: Math.round(totalReturn * 100) / 100,
          netTaxableValue: Math.round(totalNet * 100) / 100,
          igstAmount: Math.round(totalIgst * 100) / 100,
          cgstAmount: Math.round(totalCgst * 100) / 100,
          sgstAmount: Math.round(totalSgst * 100) / 100,
          totalTcs: Math.round(totalTcs * 100) / 100,
          collectorGstin: extractedGstin,
          collectorName: extractedName
        };

        if (!bestResult || res.recordCount > bestResult.recordCount) {
          bestResult = res;
        }
      }
    }

    if (bestResult) {
      return bestResult;
    }

    return {
      isValid: false,
      errorMessage:
        'Unable to identify the GST Portal TCS report structure. Please upload the report downloaded from GST Portal → Services → Returns → TDS and TCS credit received.',
      fileName,
      fileSize,
      recordCount: 0,
      grossValue: 0,
      salesReturn: 0,
      netTaxableValue: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      totalTcs: 0
    };
  } catch (err: any) {
    return {
      isValid: false,
      errorMessage:
        'Unable to identify the GST Portal TCS report structure. Please upload the report downloaded from GST Portal → Services → Returns → TDS and TCS credit received.',
      fileName,
      fileSize,
      recordCount: 0,
      grossValue: 0,
      salesReturn: 0,
      netTaxableValue: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      totalTcs: 0
    };
  }
}
