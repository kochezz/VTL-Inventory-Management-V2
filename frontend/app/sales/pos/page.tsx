'use client';

// ============================================================================
// POINT OF SALE — frontend/app/sales/pos/page.tsx
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, api } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  ShoppingBag, Plus, Minus, Trash2, Search, User, X,
  CreditCard, Banknote, Smartphone, Layers,
  CheckCircle2, AlertCircle, Mail,
  LogIn, LogOut, Package, MapPin, Tag, Receipt, RefreshCw,
  ShoppingCart, BarChart3
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface POSProduct {
  product_id: string;
  sku: string;
  product_name: string;
  selling_price: number;
  selling_price_zmw: number | null;
  base_uom: string;
  total_available: number;
}

interface ProductLocation {
  inventory_id: string;
  location_id: string;
  location_code: string;
  location_name: string;
  quantity_available: number;
  uom: string;
}

type Currency = 'USD' | 'ZMW';

interface CartLine {
  product_id: string;
  product_name: string;
  sku: string;
  location_id: string;
  location_name: string;
  quantity: number;
  unit_price: number;
  line_discount: number;
  uom: string;
  max_available: number;
}

interface Customer {
  customer_id: string;
  vtl_customer_id: string;
  trading_name: string;
  legal_name: string;
  email: string;
  phone: string;
  tier: string;
  tier_name: string;
  territory: string;
  customer_type: string;
  payment_terms: string;
  credit_limit: number;
  total_transactions: number;
  lifetime_value: number;
  last_purchase_date: string | null;
}

interface POSSession {
  session_id: string;
  session_number: string;
  cashier_name: string;
  opened_at: string;
  opening_float: number;
  total_sales_amount: number;
  total_transactions: number;
  status: string;
}

