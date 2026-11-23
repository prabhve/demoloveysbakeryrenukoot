import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../../lib/firebase';
import {
  CustomerCrmNoteRecord,
  OrderPaymentRecord,
  ProductItem,
  CategoryItem,
} from '../../data/initialCatalogue';
import type { OrderRecord } from '../AdminDashboard';
import {
  Users,
  Search,
  Download,
  MessageCircle,
  Phone,
  CheckCircle2,
  BarChart3,
  TrendingUp,
  Tag,
  ShieldAlert,
  Edit3,
} from 'lucide-react';

interface BmsCrmAndAnalyticsModuleProps {
  mode: 'customers' | 'analytics';
  orders: OrderRecord[];
  orderPayments: OrderPaymentRecord[];
  products: ProductItem[];
  categories: CategoryItem[];
  customerCrmNotes: CustomerCrmNoteRecord[];
  userEmail: string;
  hasPermission: (perm: string) => boolean;
  requestStepUpVerification: (actionLabel: string, onVerified: () => void) => void;
  recordAuditLog: (
    module: string,
    action: string,
    targetId: string,
    summary: string
  ) => Promise<void>;
}

interface AggregatedCustomer {
  customerId: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  addresses: string[];
  totalOrders: number;
  verifiedSpent: number;
  customCakeCount: number;
  lastOrderNumber: string;
  lastOrderDate: string;
  orders: OrderRecord[];
}

