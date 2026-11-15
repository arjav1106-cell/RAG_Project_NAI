import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  CirclePlus,
  FileCheck2,
  FileText,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  EmptyState,
  FormField,
  LoadingState,
  Modal,
  Notice,
  PageHeading,
  SectionHeading,
} from "../components/ui";
import { api, ApiError, documentUrl } from "../lib/api";
import { formatCurrency, formatDate, titleCase } from "../lib/format";
import type { Payment, Policy, PolicyDocument, Vehicle } from "../lib/types";

type PolicyPayload = Omit<Policy, "id" | "vehicle_id" | "created_at">;
const blankPolicy: PolicyPayload = {
  insurer: "",
  policy_number: "",
  policy_type: "comprehensive",
  own_damage: true,
  third_party: true,
  personal_accident: false,
  start_date: null,
  end_date: null,
  own_damage_start_date: null,
  own_damage_end_date: null,
  third_party_start_date: null,
  third_party_end_date: null,
  premium_amount: null,
  payment_frequency: "annual",
  add_ons: [],
  notes: "",
};

export function PoliciesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [documents, setDocuments] = useState<Record<number, PolicyDocument[]>>(
    {},
  );
  const [payments, setPayments] = useState<Record<number, Payment[]>>({});
  const [loading, setLoading] = useState(true);
  const [activePolicy, setActivePolicy] = useState<{
    vehicleId: number;
    policy?: Policy;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [garage, policyList] = await Promise.all([
        api.vehicles(),
        api.policies(),
      ]);
      const docs = await Promise.all(
        policyList.map(
          async (policy) =>
            [policy.id, await api.documents(policy.id)] as const,
        ),
      );
      const pays = await Promise.all(
        policyList.map(
          async (policy) => [policy.id, await api.payments(policy.id)] as const,
        ),
      );
      setVehicles(garage);
      setPolicies(policyList);
      setDocuments(Object.fromEntries(docs));
      setPayments(Object.fromEntries(pays));
      setError("");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "We couldn't load your policies.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const savePolicy = async (
    vehicleId: number,
    payload: PolicyPayload,
    policy?: Policy,
  ) => {
    try {
      if (policy) await api.updatePolicy(policy.id, payload);
      else await api.createPolicy(vehicleId, payload);
      setActivePolicy(null);
      setNotice(
        policy ? "Policy details updated." : "Policy added to your garage.",
      );
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Policy could not be saved.",
      );
      throw cause;
    }
  };

  const upload = async (policyId: number, file: File) => {
    try {
      const document = await api.uploadDocument(policyId, file);
      setNotice(
        document.status === "indexed"
          ? "Policy uploaded and made searchable."
          : "Policy uploaded. Review extracted details and configure the local model to index it.",
      );
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Document upload failed.",
      );
    }
  };

  const addPayment = async (
    policyId: number,
    payload: {
      paid_on: string;
      amount: number;
      status: Payment["status"];
      reference: string;
    },
  ) => {
    try {
      await api.createPayment(policyId, payload);
      setNotice("Payment recorded.");
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Payment could not be recorded.",
      );
    }
  };

  const removePolicy = async (policy: Policy) => {
    if (
      !window.confirm(
        `Remove the ${policy.insurer || "selected"} policy? Linked documents and claims will be removed too.`,
      )
    )
      return;
    try {
      await api.deletePolicy(policy.id);
      setNotice("Policy removed.");
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Policy could not be removed.",
      );
    }
  };

  const removePayment = async (payment: Payment) => {
    if (
      !window.confirm(
        `Remove the payment record for ${formatCurrency(payment.amount)}?`,
      )
    )
      return;
    try {
      await api.deletePayment(payment.id);
      setNotice("Payment record removed.");
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Payment could not be removed.",
      );
    }
  };

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="POLICY LIBRARY"
        title="Policies & payments"
        description="See the details that matter, keep documents close, and track what you’ve paid."
      />
      {notice && <Notice>{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {loading ? (
        <LoadingState label="Finding your policy records…" />
      ) : vehicles.length === 0 ? (
        <section className="surface-card large-empty">
          <EmptyState
            title="Add a vehicle first"
            text="Policies are linked to a vehicle in your garage, so start there and come back to add its cover."
            action={
              <a className="button button-primary" href="/garage">
                Open my garage <ArrowRight size={15} />
              </a>
            }
          />
        </section>
      ) : (
        <div className="policy-library">
          {vehicles.map((vehicle) => {
            const linked = policies.filter(
              (policy) => policy.vehicle_id === vehicle.id,
            );
            return (
              <section className="vehicle-policy-section" key={vehicle.id}>
                <SectionHeading
                  title={vehicle.label}
                  subtitle={`${vehicle.registration_number || vehicle.vehicle_type} · ${linked.length} ${linked.length === 1 ? "policy" : "policies"}`}
                  action={
                    <button
                      className="button button-secondary button-small"
                      onClick={() => setActivePolicy({ vehicleId: vehicle.id })}
                    >
                      <Plus size={15} /> Add policy
                    </button>
                  }
                />
                {linked.length === 0 ? (
                  <div className="policy-empty-inline">
                    <ShieldCheck size={17} />
                    <span>
                      No policies linked yet. Add one manually or upload a
                      policy PDF.
                    </span>
                    <button
                      className="text-link"
                      onClick={() => setActivePolicy({ vehicleId: vehicle.id })}
                    >
                      Add policy <ArrowRight size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="policy-grid">
                    {linked.map((policy) => (
                      <PolicyCard
                        key={policy.id}
                        policy={policy}
                        docs={documents[policy.id] ?? []}
                        payments={payments[policy.id] ?? []}
                        onEdit={() =>
                          setActivePolicy({ vehicleId: vehicle.id, policy })
                        }
                        onRemove={() => void removePolicy(policy)}
                        onUpload={(file) => void upload(policy.id, file)}
                        onAddPayment={(payload) =>
                          void addPayment(policy.id, payload)
                        }
                        onRemovePayment={(payment) =>
                          void removePayment(payment)
                        }
                        onChanged={refresh}
                        onNotice={setNotice}
                        onError={setError}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      {activePolicy && (
        <PolicyModal
          initial={activePolicy.policy ?? blankPolicy}
          vehicleId={activePolicy.vehicleId}
          policy={activePolicy.policy}
          onClose={() => setActivePolicy(null)}
          onSave={savePolicy}
        />
      )}
    </div>
  );
}

function PolicyCard({
  policy,
  docs,
  payments,
  onEdit,
  onRemove,
  onUpload,
  onAddPayment,
  onRemovePayment,
  onChanged,
  onNotice,
  onError,
}: {
  policy: Policy;
  docs: PolicyDocument[];
  payments: Payment[];
  onEdit: () => void;
  onRemove: () => void;
  onUpload: (file: File) => void;
  onAddPayment: (payload: {
    paid_on: string;
    amount: number;
    status: Payment["status"];
    reference: string;
  }) => void;
  onRemovePayment: (payment: Payment) => void;
  onChanged: () => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const coverLabels = [
    ...(policy.third_party ? ["Third party"] : []),
    ...(policy.own_damage ? ["Own damage"] : []),
    ...(policy.personal_accident ? ["Personal accident"] : []),
  ];
  const latestPayment = payments[0];

  const handleUpload = async (event: FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setUploadBusy(true);
    try {
      await onUpload(file);
    } finally {
      setUploadBusy(false);
      input.value = "";
    }
  };

  return (
    <article className="policy-card">
      <div className="policy-card-heading">
        <div className="insurer-monogram">
          {policy.insurer ? (
            policy.insurer.slice(0, 1).toUpperCase()
          ) : (
            <ShieldCheck size={18} />
          )}
        </div>
        <div className="policy-title">
          <span className="eyebrow">{titleCase(policy.policy_type)} cover</span>
          <h3>{policy.insurer || "Insurer not added"}</h3>
          <span>{policy.policy_number || "Policy number not provided"}</span>
        </div>
        <div className="policy-card-actions">
          <button
            className="icon-button"
            aria-label="Edit policy"
            onClick={onEdit}
          >
            <Pencil size={15} />
          </button>
          <button
            className="icon-button danger-icon"
            aria-label="Remove policy"
            onClick={onRemove}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div className="coverage-chip-row">
        {coverLabels.map((label) => (
          <span className="coverage-chip" key={label}>
            <Check size={12} />
            {label}
          </span>
        ))}
        {policy.add_ons.map((addon) => (
          <span className="addon-chip" key={addon}>
            {addon}
          </span>
        ))}
      </div>
      <div className="policy-stat-grid">
        <div>
          <span>Policy period</span>
          <strong>
            {formatDate(policy.start_date)} — {formatDate(policy.end_date)}
          </strong>
        </div>
        <div>
          <span>Premium</span>
          <strong>
            {formatCurrency(policy.premium_amount)}{" "}
            <small>/ {policy.payment_frequency}</small>
          </strong>
        </div>
        <div>
          <span>Latest payment</span>
          <strong>
            {latestPayment
              ? `${formatCurrency(latestPayment.amount)} · ${formatDate(latestPayment.paid_on)}`
              : "No payments recorded"}
          </strong>
        </div>
      </div>
      {(policy.own_damage_end_date || policy.third_party_end_date) && (
        <div className="period-detail">
          {policy.own_damage && (
            <span>
              Own damage to{" "}
              <b>{formatDate(policy.own_damage_end_date || policy.end_date)}</b>
            </span>
          )}
          {policy.third_party && (
            <span>
              Third party to{" "}
              <b>
                {formatDate(policy.third_party_end_date || policy.end_date)}
              </b>
            </span>
          )}
        </div>
      )}
      <div className="policy-card-divider" />
      <div className="document-section-heading">
        <div>
          <FileText size={15} />
          <strong>Policy documents</strong>
        </div>
        <label
          className={`button button-secondary button-small upload-button ${uploadBusy ? "disabled" : ""}`}
        >
          <UploadCloud size={14} />
          {uploadBusy ? "Uploading…" : "Upload PDF"}
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleUpload}
            disabled={uploadBusy}
          />
        </label>
      </div>
      {docs.length ? (
        <div className="document-list">
          {docs.map((document) => (
            <DocumentRow
              key={document.id}
              document={document}
              policy={policy}
              onChanged={onChanged}
              onNotice={onNotice}
              onError={onError}
            />
          ))}
        </div>
      ) : (
        <p className="document-empty">
          Upload a policy PDF to keep it here and ask questions about its terms.
        </p>
      )}
      <div className="payment-toggle-row">
        <button
          className="text-link"
          onClick={() => setPaymentOpen((open) => !open)}
        >
          <CalendarClock size={14} />{" "}
          {paymentOpen ? "Close payment form" : "Record a premium payment"}
        </button>
        <span>{payments.length} recorded</span>
      </div>
      {payments.length > 0 && (
        <div className="payment-history">
          {payments.map((payment) => (
            <div className="payment-history-row" key={payment.id}>
              <span>{formatDate(payment.paid_on)}</span>
              <strong>{formatCurrency(payment.amount)}</strong>
              <span className={`payment-status payment-${payment.status}`}>
                {titleCase(payment.status)}
              </span>
              {payment.reference && <small>{payment.reference}</small>}
              <button
                className="icon-button danger-icon"
                aria-label="Remove payment record"
                onClick={() => onRemovePayment(payment)}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      {paymentOpen && (
        <PaymentForm
          onCancel={() => setPaymentOpen(false)}
          onSave={(payload) => {
            onAddPayment(payload);
            setPaymentOpen(false);
          }}
        />
      )}
    </article>
  );
}

function DocumentRow({
  document,
  policy,
  onChanged,
  onNotice,
  onError,
}: {
  document: PolicyDocument;
  policy: Policy;
  onChanged: () => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const retryIndex = async () => {
    setBusy(true);
    try {
      const result = await fetch(`/api/documents/${document.id}/index`, {
        method: "POST",
        credentials: "include",
      });
      const body = await result.json();
      if (!result.ok)
        throw new Error(body.detail || "Indexing could not be started.");
      onNotice(
        body.status === "indexed"
          ? "Policy is now searchable."
          : body.extraction_error || "Policy remains ready for review.",
      );
      await onChanged();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Indexing failed.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${document.original_name}?`)) return;
    try {
      await api.deleteDocument(document.id);
      onNotice("Document deleted.");
      await onChanged();
    } catch (cause) {
      onError(
        cause instanceof ApiError
          ? cause.message
          : "Document could not be deleted.",
      );
    }
  };
  const statusLabel =
    document.status === "indexed"
      ? "Searchable"
      : document.status === "extracted"
        ? "Review extracted details"
        : titleCase(document.status);
  return (
    <div className="document-row">
      <div className="file-type-icon">
        <FileText size={15} />
      </div>
      <div className="document-row-copy">
        <a href={documentUrl(document.id)} target="_blank" rel="noreferrer">
          {document.original_name}
        </a>
        <span>{statusLabel}</span>
        {document.extraction_error && (
          <small>{document.extraction_error}</small>
        )}
      </div>
      <div className="document-row-actions">
        <button
          className="text-link compact-link"
          onClick={() => setReviewOpen(true)}
        >
          Review
        </button>
        {document.status !== "indexed" && (
          <button
            className="icon-button"
            aria-label="Retry indexing"
            disabled={busy}
            onClick={() => void retryIndex()}
          >
            <CirclePlus size={15} />
          </button>
        )}
        <button
          className="icon-button danger-icon"
          aria-label="Delete document"
          onClick={() => void remove()}
        >
          <X size={15} />
        </button>
      </div>
      {reviewOpen && (
        <ExtractionReview
          document={document}
          policy={policy}
          onClose={() => setReviewOpen(false)}
          onSaved={async () => {
            setReviewOpen(false);
            onNotice("Extracted details reviewed and applied.");
            await onChanged();
          }}
          onError={onError}
        />
      )}
    </div>
  );
}

function ExtractionReview({
  document,
  policy,
  onClose,
  onSaved,
  onError,
}: {
  document: PolicyDocument;
  policy: Policy;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const fields = document.suggested_fields;
  const [insurer, setInsurer] = useState(
    String(fields.insurer ?? policy.insurer),
  );
  const [policyNumber, setPolicyNumber] = useState(
    String(fields.policy_number ?? policy.policy_number),
  );
  const [startDate, setStartDate] = useState(
    String(fields.start_date ?? policy.start_date ?? ""),
  );
  const [endDate, setEndDate] = useState(
    String(fields.end_date ?? policy.end_date ?? ""),
  );
  const [premium, setPremium] = useState(
    String(fields.premium_amount ?? policy.premium_amount ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.reviewDocument(document.id, {
        insurer,
        policy_number: policyNumber,
        start_date: startDate || null,
        end_date: endDate || null,
        premium_amount: premium ? Number(premium) : null,
      });
      await onSaved();
    } catch (cause) {
      onError(
        cause instanceof ApiError
          ? cause.message
          : "Extracted information could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Review extracted details"
      description="Check the document suggestions and correct anything that isn’t right."
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={submit}>
        <div className="extraction-source">
          <FileCheck2 size={16} />
          <span>
            <strong>{document.original_name}</strong>
            <small>
              {Object.keys(fields).length} details suggested from the PDF
            </small>
          </span>
        </div>
        <FormField label="Insurance company">
          <input
            value={insurer}
            onChange={(event) => setInsurer(event.target.value)}
            maxLength={120}
          />
        </FormField>
        <FormField label="Policy number">
          <input
            value={policyNumber}
            onChange={(event) => setPolicyNumber(event.target.value)}
            maxLength={120}
          />
        </FormField>
        <div className="form-row">
          <FormField label="Policy starts">
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </FormField>
          <FormField label="Policy ends">
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </FormField>
        </div>
        <FormField label="Premium amount (₹)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={premium}
            onChange={(event) => setPremium(event.target.value)}
          />
        </FormField>
        <div className="modal-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={busy}
            type="submit"
          >
            {busy ? "Saving…" : "Save reviewed details"}
            <Check size={15} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PaymentForm({
  onSave,
  onCancel,
}: {
  onSave: (payload: {
    paid_on: string;
    amount: number;
    status: Payment["status"];
    reference: string;
  }) => void;
  onCancel: () => void;
}) {
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      paid_on: paidOn,
      amount: Number(amount),
      status: "paid",
      reference,
    });
  };
  return (
    <form className="payment-form" onSubmit={submit}>
      <label>
        <span>Paid on</span>
        <input
          type="date"
          required
          value={paidOn}
          onChange={(event) => setPaidOn(event.target.value)}
        />
      </label>
      <label>
        <span>Amount (₹)</span>
        <input
          type="number"
          min="1"
          step="0.01"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
        />
      </label>
      <label>
        <span>Reference</span>
        <input
          maxLength={120}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Optional"
        />
      </label>
      <div className="payment-form-actions">
        <button type="button" className="text-link" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button-primary button-small">
          Save payment
        </button>
      </div>
    </form>
  );
}

function PolicyModal({
  initial,
  vehicleId,
  policy,
  onClose,
  onSave,
}: {
  initial: PolicyPayload | Policy;
  vehicleId: number;
  policy?: Policy;
  onClose: () => void;
  onSave: (
    vehicleId: number,
    payload: PolicyPayload,
    policy?: Policy,
  ) => Promise<void>;
}) {
  const [form, setForm] = useState<PolicyPayload>({
    ...blankPolicy,
    ...initial,
  });
  const [addonsText, setAddonsText] = useState(
    (initial.add_ons ?? []).join(", "),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (key: keyof PolicyPayload, value: unknown) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        add_ons: addonsText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        premium_amount: form.premium_amount || null,
      };
      await onSave(vehicleId, payload, policy);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Policy details could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={policy ? "Edit policy details" : "Add an insurance policy"}
      description="Keep coverage periods and payment details as they appear on the issued policy."
      onClose={onClose}
      wide
    >
      <form className="form-stack" onSubmit={submit}>
        <div className="form-row">
          <FormField label="Insurance company">
            <input
              autoFocus
              maxLength={120}
              value={form.insurer}
              onChange={(event) => update("insurer", event.target.value)}
              placeholder="e.g. Sample General Insurance"
            />
          </FormField>
          <FormField label="Policy number">
            <input
              maxLength={120}
              value={form.policy_number}
              onChange={(event) => update("policy_number", event.target.value)}
            />
          </FormField>
        </div>
        <div className="form-row">
          <FormField label="Policy type">
            <select
              value={form.policy_type}
              onChange={(event) => update("policy_type", event.target.value)}
            >
              <option value="comprehensive">Comprehensive</option>
              <option value="third_party">Third-party only</option>
              <option value="own_damage">Own-damage only</option>
              <option value="standalone">Standalone</option>
            </select>
          </FormField>
          <FormField label="Payment schedule">
            <select
              value={form.payment_frequency}
              onChange={(event) =>
                update("payment_frequency", event.target.value)
              }
            >
              <option value="one_time">One-time</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
              <option value="unknown">Not sure</option>
            </select>
          </FormField>
        </div>
        <div className="coverage-toggle-group">
          <label>
            <input
              type="checkbox"
              checked={form.third_party}
              onChange={(event) => update("third_party", event.target.checked)}
            />{" "}
            Third-party liability
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.own_damage}
              onChange={(event) => update("own_damage", event.target.checked)}
            />{" "}
            Own-damage cover
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.personal_accident}
              onChange={(event) =>
                update("personal_accident", event.target.checked)
              }
            />{" "}
            Personal accident
          </label>
        </div>
        <div className="form-row">
          <FormField label="Policy starts">
            <input
              type="date"
              value={form.start_date ?? ""}
              onChange={(event) =>
                update("start_date", event.target.value || null)
              }
            />
          </FormField>
          <FormField label="Policy ends">
            <input
              type="date"
              value={form.end_date ?? ""}
              onChange={(event) =>
                update("end_date", event.target.value || null)
              }
            />
          </FormField>
          <FormField label="Premium (₹)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.premium_amount ?? ""}
              onChange={(event) =>
                update(
                  "premium_amount",
                  event.target.value ? Number(event.target.value) : null,
                )
              }
            />
          </FormField>
        </div>
        <div className="form-row">
          <FormField
            label="Own-damage expiry"
            hint="Use this if dates differ from the overall policy period."
          >
            <input
              type="date"
              value={form.own_damage_end_date ?? ""}
              onChange={(event) =>
                update("own_damage_end_date", event.target.value || null)
              }
            />
          </FormField>
          <FormField
            label="Third-party expiry"
            hint="Use this if dates differ from the overall policy period."
          >
            <input
              type="date"
              value={form.third_party_end_date ?? ""}
              onChange={(event) =>
                update("third_party_end_date", event.target.value || null)
              }
            />
          </FormField>
        </div>
        <FormField label="Add-ons">
          <input
            value={addonsText}
            onChange={(event) => setAddonsText(event.target.value)}
            placeholder="Separate add-ons with commas"
          />
          <small>For example: zero depreciation, roadside assistance</small>
        </FormField>
        <FormField label="Notes">
          <textarea
            rows={3}
            maxLength={5000}
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Optional details to remember"
          />
        </FormField>
        {error && (
          <div role="alert" className="inline-error">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={busy}
          >
            {busy ? "Saving…" : policy ? "Save changes" : "Add policy"}
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
