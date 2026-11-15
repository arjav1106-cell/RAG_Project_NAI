import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  FilePlus2,
  FileText,
  Plus,
  ShieldAlert,
  UploadCloud,
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
import type { Claim, Policy, PolicyDocument, Vehicle } from "../lib/types";

type ClaimView = Claim & {
  vehicleLabel: string;
  insurer: string;
  policyNumber: string;
  documents: PolicyDocument[];
};

export function ClaimsPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [policyList, garage] = await Promise.all([
        api.policies(),
        api.vehicles(),
      ]);
      const grouped = await Promise.all(
        policyList.map(async (policy) => {
          const [policyClaims, documents] = await Promise.all([
            api.claims(policy.id),
            api.documents(policy.id),
          ]);
          const vehicle = garage.find((item) => item.id === policy.vehicle_id);
          return policyClaims.map((claim) => ({
            ...claim,
            vehicleLabel: vehicle?.label ?? "Vehicle",
            insurer: policy.insurer,
            policyNumber: policy.policy_number,
            documents: documents.filter(
              (document) => document.claim_id === claim.id,
            ),
          }));
        }),
      );
      setPolicies(policyList);
      setVehicles(garage);
      setClaims(
        grouped
          .flat()
          .sort((a, b) =>
            (b.incident_date ?? "").localeCompare(a.incident_date ?? ""),
          ),
      );
      setError("");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Claims could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const create = async (
    policyId: number,
    payload: {
      incident_date: string | null;
      description: string;
      claim_amount: number | null;
      notes: string;
    },
  ) => {
    try {
      await api.createClaim(policyId, payload);
      setModalOpen(false);
      setNotice("Claim added to your history.");
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Claim could not be recorded.",
      );
      throw cause;
    }
  };

  const updateStatus = async (claim: ClaimView, status: Claim["status"]) => {
    try {
      await api.updateClaim(claim.id, {
        incident_date: claim.incident_date,
        description: claim.description,
        status,
        claim_amount: claim.claim_amount,
        notes: claim.notes,
      });
      setNotice("Claim status updated.");
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Claim status could not be updated.",
      );
    }
  };

  const attachFile = async (claimId: number, file: File) => {
    try {
      await api.uploadClaimDocument(claimId, file);
      setNotice("Claim document uploaded.");
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Claim document could not be uploaded.",
      );
    }
  };

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="CLAIM HISTORY"
        title="Claims & documents"
        description="Keep claim notes and supporting documents beside the policy they relate to."
        actions={
          <button
            className="button button-primary"
            disabled={!policies.length}
            onClick={() => setModalOpen(true)}
          >
            <Plus size={16} /> Record a claim
          </button>
        }
      />
      {notice && <Notice>{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="claim-guidance-banner">
        <div className="claim-guidance-icon">
          <ShieldAlert size={18} />
        </div>
        <div>
          <strong>Before you file</strong>
          <span>
            Check your policy conditions and notify your insurer promptly. The
            assistant can help prepare a checklist from your policy.
          </span>
        </div>
        <a className="text-link" href="/assistant">
          Open policy assistant <ArrowRight size={14} />
        </a>
      </div>
      {loading ? (
        <LoadingState label="Loading claim history…" />
      ) : !claims.length ? (
        <section className="surface-card large-empty">
          <EmptyState
            title="No claims in your history"
            text="Add a past or current claim to keep its status and paperwork organized by vehicle and policy."
            action={
              <button
                className="button button-primary"
                disabled={!policies.length}
                onClick={() => setModalOpen(true)}
              >
                <Plus size={15} /> Record a claim
              </button>
            }
          />
        </section>
      ) : (
        <section className="surface-card claims-surface">
          <SectionHeading
            title="Your claim timeline"
            subtitle={`${claims.length} recorded ${claims.length === 1 ? "claim" : "claims"}`}
          />
          <div className="claim-list">
            {claims.map((claim) => (
              <article className="claim-item" key={claim.id}>
                <div className="claim-rail">
                  <div className="claim-marker">
                    <ClipboardCheck size={16} />
                  </div>
                  <span />
                </div>
                <div className="claim-main">
                  <div className="claim-topline">
                    <div>
                      <span className={`status-pill status-${claim.status}`}>
                        {titleCase(claim.status)}
                      </span>
                      <span className="claim-date">
                        <CalendarDays size={13} />
                        {formatDate(claim.incident_date)}
                      </span>
                    </div>
                    <strong>{formatCurrency(claim.claim_amount)}</strong>
                  </div>
                  <h3>{claim.description}</h3>
                  <p>
                    {claim.vehicleLabel} ·{" "}
                    {claim.insurer || "Insurer not entered"} ·{" "}
                    {claim.policyNumber || "Policy number not added"}
                  </p>
                  {claim.notes && (
                    <div className="claim-notes">{claim.notes}</div>
                  )}
                  <div className="claim-tools">
                    <label className="claim-status-select">
                      <span>Update status</span>
                      <select
                        value={claim.status}
                        onChange={(event) =>
                          void updateStatus(
                            claim,
                            event.target.value as Claim["status"],
                          )
                        }
                      >
                        <option value="reported">Reported</option>
                        <option value="in_review">In review</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="settled">Settled</option>
                      </select>
                    </label>
                    <label className="button button-secondary button-small upload-button">
                      <UploadCloud size={14} /> Attach document
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void attachFile(claim.id, file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {claim.documents.length > 0 && (
                    <div className="claim-document-list">
                      {claim.documents.map((document) => (
                        <a
                          key={document.id}
                          href={documentUrl(document.id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText size={14} />
                          {document.original_name}
                          <span>{titleCase(document.status)}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {modalOpen && (
        <ClaimModal
          policies={policies}
          vehicles={vehicles}
          onClose={() => setModalOpen(false)}
          onSave={create}
        />
      )}
    </div>
  );
}

function ClaimModal({
  policies,
  vehicles,
  onClose,
  onSave,
}: {
  policies: Policy[];
  vehicles: Vehicle[];
  onClose: () => void;
  onSave: (
    policyId: number,
    payload: {
      incident_date: string | null;
      description: string;
      claim_amount: number | null;
      notes: string;
    },
  ) => Promise<void>;
}) {
  const [policyId, setPolicyId] = useState(policies[0]?.id ?? 0);
  const [incidentDate, setIncidentDate] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(policyId, {
        incident_date: incidentDate || null,
        description,
        claim_amount: amount ? Number(amount) : null,
        notes,
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Claim could not be recorded.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Record a claim"
      description="Keep a note of what happened and attach supporting documents afterwards."
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={submit}>
        <FormField label="Policy">
          <select
            value={policyId}
            onChange={(event) => setPolicyId(Number(event.target.value))}
            required
          >
            {policies.map((policy) => {
              const vehicle = vehicles.find(
                (item) => item.id === policy.vehicle_id,
              );
              return (
                <option value={policy.id} key={policy.id}>
                  {vehicle?.label ?? "Vehicle"} · {policy.insurer || "Insurer"}{" "}
                  · {policy.policy_number || "Policy"}
                </option>
              );
            })}
          </select>
        </FormField>
        <FormField label="Incident date">
          <input
            type="date"
            value={incidentDate}
            onChange={(event) => setIncidentDate(event.target.value)}
          />
        </FormField>
        <FormField label="What happened?">
          <textarea
            rows={4}
            minLength={3}
            maxLength={5000}
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add a brief description of the incident"
          />
        </FormField>
        <FormField label="Claim amount (₹), if known">
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </FormField>
        <FormField label="Notes">
          <textarea
            rows={2}
            maxLength={5000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Claim reference, next step, or other reminder"
          />
        </FormField>
        {error && (
          <div className="inline-error" role="alert">
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
            {busy ? "Saving…" : "Save claim"}
            <FilePlus2 size={15} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