export const BmsCrmAndAnalyticsModule: React.FC<BmsCrmAndAnalyticsModuleProps> = ({
  mode,
  orders,
  orderPayments,
  products,
  categories,
  customerCrmNotes,
  userEmail,
  hasPermission,
  requestStepUpVerification,
  recordAuditLog,
}) => {
  const [crmSearch, setCrmSearch] = useState('');
  const [crmSegment, setCrmSegment] = useState<'all' | 'repeat' | 'new' | 'high_value' | 'privacy_requests'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<AggregatedCustomer | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [allowWhatsappPref, setAllowWhatsappPref] = useState(true);
  const [allowPhonePref, setAllowPhonePref] = useState(true);
  const [privacyStatusInput, setPrivacyStatusInput] = useState<
    'none' | 'access_requested' | 'correction_requested' | 'deletion_requested' | 'completed'
  >('none');
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  // Analytics Date Range
  const [analyticsRange, setAnalyticsRange] = useState<'all' | 'today' | '7days' | '30days'>('all');

  // Aggregate unique customers from real Firestore orders
  const customerMap = new Map<string, AggregatedCustomer>();
  orders.forEach((o) => {
    const cleanPhone = (o.customerPhone || '').replace(/[^\d]/g, '') || o.customerName;
    const customerId = `cust-${cleanPhone}`;
    const isVerifiedOrder =
      o.orderStatus !== 'cancelled' &&
      o.orderStatus !== 'awaiting_advance_payment' &&
      o.orderStatus !== 'payment_rejected';

    const existing = customerMap.get(customerId);
    if (existing) {
      existing.totalOrders += 1;
      if (isVerifiedOrder) {
        existing.verifiedSpent += Number(o.totalAmount || 0);
      }
      if (o.customCakeDetails) {
        existing.customCakeCount += 1;
      }
      if (o.deliveryAddress && !existing.addresses.includes(o.deliveryAddress)) {
        existing.addresses.push(o.deliveryAddress);
      }
      existing.orders.push(o);
    } else {
      customerMap.set(customerId, {
        customerId,
        name: o.customerName,
        phone: o.customerPhone,
        whatsapp: o.customerWhatsapp || o.customerPhone,
        email: o.customerEmail || '',
        addresses: o.deliveryAddress ? [o.deliveryAddress] : [],
        totalOrders: 1,
        verifiedSpent: isVerifiedOrder ? Number(o.totalAmount || 0) : 0,
        customCakeCount: o.customCakeDetails ? 1 : 0,
        lastOrderNumber: o.orderNumber,
        lastOrderDate: o.createdAt,
        orders: [o],
      });
    }
  });

  const allCustomers = Array.from(customerMap.values());

  const parseTags = (tagsSummary?: string): string[] =>
    (tagsSummary || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

  const openCustomerInspector = (cust: AggregatedCustomer) => {
    setSelectedCustomer(cust);
    const crmDoc = customerCrmNotes.find((n) => n.id === cust.customerId);
    setNoteInput(crmDoc?.internalNotes || '');
    setTagsInput(crmDoc?.tagsSummary || '');
    setAllowWhatsappPref(crmDoc?.whatsappOptIn !== false);
    setAllowPhonePref(crmDoc?.phoneCallOptIn !== false);
    setPrivacyStatusInput((crmDoc?.privacyRequestStatus as any) || 'none');
  };

  const handleSaveCrmNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const rec: CustomerCrmNoteRecord = {
      id: selectedCustomer.customerId,
      customerName: selectedCustomer.name,
      customerPhone: selectedCustomer.phone,
      customerEmail: selectedCustomer.email,
      savedAddresses: selectedCustomer.addresses.join(' | '),
      tagsSummary: tags.join(', '),
      segment: selectedCustomer.totalOrders >= 2 ? 'repeat' : 'new',
      whatsappOptIn: allowWhatsappPref,
      phoneCallOptIn: allowPhonePref,
      internalNotes: noteInput.trim(),
      privacyRequestStatus: privacyStatusInput,
      updatedByEmail: userEmail,
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'customer_crm_notes', selectedCustomer.customerId), rec);
      await recordAuditLog(
        'customers',
        'CRM_PROFILE_UPDATED',
        selectedCustomer.customerId,
        `Updated CRM profile & tags for ${selectedCustomer.name} (${selectedCustomer.phone})`
      );
    } catch (err: any) {
      console.warn('CRM note save:', err?.message || err);
    }
    setBannerMsg(`Saved CRM notes, tags, and privacy status for ${selectedCustomer.name}.`);
    setTimeout(() => setBannerMsg(null), 3500);
  };

  const handleExportCustomersCsv = () => {
    if (!hasPermission('export_csv')) return;
    requestStepUpVerification('Export Customer Directory CSV (Contains PII)', () => {
      const headers = [
        'Customer ID',
        'Name',
        'Phone',
        'Total Orders',
        'Verified Spent (INR)',
        'Custom Cake Bookings',
        'Segment',
        'Tags',
      ];
      const rows = allCustomers.map((c) => {
        const crmDoc = customerCrmNotes.find((n) => n.id === c.customerId);
        const segment =
          c.totalOrders >= 3 ? 'Frequent VIP' : c.totalOrders === 2 ? 'Repeat' : 'New';
        return [
          c.customerId,
          `"${c.name.replace(/"/g, '""')}"`,
          c.phone,
          c.totalOrders,
          c.verifiedSpent,
          c.customCakeCount,
          segment,
          `"${parseTags(crmDoc?.tagsSummary).join('; ')}"`,
        ].join(',');
      });
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loveys-customers-crm-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      recordAuditLog(
        'customers',
        'CUSTOMER_CSV_EXPORTED',
        'all_customers',
        `Exported ${allCustomers.length} customer profiles to CSV`
      );
    });
  };

  // ============================================================================
  // MODE 1: CUSTOMER RELATIONSHIP MANAGEMENT (/admin/customers)
  // ============================================================================
  if (mode === 'customers') {
    const filteredCustomers = allCustomers.filter((c) => {
      const crmDoc = customerCrmNotes.find((n) => n.id === c.customerId);
      if (crmSegment === 'repeat' && c.totalOrders < 2) return false;
      if (crmSegment === 'new' && c.totalOrders > 1) return false;
      if (crmSegment === 'high_value' && c.verifiedSpent < 1500 && c.totalOrders < 3) return false;
      if (
        crmSegment === 'privacy_requests' &&
        (!crmDoc || !crmDoc.privacyRequestStatus || crmDoc.privacyRequestStatus === 'none')
      ) {
        return false;
      }

      if (crmSearch.trim()) {
        const q = crmSearch.toLowerCase();
        const tagMatch = parseTags(crmDoc?.tagsSummary).some((t) =>
          t.toLowerCase().includes(q)
        );
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.lastOrderNumber.toLowerCase().includes(q) ||
          tagMatch
        );
      }
      return true;
    });

    const repeatCount = allCustomers.filter((c) => c.totalOrders >= 2).length;
    const newCount = allCustomers.filter((c) => c.totalOrders === 1).length;

    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-1 rounded-lg bg-[#3B2824] text-[#E5B867] text-[10px] font-bold uppercase tracking-wider">
              Customer Relationship Management (CRM)
            </span>
            <h2 className="font-serif text-2xl font-bold mt-1">
              Customer Profiles, Order History, Tags &amp; Privacy Requests
            </h2>
            <p className="text-xs text-[#6B544E]">
              Track repeat vs. new customers, custom cake inquiries, saved addresses, communication preferences, and data privacy requests.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCustomersCsv}
            className="px-4 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] hover:bg-[#F5EBE1] text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CRM Directory CSV
          </button>
        </div>

        {bannerMsg && (
          <div className="p-3.5 rounded-2xl bg-[#E8F5E9] text-[#2D6A4F] text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{bannerMsg}</span>
          </div>
        )}

        {/* CRM Summary KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E6D7C8] rounded-2xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-[#6B544E] font-semibold">
              Total Unique Customers
            </p>
            <p className="font-serif text-2xl font-bold font-mono-num mt-1">
              {allCustomers.length}
            </p>
          </div>
          <div className="bg-white border border-[#E6D7C8] rounded-2xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-[#2D6A4F] font-semibold">
              Repeat Customers (2+ Orders)
            </p>
            <p className="font-serif text-2xl font-bold font-mono-num text-[#2D6A4F] mt-1">
              {repeatCount}
            </p>
          </div>
          <div className="bg-white border border-[#E6D7C8] rounded-2xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-[#3B2824] font-semibold">
              First-Time Customers
            </p>
            <p className="font-serif text-2xl font-bold font-mono-num mt-1">{newCount}</p>
          </div>
          <div className="bg-white border border-[#E6D7C8] rounded-2xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-[#B94E62] font-semibold">
              Tagged CRM Profiles
            </p>
            <p className="font-serif text-2xl font-bold font-mono-num text-[#B94E62] mt-1">
              {customerCrmNotes.length}
            </p>
          </div>
        </div>

        {/* Search & Segmentation Filters */}
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-[#6B544E] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={crmSearch}
                onChange={(e) => setCrmSearch(e.target.value)}
                placeholder="Search customer name, phone number, order ID, or CRM tag..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: 'All Customers' },
                  { id: 'repeat', label: 'Repeat Guests' },
                  { id: 'new', label: 'New Guests' },
                  { id: 'high_value', label: 'High-Value (₹1,500+)' },
                  { id: 'privacy_requests', label: 'Privacy / Data Requests' },
                ] as const
              ).map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setCrmSegment(seg.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                    crmSegment === seg.id
                      ? 'bg-[#3B2824] text-[#FFF8F1]'
                      : 'bg-[#F5EBE1] text-[#3B2824]'
                  }`}
                >
                  {seg.label}
                </button>
              ))}
            </div>
          </div>

          {filteredCustomers.length === 0 ? (
            <p className="text-xs text-[#6B544E] py-8 text-center">
              No matching customer profiles found for this filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6D7C8] text-[#6B544E]">
                    <th className="py-2.5 pr-3">Customer</th>
                    <th className="py-2.5 pr-3">Segment &amp; Tags</th>
                    <th className="py-2.5 pr-3">Orders</th>
                    <th className="py-2.5 pr-3">Verified Spend</th>
                    <th className="py-2.5 pr-3">Saved Address</th>
                    <th className="py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6D7C8]">
                  {filteredCustomers.map((c) => {
                    const crmDoc = customerCrmNotes.find((n) => n.id === c.customerId);
                    const rawPhone = (c.whatsapp || c.phone || '').replace(/[^\d]/g, '');
                    const waPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

                    return (
                      <tr key={c.customerId} className="hover:bg-[#FFF8F1]/60">
                        <td className="py-3 pr-3">
                          <p className="font-bold text-[#3B2824]">{c.name}</p>
                          <p className="font-mono-num text-[11px] text-[#6B544E]">{c.phone}</p>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap gap-1">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                c.totalOrders >= 2
                                  ? 'bg-[#E8F5E9] text-[#2D6A4F]'
                                  : 'bg-[#F5EBE1] text-[#3B2824]'
                              }`}
                            >
                              {c.totalOrders >= 2 ? 'REPEAT' : 'NEW'}
                            </span>
                            {parseTags(crmDoc?.tagsSummary).map((t) => (
                              <span
                                key={t}
                                className="px-2 py-0.5 rounded bg-[#3B2824] text-[#E5B867] font-bold text-[10px]"
                              >
                                {t}
                              </span>
                            ))}
                            {crmDoc?.privacyRequestStatus &&
                              crmDoc.privacyRequestStatus !== 'none' && (
                                <span className="px-2 py-0.5 rounded bg-[#FFF5F5] text-[#B94E62] font-bold text-[10px]">
                                  {crmDoc.privacyRequestStatus.toUpperCase()}
                                </span>
                              )}
                          </div>
                        </td>
                        <td className="py-3 pr-3 font-mono-num font-bold">
                          {c.totalOrders}{' '}
                          {c.customCakeCount > 0 ? `(${c.customCakeCount} cake)` : ''}
                        </td>
                        <td className="py-3 pr-3 font-mono-num font-bold text-[#2D6A4F]">
                          ₹{c.verifiedSpent.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 pr-3 text-[11px] text-[#6B544E] max-w-[220px] truncate">
                          {c.addresses[0] || 'Store Pickup / Dine-In'}
                        </td>
                        <td className="py-3 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openCustomerInspector(c)}
                            className="px-2.5 py-1.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] font-semibold flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            CRM Profile
                          </button>
                          {waPhone && (
                            <a
                              href={`https://wa.me/${waPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-xl bg-[#2D6A4F] text-white font-semibold"
                            >
                              WhatsApp
                            </a>
                          )}
                          {c.phone && (
                            <a
                              href={`tel:${c.phone}`}
                              className="px-2.5 py-1.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-semibold"
                            >
                              Call
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Customer CRM Profile Modal */}
        {selectedCustomer && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E6D7C8] rounded-3xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="flex items-start justify-between border-b border-[#E6D7C8] pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#B94E62]">
                    Customer 360° CRM Dossier
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-[#3B2824]">
                    {selectedCustomer.name}
                  </h3>
                  <p className="text-xs font-mono-num text-[#6B544E]">
                    Phone: {selectedCustomer.phone} · Verified Spend: ₹
                    {selectedCustomer.verifiedSpent.toLocaleString('en-IN')} ({selectedCustomer.totalOrders}{' '}
                    orders)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="px-3 py-1.5 rounded-xl border border-[#E6D7C8] text-xs font-semibold"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleSaveCrmNote} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold mb-1">
                    Customer Tags (Comma-Separated: e.g. VIP, Custom Cake Regular, Extra Spicy)
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="VIP, Birthday Club, Truffle Cake Fan"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    Internal Staff &amp; Support Notes
                  </label>
                  <textarea
                    rows={3}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Record flavour preferences, delivery landmark notes, or support follow-ups..."
                    className="w-full p-3 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">
                      Data Privacy / Correction Request Status
                    </label>
                    <select
                      value={privacyStatusInput}
                      onChange={(e) => setPrivacyStatusInput(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-semibold"
                    >
                      <option value="none">No Active Data Request</option>
                      <option value="access_requested">Data Access Copy Requested</option>
                      <option value="correction_requested">Data Correction Requested</option>
                      <option value="deletion_requested">Data Anonymization / Deletion Requested</option>
                      <option value="completed">Privacy Request Completed</option>
                    </select>
                  </div>
                  <div className="space-y-2 pt-2">
                    <label className="flex items-center gap-2 font-bold">
                      <input
                        type="checkbox"
                        checked={allowWhatsappPref}
                        onChange={(e) => setAllowWhatsappPref(e.target.checked)}
                      />
                      Customer Consents to WhatsApp Order Chats
                    </label>
                    <label className="flex items-center gap-2 font-bold">
                      <input
                        type="checkbox"
                        checked={allowPhonePref}
                        onChange={(e) => setAllowPhonePref(e.target.checked)}
                      />
                      Customer Consents to Phone Delivery Calls
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] font-semibold hover:bg-[#B94E62]"
                >
                  Save CRM Profile &amp; Preferences
                </button>
              </form>

              {/* Customer's Order History */}
              <div className="pt-3 border-t border-[#E6D7C8] space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[#6B544E]">
                  Order History ({selectedCustomer.orders.length})
                </p>
                <div className="space-y-2">
                  {selectedCustomer.orders.map((ord) => (
                    <div
                      key={ord.orderNumber}
                      className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] text-xs flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-mono-num font-bold">
                          #{ord.orderNumber} · ₹{ord.totalAmount} ({ord.fulfilmentType.toUpperCase()})
                        </p>
                        <p className="text-[11px] text-[#6B544E]">{ord.itemsSummary}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E6D7C8] font-bold text-[10px] uppercase">
                        {ord.orderStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // MODE 2: BUSINESS ANALYTICS & FINANCIAL RECONCILIATION (/admin/analytics & /admin/reports)
  // ============================================================================
  const nowMs = Date.now();
  const rangedOrders = orders.filter((o) => {
    if (analyticsRange === 'all') return true;
    const ms = new Date(o.createdAt).getTime();
    if (Number.isNaN(ms)) return true;
    const days = (nowMs - ms) / (1000 * 60 * 60 * 24);
    if (analyticsRange === 'today') return days <= 1;
    if (analyticsRange === '7days') return days <= 7;
    if (analyticsRange === '30days') return days <= 30;
    return true;
  });

  // Strict Financial Separation: Never count unverified or cancelled orders as Verified Revenue
  const verifiedOrders = rangedOrders.filter(
    (o) =>
      o.orderStatus !== 'cancelled' &&
      o.orderStatus !== 'awaiting_advance_payment' &&
      o.orderStatus !== 'AWAITING_PAYMENT_VERIFICATION' &&
      o.orderStatus !== 'payment_rejected' &&
      o.orderStatus !== 'resubmission_requested'
  );

  const verifiedOrderRevenue = verifiedOrders.reduce(
    (sum, o) => sum + Number(o.totalAmount || 0),
    0
  );

  const verifiedAdvanceCollected = orderPayments
    .filter((p) => p.paymentStatus === 'VERIFIED')
    .reduce((sum, p) => sum + Number(p.verifiedAdvanceAmount || 0), 0);

  const pendingVerificationAmount = orderPayments
    .filter((p) => p.paymentStatus === 'PAYMENT_SUBMITTED')
    .reduce((sum, p) => sum + Number(p.submittedAmount || 0), 0);

  const outstandingBalancesDue = verifiedOrders.reduce(
    (sum, o) => sum + Number(o.remainingBalanceAmount ?? 0),
    0
  );

  const deliveryCount = rangedOrders.filter((o) => o.fulfilmentType === 'delivery').length;
  const pickupCount = rangedOrders.filter((o) => o.fulfilmentType === 'pickup').length;
  const dineInCount = rangedOrders.filter((o) => o.fulfilmentType === 'dine_in').length;
  const cancelledCount = rangedOrders.filter((o) => o.orderStatus === 'cancelled').length;

  const handleExportFinancialReportCsv = () => {
    const headers = [
      'Order Number',
      'Date',
      'Customer',
      'Fulfilment Type',
      'Order Status',
      'Payment Status',
      'Total Order Amount (INR)',
      'Required Advance (INR)',
      'Verified Advance Collected (INR)',
      'Remaining Balance Due (INR)',
    ];
    const rows = rangedOrders.map((o) => {
      const payDoc = orderPayments.find((p) => p.orderNumber === o.orderNumber);
      return [
        o.orderNumber,
        o.createdAt,
        `"${o.customerName.replace(/"/g, '""')}"`,
        o.fulfilmentType,
        o.orderStatus,
        payDoc?.paymentStatus || o.paymentStatus,
        o.totalAmount,
        payDoc?.requiredAdvanceAmount ?? o.requiredAdvanceAmount ?? 0,
        payDoc?.verifiedAdvanceAmount ?? o.verifiedAdvanceAmount ?? 0,
        payDoc?.remainingBalanceAmount ?? o.remainingBalanceAmount ?? 0,
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loveys-financial-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-lg bg-[#3B2824] text-[#E5B867] text-[10px] font-bold uppercase tracking-wider">
            Real-Time Business Intelligence &amp; Payment Reconciliation
          </span>
          <h2 className="font-serif text-2xl font-bold mt-1">
            Verified Revenue, Advance UPI Ledger &amp; Fulfilment Analytics
          </h2>
          <p className="text-xs text-[#6B544E]">
            All figures are calculated directly from live Firestore documents. Unverified or pending payments are strictly separated from verified revenue.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'today', '7days', '30days'] as const).map((rng) => (
            <button
              key={rng}
              type="button"
              onClick={() => setAnalyticsRange(rng)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                analyticsRange === rng
                  ? 'bg-[#3B2824] text-[#FFF8F1]'
                  : 'bg-[#F5EBE1] text-[#3B2824]'
              }`}
            >
              {rng === 'all'
                ? 'All Time'
                : rng === 'today'
                ? 'Today'
                : rng === '7days'
                ? 'Last 7 Days'
                : 'Last 30 Days'}
            </button>
          ))}
          <button
            type="button"
            onClick={handleExportFinancialReportCsv}
            className="px-3.5 py-1.5 rounded-xl bg-[#2D6A4F] text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export Reconciliation CSV
          </button>
        </div>
      </div>

      {/* Financial Reconciliation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-[#2D6A4F] font-bold">
            Verified Order Value
          </p>
          <p className="font-serif text-3xl font-bold font-mono-num text-[#2D6A4F] mt-1">
            ₹{verifiedOrderRevenue.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-[#6B544E] mt-1">
            From {verifiedOrders.length} confirmed/completed orders
          </p>
        </div>

        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-[#3B2824] font-bold">
            Verified UPI Advance Received
          </p>
          <p className="font-serif text-3xl font-bold font-mono-num text-[#3B2824] mt-1">
            ₹{verifiedAdvanceCollected.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-[#6B544E] mt-1">
            Owner-verified UTR advance payments
          </p>
        </div>

        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-[#B36B00] font-bold">
            Awaiting UPI Verification
          </p>
          <p className="font-serif text-3xl font-bold font-mono-num text-[#B36B00] mt-1">
            ₹{pendingVerificationAmount.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-[#6B544E] mt-1">
            Not counted as revenue until verified
          </p>
        </div>

        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-[#B94E62] font-bold">
            Remaining Balance Collectable
          </p>
          <p className="font-serif text-3xl font-bold font-mono-num text-[#B94E62] mt-1">
            ₹{outstandingBalancesDue.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-[#6B544E] mt-1">
            To collect on delivery or store pickup
          </p>
        </div>
      </div>

      {/* Fulfilment Split & Catalogue Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-3">
          <h3 className="font-serif text-lg font-bold">
            Order Fulfilment Channel Breakdown
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] flex justify-between">
              <span className="font-bold">Home Delivery Orders</span>
              <span className="font-mono-num font-bold">{deliveryCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] flex justify-between">
              <span className="font-bold">Takeaway / Parcel Orders</span>
              <span className="font-mono-num font-bold">{pickupCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] flex justify-between">
              <span className="font-bold">Dine-In Table QR Orders</span>
              <span className="font-mono-num font-bold">{dineInCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#FFF5F5] border border-[#B94E62]/30 flex justify-between text-[#B94E62]">
              <span className="font-bold">Cancelled Orders</span>
              <span className="font-mono-num font-bold">{cancelledCount}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-3">
          <h3 className="font-serif text-lg font-bold">
            Category &amp; Bestseller Performance
          </h3>
          <div className="space-y-2 text-xs">
            {categories.map((cat) => {
              const catProducts = products.filter(
                (p) => p.categoryId === cat.id && !p.isArchived
              );
              const bestsellers = catProducts.filter((p) => p.isBestseller).length;
              return (
                <div
                  key={cat.id}
                  className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold">{cat.name}</p>
                    <p className="text-[11px] text-[#6B544E]">{cat.nameHi}</p>
                  </div>
                  <div className="text-right font-mono-num">
                    <p className="font-bold">{catProducts.length} Active SKUs</p>
                    <p className="text-[11px] text-[#2D6A4F]">{bestsellers} Bestsellers</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
