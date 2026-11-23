import React, { useState, useEffect } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadString,
  getDownloadURL,
} from 'firebase/storage';
import {
  db,
  storage,
  OperationType,
  handleFirestoreError,
} from '../lib/firebase';
import {
  PaymentSettings,
  OrderPaymentRecord,
  PaymentSubmissionRecord,
  PaymentVerificationHistoryRecord,
  BusinessSettings,
} from '../data/initialCatalogue';
import {
  CheckCircle2,
  Copy,
  Check,
  Upload,
  AlertTriangle,
  Clock,
  MessageCircle,
  Phone,
  ShieldCheck,
  XCircle,
  RefreshCw,
  FileText,
  CreditCard,
} from 'lucide-react';

interface AdvancePaymentViewProps {
  orderNumber: string;
  orderSummary: any;
  fullOrder?: any | null;
  paymentSettings: PaymentSettings;
  businessSettings: BusinessSettings;
  currentUserUid: string;
  onOrderUpdated?: () => void;
}

export const AdvancePaymentView: React.FC<AdvancePaymentViewProps> = ({
  orderNumber,
  orderSummary,
  fullOrder,
  paymentSettings,
  businessSettings,
  currentUserUid,
  onOrderUpdated,
}) => {
  const [orderPayment, setOrderPayment] = useState<OrderPaymentRecord | null>(null);
  const [submissions, setSubmissions] = useState<PaymentSubmissionRecord[]>([]);
  const [historyLogs, setHistoryLogs] = useState<PaymentVerificationHistoryRecord[]>([]);
  const [loadingPaymentData, setLoadingPaymentData] = useState(true);

  // Active customer path: 'none' | 'already_paid' | 'not_paid_yet'
  const [activeActionPath, setActiveActionPath] = useState<'none' | 'already_paid' | 'not_paid_yet'>('none');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Payment submission form state
  const [utrInput, setUtrInput] = useState('');
  const [amountPaidInput, setAmountPaidInput] = useState<number>(0);
  const [paymentDateTimeInput, setPaymentDateTimeInput] = useState<string>(() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  });
  const [customerNoteInput, setCustomerNoteInput] = useState('');
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState<string>('');
  const [screenshotMimeType, setScreenshotMimeType] = useState<string>('');
  const [screenshotSizeBytes, setScreenshotSizeBytes] = useState<number>(0);
  const [screenshotRawPrefix, setScreenshotRawPrefix] = useState<string>('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [justSubmittedSuccess, setJustSubmittedSuccess] = useState(false);

  const loadOrderPaymentRecords = async () => {
    if (!orderNumber) return;
    setLoadingPaymentData(true);
    try {
      const paySnap = await getDoc(doc(db, 'order_payments', orderNumber));
      if (paySnap.exists()) {
        const payData = paySnap.data() as OrderPaymentRecord;
        setOrderPayment(payData);
        setAmountPaidInput(payData.requiredAdvanceAmount || orderSummary?.requiredAdvanceAmount || 0);
      } else if (orderSummary) {
        setAmountPaidInput(orderSummary.requiredAdvanceAmount || 0);
      }

      // Load previous submissions for this orderNumber
      const subQuery = query(
        collection(db, 'payment_submissions'),
        where('orderNumber', '==', orderNumber)
      );
      const subSnap = await getDocs(subQuery);
      const subList = subSnap.docs.map((d) => d.data() as PaymentSubmissionRecord);
      subList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSubmissions(subList);

      // Load audit trail history for this orderNumber
      const histQuery = query(
        collection(db, 'payment_verification_history'),
        where('orderNumber', '==', orderNumber)
      );
      const histSnap = await getDocs(histQuery);
      const histList = histSnap.docs.map((d) => d.data() as PaymentVerificationHistoryRecord);
      histList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHistoryLogs(histList);
    } catch (err) {
      console.warn('Error loading order payment record:', err);
    } finally {
      setLoadingPaymentData(false);
    }
  };

  useEffect(() => {
    loadOrderPaymentRecords();
  }, [orderNumber, orderSummary?.paymentStatus, orderSummary?.orderStatus]);

  const totalOrderAmount = Number(
    orderPayment?.totalOrderAmount ?? orderSummary?.totalAmount ?? fullOrder?.totalAmount ?? 0
  );
  const requiredAdvanceAmount = Number(
    orderPayment?.requiredAdvanceAmount ??
      orderSummary?.requiredAdvanceAmount ??
      fullOrder?.requiredAdvanceAmount ??
      0
  );
  const verifiedAdvanceAmount = Number(
    orderPayment?.verifiedAdvanceAmount ??
      orderSummary?.verifiedAdvanceAmount ??
      fullOrder?.verifiedAdvanceAmount ??
      0
  );
  const submittedAmount = Number(
    orderPayment?.submittedAmount ??
      orderSummary?.submittedAdvanceAmount ??
      fullOrder?.submittedAdvanceAmount ??
      0
  );
  const remainingBalanceAmount =
    verifiedAdvanceAmount > 0
      ? Math.max(0, totalOrderAmount - verifiedAdvanceAmount)
      : Math.max(0, totalOrderAmount - requiredAdvanceAmount);

  const fulfilmentType: 'delivery' | 'pickup' | 'dine_in' =
    orderPayment?.fulfilmentType || orderSummary?.fulfilmentType || fullOrder?.fulfilmentType || 'delivery';

  const fulfilmentDisplayLabel =
    fulfilmentType === 'delivery'
      ? 'Home Delivery'
      : fulfilmentType === 'pickup'
      ? 'Takeaway / Parcel'
      : 'Dine-In Table';

  const currentPaymentStatus =
    orderPayment?.paymentStatus ||
    (orderSummary?.paymentStatus === 'PAYMENT_SUBMITTED'
      ? 'PAYMENT_SUBMITTED'
      : orderSummary?.paymentStatus === 'VERIFIED' || orderSummary?.paymentStatus === 'advance_verified'
      ? 'VERIFIED'
      : orderSummary?.paymentStatus === 'REJECTED'
      ? 'REJECTED'
      : orderSummary?.paymentStatus === 'RESUBMISSION_REQUESTED'
      ? 'RESUBMISSION_REQUESTED'
      : orderSummary?.paymentStatus === 'CONTACT_PENDING'
      ? 'CONTACT_PENDING'
      : 'AWAITING_PAYMENT');

  const isAdvanceRequired =
    Boolean(orderPayment?.advanceRequired) ||
    Boolean(orderSummary?.advanceRequired) ||
    Boolean(fullOrder?.advanceRequired) ||
    requiredAdvanceAmount > 0;

  if (!isAdvanceRequired && fulfilmentType === 'dine_in') {
    return null;
  }

  const handleCopyUpiId = async () => {
    if (!paymentSettings.upiId) return;
    try {
      await navigator.clipboard.writeText(paymentSettings.upiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Validate and process payment screenshot upload (JPG, JPEG, PNG, WebP <= 5 MB)
  const handleScreenshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setFormError('Invalid file format. Only JPG, JPEG, PNG, and WebP payment screenshots are allowed.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError('File is too large. Payment screenshot must be under 5 MB.');
      e.target.value = '';
      return;
    }

    setUploadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setUploadingFile(false);
        setFormError('Could not read image file.');
        return;
      }

      const rawDataUrl = reader.result;
      setScreenshotRawPrefix(rawDataUrl.slice(0, 256));
      setScreenshotMimeType(file.type.toLowerCase());
      setScreenshotSizeBytes(file.size);

      // Resize cleanly on canvas so private Firestore/Storage submission stays fast and reliable
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1000;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.82);

        try {
          const safeFileName = `payment_submissions/${orderNumber}/${Date.now()}-${file.name.replace(
            /[^a-zA-Z0-9._-]/g,
            ''
          )}`;
          const sRef = storageRef(storage, safeFileName);
          await uploadString(sRef, optimizedDataUrl, 'data_url');
          const downloadUrl = await getDownloadURL(sRef);
          setScreenshotPreviewUrl(downloadUrl);
        } catch {
          // Use optimized data URL stored inside restricted payment_submissions collection
          setScreenshotPreviewUrl(optimizedDataUrl);
        } finally {
          setUploadingFile(false);
        }
      };
      img.onerror = () => {
        setUploadingFile(false);
        setFormError('Invalid or corrupted image file. Please select an authentic payment screenshot.');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Submit Payment Proof ("ALREADY PAID" or Resubmission)
  const handleSubmitPaymentProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!screenshotPreviewUrl) {
      setFormError('Please upload your UPI payment screenshot before submitting.');
      return;
    }

    const cleanUtr = utrInput.trim();
    if (!cleanUtr || cleanUtr.length < 6) {
      setFormError('Please enter a valid UPI Reference Number / UTR (minimum 6 characters, typically 12 digits).');
      return;
    }

    setSubmittingProof(true);
    try {
      // 1. Validate on Server (/api/payments/validate-submission)
      const valRes = await fetch('/api/payments/validate-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          utrNumber: cleanUtr,
          amountPaid: amountPaidInput,
          requiredAdvanceAmount,
          totalOrderAmount,
          screenshotMimeType: screenshotMimeType || 'image/jpeg',
          screenshotSizeBytes: screenshotSizeBytes || 50000,
          screenshotDataPrefix: screenshotRawPrefix,
        }),
      });

      const valData = await valRes.json();
      if (!valRes.ok || !valData.valid) {
        throw new Error(valData.error || 'Payment submission validation failed.');
      }

      const nowIso = new Date().toISOString();
      const submissionId = `sub-${orderNumber}-${Date.now()}`;
      const historyId = `hist-${orderNumber}-${Date.now()}`;
      const isResubmission =
        currentPaymentStatus === 'REJECTED' ||
        currentPaymentStatus === 'RESUBMISSION_REQUESTED' ||
        submissions.length > 0;

      const customerName =
        orderPayment?.customerName || fullOrder?.customerName || 'Valued Customer';
      const customerPhone =
        orderPayment?.customerPhone || fullOrder?.customerPhone || businessSettings.phone;
      const userId = orderPayment?.userId || orderSummary?.userId || currentUserUid || 'guest';

      const newSubmission: PaymentSubmissionRecord = {
        id: submissionId,
        orderNumber,
        userId,
        customerName,
        customerPhone,
        fulfilmentType,
        totalOrderAmount,
        requiredAdvanceAmount,
        amountPaid: valData.verifiedSubmittedAmount,
        utrNumber: valData.normalizedUtr,
        screenshotUrl: screenshotPreviewUrl,
        screenshotMimeType: screenshotMimeType || 'image/jpeg',
        paymentDateTime: paymentDateTimeInput || nowIso,
        customerNote: customerNoteInput.trim(),
        verificationStatus: 'SUBMITTED',
        createdAt: nowIso,
      };

      const updatedOrderPayment: OrderPaymentRecord = {
        orderNumber,
        userId,
        customerName,
        customerPhone,
        fulfilmentType,
        totalOrderAmount,
        advanceRequired: true,
        requiredAdvanceAmount,
        submittedAmount: valData.verifiedSubmittedAmount,
        verifiedAdvanceAmount: 0,
        remainingBalanceAmount: Math.max(0, totalOrderAmount - requiredAdvanceAmount),
        paymentStatus: 'PAYMENT_SUBMITTED',
        latestSubmissionId: submissionId,
        latestUtrNumber: valData.normalizedUtr,
        latestScreenshotUrl: screenshotPreviewUrl,
        latestSubmittedAt: nowIso,
        rejectionReason: '',
        internalAdminNote: orderPayment?.internalAdminNote || '',
        paymentDeadlineIso: orderPayment?.paymentDeadlineIso || '',
        createdAt: orderPayment?.createdAt || orderSummary?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      const historyEntry: PaymentVerificationHistoryRecord = {
        id: historyId,
        orderNumber,
        submissionId,
        action: isResubmission ? 'PAYMENT_RESUBMITTED' : 'PAYMENT_SUBMITTED',
        actorRole: 'customer',
        actorIdentifier: `${customerName} (${customerPhone})`,
        amount: valData.verifiedSubmittedAmount,
        utrNumber: valData.normalizedUtr,
        note:
          customerNoteInput.trim() ||
          `Customer submitted UPI UTR ${valData.normalizedUtr} for ₹${valData.verifiedSubmittedAmount}. Awaiting manual verification by bakery admin.`,
        createdAt: nowIso,
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'payment_submissions', submissionId), newSubmission);
      batch.set(doc(db, 'order_payments', orderNumber), updatedOrderPayment);
      batch.set(doc(db, 'payment_verification_history', historyId), historyEntry);

      // Update public order_summaries to reflect AWAITING_PAYMENT_VERIFICATION
      if (orderSummary) {
        batch.set(doc(db, 'order_summaries', orderNumber), {
          ...orderSummary,
          orderStatus: 'AWAITING_PAYMENT_VERIFICATION',
          paymentStatus: 'PAYMENT_SUBMITTED',
          advanceRequired: true,
          requiredAdvanceAmount,
          submittedAdvanceAmount: valData.verifiedSubmittedAmount,
          remainingBalanceAmount: Math.max(0, totalOrderAmount - requiredAdvanceAmount),
          latestSubmissionId: submissionId,
          paymentRejectionReason: '',
          updatedAt: nowIso,
        });
      }

      // If fullOrder is loaded and accessible, update it in batch
      if (fullOrder) {
        batch.set(doc(db, 'orders', orderNumber), {
          ...fullOrder,
          orderStatus: 'AWAITING_PAYMENT_VERIFICATION',
          paymentStatus: 'PAYMENT_SUBMITTED',
          advanceRequired: true,
          requiredAdvanceAmount,
          submittedAdvanceAmount: valData.verifiedSubmittedAmount,
          remainingBalanceAmount: Math.max(0, totalOrderAmount - requiredAdvanceAmount),
          latestSubmissionId: submissionId,
          paymentRejectionReason: '',
          updatedAt: nowIso,
        });
      }

      await batch.commit();

      setJustSubmittedSuccess(true);
      setActiveActionPath('none');
      setUtrInput('');
      setCustomerNoteInput('');
      await loadOrderPaymentRecords();
      if (onOrderUpdated) onOrderUpdated();
    } catch (err: any) {
      setFormError(err.message || 'Could not submit payment details. Please check your UTR and screenshot.');
    } finally {
      setSubmittingProof(false);
    }
  };

  // Mark "NOT PAID YET" -> Contact Pending (never confirms order)
  const handleSelectNotPaidYet = async () => {
    setActiveActionPath('not_paid_yet');
    if (currentPaymentStatus === 'AWAITING_PAYMENT' && orderPayment) {
      try {
        const nowIso = new Date().toISOString();
        const histId = `hist-contact-${orderNumber}-${Date.now()}`;
        const batch = writeBatch(db);
        batch.set(doc(db, 'order_payments', orderNumber), {
          ...orderPayment,
          paymentStatus: 'CONTACT_PENDING',
          updatedAt: nowIso,
        });
        batch.set(doc(db, 'payment_verification_history', histId), {
          id: histId,
          orderNumber,
          action: 'CUSTOMER_CONTACT_PENDING',
          actorRole: 'customer',
          actorIdentifier: `${orderPayment.customerName} (${orderPayment.customerPhone})`,
          note: 'Customer selected "NOT PAID YET" to discuss order/payment with Lovey’s Bakery & Pizza Corners via WhatsApp or phone.',
          createdAt: nowIso,
        });
        await batch.commit();
        await loadOrderPaymentRecords();
      } catch {
        // Non-blocking audit update
      }
    }
  };

  // Build exact URL-encoded WhatsApp discussion link for "NOT PAID YET"
  const buildNotPaidWhatsAppUrl = () => {
    const rawWa = (
      paymentSettings.verificationWhatsapp ||
      businessSettings.whatsapp ||
      '918090529971'
    ).replace(/[^\d]/g, '');
    const waTarget = rawWa.length === 10 ? `91${rawWa}` : rawWa;
    const customerName =
      orderPayment?.customerName || fullOrder?.customerName || 'Valued Guest';

    const messageText = [
      `Hello Lovey's Bakery & Pizza Corners,`,
      ``,
      `Name: ${customerName}`,
      `Order ID: ${orderNumber}`,
      `Order Type: ${fulfilmentDisplayLabel}`,
      `Order Amount: ₹${totalOrderAmount}`,
      `Required Advance: ₹${requiredAdvanceAmount}`,
      ``,
      `I have not completed the advance payment yet and would like to discuss/confirm my order. Please guide me regarding payment. Thank you.`,
    ].join('\n');

    return `https://wa.me/${waTarget}?text=${encodeURIComponent(messageText)}`;
  };

  // Determine 5-stage Payment Progress Timeline index
  // 1. Advance Payment Required
  // 2. Payment Submitted
  // 3. Verification in Progress
  // 4. Advance Payment Verified
  // 5. Order Confirmed
  const getTimelineStage = () => {
    if (
      currentPaymentStatus === 'VERIFIED' ||
      orderSummary?.orderStatus === 'confirmed' ||
      orderSummary?.orderStatus === 'preparing' ||
      orderSummary?.orderStatus === 'ready_for_pickup' ||
      orderSummary?.orderStatus === 'out_for_delivery' ||
      orderSummary?.orderStatus === 'delivered'
    ) {
      return 5;
    }
    if (currentPaymentStatus === 'PAYMENT_SUBMITTED') {
      return 3; // Both Stage 2 (Payment Submitted) and Stage 3 (Verification in Progress) active
    }
    return 1; // Advance Payment Required (or Rejected / Resubmission Requested)
  };

  const timelineStage = getTimelineStage();
  const hasValidOwnerQr = Boolean(
    paymentSettings.qrCodeImageUrl && paymentSettings.qrCodeImageUrl.trim().length > 5
  );

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* 1. FIVE-STAGE PAYMENT & ORDER VERIFICATION TIMELINE */}
      {/* ==================================================================== */}
      <div className="bg-white border border-[#E6D7C8] rounded-3xl p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6D7C8] pb-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#B94E62] font-bold">
              Advance Payment &amp; Verification Status
            </p>
            <h3 className="font-serif text-xl font-bold text-[#3B2824]">
              Order #{orderNumber} · {fulfilmentDisplayLabel}
            </h3>
          </div>
          <span
            className={`px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider ${
              currentPaymentStatus === 'VERIFIED'
                ? 'bg-[#E8F5E9] text-[#2D6A4F] border border-[#2D6A4F]/30'
                : currentPaymentStatus === 'PAYMENT_SUBMITTED'
                ? 'bg-amber-50 text-amber-800 border border-amber-300'
                : currentPaymentStatus === 'REJECTED' ||
                  currentPaymentStatus === 'RESUBMISSION_REQUESTED'
                ? 'bg-[#FFF5F5] text-[#B94E62] border border-[#B94E62]'
                : 'bg-[#F5EBE1] text-[#3B2824] border border-[#E6D7C8]'
            }`}
          >
            {currentPaymentStatus === 'VERIFIED'
              ? 'Advance Payment Verified'
              : currentPaymentStatus === 'PAYMENT_SUBMITTED'
              ? 'Submitted · Awaiting Verification'
              : currentPaymentStatus === 'REJECTED'
              ? 'Payment Rejected · Resubmit Proof'
              : currentPaymentStatus === 'RESUBMISSION_REQUESTED'
              ? 'New Screenshot Requested'
              : currentPaymentStatus === 'CONTACT_PENDING'
              ? 'Awaiting Payment / Contact Pending'
              : 'Awaiting Advance Payment'}
          </span>
        </div>

        {/* 5-Stage Progress Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-1">
          {[
            { step: 1, label: 'Advance Payment Required' },
            { step: 2, label: 'Payment Submitted' },
            { step: 3, label: 'Verification in Progress' },
            { step: 4, label: 'Advance Payment Verified' },
            { step: 5, label: 'Order Confirmed' },
          ].map((item) => {
            const isCompleted = timelineStage >= item.step;
            const isCurrent =
              (timelineStage === 1 && item.step === 1) ||
              (timelineStage === 3 && (item.step === 2 || item.step === 3)) ||
              (timelineStage === 5 && item.step >= 4);

            return (
              <div
                key={item.step}
                className={`p-3 rounded-2xl border text-xs flex sm:flex-col items-center sm:items-start gap-2.5 transition-all ${
                  isCompleted
                    ? 'bg-[#3B2824] text-[#FFF8F1] border-[#3B2824]'
                    : isCurrent
                    ? 'bg-[#FFF8F1] text-[#3B2824] border-[#B94E62]'
                    : 'bg-[#FFF8F1]/60 text-[#6B544E] border-[#E6D7C8]'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold font-mono-num shrink-0 ${
                    isCompleted
                      ? 'bg-[#E5B867] text-[#1E1412]'
                      : 'bg-[#E6D7C8] text-[#3B2824]'
                  }`}
                >
                  {isCompleted ? '✓' : item.step}
                </span>
                <span className="font-semibold leading-snug">{item.label}</span>
              </div>
            );
          })}
        </div>

        {/* Financial Breakdown Pill Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8]">
            <span className="text-[11px] text-[#6B544E] block">Total Order Amount</span>
            <span className="font-serif text-xl font-bold font-mono-num text-[#3B2824]">
              ₹{totalOrderAmount}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#FFF8F1] border-2 border-[#B94E62]">
            <span className="text-[11px] text-[#B94E62] font-bold uppercase tracking-wider block">
              {currentPaymentStatus === 'VERIFIED'
                ? 'Verified Advance Paid'
                : 'Required Advance Now'}
            </span>
            <span className="font-serif text-xl font-bold font-mono-num text-[#B94E62]">
              ₹{currentPaymentStatus === 'VERIFIED' ? verifiedAdvanceAmount : requiredAdvanceAmount}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8]">
            <span className="text-[11px] text-[#6B544E] block">
              Remaining Balance ({fulfilmentDisplayLabel})
            </span>
            <span className="font-serif text-xl font-bold font-mono-num text-[#2D6A4F]">
              ₹{remainingBalanceAmount}
            </span>
          </div>
        </div>

        {/* Remaining Balance Policy Explanation */}
        <div className="p-3.5 rounded-2xl bg-[#F5EBE1]/70 border border-[#E6D7C8] text-xs text-[#3B2824] flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
          <div>
            <strong>Remaining Balance Policy (₹{remainingBalanceAmount}):</strong>{' '}
            {paymentSettings.remainingBalancePolicy}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. REJECTION OR RESUBMISSION ALERT BANNER */}
      {/* ==================================================================== */}
      {(currentPaymentStatus === 'REJECTED' ||
        currentPaymentStatus === 'RESUBMISSION_REQUESTED') && (
        <div className="bg-[#FFF5F5] border-2 border-[#B94E62] rounded-3xl p-6 space-y-3">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 text-[#B94E62] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-serif text-xl font-bold text-[#B94E62]">
                {currentPaymentStatus === 'REJECTED'
                  ? 'Advance Payment Verification Rejected'
                  : 'New Payment Screenshot Requested by Bakery'}
              </h4>
              <p className="text-xs text-[#3B2824] leading-relaxed">
                <strong>Reason from Lovey&apos;s Bakery Team:</strong>{' '}
                {orderPayment?.rejectionReason ||
                  orderSummary?.paymentRejectionReason ||
                  'The uploaded UTR or payment screenshot could not be matched with our bank statement. Please upload a clear screenshot showing the 12-digit UPI UTR and amount.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setJustSubmittedSuccess(false);
              setActiveActionPath('already_paid');
            }}
            className="px-5 py-2.5 rounded-xl bg-[#B94E62] hover:bg-[#9E3D50] text-white text-xs font-semibold flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Upload New Payment Screenshot &amp; UTR</span>
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. POST-SUBMISSION CONFIRMATION SCREEN ("Payment details submitted") */}
      {/* ==================================================================== */}
      {(justSubmittedSuccess || currentPaymentStatus === 'PAYMENT_SUBMITTED') &&
        activeActionPath === 'none' && (
          <div className="bg-white border-2 border-[#2D6A4F] rounded-3xl p-6 sm:p-8 space-y-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#E8F5E9] text-[#2D6A4F] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#2D6A4F]">
                  Status: Awaiting Verification
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#3B2824]">
                  Payment details submitted successfully!
                </h3>
                <p className="text-sm text-[#6B544E] leading-relaxed">
                  Our team will verify your payment and confirm your order shortly.
                </p>
              </div>
            </div>

            {orderPayment?.latestUtrNumber && (
              <div className="p-4 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[#6B544E] block">Submitted UPI UTR / Ref</span>
                  <span className="font-mono-num font-bold text-[#3B2824]">
                    {orderPayment.latestUtrNumber}
                  </span>
                </div>
                <div>
                  <span className="text-[#6B544E] block">Submitted Advance Amount</span>
                  <span className="font-mono-num font-bold text-[#2D6A4F]">
                    ₹{submittedAmount || requiredAdvanceAmount}
                  </span>
                </div>
                <div>
                  <span className="text-[#6B544E] block">Order Verification Status</span>
                  <span className="font-bold text-amber-800">
                    AWAITING_PAYMENT_VERIFICATION
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#E6D7C8] text-xs text-[#6B544E]">
              <span>
                Entered an incorrect UTR or wrong screenshot? You can submit an updated proof before verification completes.
              </span>
              <button
                type="button"
                onClick={() => {
                  setJustSubmittedSuccess(false);
                  setActiveActionPath('already_paid');
                }}
                className="px-3.5 py-2 rounded-xl border border-[#3B2824] text-[#3B2824] font-semibold hover:bg-[#F5EBE1]"
              >
                Update Payment Proof
              </button>
            </div>
          </div>
        )}

      {/* ==================================================================== */}
      {/* 4. VERIFIED ADVANCE PAYMENT BANNER */}
      {/* ==================================================================== */}
      {currentPaymentStatus === 'VERIFIED' && (
        <div className="bg-[#E8F5E9] border-2 border-[#2D6A4F] rounded-3xl p-6 sm:p-8 space-y-3">
          <div className="flex items-start gap-3.5">
            <CheckCircle2 className="w-7 h-7 text-[#2D6A4F] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#2D6A4F]">
                Verified by Lovey&apos;s Bakery Team
              </span>
              <h3 className="font-serif text-2xl font-bold text-[#1E3F2B]">
                Advance Payment of ₹{verifiedAdvanceAmount} Verified &amp; Order Confirmed!
              </h3>
              <p className="text-xs text-[#2D6A4F] leading-relaxed">
                Your order is confirmed for preparation. Remaining balance to be paid upon{' '}
                {fulfilmentDisplayLabel.toLowerCase()}: <strong>₹{remainingBalanceAmount}</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. MAIN PAYMENT INSTRUCTIONS SCREEN ("Complete Your Advance Payment") */}
      {/* ==================================================================== */}
      {currentPaymentStatus !== 'VERIFIED' && (
        <div className="bg-white border-2 border-[#3B2824] rounded-3xl overflow-hidden shadow-md">
          {/* Header Banner */}
          <div className="bg-[#3B2824] text-[#FFF8F1] p-6 sm:p-8 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-3 py-1 rounded-lg bg-[#B94E62] text-white text-[11px] font-bold uppercase tracking-widest">
                Manual UPI Advance Payment Required
              </span>
              {orderPayment?.paymentDeadlineIso && (
                <span className="text-xs text-[#E5B867] font-mono-num flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Pay by {new Date(orderPayment.paymentDeadlineIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-[#FFF8F1]">
              Complete Your Advance Payment
            </h2>
            <p className="text-xs sm:text-sm text-[#DECBC0] max-w-2xl leading-relaxed">
              To help us confirm and prepare your order, please pay the required advance using the UPI details below.
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {/* Order & UPI Details Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 7 Cols: Order Breakdown & Copyable UPI ID */}
              <div className="lg:col-span-7 space-y-5">
                <div className="p-5 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8] space-y-3 text-xs">
                  <div className="flex justify-between items-center border-b border-[#E6D7C8] pb-2.5">
                    <span className="text-[#6B544E] font-medium">Business Name</span>
                    <span className="font-serif text-sm font-bold text-[#3B2824]">
                      {businessSettings.businessName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#E6D7C8] pb-2.5">
                    <span className="text-[#6B544E] font-medium">Order Number</span>
                    <span className="font-mono-num font-bold text-sm text-[#3B2824]">
                      {orderNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#E6D7C8] pb-2.5">
                    <span className="text-[#6B544E] font-medium">Order Type</span>
                    <span className="font-bold uppercase text-[#B94E62]">
                      {fulfilmentDisplayLabel}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#E6D7C8] pb-2.5">
                    <span className="text-[#6B544E] font-medium">Total Order Amount</span>
                    <span className="font-mono-num font-bold text-sm">
                      ₹{totalOrderAmount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#E6D7C8] pb-2.5 bg-[#FFF0F3] -mx-2 px-2 py-2 rounded-xl">
                    <span className="text-[#B94E62] font-bold uppercase tracking-wider">
                      Required Advance to Confirm Order
                    </span>
                    <span className="font-serif text-2xl font-bold font-mono-num text-[#B94E62]">
                      ₹{requiredAdvanceAmount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[#6B544E] font-medium">
                      Remaining Balance (Pay on {fulfilmentDisplayLabel})
                    </span>
                    <span className="font-mono-num font-bold text-sm text-[#2D6A4F]">
                      ₹{remainingBalanceAmount}
                    </span>
                  </div>
                </div>

                {/* Official UPI Payee & Copy UPI ID Box */}
                <div className="p-5 rounded-2xl bg-white border-2 border-[#E6D7C8] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#B94E62]">
                      Official Bakery UPI Account
                    </span>
                    <span className="text-[11px] text-[#2D6A4F] font-semibold">
                      GPay · PhonePe · Paytm · BHIM
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-[#6B544E] block">UPI Account / Payee Name</span>
                    <p className="font-serif text-lg font-bold text-[#3B2824]">
                      {paymentSettings.payeeDisplayName || "Lovey's Bakery & Pizza Corners"}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase tracking-wider text-[#6B544E] block">
                        Merchant UPI ID (VPA)
                      </span>
                      <span className="font-mono-num text-base sm:text-lg font-bold text-[#3B2824] select-all break-all">
                        {paymentSettings.upiId || 'loveysbakery@pnb'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyUpiId}
                      className="px-4 py-2 rounded-xl bg-[#3B2824] hover:bg-[#B94E62] text-[#FFF8F1] text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      {copiedUpi ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#E5B867]" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy UPI ID</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Owner Payment Instructions */}
                  <div className="pt-2 space-y-1.5">
                    <p className="text-xs font-bold text-[#3B2824]">Payment Instructions:</p>
                    <p className="text-xs text-[#6B544E] whitespace-pre-line leading-relaxed">
                      {paymentSettings.paymentInstructions}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: Owner-Uploaded Actual Payment QR Code */}
              <div className="lg:col-span-5">
                <div className="p-4 sm:p-6 rounded-3xl bg-[#FFF8F1] border border-[#E6D7C8] text-center space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#3B2824]">
                    Scan Official UPI QR Code
                  </p>

                  {hasValidOwnerQr ? (
                    <div className="bg-white p-3 sm:p-4 rounded-2xl border border-[#E6D7C8] inline-block shadow-xs max-w-full">
                      <img
                        src={paymentSettings.qrCodeImageUrl}
                        alt={`${paymentSettings.payeeDisplayName} Official UPI QR Code`}
                        className="w-48 h-48 sm:w-64 sm:h-64 max-w-full aspect-square object-contain mx-auto"
                      />
                    </div>
                  ) : (
                    <div className="bg-white p-6 rounded-2xl border border-dashed border-[#B94E62] text-center space-y-2.5">
                      <CreditCard className="w-8 h-8 text-[#B94E62] mx-auto" />
                      <p className="text-xs font-bold text-[#3B2824]">
                        Pay Directly via Merchant UPI ID
                      </p>
                      <p className="text-[11px] text-[#6B544E] leading-relaxed">
                        Copy the official UPI ID{' '}
                        <strong className="font-mono-num text-[#3B2824]">
                          {paymentSettings.upiId || 'loveysbakery@pnb'}
                        </strong>{' '}
                        into any UPI app (Google Pay, PhonePe, Paytm, BHIM) to pay{' '}
                        <strong className="font-mono-num text-[#B94E62]">
                          ₹{requiredAdvanceAmount}
                        </strong>
                        , or contact our Renukoot counter on WhatsApp below.
                      </p>
                    </div>
                  )}

                  <div className="text-xs space-y-1">
                    <p className="font-bold text-[#3B2824]">
                      Payee: {paymentSettings.payeeDisplayName}
                    </p>
                    <p className="font-mono-num text-[#B94E62] font-bold text-base">
                      Advance Payable Now: ₹{requiredAdvanceAmount}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* TWO PROMINENT CUSTOMER ACTION PATHS: "ALREADY PAID" vs "NOT PAID YET" */}
            {/* ============================================================== */}
            <div className="pt-4 border-t border-[#E6D7C8] space-y-5">
              <div className="text-center space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-[#B94E62]">
                  Select Your Payment Status Below
                </p>
                <p className="text-xs text-[#6B544E]">
                  Have you completed the ₹{requiredAdvanceAmount} UPI transfer? Choose an option below:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* BUTTON A: ALREADY PAID */}
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setActiveActionPath('already_paid');
                  }}
                  className={`py-4 px-6 rounded-2xl text-sm font-bold flex items-center justify-center gap-2.5 transition-all shadow-sm ${
                    activeActionPath === 'already_paid'
                      ? 'bg-[#2D6A4F] text-white ring-4 ring-[#2D6A4F]/20'
                      : 'bg-[#3B2824] hover:bg-[#2D6A4F] text-[#FFF8F1]'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>ALREADY PAID</span>
                </button>

                {/* BUTTON B: NOT PAID YET */}
                <button
                  type="button"
                  onClick={handleSelectNotPaidYet}
                  className={`py-4 px-6 rounded-2xl text-sm font-bold flex items-center justify-center gap-2.5 transition-all border-2 ${
                    activeActionPath === 'not_paid_yet'
                      ? 'bg-[#FFF5F5] text-[#B94E62] border-[#B94E62] ring-4 ring-[#B94E62]/15'
                      : 'bg-[#FFF8F1] hover:bg-[#F5EBE1] text-[#3B2824] border-[#3B2824]'
                  }`}
                >
                  <MessageCircle className="w-5 h-5 text-[#B94E62]" />
                  <span>NOT PAID YET</span>
                </button>
              </div>

              {/* ============================================================ */}
              {/* FLOW A: "ALREADY PAID" — SCREENSHOT & UTR SUBMISSION FORM */}
              {/* ============================================================ */}
              {activeActionPath === 'already_paid' && (
                <form
                  onSubmit={handleSubmitPaymentProof}
                  className="p-6 sm:p-8 rounded-3xl bg-[#FFF8F1] border-2 border-[#2D6A4F] space-y-5"
                >
                  <div className="border-b border-[#E6D7C8] pb-3">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#2D6A4F]">
                      Step 2 · Submit Payment Proof for Verification
                    </span>
                    <h3 className="font-serif text-2xl font-bold text-[#3B2824] mt-0.5">
                      Upload Your UPI Payment Screenshot &amp; UTR
                    </h3>
                    <p className="text-xs text-[#6B544E]">
                      Both the payment screenshot and the 12-digit UPI Reference / UTR number are mandatory for manual verification.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* 1. Payment Screenshot Upload */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[#3B2824]">
                        1. Upload Payment Screenshot (JPG, PNG, WebP · Max 5 MB) *
                      </label>
                      <div className="p-4 rounded-2xl bg-white border border-dashed border-[#3B2824] space-y-3">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handleScreenshotSelect}
                          className="block w-full text-xs text-[#6B544E] file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#3B2824] file:text-[#FFF8F1] hover:file:bg-[#B94E62]"
                        />
                        {uploadingFile && (
                          <p className="text-xs text-[#B94E62] font-semibold">
                            Validating &amp; preparing screenshot preview...
                          </p>
                        )}
                        {screenshotPreviewUrl && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-bold text-[#2D6A4F] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Screenshot Ready for Verification:
                            </p>
                            <img
                              src={screenshotPreviewUrl}
                              alt="Uploaded UPI Payment Proof Preview"
                              className="max-h-48 rounded-xl border border-[#E6D7C8] object-contain bg-[#FFF8F1] p-1"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. UTR, Amount Paid, Date/Time */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-[#3B2824] mb-1">
                          2. UPI Reference Number / Transaction ID / UTR *
                        </label>
                        <input
                          type="text"
                          required
                          value={utrInput}
                          onChange={(e) => setUtrInput(e.target.value)}
                          placeholder="e.g. 432618904512 (12-digit UPI UTR)"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-white text-xs font-mono-num font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#3B2824] mb-1">
                            3. Amount Paid (₹) *
                          </label>
                          <input
                            type="number"
                            required
                            min={requiredAdvanceAmount}
                            max={totalOrderAmount}
                            value={amountPaidInput}
                            onChange={(e) => setAmountPaidInput(Number(e.target.value))}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-white text-xs font-mono-num font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#3B2824] mb-1">
                            4. Payment Date &amp; Time
                          </label>
                          <input
                            type="datetime-local"
                            value={paymentDateTimeInput}
                            onChange={(e) => setPaymentDateTimeInput(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-[#E6D7C8] bg-white text-xs font-mono-num"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#3B2824] mb-1">
                          5. Additional Payment Note (Optional)
                        </label>
                        <input
                          type="text"
                          value={customerNoteInput}
                          onChange={(e) => setCustomerNoteInput(e.target.value)}
                          placeholder="e.g. Paid from Google Pay / Sender Name..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-white text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {formError && (
                    <div className="p-3.5 rounded-xl bg-[#FFF5F5] border border-[#B94E62] text-xs text-[#B94E62] font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveActionPath('none')}
                      className="px-4 py-2.5 rounded-xl border border-[#E6D7C8] bg-white text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingProof || uploadingFile}
                      className="px-6 py-3 rounded-xl bg-[#2D6A4F] hover:bg-[#23533D] disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm"
                    >
                      <Upload className="w-4 h-4" />
                      <span>
                        {submittingProof
                          ? 'Validating & Submitting Proof...'
                          : 'Submit Payment for Verification'}
                      </span>
                    </button>
                  </div>
                </form>
              )}

              {/* ============================================================ */}
              {/* FLOW B: "NOT PAID YET" — WHATSAPP & CALL BAKERY OPTIONS */}
              {/* ============================================================ */}
              {activeActionPath === 'not_paid_yet' && (
                <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF8F1] border-2 border-[#B94E62] space-y-5">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#B94E62]">
                      Order Status: Awaiting Advance Payment
                    </span>
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#3B2824]">
                      You haven&apos;t completed your advance payment yet. Contact Lovey&apos;s Bakery &amp; Pizza Corners to discuss your order.
                    </h3>
                    <p className="text-xs text-[#6B544E] leading-relaxed">
                      Your order <strong>#{orderNumber}</strong> remains saved in{' '}
                      <strong className="text-[#B94E62]">Awaiting Advance Payment</strong> status and will only be confirmed once our bakery team verifies your payment or confirms your request directly.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <a
                      href={buildNotPaidWhatsAppUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-3.5 px-5 rounded-2xl bg-[#2D6A4F] hover:bg-[#23533D] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Continue on WhatsApp</span>
                    </a>

                    <a
                      href={`tel:${(
                        paymentSettings.verificationPhone ||
                        businessSettings.phone ||
                        '+918090529971'
                      ).replace(/\s+/g, '')}`}
                      className="py-3.5 px-5 rounded-2xl bg-[#3B2824] hover:bg-[#B94E62] text-[#FFF8F1] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors font-mono-num"
                    >
                      <Phone className="w-4 h-4 text-[#E5B867]" />
                      <span>
                        Call the Bakery ({paymentSettings.verificationPhone || businessSettings.phone})
                      </span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. SUBMISSION & VERIFICATION AUDIT TRAIL FOR THIS ORDER */}
      {/* ==================================================================== */}
      {(submissions.length > 0 || historyLogs.length > 0) && (
        <div className="bg-white border border-[#E6D7C8] rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E6D7C8] pb-3">
            <h4 className="font-serif text-lg font-bold text-[#3B2824] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#B94E62]" />
              <span>Payment Verification Audit Log</span>
            </h4>
            <span className="text-[11px] text-[#6B544E] font-mono-num">
              {submissions.length} {submissions.length === 1 ? 'Submission' : 'Submissions'}
            </span>
          </div>

          <div className="space-y-2.5">
            {historyLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] flex flex-wrap items-start justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <span className="font-bold text-[#3B2824]">
                    {log.action.replace(/_/g, ' ')}
                  </span>
                  {log.utrNumber && (
                    <span className="ml-2 px-2 py-0.5 rounded bg-white border border-[#E6D7C8] font-mono-num text-[11px]">
                      UTR: {log.utrNumber}
                    </span>
                  )}
                  <p className="text-[#6B544E]">{log.note}</p>
                </div>
                <span className="text-[11px] font-mono-num text-[#6B544E]">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
