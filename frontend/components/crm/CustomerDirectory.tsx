'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import {
  Search, Filter, Eye, Users, CheckCircle2, Clock, AlertCircle,
  Store, MapPin, FileText, AlertOctagon, X, ChevronDown,
  Mail, Send, Building2, Phone, CreditCard, Package,
  UserPlus, Layers, Star, Zap, RefreshCw, UserCheck,
  ShoppingBag, ArrowRight
} from 'lucide-react';
import RaiseNCRModal from '@/components/qms/RaiseNCRModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Customer {
  customer_id: string;
  vtl_customer_id: string | null;
  trading_name: string;
  legal_name: string;
  tier: string;
  tier_name: string;
  status: string;
  territory: string;
  created_at: string;
  onboarded_by_name: string;
  email?: string;
  phone?: string;
  customer_type?: string;
  total_transactions?: number;
  lifetime_value?: number;
  last_purchase_date?: string;
}

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  Kantemba: {
    label: 'T1 · Kantemba',
    desc: 'Single shop / kiosk',
    color: 'text-gray-300',
    bg: 'bg-gray-700',
    border: 'border-gray-600',
    dot: 'bg-gray-400',
    pill: 'bg-gray-700 text-gray-300 border-gray-600',
  },
  Wholesale: {
    label: 'T2 · Wholesale',
    desc: 'Bulk buyer / distributor',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
    pill: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  Chain: {
    label: 'T3 · Chain',
    desc: 'Multiple outlets',
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
    dot: 'bg-purple-400',
    pill: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
  Corporate: {
    label: 'T4 · Corporate',
    desc: 'B2B · Mines · Clubs',
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
    pill: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
};

const STATUS_CONFIG = {
  ACTIVE:            { label: 'Active',          icon: CheckCircle2, cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  PENDING_CFO:       { label: 'Pending CFO',     icon: Clock,        cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  REVISION_REQUIRED: { label: 'Revision Req.',   icon: AlertCircle,  cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
};

// ── Onboarding Request Modal ──────────────────────────────────────────────────

interface OnboardingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillName?: string;
  prefillEmail?: string;
}

function OnboardingRequestModal({ isOpen, onClose, prefillName = '', prefillEmail = '' }: OnboardingRequestModalProps) {
  const { user } = useAuth();
  const [step, setStep]         = useState<1 | 2>(1);
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState('');

  // Prospect details
  const [contactName, setContactName]   = useState(prefillName);
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail]               = useState(prefillEmail);
  const [phone, setPhone]               = useState('');
  const [tier, setTier]                 = useState<'Kantemba' | 'Wholesale' | 'Chain' | 'Corporate'>('Wholesale');
  const [territory, setTerritory]       = useState('');
  const [cashierNote, setCashierNote]   = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep(1); setSent(false); setError('');
      setContactName(prefillName); setEmail(prefillEmail);
      setBusinessName(''); setPhone(''); setTier('Wholesale');
      setTerritory(''); setCashierNote('');
    }
  }, [isOpen, prefillName, prefillEmail]);

  const buildEmailHTML = () => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#0F172A;padding:28px 32px;">
      <p style="color:#94A3B8;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px;">Vilagio Technologies Ltd.</p>
      <h1 style="color:#FFFFFF;font-size:22px;margin:0;font-weight:700;">Customer Account Registration</h1>
      <p style="color:#64748B;font-size:13px;margin:8px 0 0;">Request for Business Information — VTL Customer Onboarding</p>
    </div>

    <!-- Greeting -->
    <div style="padding:32px 32px 0;">
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Dear <strong>${contactName || 'Valued Customer'}</strong>,
      </p>
      <p style="color:#334155;font-size:14px;line-height:1.7;margin:0 0 16px;">
        Thank you for choosing <strong>FreshDrip Water</strong> — we appreciate your business. 
        To set up your <strong>${TIER_CONFIG[tier].desc}</strong> account and unlock account-based benefits 
        including priority delivery scheduling, dedicated account management, and preferential pricing, 
        we need a few details from you.
      </p>
      <p style="color:#334155;font-size:14px;line-height:1.7;margin:0 0 24px;">
        Please complete the information below and reply to this email — our team will have your 
        <strong>VTL Customer Account</strong> activated within <strong>24–48 business hours</strong>.
      </p>
    </div>

    <!-- Tier badge -->
    <div style="margin:0 32px 24px;background:#F1F5F9;border-radius:8px;padding:16px;border-left:4px solid #3B82F6;">
      <p style="color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Your Account Tier</p>
      <p style="color:#0F172A;font-size:16px;font-weight:700;margin:0;">${TIER_CONFIG[tier].label}</p>
      <p style="color:#64748B;font-size:13px;margin:4px 0 0;">${TIER_CONFIG[tier].desc}</p>
    </div>

    <!-- Required Information -->
    <div style="padding:0 32px 24px;">
      <h2 style="color:#0F172A;font-size:16px;font-weight:700;margin:0 0 16px;border-bottom:1px solid #E2E8F0;padding-bottom:8px;">
        Information Required
      </h2>

      <!-- Section 1 -->
      <div style="margin-bottom:20px;">
        <p style="color:#3B82F6;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">
          1. Business Identity
        </p>
        <table style="width:100%;border-collapse:collapse;">
          ${[
            ['Trading Name', '(name your business trades under)'],
            ['Legal / Registered Name', '(if different from trading name)'],
            ['TPIN / Tax Number', '(required for account terms)'],
            ['Business Type', 'Sole Trader / Partnership / Ltd Company / Other'],
          ].map(([field, hint]) => `
          <tr>
            <td style="padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;width:45%;color:#475569;font-size:13px;font-weight:600;">${field}</td>
            <td style="padding:8px 12px;background:#FFFFFF;border:1px solid #E2E8F0;color:#94A3B8;font-size:12px;font-style:italic;">${hint}</td>
          </tr>`).join('')}
        </table>
      </div>

      <!-- Section 2 -->
      <div style="margin-bottom:20px;">
        <p style="color:#3B82F6;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">
          2. Primary Contact Person
        </p>
        <table style="width:100%;border-collapse:collapse;">
          ${[
            ['Full Name', ''],
            ['Position / Title', 'e.g. Owner, Procurement Manager'],
            ['Mobile Number', ''],
            ['Email Address', '(for invoices and account correspondence)'],
            ['WhatsApp Number', '(include country code, e.g. +260...)'],
          ].map(([field, hint]) => `
          <tr>
            <td style="padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;width:45%;color:#475569;font-size:13px;font-weight:600;">${field}</td>
            <td style="padding:8px 12px;background:#FFFFFF;border:1px solid #E2E8F0;color:#94A3B8;font-size:12px;font-style:italic;">${hint || '&nbsp;'}</td>
          </tr>`).join('')}
        </table>
      </div>

      <!-- Section 3 -->
      <div style="margin-bottom:20px;">
        <p style="color:#3B82F6;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">
          3. Delivery Location(s)
        </p>
        <table style="width:100%;border-collapse:collapse;">
          ${[
            ['Street Address', ''],
            ['Town / City', ''],
            ['Region / Province', ''],
            tier === 'Chain' || tier === 'Corporate' ? ['Additional Branch/Site Addresses', '(list any other delivery locations)'] : null,
          ].filter(Boolean).map(([field, hint]: any) => `
          <tr>
            <td style="padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;width:45%;color:#475569;font-size:13px;font-weight:600;">${field}</td>
            <td style="padding:8px 12px;background:#FFFFFF;border:1px solid #E2E8F0;color:#94A3B8;font-size:12px;font-style:italic;">${hint || '&nbsp;'}</td>
          </tr>`).join('')}
        </table>
      </div>

      <!-- Section 4 -->
      <div style="margin-bottom:24px;">
        <p style="color:#3B82F6;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">
          4. Commercial Profile
        </p>
        <table style="width:100%;border-collapse:collapse;">
          ${[
            ['Estimated Monthly Volume', '(approximate units of water per month)'],
            ['Preferred Delivery Frequency', 'Daily / Weekly / Bi-Weekly / Monthly / Ad-hoc'],
            ['Preferred Payment Terms', 'Cash on Delivery / 7-Day / 14-Day / 30-Day Account'],
          ].map(([field, hint]) => `
          <tr>
            <td style="padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;width:45%;color:#475569;font-size:13px;font-weight:600;">${field}</td>
            <td style="padding:8px 12px;background:#FFFFFF;border:1px solid #E2E8F0;color:#94A3B8;font-size:12px;font-style:italic;">${hint}</td>
          </tr>`).join('')}
        </table>
      </div>

      <!-- Note from cashier -->
      ${cashierNote ? `
      <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:6px;padding:14px 16px;margin-bottom:24px;">
        <p style="color:#92400E;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Note from your VTL Sales Representative</p>
        <p style="color:#78350F;font-size:13px;margin:0;line-height:1.6;">${cashierNote}</p>
      </div>` : ''}

      <!-- CTA -->
      <div style="background:#EFF6FF;border-radius:8px;padding:20px 24px;margin-bottom:24px;text-align:center;">
        <p style="color:#1E40AF;font-size:14px;font-weight:600;margin:0 0 8px;">Simply reply to this email with your completed information</p>
        <p style="color:#3B82F6;font-size:13px;margin:0;">Our team will process your registration and confirm your VTL Customer Account within 24–48 business hours.</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#F1F5F9;padding:20px 32px;border-top:1px solid #E2E8F0;">
      <p style="color:#64748B;font-size:12px;margin:0 0 4px;">
        This request was sent by <strong>${user?.full_name || 'Vilagio Sales'}</strong> on behalf of Vilagio Technologies Ltd.
      </p>
      <p style="color:#94A3B8;font-size:11px;margin:0;">
        Vilagio Technologies Ltd. · FreshDrip Water · www.vilag.io · 
        Questions? Reply to this email or call your VTL sales representative.
      </p>
    </div>
  </div>
</body>
</html>`;

  const handleSend = async () => {
    if (!email.trim()) { setError('An email address is required to send the request.'); return; }
    if (!contactName.trim()) { setError('Contact name is required.'); return; }
    setSending(true); setError('');
    try {
      await api.post('/customers/onboarding-request', {
        to_email:      email.trim(),
        contact_name:  contactName.trim(),
        business_name: businessName.trim() || null,
        phone:         phone.trim() || null,
        tier,
        territory:     territory.trim() || null,
        cashier_note:  cashierNote.trim() || null,
        sent_by:       user?.full_name,
        email_html:    buildEmailHTML(),
        email_subject: `FreshDrip Water — Customer Account Registration Request`,
      });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="p-6 border-b border-dark-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-xl">
              <UserPlus className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Send Onboarding Request</h2>
              <p className="text-xs text-gray-400 mt-0.5">Email the customer a pre-filled registration form</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {sent ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Request Sent!</h3>
            <p className="text-gray-400 text-sm mb-1">Onboarding request emailed to</p>
            <p className="text-primary-400 font-mono font-medium mb-6">{email}</p>
            <p className="text-gray-500 text-xs max-w-sm">
              Once the customer replies with their details, use the <strong className="text-gray-300">New Customer Profile</strong> form to register them in the system.
            </p>
            <button onClick={onClose}
              className="mt-8 px-6 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-xl text-sm font-medium transition-colors">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Step indicator */}
              <div className="flex gap-2 mb-1">
                {[1, 2].map(s => (
                  <div key={s} className={`flex items-center gap-2 flex-1 ${s < 2 ? 'after:flex-1 after:h-px after:bg-dark-600 after:content-[\'\']' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${step >= s ? 'bg-primary-500 text-white' : 'bg-dark-700 text-gray-500'}`}>
                      {s}
                    </div>
                    <span className={`text-xs ${step >= s ? 'text-gray-300' : 'text-gray-600'}`}>
                      {s === 1 ? 'Prospect details' : 'Review & send'}
                    </span>
                  </div>
                ))}
              </div>

              {step === 1 ? (
                <div className="space-y-4">
                  {/* Tier picker */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">Expected Account Tier</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(TIER_CONFIG) as Array<keyof typeof TIER_CONFIG>).map(t => {
                        const cfg = TIER_CONFIG[t];
                        return (
                          <button key={t} onClick={() => setTier(t as any)}
                            className={`text-left p-3 rounded-xl border transition-all ${
                              tier === t
                                ? `${cfg.bg} ${cfg.border} border-2`
                                : 'bg-dark-900 border-dark-600 hover:border-dark-500'
                            }`}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                              <span className={`text-sm font-bold ${tier === t ? cfg.color : 'text-gray-300'}`}>{t}</span>
                            </div>
                            <p className="text-xs text-gray-500 pl-4">{cfg.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Contact Person Name *</label>
                      <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                        placeholder="e.g. John Mwale"
                        className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Business / Trading Name</label>
                      <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                        placeholder="e.g. Mwale Stores"
                        className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Email Address *</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="customer@example.com"
                        className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Phone Number</label>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                        placeholder="+260..."
                        className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Territory / Area</label>
                      <input type="text" value={territory} onChange={e => setTerritory(e.target.value)}
                        placeholder="e.g. Copperbelt North, Lusaka CBD"
                        className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Note to Customer (optional)</label>
                      <textarea value={cashierNote} onChange={e => setCashierNote(e.target.value)}
                        rows={2} placeholder="Any context from your interaction today..."
                        className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm resize-none focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Step 2: Preview */
                <div className="space-y-4">
                  <div className="bg-dark-900 rounded-xl border border-dark-600 overflow-hidden">
                    <div className="bg-dark-950 px-4 py-3 border-b border-dark-700 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-400 font-medium">Email preview</span>
                    </div>
                    <div className="p-4 space-y-2 text-sm">
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-12 flex-shrink-0">To:</span>
                        <span className="text-primary-400 font-medium">{email}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-12 flex-shrink-0">Subj:</span>
                        <span className="text-gray-200">FreshDrip Water — Customer Account Registration Request</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {[
                      { icon: UserCheck, label: 'Contact', value: contactName },
                      { icon: Store,     label: 'Business', value: businessName || '(not specified)' },
                      { icon: Layers,    label: 'Tier', value: `${tier} — ${TIER_CONFIG[tier].desc}` },
                      { icon: MapPin,    label: 'Territory', value: territory || '(not specified)' },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center gap-3 p-3 bg-dark-900 rounded-lg border border-dark-700">
                        <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-400 w-20 text-xs">{label}</span>
                        <span className="text-white text-sm">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">
                    The email will contain a structured table asking the customer to provide their business details,
                    contact information, delivery locations, and commercial profile — everything needed to register
                    them in the VTL system.
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-dark-700 flex-shrink-0 flex gap-3">
              {step === 1 ? (
                <>
                  <button onClick={onClose}
                    className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-xl text-sm font-medium transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={() => { setError(''); setStep(2); }}
                    disabled={!email.trim() || !contactName.trim()}
                    className="flex-1 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    Review Email <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setStep(1)}
                    className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-xl text-sm font-medium transition-colors">
                    ← Back
                  </button>
                  <button onClick={handleSend} disabled={sending}
                    className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {sending
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</>
                      : <><Send className="w-4 h-4" />Send Onboarding Request</>
                    }
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main CustomerDirectory ────────────────────────────────────────────────────

export default function CustomerDirectory() {
  const router = useRouter();
  const { user } = useAuth();

  const [customers, setCustomers]     = useState<Customer[]>([]);
  const [loading, setLoading]         = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tierFilter, setTierFilter]   = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [showNCRModal, setShowNCRModal]         = useState(false);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardPrefill, setOnboardPrefill]     = useState({ name: '', email: '' });

  // POS quick-link: when coming from POS with ?prospect query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prospectName  = params.get('prospect_name') || '';
    const prospectEmail = params.get('prospect_email') || '';
    if (prospectName || prospectEmail) {
      setOnboardPrefill({ name: prospectName, email: prospectEmail });
      setShowOnboardModal(true);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [statusFilter, tierFilter]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (tierFilter)   params.append('tier', tierFilter);
      const res = await api.get(`/customers?${params.toString()}`);
      setCustomers(res.data);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Multi-field search: name, ID, territory, legal name, email, tier description
  const filtered = customers.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.trading_name?.toLowerCase().includes(q) ||
      c.legal_name?.toLowerCase().includes(q)   ||
      c.vtl_customer_id?.toLowerCase().includes(q) ||
      c.territory?.toLowerCase().includes(q)    ||
      c.email?.toLowerCase().includes(q)        ||
      c.tier_name?.toLowerCase().includes(q)    ||
      c.onboarded_by_name?.toLowerCase().includes(q)
    );
  });

  // Stats
  const stats = {
    total:    customers.length,
    active:   customers.filter(c => c.status === 'ACTIVE').length,
    pending:  customers.filter(c => c.status === 'PENDING_CFO').length,
    revision: customers.filter(c => c.status === 'REVISION_REQUIRED').length,
  };

  const tierCounts = Object.keys(TIER_CONFIG).reduce((acc, t) => {
    acc[t] = customers.filter(c => c.tier_name === t).length;
    return acc;
  }, {} as Record<string, number>);

  const getStatusPill = (status: string) => {
    const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
      ?? { label: status, icon: AlertCircle, cls: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
    const Icon = cfg.icon;
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1 w-max ${cfg.cls}`}>
        <Icon className="w-3 h-3" />{cfg.label}
      </span>
    );
  };

  const getTierPill = (tierName: string) => {
    const cfg = TIER_CONFIG[tierName as keyof typeof TIER_CONFIG];
    if (!cfg) return <span className="text-xs text-gray-400">{tierName}</span>;
    return (
      <span className={`px-2 py-1 rounded text-xs font-bold border ${cfg.pill}`}>
        {cfg.label}
      </span>
    );
  };

  return (
    <>
      <div className="space-y-4">

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Customers', value: stats.total,    color: 'text-white',        bg: 'bg-dark-800 border-dark-700' },
            { label: 'Active',          value: stats.active,   color: 'text-green-400',    bg: 'bg-green-500/5 border-green-500/20' },
            { label: 'Pending CFO',     value: stats.pending,  color: 'text-blue-400',     bg: 'bg-blue-500/5 border-blue-500/20' },
            { label: 'Needs Revision',  value: stats.revision, color: 'text-orange-400',   bg: 'bg-orange-500/5 border-orange-500/20' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border rounded-xl p-4`}>
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tier breakdown */}
        <div className="grid grid-cols-4 gap-2">
          {(Object.entries(TIER_CONFIG) as Array<[string, typeof TIER_CONFIG.Kantemba]>).map(([t, cfg]) => (
            <button key={t}
              onClick={() => setTierFilter(tierFilter === t ? '' : t)}
              className={`p-3 rounded-xl border text-left transition-all ${
                tierFilter === t
                  ? `${cfg.bg} ${cfg.border} border-2`
                  : 'bg-dark-800 border-dark-700 hover:border-dark-500'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className={`text-lg font-bold ${tierFilter === t ? cfg.color : 'text-white'}`}>
                  {tierCounts[t] || 0}
                </span>
              </div>
              <p className={`text-xs font-medium ${tierFilter === t ? cfg.color : 'text-gray-300'}`}>{t}</p>
              <p className="text-xs text-gray-500">{cfg.desc}</p>
            </button>
          ))}
        </div>

        {/* Main card */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-xl">

          {/* Action bar */}
          <div className="p-4 border-b border-dark-700 flex flex-col sm:flex-row justify-between items-center bg-dark-900 gap-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-400" />
              Customer Directory
              {filtered.length !== customers.length && (
                <span className="text-xs font-normal text-gray-400">· {filtered.length} of {customers.length} shown</span>
              )}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setShowOnboardModal(true)}
                className="px-3 py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors">
                <UserPlus className="w-3.5 h-3.5" />Send Onboarding Request
              </button>
              <button onClick={() => window.open('/qms/documents?search=QA-SAL-MGT-SOP-002', '_blank')}
                className="px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors">
                <FileText className="w-3.5 h-3.5" />CRM SOP
              </button>
              <button onClick={() => setShowNCRModal(true)}
                className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors">
                <AlertOctagon className="w-3.5 h-3.5" />Log Complaint
              </button>
              <button onClick={fetchCustomers}
                className="p-1.5 hover:bg-dark-700 text-gray-400 rounded-lg transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search + filters */}
          <div className="p-4 border-b border-dark-700 bg-dark-900/40 space-y-3">
            <div className="flex gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID, territory, email, tier..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none placeholder:text-gray-500"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {/* Status filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="pl-8 pr-8 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm appearance-none focus:border-primary-500 focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING_CFO">Pending CFO</option>
                  <option value="REVISION_REQUIRED">Revision Required</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Active filters summary */}
            {(searchQuery || statusFilter || tierFilter) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">Filters:</span>
                {searchQuery && (
                  <span className="px-2 py-0.5 bg-primary-500/10 border border-primary-500/30 text-primary-400 rounded text-xs flex items-center gap-1">
                    "{searchQuery}" <button onClick={() => setSearchQuery('')}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {tierFilter && (
                  <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 border ${TIER_CONFIG[tierFilter as keyof typeof TIER_CONFIG]?.pill}`}>
                    {tierFilter} <button onClick={() => setTierFilter('')}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {statusFilter && (
                  <span className="px-2 py-0.5 bg-gray-500/10 border border-gray-500/20 text-gray-400 rounded text-xs flex items-center gap-1">
                    {statusFilter} <button onClick={() => setStatusFilter('')}><X className="w-3 h-3" /></button>
                  </span>
                )}
                <button onClick={() => { setSearchQuery(''); setTierFilter(''); setStatusFilter(''); }}
                  className="text-xs text-gray-500 hover:text-gray-300 underline">Clear all</button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-900/80 border-b border-dark-700 text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-5 py-3 font-medium">Customer ID</th>
                  <th className="px-5 py-3 font-medium">Trading Name</th>
                  <th className="px-5 py-3 font-medium">Tier</th>
                  <th className="px-5 py-3 font-medium">Territory</th>
                  <th className="px-5 py-3 font-medium">Onboarded By</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
                      Loading directory...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 font-medium mb-1">No customers found</p>
                      {searchQuery && (
                        <p className="text-gray-500 text-sm mb-4">
                          No results for "<span className="text-gray-300">{searchQuery}</span>"
                        </p>
                      )}
                      {/* Offer to send onboarding request for walk-in customer */}
                      <div className="mt-4 inline-flex flex-col items-center gap-2">
                        <p className="text-xs text-gray-500">Is this a potential new customer?</p>
                        <button
                          onClick={() => {
                            setOnboardPrefill({ name: searchQuery, email: '' });
                            setShowOnboardModal(true);
                          }}
                          className="px-4 py-2 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                          <UserPlus className="w-4 h-4" />
                          Send Onboarding Request to "{searchQuery}"
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(customer => (
                    <tr key={customer.customer_id}
                      className="hover:bg-dark-700/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/vendor-management/customers/${customer.customer_id}`)}>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {customer.vtl_customer_id
                          ? <span className="font-mono text-sm font-bold text-primary-400">{customer.vtl_customer_id}</span>
                          : <span className="text-xs text-gray-500 italic">Pending</span>
                        }
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Store className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate max-w-[180px]">{customer.trading_name}</p>
                            {customer.email && (
                              <p className="text-xs text-gray-500 truncate max-w-[180px]">{customer.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {getTierPill(customer.tier_name)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="text-sm text-gray-300 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-500" />
                          {customer.territory || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="text-sm text-gray-400">{customer.onboarded_by_name}</p>
                        <p className="text-xs text-gray-600">{new Date(customer.created_at).toLocaleDateString()}</p>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {getStatusPill(customer.status)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick onboarding request if email on record */}
                          {customer.status !== 'ACTIVE' && (
                            <button
                              title="Send onboarding request"
                              onClick={() => {
                                setOnboardPrefill({
                                  name:  customer.trading_name,
                                  email: customer.email || '',
                                });
                                setShowOnboardModal(true);
                              }}
                              className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => router.push(`/vendor-management/customers/${customer.customer_id}`)}
                            className="p-1.5 text-gray-400 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      <OnboardingRequestModal
        isOpen={showOnboardModal}
        onClose={() => { setShowOnboardModal(false); setOnboardPrefill({ name: '', email: '' }); }}
        prefillName={onboardPrefill.name}
        prefillEmail={onboardPrefill.email}
      />

      <RaiseNCRModal
        isOpen={showNCRModal}
        onClose={() => setShowNCRModal(false)}
        sourceModule="Customer"
        sourceId="Customer Complaint"
        onSuccess={() => alert('Customer Complaint NCR successfully logged into the QMS.')}
      />
    </>
  );
}
