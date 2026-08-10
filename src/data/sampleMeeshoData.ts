import { MeeshoTransaction, GSTINProfile } from '../types';

export const INITIAL_GSTIN_PROFILES: GSTINProfile[] = [];

export function generateSampleMeeshoTransactions(): MeeshoTransaction[] {
  const states = [
    { code: '07', name: 'Delhi' },
    { code: '27', name: 'Maharashtra' },
    { code: '29', name: 'Karnataka' },
    { code: '24', name: 'Gujarat' },
    { code: '09', name: 'Uttar Pradesh' },
    { code: '33', name: 'Tamil Nadu' },
    { code: '19', name: 'West Bengal' },
    { code: '08', name: 'Rajasthan' },
    { code: '06', name: 'Haryana' },
    { code: '36', name: 'Telangana' }
  ];

  const hsnItems = [
    { hsn: '6109', rate: 5, desc: 'T-Shirts & Apparel' },
    { hsn: '6204', rate: 12, desc: 'Women Suits & Dresses' },
    { hsn: '9503', rate: 12, desc: 'Toys & Games' },
    { hsn: '8518', rate: 18, desc: 'Audio Headphones & Gadgets' },
    { hsn: '3304', rate: 18, desc: 'Beauty & Cosmetics' }
  ];

  const transactions: MeeshoTransaction[] = [];
  const sellerStateCode = '07'; // Delhi seller

  // Generate 28 sales orders
  for (let i = 1; i <= 28; i++) {
    const stateObj = states[i % states.length];
    const hsnObj = hsnItems[i % hsnItems.length];
    const isInterState = stateObj.code !== sellerStateCode;
    
    const qty = (i % 3) + 1;
    const baseUnitRate = 250 + (i * 35) % 600;
    const taxableValue = Math.round(baseUnitRate * qty);
    const gstRate = hsnObj.rate;
    const totalTax = Math.round((taxableValue * gstRate) / 100);

    let igst = 0;
    let cgst = 0;
    let sgst = 0;

    if (isInterState) {
      igst = totalTax;
    } else {
      cgst = Math.round(totalTax / 2);
      sgst = totalTax - cgst;
    }

    // TCS is 1% on net taxable value (1% IGST for interstate, 0.5% CGST + 0.5% SGST for intrastate)
    const tcsTotal = Math.round(taxableValue * 0.01);
    let tcsIgst = 0;
    let tcsCgst = 0;
    let tcsSgst = 0;

    if (isInterState) {
      tcsIgst = tcsTotal;
    } else {
      tcsCgst = Math.round(tcsTotal / 2);
      tcsSgst = tcsTotal - tcsCgst;
    }

    const day = (i % 28) + 1;
    const dateStr = `2026-07-${day < 10 ? '0' + day : day}`;

    transactions.push({
      id: `msh-sales-${i}`,
      orderId: `MEESHO-ORD-20267-${1000 + i}`,
      subOrderId: `SUB-${1000 + i}-A`,
      orderDate: dateStr,
      invoiceDate: dateStr,
      type: 'Sales',
      posStateCode: stateObj.code,
      posStateName: stateObj.name,
      isInterState,
      hsnCode: hsnObj.hsn,
      quantity: qty,
      grossAmount: taxableValue + totalTax,
      taxableValue,
      gstRate,
      igstAmount: igst,
      cgstAmount: cgst,
      sgstAmount: sgst,
      tcsIgst,
      tcsCgst,
      tcsSgst,
      totalTcs: tcsTotal,
      sourceFile: 'sample'
    });
  }

  // Generate 5 return orders
  for (let i = 1; i <= 5; i++) {
    const salesRef = transactions[i * 3];
    const day = (salesRef ? parseInt(salesRef.orderDate.split('-')[2]) + 3 : 15);
    const returnDateStr = `2026-07-${day > 28 ? 28 : day}`;

    const taxableValue = salesRef.taxableValue;
    const totalTax = salesRef.igstAmount + salesRef.cgstAmount + salesRef.sgstAmount;
    const tcsTotal = salesRef.totalTcs;

    transactions.push({
      id: `msh-return-${i}`,
      orderId: salesRef.orderId,
      subOrderId: salesRef.subOrderId,
      orderDate: salesRef.orderDate,
      invoiceDate: returnDateStr,
      type: 'Return',
      posStateCode: salesRef.posStateCode,
      posStateName: salesRef.posStateName,
      isInterState: salesRef.isInterState,
      hsnCode: salesRef.hsnCode,
      quantity: salesRef.quantity,
      grossAmount: salesRef.grossAmount,
      taxableValue,
      gstRate: salesRef.gstRate,
      igstAmount: salesRef.igstAmount,
      cgstAmount: salesRef.cgstAmount,
      sgstAmount: salesRef.sgstAmount,
      tcsIgst: salesRef.tcsIgst,
      tcsCgst: salesRef.tcsCgst,
      tcsSgst: salesRef.tcsSgst,
      totalTcs: tcsTotal,
      sourceFile: 'sample'
    });
  }

  return transactions;
}