interface Transaction {
  transaction_id: string;
  receipt_number: string;
  total_amount: number;
  subtotal: number;
  payment_method: string;
  change_given: number;
  transaction_date: string;
  cashier_name: string;
  customer_trading_name?: string;
  lines: any[];
  order_discount_amount: number;
  receipt_emailed: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtCurrency = (n: number | string, currency: Currency) => {
  const val = parseFloat(String(n || 0));
  return currency === 'ZMW'
    ? `K${val.toFixed(2)}`
    : `$${val.toFixed(2)}`;
};
const fmt = (n: number | string) => `$${parseFloat(String(n || 0)).toFixed(2)}`;

const PAYMENT_METHODS = [
  { id: 'cash',   label: 'Cash',         icon: Banknote },
  { id: 'mobile', label: 'Mobile Money', icon: Smartphone },
  { id: 'card',   label: 'Card',         icon: CreditCard },
  { id: 'mixed',  label: 'Split Tender', icon: Layers },
];

// ── ProductCard ───────────────────────────────────────────────────────────────

function ProductCard({ product, onAdd, currency }: { product: POSProduct; onAdd: (p: POSProduct) => void; currency: Currency }) {
  const outOfStock = product.total_available <= 0;
  return (
    <button
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      className={`text-left p-4 rounded-xl border transition-all ${
        outOfStock
          ? 'bg-dark-900 border-dark-700 opacity-50 cursor-not-allowed'
          : 'bg-dark-800 border-dark-700 hover:border-primary-500 hover:bg-dark-700 cursor-pointer'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Package className="w-4 h-4 text-blue-400" />
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          outOfStock ? 'bg-red-500/10 text-red-400' :
          product.total_available < 20 ? 'bg-yellow-500/10 text-yellow-400' :
          'bg-green-500/10 text-green-400'
        }`}>
          {outOfStock ? 'Out of stock' : `${product.total_available} units`}
        </span>
      </div>
      <p className="text-sm font-medium text-white leading-tight mb-1">{product.product_name}</p>
      <p className="text-xs text-gray-500 mb-2">{product.sku}</p>
      <p className="text-base font-bold text-primary-400">{fmtCurrency(currency === 'ZMW' && product.selling_price_zmw ? product.selling_price_zmw : product.selling_price, currency)}</p>
    </button>
  );
}

// ── LocationPickerModal ───────────────────────────────────────────────────────

function LocationPickerModal({
  product, onSelect, onClose, token, currency
}: {
  product: POSProduct;
  onSelect: (loc: ProductLocation) => void;
  onClose: () => void;
  token: string | null;
  currency: Currency;
}) {
  const [locations, setLocations] = useState<ProductLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/sales/products/${product.product_id}/locations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => setLocations(r.data.locations))
      .catch(() => setLocations([]))
      .finally(() => setLoading(false));
  }, [product.product_id, token]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-md">
        <div className="p-5 border-b border-dark-700 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white">{product.product_name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Select which stock location to fulfil from</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
          {loading && <p className="text-center text-gray-400 py-6">Loading locations...</p>}
          {!loading && locations.length === 0 && (
            <div className="text-center py-6">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-red-400 text-sm">No stock available at any location</p>
            </div>
          )}
          {locations.map(loc => (
            <button key={loc.location_id} onClick={() => onSelect(loc)}
              className="w-full text-left p-4 bg-dark-900 border border-dark-600 rounded-lg hover:border-primary-500 hover:bg-dark-700 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white">{loc.location_name}</p>
                    <p className="text-xs text-gray-400">{loc.location_code}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-400">{loc.quantity_available}</p>
                  <p className="text-xs text-gray-500">{loc.uom} available</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PaymentModal ──────────────────────────────────────────────────────────────

function PaymentModal({
  subtotal, cartLines, session, customer, token, currency, onComplete, onClose,
}: {
  subtotal: number;
  cartLines: CartLine[];
  session: POSSession | null;
  customer: Customer | null;
  token: string | null;
  currency: Currency;
  onComplete: (tx: Transaction) => void;
  onClose: () => void;
}) {
  const [method, setMethod]                 = useState('cash');
  const [tendered, setTendered]             = useState('');
  const [cashAmt, setCashAmt]               = useState('');
  const [mobileAmt, setMobileAmt]           = useState('');
  const [cardAmt, setCardAmt]               = useState('');
  const [discType, setDiscType]             = useState('none');
  const [discValue, setDiscValue]           = useState('');
  const [receiptEmail, setReceiptEmail]     = useState(customer?.email || '');
  const [emailReceipt, setEmailReceipt]     = useState(!!customer?.email);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState('');

  const orderDiscAmt = (() => {
    if (discType === 'percentage') return subtotal * (parseFloat(discValue || '0') / 100);
    if (discType === 'fixed') return parseFloat(discValue || '0');
    return 0;
  })();
  const finalTotal = Math.max(0, subtotal - orderDiscAmt);

  const change      = method === 'cash' ? Math.max(0, parseFloat(tendered || '0') - finalTotal) : 0;
  const splitSum    = parseFloat(cashAmt || '0') + parseFloat(mobileAmt || '0') + parseFloat(cardAmt || '0');
  const splitShort  = method === 'mixed' ? finalTotal - splitSum : 0;

  const canPay = (() => {
    if (method === 'cash')   return parseFloat(tendered || '0') >= finalTotal - 0.005;
    if (method === 'mobile') return true;
    if (method === 'card')   return true;
    if (method === 'mixed')  return splitShort <= 0.01;
    return false;
  })();

  const handleComplete = async () => {
    setError(''); setSubmitting(true);
    try {
      // FIX: Convert the tendered Kwacha amounts back to USD before sending to the backend!
      const rate = currency === 'ZMW' ? exchangeRate : 1;
      const orderDiscValUSD = discType === 'fixed' ? parseFloat(discValue || '0') / rate : parseFloat(discValue || '0');
      const tenderedValUSD = method === 'cash' ? parseFloat(tendered || String(finalTotal)) / rate : finalTotal / rate;
      const cashAmtUSD = method === 'cash' ? finalTotal / rate : parseFloat(cashAmt || '0') / rate;
      const mobileAmtUSD = method === 'mobile' ? finalTotal / rate : parseFloat(mobileAmt || '0') / rate;
      const cardAmtUSD = method === 'card' ? finalTotal / rate : parseFloat(cardAmt || '0') / rate;

      const res = await axios.post(`${API_URL}/sales/transactions`, {
        session_id:           session?.session_id || null,
        customer_id:          customer?.customer_id || null,
        customer_name:        customer?.trading_name || null,
        lines:                cartLines.map(l => ({
          product_id:    l.product_id,
          location_id:   l.location_id,
          quantity:      l.quantity,
          unit_price:    l.unit_price, // Already in USD
          line_discount: l.line_discount, // Already in USD
          uom:           l.uom,
        })),
        order_discount_type:  discType,
        order_discount_value: orderDiscValUSD,
        payment_method:       method,
        amount_tendered:      tenderedValUSD,
        cash_amount:          cashAmtUSD,
        mobile_amount:        mobileAmtUSD,
        card_amount:          cardAmtUSD,
        receipt_email_address: emailReceipt && receiptEmail ? receiptEmail : null,
      }, { headers: { Authorization: `Bearer ${token}` } });
      onComplete(res.data.transaction);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Transaction failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">

        <div className="p-5 border-b border-dark-700 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-white">Complete Payment</h2>
          <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Order discount */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Order Discount</label>
            <div className="flex gap-2 mb-2">
              {['none','percentage','fixed'].map(t => (
                <button key={t} onClick={() => { setDiscType(t); setDiscValue(''); }}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                    discType === t
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'bg-dark-900 border-dark-600 text-gray-400'
                  }`}>
                  {t === 'none' ? 'None' : t === 'percentage' ? '% Off' : `${currency === 'ZMW' ? 'K' : '$'} Off`}
                </button>
              ))}
            </div>
            {discType !== 'none' && (
              <input type="number" min="0"
                value={discValue} onChange={e => setDiscValue(e.target.value)}
                placeholder={discType === 'percentage' ? 'e.g. 10 for 10% off' : `e.g. 5.00 off total`}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm"
              />
            )}
          </div>

          {/* Summary */}
          <div className="bg-dark-900 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Subtotal</span><span>{fmtCurrency(subtotal, currency)}</span>
            </div>
            {orderDiscAmt > 0 && (
              <div className="flex justify-between text-sm text-green-400">
                <span>Discount</span><span>-{fmtCurrency(orderDiscAmt, currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold text-white border-t border-dark-700 pt-2">
              <span>Total</span>
              <span className="text-primary-400">{fmtCurrency(finalTotal, currency)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button key={m.id} onClick={() => setMethod(m.id)}
                  className={`flex items-center gap-2 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                    method === m.id
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'bg-dark-900 border-dark-600 text-gray-400 hover:border-dark-500'
                  }`}>
                  <m.icon className="w-4 h-4" />{m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cash */}
          {method === 'cash' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Amount Tendered</label>
              <input type="number" min={finalTotal} step="0.01"
                value={tendered} onChange={e => setTendered(e.target.value)}
                placeholder={`Min: ${fmtCurrency(finalTotal, currency)}`}
                className="w-full px-3 py-2.5 bg-dark-900 border border-dark-600 rounded-lg text-white text-lg font-mono"
              />
              {change > 0.005 && (
                <div className="mt-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex justify-between">
                  <span className="text-green-400 text-sm font-medium">Change</span>
                  <span className="text-green-400 text-lg font-bold">{fmtCurrency(change, currency)}</span>
                </div>
              )}
            </div>
          )}

          {/* Split */}
          {method === 'mixed' && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-gray-400">Split Payment Amounts</label>
              {[
                { label: 'Cash',         icon: Banknote,   val: cashAmt,   set: setCashAmt   },
                { label: 'Mobile Money', icon: Smartphone, val: mobileAmt, set: setMobileAmt },
                { label: 'Card',         icon: CreditCard, val: cardAmt,   set: setCardAmt   },
              ].map(({ label, icon: Icon, val, set }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-300 w-28">{label}</span>
                  <input type="number" min="0" step="0.01"
                    value={val} onChange={e => set(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm font-mono"
                  />
                </div>
              ))}
              <div className={`flex justify-between text-sm p-2 rounded-lg ${
                splitShort <= 0.01 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                <span>{splitShort <= 0.01 ? 'Fully covered' : `Remaining to collect`}</span>
                <span className="font-bold">{splitShort <= 0.01 ? '✓' : fmtCurrency(splitShort, currency)}</span>
              </div>
            </div>
          )}

          {/* Receipt email */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" checked={emailReceipt}
                onChange={e => setEmailReceipt(e.target.checked)} className="rounded" />
              <span className="text-sm text-gray-300">Email receipt to customer</span>
            </label>
            {emailReceipt && (
              <input type="email" value={receiptEmail}
                onChange={e => setReceiptEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm"
              />
            )}
          </div>
        </div>

        <div className="p-5 border-t border-dark-700 flex-shrink-0 flex gap-3">
          <button onClick={onClose} disabled={submitting}
            className="flex-1 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-xl font-medium transition-colors">
            Cancel
          </button>
          <button onClick={handleComplete} disabled={!canPay || submitting}
            className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing...</>
              : <><CheckCircle2 className="w-4 h-4" />Complete — {fmtCurrency(finalTotal, currency)}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ReceiptModal ──────────────────────────────────────────────────────────────

function ReceiptModal({
  transaction, token, currency, exchangeRate, formatStat, onClose, onNewSale,
}: {
  transaction: Transaction;
  token: string | null;
  currency: Currency;
  exchangeRate: number;
  formatStat: (amount: number | string) => string;
  onClose: () => void;
  onNewSale: () => void;
}) {
  const [emailAddr, setEmailAddr]   = useState('');
  const [sending, setSending]       = useState(false);
  const [emailSent, setEmailSent]   = useState(transaction.receipt_emailed);
  const [emailError, setEmailError] = useState('');

  const sendEmail = async () => {
    if (!emailAddr.trim()) return;
    setSending(true); setEmailError('');
    try {
      await axios.post(
        `${API_URL}/sales/transactions/${transaction.transaction_id}/email-receipt`,
        { 
          email: emailAddr.trim(),
          currency: currency,
          exchangeRate: exchangeRate 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEmailSent(true);
    } catch (err: any) {
      setEmailError(err.response?.data?.error || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=800');
    if (!printWindow) return;

    const totalInclVat = parseFloat(String(transaction.total_amount));
    const totalExclVat = totalInclVat / 1.16;
    const vatAmount = totalInclVat - totalExclVat;

    // FIX: Added specific classes to ensure the table columns don't squish together
    const lineRows = transaction.lines.map((l: any) => `
      <tr>
        <td class="col-item" style="padding:8px 0;border-bottom:1px dashed #ccc;">${l.product_name}</td>
        <td class="col-qty" style="padding:8px 0;border-bottom:1px dashed #ccc;">${l.quantity}</td>
        <td class="col-price" style="padding:8px 0;border-bottom:1px dashed #ccc;">${formatStat(l.unit_price)}</td>
        <td class="col-total" style="padding:8px 0;border-bottom:1px dashed #ccc;">${formatStat(l.line_total)}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Receipt ${transaction.receipt_number}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; color: #000; max-width: 340px; margin: 0 auto; padding: 20px; font-size: 13px; }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { max-width: 120px; margin-bottom: 10px; filter: invert(1); }
            .company-name { font-weight: bold; font-size: 18px; margin: 0 0 5px 0; }
            .company-details { font-size: 12px; margin: 0 0 15px 0; line-height: 1.4; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            
            /* FIX: Strict table layout forces text to wrap instead of squishing columns */
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 13px; table-layout: fixed; }
            th, td { vertical-align: top; word-wrap: break-word; }
            .col-item { width: 45%; text-align: left; padding-right: 5px; }
            .col-qty { width: 12%; text-align: center; }
            .col-price { width: 20%; text-align: right; }
            .col-total { width: 23%; text-align: right; font-weight: bold; }
            
            .totals { width: 100%; font-size: 13px; margin-bottom: 20px; }
            .totals td { padding: 4px 0; }
            .bold { font-weight: bold; }
            .footer { text-align: center; font-size: 11px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="/logo-white.png" class="logo" alt="Vilagio" />
            <p class="company-name">Vilagio Trading Limited</p>
            <p class="company-details">Plot 28441 50/50<br/>Kitwe Road, Chingola<br/>Email: info@vilag.io<br/>Tel: +260571669256<br/><strong>TPIN: 2003903432 </strong></p>
            <p style="font-size: 16px; font-weight: bold; margin: 10px 0;">TAX INVOICE</p>
          </div>
          
          <div style="margin-bottom: 15px; font-size: 12px;">
            <p style="margin: 2px 0;"><strong>Receipt #:</strong> ${transaction.receipt_number}</p>
            <p style="margin: 2px 0;"><strong>Date:</strong> ${new Date(transaction.transaction_date).toLocaleString('en-GB')}</p>
            <p style="margin: 2px 0;"><strong>Cashier:</strong> ${transaction.cashier_name}</p>
            ${transaction.customer_trading_name ? `<p style="margin: 2px 0;"><strong>Customer:</strong> ${transaction.customer_trading_name}</p>` : ''}
          </div>
          
          <table>
            <thead>
              <tr>
                <th class="col-item" style="border-bottom:1px solid #000;padding-bottom:5px;">Item</th>
                <th class="col-qty" style="border-bottom:1px solid #000;padding-bottom:5px;">Qty</th>
                <th class="col-price" style="border-bottom:1px solid #000;padding-bottom:5px;">Price</th>
                <th class="col-total" style="border-bottom:1px solid #000;padding-bottom:5px;">Total</th>
              </tr>
            </thead>
            <tbody>${lineRows}</tbody>
          </table>

          <table class="totals">
            <tr>
              <td>Subtotal (Excl. VAT)</td>
              <td style="text-align:right;">${formatStat(totalExclVat)}</td>
            </tr>
            <tr>
              <td>VAT (16%)</td>
              <td style="text-align:right;">${formatStat(vatAmount)}</td>
            </tr>
            ${parseFloat(String(transaction.order_discount_amount)) > 0 ? `
            <tr>
              <td>Discount</td>
              <td style="text-align:right;">-${formatStat(transaction.order_discount_amount)}</td>
            </tr>` : ''}
            <tr style="border-top: 1px solid #000;">
              <td class="bold" style="padding-top: 10px; font-size: 16px;">TOTAL</td>
              <td class="bold" style="text-align:right; padding-top: 10px; font-size: 16px;">${formatStat(totalInclVat)}</td>
            </tr>
          </table>

          <div style="font-size: 12px; margin-bottom: 20px;">
            <p style="margin: 2px 0;"><strong>Payment:</strong> ${transaction.payment_method.toUpperCase()}</p>
            ${parseFloat(String(transaction.change_given)) > 0.005 ? `<p style="margin: 2px 0;"><strong>Change:</strong> ${formatStat(transaction.change_given)}</p>` : ''}
          </div>

          <div class="divider"></div>
          
          <div class="footer">
            <p style="font-weight:bold; font-size:14px; margin-bottom: 5px;">Thank you for your business!</p>
            <p style="margin-bottom: 5px;">Join our Loyalty Program at vilag.io</p>
            <p>Prices inclusive of 16% VAT</p>
          </div>
          
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-md">
        <div className="p-6 text-center border-b border-dark-700">
          <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Sale Complete</h2>
          <p className="text-gray-400 text-sm mt-1 font-mono">{transaction.receipt_number}</p>
          {transaction.customer_trading_name && (
            <p className="text-xs text-gray-500 mt-1">Customer: {transaction.customer_trading_name}</p>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-dark-900 rounded-xl p-4 space-y-2 text-sm">
            {transaction.lines.map((l: any, i: number) => (
              <div key={i} className="flex justify-between text-gray-300">
                <span className="truncate pr-2">{l.product_name} × {l.quantity}</span>
                <span className="flex-shrink-0">{formatStat(l.line_total)}</span>
              </div>
            ))}
            {parseFloat(String(transaction.order_discount_amount)) > 0 && (
              <div className="flex justify-between text-green-400 border-t border-dark-700 pt-2">
                <span>Discount</span>
                <span>-{formatStat(transaction.order_discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-white border-t border-dark-700 pt-2 text-base">
              <span>Total</span>
              <span className="text-primary-400">{formatStat(transaction.total_amount)}</span>
            </div>
            <p className="text-gray-500 text-xs">
              {transaction.payment_method.charAt(0).toUpperCase() + transaction.payment_method.slice(1)} payment
              {parseFloat(String(transaction.change_given)) > 0.005 &&
                ` · Change: ${formatStat(transaction.change_given)}`}
            </p>
          </div>

          {/* Action Buttons: Email and Print */}
          <div className="flex gap-2 mb-4">
            <button onClick={handlePrint}
              className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 border border-dark-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
              Print Receipt
            </button>
          </div>

          {emailSent ? (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <p className="text-green-400 text-sm">Receipt emailed successfully</p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email receipt</label>
              <div className="flex gap-2">
                <input type="email" value={emailAddr} onChange={e => setEmailAddr(e.target.value)}
                  placeholder="customer@example.com"
                  className="flex-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm"
                  onKeyDown={e => { if (e.key === 'Enter') sendEmail(); }}
                />
                <button onClick={sendEmail} disabled={!emailAddr.trim() || sending}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-1.5">
                  {sending
                    ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Mail className="w-3.5 h-3.5" />}
                  Send
                </button>
              </div>
              {emailError && <p className="text-red-400 text-xs mt-1">{emailError}</p>}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-xl text-sm font-medium transition-colors">
              Close
            </button>
            <button onClick={onNewSale}
              className="flex-1 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />New Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SessionManager ────────────────────────────────────────────────────────────

function SessionManager({
  session, token, formatStat, onSessionChange,
}: {
  session: POSSession | null;
  token: string | null;
  formatStat: (amount: number | string) => string;
  onSessionChange: (s: POSSession | null) => void;
}) {
  const [showOpen, setShowOpen]     = useState(false);
  const [showClose, setShowClose]   = useState(false);
  const [float, setFloat]           = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const openSession = async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.post(
        `${API_URL}/sales/sessions/open`,
        { opening_float: parseFloat(float || '0') },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onSessionChange(res.data.session);
      setShowOpen(false); setFloat('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to open session');
    } finally {
      setLoading(false);
    }
  };

  const closeSession = async () => {
    if (!session) return;
    setLoading(true); setError('');
    try {
      await axios.post(
        `${API_URL}/sales/sessions/${session.session_id}/close`,
        { closing_cash: parseFloat(closingCash || '0'), notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onSessionChange(null);
      setShowClose(false); setClosingCash(''); setNotes('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to close session');
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div>
        {!showOpen ? (
          <button onClick={() => setShowOpen(true)}
            className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
            <LogIn className="w-4 h-4" />Open Cashier Session
          </button>
        ) : (
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-white">Opening Cash Float</p>
            <input type="number" min="0" step="0.01"
              value={float} onChange={e => setFloat(e.target.value)}
              placeholder="Cash in drawer e.g. 100.00"
              className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowOpen(false); setError(''); }}
                className="flex-1 py-2 bg-dark-700 text-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={openSession} disabled={loading}
                className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {loading ? 'Opening...' : 'Open Session'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-dark-900 border border-green-500/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-green-400">Session Active</span>
        </div>
        <span className="text-xs text-gray-400 font-mono">{session.session_number}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-dark-800 rounded-lg p-2">
          <p className="text-gray-500 mb-0.5">Revenue</p>
          <p className="text-white font-bold">{formatStat(session.total_sales_amount)}</p>
        </div>
        <div className="bg-dark-800 rounded-lg p-2">
          <p className="text-gray-500 mb-0.5">Transactions</p>
          <p className="text-white font-bold">{session.total_transactions}</p>
        </div>
      </div>
      {!showClose ? (
        <button onClick={() => setShowClose(true)}
          className="w-full py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
          <LogOut className="w-4 h-4" />Close Session
        </button>
      ) : (
        <div className="space-y-2">
          <input type="number" min="0" step="0.01"
            value={closingCash} onChange={e => setClosingCash(e.target.value)}
            placeholder="Closing cash count"
            className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm"
          />
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Session notes (optional)" rows={2}
            className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm resize-none"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setShowClose(false); setError(''); }}
              className="flex-1 py-2 bg-dark-700 text-gray-300 rounded-lg text-xs">Cancel</button>
            <button onClick={closeSession} disabled={loading}
              className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">
              {loading ? 'Closing...' : 'Close & Reconcile'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function POSPage() {
  const router = useRouter();
  const { isAuthenticated, token, isLoading: authLoading } = useAuth();

  const [products, setProducts]   = useState<POSProduct[]>([]);
  const [cart, setCart]           = useState<CartLine[]>([]);
  const [session, setSession]     = useState<POSSession | null>(null);
  const [customer, setCustomer]   = useState<Customer | null>(null);
  const [stats, setStats]         = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [currency, setCurrency]   = useState<Currency>('USD');

  const [locationPicker, setLocationPicker] = useState<POSProduct | null>(null);
  const [showPayment, setShowPayment]       = useState(false);
  const [completedTx, setCompletedTx]       = useState<Transaction | null>(null);

  const [customerSearch, setCustomerSearch]     = useState('');
  const [customerResults, setCustomerResults]   = useState<Customer[]>([]);
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);

  // Dynamic exchange rate based on DB prices (fallback to 27)
  const exchangeRate = products.length > 0 && products[0].selling_price_zmw 
    ? (products[0].selling_price_zmw / products[0].selling_price) 
    : 27;

  // Global formatter for generic DB amounts (like session revenue)
  const formatStat = (amountInUSD: number | string) => {
    const val = parseFloat(String(amountInUSD || 0));
    if (currency === 'ZMW') {
      return `K${(val * exchangeRate).toFixed(2)}`;
    }
    return `$${val.toFixed(2)}`;
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [pr, sr, str] = await Promise.all([
        axios.get(`${API_URL}/sales/products`,       { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/sales/sessions/active`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/sales/stats`,           { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setProducts(pr.data.products);
      setSession(sr.data.session);
      setStats(str.data.stats);
    } catch {
      setError('Failed to load POS data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated && token) loadData();
  }, [isAuthenticated, token, loadData]);

  // Customer search debounce
  useEffect(() => {
    if (customerSearch.length < 2) { setCustomerResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_URL}/sales/customers/search?q=${customerSearch}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCustomerResults(res.data.customers);
        setShowCustomerDrop(true);
      } catch { setCustomerResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch, token]);

  const handleAddProduct = (product: POSProduct) => setLocationPicker(product);

  const handleLocationSelect = (product: POSProduct, loc: ProductLocation) => {
    setLocationPicker(null);
    const idx = cart.findIndex(l => l.product_id === product.product_id && l.location_id === loc.location_id);
    if (idx >= 0) {
      if (cart[idx].quantity < loc.quantity_available) {
        const updated = [...cart];
        updated[idx].quantity += 1;
        setCart(updated);
      }
    } else {
      setCart(prev => [...prev, {
        product_id:    product.product_id,
        product_name:  product.product_name,
        sku:           product.sku,
        location_id:   loc.location_id,
        location_name: loc.location_name,
        quantity:      1,
        // Always store USD in cart base unit_price so the backend processes it smoothly
        unit_price:    parseFloat(String(product.selling_price)),
        line_discount: 0,
        uom:           loc.uom,
        max_available: loc.quantity_available,
      }]);
    }
  };

  const updateQty = (idx: number, delta: number) => {
    const updated = [...cart];
    const newQty  = updated[idx].quantity + delta;
    if (newQty <= 0) updated.splice(idx, 1);
    else if (newQty <= updated[idx].max_available) updated[idx].quantity = newQty;
    setCart([...updated]);
  };

  const updateDiscount = (idx: number, val: string) => {
    const updated = [...cart];
    // Convert ZMW discount back to USD if in ZMW mode so DB is always stored in USD
    const discountVal = parseFloat(val || '0');
    updated[idx].line_discount = currency === 'ZMW' ? discountVal / exchangeRate : discountVal;
    setCart(updated);
  };

  const cartSubtotalUSD = cart.reduce((s, l) => s + (l.unit_price * l.quantity - l.line_discount), 0);

  const handleNewSale = () => {
    setCart([]); setCustomer(null); setCompletedTx(null);
    setCustomerSearch(''); loadData();
  };

  if (authLoading || !isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="max-w-screen-xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <ShoppingBag className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Point of Sale</h1>
              <p className="text-xs text-gray-400">FreshDrip Water Sales Terminal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Currency toggle */}
            <div className="flex items-center bg-dark-800 border border-dark-700 rounded-xl p-1">
              {(['USD', 'ZMW'] as Currency[]).map(c => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    currency === c
                      ? c === 'ZMW'
                        ? 'bg-green-500 text-white shadow'
                        : 'bg-blue-500 text-white shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {c === 'USD' ? '$ USD' : 'K ZMW'}
                </button>
              ))}
            </div>
            <button onClick={loadData} className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Revenue Today',    value: formatStat(stats.revenue_today),      icon: BarChart3,   cls: 'bg-green-500/10 text-green-400' },
              { label: 'Sales Today',      value: String(stats.sales_today),            icon: ShoppingBag, cls: 'bg-blue-500/10 text-blue-400'  },
              { label: 'Month Revenue',    value: formatStat(stats.revenue_this_month), icon: Receipt,     cls: 'bg-purple-500/10 text-purple-400' },
              { label: 'Customers Today',  value: String(stats.unique_customers_today), icon: User, cls: 'bg-amber-500/10 text-amber-400' },
            ].map(s => (
              <div key={s.label} className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${s.cls}`}><s.icon className="w-4 h-4" /></div>
                <div>
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className="text-lg font-bold text-white">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

          {/* Product Grid */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Products</h2>
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-36 bg-dark-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {products.map(p => (
                  <ProductCard key={p.product_id} product={p} onAdd={handleAddProduct} currency={currency} />
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-3">

            {/* Session */}
            <SessionManager session={session} token={token} formatStat={formatStat} onSessionChange={setSession} />

            {/* Customer */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300">Customer</h3>
                {customer && (
                  <button onClick={() => setCustomer(null)} className="text-xs text-gray-500 hover:text-gray-300">
                    Clear
                  </button>
                )}
              </div>
              {customer ? (
                <div className="bg-dark-900 rounded-lg p-3 border border-dark-600 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-primary-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{customer.trading_name}</p>
                      <p className="text-xs text-gray-400">{customer.vtl_customer_id} · {customer.tier_name || customer.tier}</p>
                      {customer.territory && <p className="text-xs text-gray-500">{customer.territory}</p>}
                    </div>
                    {customer.total_transactions > 0 && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-green-400 font-medium">{customer.total_transactions} orders</p>
                        <p className="text-xs text-gray-500">{formatStat(customer.lifetime_value)} LTV</p>
                      </div>
                    )}
                  </div>
                  {customer.payment_terms && customer.payment_terms !== 'Cash' && (
                    <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">
                      {customer.payment_terms} account · Credit: {formatStat(customer.credit_limit)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <input type="text" value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                      onFocus={() => setShowCustomerDrop(true)}
                      placeholder="Search B2B customer... or walk-in"
                      className="w-full pl-8 pr-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm"
                    />
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                  </div>
                  {showCustomerDrop && customerResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-xl">
                      {customerResults.map(c => (
                        <button key={c.customer_id}
                          onClick={() => {
                            setCustomer(c); setCustomerSearch('');
                            setShowCustomerDrop(false); setCustomerResults([]);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-dark-700 border-b border-dark-700 last:border-0 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{c.trading_name}</p>
                              <p className="text-xs text-gray-400">{c.vtl_customer_id} · {c.tier_name || c.tier} · {c.territory || '—'}</p>
                            </div>
                            {c.total_transactions > 0 && (
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs text-green-400 font-medium">{c.total_transactions} orders</p>
                                <p className="text-xs text-gray-500">{formatStat(c.lifetime_value)}</p>
                              </div>
                            )}
                          </div>
                          {c.payment_terms && c.payment_terms !== 'Cash' && (
                            <p className="text-xs text-amber-400 mt-0.5">{c.payment_terms} account · Credit: {formatStat(c.credit_limit)}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cart */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl">
              <div className="p-4 border-b border-dark-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">
                  Cart {cart.length > 0 && <span className="text-primary-400">({cart.length})</span>}
                </h3>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
                    Clear all
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto p-3 space-y-2">
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Tap a product to add it</p>
                  </div>
                ) : (
                  cart.map((line, idx) => (
                    <div key={idx} className="bg-dark-900 rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{line.product_name}</p>
                          <p className="text-xs text-gray-500">{line.location_name} · {formatStat(line.unit_price)} each</p>
                        </div>
                        <button onClick={() => setCart(cart.filter((_, i) => i !== idx))}
                          className="p-1 hover:bg-dark-700 rounded text-gray-500 hover:text-red-400 transition-colors flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-dark-800 rounded-lg border border-dark-600">
                          <button onClick={() => updateQty(idx, -1)}
                            className="w-7 h-7 flex items-center justify-center hover:bg-dark-700 rounded-l-lg text-gray-400 hover:text-white transition-colors">
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={line.max_available}
                            value={line.quantity}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 1;
                              const updated = [...cart];
                              updated[idx].quantity = Math.min(Math.max(1, val), line.max_available);
                              setCart([...updated]);
                            }}
                            className="w-12 text-center text-sm font-bold text-white bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary-500 rounded"
                          />
                          <button onClick={() => updateQty(idx, 1)}
                            disabled={line.quantity >= line.max_available}
                            className="w-7 h-7 flex items-center justify-center hover:bg-dark-700 rounded-r-lg text-gray-400 hover:text-white transition-colors disabled:opacity-40">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1 flex-1">
                          <Tag className="w-3 h-3 text-gray-600 flex-shrink-0" />
                          <input type="number" min="0" step="0.01"
                            value={(currency === 'ZMW' ? line.line_discount * exchangeRate : line.line_discount) || ''}
                            onChange={e => updateDiscount(idx, e.target.value)}
                            placeholder="Disc."
                            className="w-full px-2 py-1 bg-dark-800 border border-dark-700 rounded text-xs text-gray-300 font-mono min-w-0"
                          />
                        </div>
                        <span className="text-sm font-bold text-primary-400 flex-shrink-0 w-14 text-right">
                          {formatStat(line.unit_price * line.quantity - line.line_discount)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-4 border-t border-dark-700 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="text-white font-bold">{formatStat(cartSubtotalUSD)}</span>
                  </div>
                  <button
                    onClick={() => setShowPayment(true)}
                    disabled={!session}
                    className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    {session ? `Pay — ${formatStat(cartSubtotalUSD)}` : 'Open a session first'}
                  </button>
                  {!session && (
                    <p className="text-xs text-amber-400 text-center">Open a cashier session above to process sales</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {locationPicker && (
        <LocationPickerModal
          product={locationPicker}
          token={token}
          currency={currency}
          onSelect={loc => handleLocationSelect(locationPicker, loc)}
          onClose={() => setLocationPicker(null)}
        />
      )}

      {showPayment && (
        <PaymentModal
          subtotal={currency === 'ZMW' ? cartSubtotalUSD * exchangeRate : cartSubtotalUSD}
          cartLines={cart}
          session={session}
          customer={customer}
          token={token}
          currency={currency}
          onComplete={tx => { setShowPayment(false); setCompletedTx(tx); }}
          onClose={() => setShowPayment(false)}
        />
      )}

      {completedTx && (
        <ReceiptModal
          transaction={completedTx}
          token={token}
          currency={currency}
          exchangeRate={exchangeRate}
          formatStat={formatStat}
          onClose={() => { setCompletedTx(null); loadData(); }}
          onNewSale={handleNewSale}
        />
      )}
    </DashboardLayout>
  );
}