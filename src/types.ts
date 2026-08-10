export interface UserProfile {
  id: string;
  name: string;
  email: string;
  businessName: string;
  isLoggedIn: boolean;
}

export interface GSTINProfile {
  id: string;
  gstin: string;
  tradeName: string;
  partyName?: string;
  returnType: 'Monthly' | 'Quarterly';
  periodMonth: string; // e.g. "July"
  periodYear: string;  // e.g. "2026"
  isActive: boolean;
  addedDate: string;
  lastUsedDate: string;
  stateCode: string; // e.g., "07" for Delhi
  stateName: string; // e.g., "Delhi"
}

export interface PlatformItem {
  id: string;
  name: string;
  logo: string;
  badge: 'B2C' | 'B2B' | 'B2C / B2B';
  domain: string;
  isAvailable: boolean;
  importedCount?: number;
}

export interface MeeshoDocumentReference {
  type: 'INVOICE' | 'CREDIT_NOTE' | 'CREDIT_DISCOUNT' | 'CREDIT_CONVERSION';
  number: string;
  cancelled?: boolean;
}

export interface MeeshoTransaction {
  id: string;
  orderId: string;
  subOrderId?: string;
  orderDate: string;
  invoiceDate: string;
  type: 'Sales' | 'Return';
  posStateCode: string; // e.g. "27"
  posStateName: string; // e.g. "Maharashtra"
  isInterState: boolean; // IGST vs CGST+SGST
  hsnCode: string;
  quantity: number;
  grossAmount: number;
  taxableValue: number;
  gstRate: number; // e.g., 5, 12, 18
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  tcsIgst: number;
  tcsCgst: number;
  tcsSgst: number;
  totalTcs: number;
  sourceFile: string;
  sourceSheet?: string;
  sourceRow?: number | string;
  invoiceNumber?: string;
  isCancelled?: boolean;
  customerGstin?: string;
  returnCategory?: string;
  documentType?: MeeshoDocumentReference['type'];
  documentReferences?: MeeshoDocumentReference[];
}

export interface StateGSTR1Summary {
  stateCode: string;
  stateName: string;
  type: 'OE' | 'E' | 'INTRA' | 'INTER'; // Supply type or E-Commerce flag
  gstRate: number;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
  totalTax: number;
  totalInvoiceValue: number;
}

export interface HSNSummary {
  hsnCode: string;
  description: string;
  uqc: string; // Unit Quantity Code e.g. NOS, PCS
  totalQty: number;
  totalValue: number;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalTax: number;
}

export interface TCSReconcileSummary {
  totalGrossSales: number;
  totalSalesReturn: number;
  netSalesValue: number;
  tcsCollectedIgst: number;
  tcsCollectedCgst: number;
  tcsCollectedSgst: number;
  totalTcsCollected: number;
  expectedTcs: number; // 1% of net taxable sales
  variance: number;
  reconciledOrdersCount: number;
  discrepancyCount: number;
}

export interface ManualGSTR1Entry {
  id: string;
  section: 'b2cs' | 'doc_issue' | 'sec14' | 'hsn';
  stateCode?: string;
  stateName?: string;
  gstRate?: number;
  taxableValue?: number;
  igstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  invoiceValue?: number;
  hsnCode?: string;
  description?: string;
  docType?: string;
  totalDocs?: number;
  cancelledDocs?: number;
  operatorGstin?: string;
  operatorName?: string;
  notes?: string;
}

export interface DocumentCategorySummary {
  docNum: number;
  docType: string; // e.g. "Invoices for outward supply" or "Credit Note"
  from?: string;
  to?: string;
  totalCount: number;
  cancelledCount: number;
  netIssuedCount: number;
  sourceSheet?: string;
}

export interface DocumentsIssuedSummary {
  recordCount: number;
  totalInvoices: number;
  totalCreditNotes: number;
  totalDocs: number;
  cancelledDocs: number;
  netIssuedDocs: number;
  categories?: DocumentCategorySummary[];
}

export interface EcommerceOperatorSummary {
  portalName: string;
  operatorGstin: string;
  recordCount: number;
  netTaxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalTax: number;
}

export interface ReconciliationStatus {
  isReconciled: boolean;
  errors: string[];
  warnings: string[];
  details: {
    sourceNetTaxable: number;
    b2csTaxable: number;
    ecoTaxable: number;
    hsnTaxable: number;
    b2csTotalTax: number;
    ecoTotalTax: number;
    hsnTotalTax: number;
    sourceSalesCount: number;
    sourceReturnsCount: number;
    docTotalInvoices: number;
    docTotalCreditNotes: number;
  };
}

export interface GSTR1CompleteReport {
  recordCount: number;
  totalTaxable: number;
  totalIgst: number;
  totalCgst: number;
  totalSgst: number;
  totalTax: number;
  totalInvoiceValue: number;
  b2csList: StateGSTR1Summary[];
  docIssue: DocumentsIssuedSummary;
  ecoSummary: EcommerceOperatorSummary[];
  hsnList: HSNSummary[];
  reconciliation?: ReconciliationStatus;
}
