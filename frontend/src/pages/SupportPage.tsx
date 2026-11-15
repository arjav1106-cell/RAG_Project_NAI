import { useEffect, useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  FileQuestion,
  MessageCircleMore,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { LoadingState, Notice, PageHeading } from "../components/ui";
import { api, ApiError } from "../lib/api";
import type { GrievanceGuidance } from "../lib/types";

export function SupportPage() {
  const [guidance, setGuidance] = useState<GrievanceGuidance | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .grievanceGuidance()
      .then(setGuidance)
      .catch((cause) =>
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Guidance could not be loaded.",
        ),
      );
  }, []);

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="HERE WHEN YOU NEED US"
        title="Help & grievances"
        description="Find the next step when an insurance question needs a human response."
      />
      {error && <Notice tone="error">{error}</Notice>}
      <section className="support-hero">
        <div className="support-hero-mark">
          <MessageCircleMore size={22} />
        </div>
        <div>
          <span className="eyebrow light">A HELPFUL PLACE TO START</span>
          <h2>
            Get clarity on your policy.
            <br />
            <em>Take the next step with confidence.</em>
          </h2>
          <p>
            Use your policy assistant to locate relevant clauses, or contact
            your insurer for a formal answer about coverage and claims.
          </p>
          <Link to="/assistant" className="button button-light">
            Ask the policy assistant <ArrowRight size={15} />
          </Link>
        </div>
        <div className="support-hero-decoration" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <div className="support-grid">
        <section className="surface-card grievance-card">
          <div className="support-card-icon">
            <FileQuestion size={18} />
          </div>
          <span className="eyebrow">OFFICIAL GRIEVANCE ROUTE</span>
          <h2>How to raise a concern</h2>
          <p className="support-card-lead">
            Follow the insurer’s grievance process and keep a copy of everything
            you submit.
          </p>
          {!guidance ? (
            <LoadingState label="Loading official guidance…" />
          ) : (
            <div className="grievance-steps">
              {guidance.steps.map((step, index) => (
                <div className="grievance-step" key={step}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{step}</p>
                </div>
              ))}
            </div>
          )}
          {guidance && (
            <>
              <div className="grievance-warning">
                <ShieldAlert size={16} />
                <span>{guidance.safety_note}</span>
              </div>
              <a
                className="button button-primary"
                href={guidance.official_url}
                target="_blank"
                rel="noreferrer"
              >
                Open IRDAI Bima Bharosa <ExternalLink size={14} />
              </a>
              <span className="source-check-date">
                Official FAQ checked {guidance.source_checked}
              </span>
            </>
          )}
        </section>
        <div className="support-side-stack">
          <section className="surface-card contact-card">
            <div className="support-card-icon green">
              <ShieldCheck size={18} />
            </div>
            <span className="eyebrow">FORMAL COVERAGE QUESTIONS</span>
            <h2>Ask your insurer</h2>
            <p>
              Only your insurer can confirm how the complete policy and the
              facts of your situation apply to a claim.
            </p>
            <Link to="/policies" className="text-link">
              Find your insurer and policy number <ArrowRight size={14} />
            </Link>
          </section>
          <section className="support-info-card">
            <div className="support-info-icon">
              <ShieldAlert size={17} />
            </div>
            <div>
              <strong>Keep important records together</strong>
              <p>
                Save your policy, claim reference, photos, receipts, and written
                insurer responses in your claim record.
              </p>
              <Link to="/claims" className="text-link">
                Open claims & documents <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        </div>
      </div>
      <div className="support-disclaimer">
        Vahana provides general, source-backed information. It does not offer
        legal advice, decide claim eligibility, or replace the insurer’s issued
        policy.
      </div>
    </div>
  );
}
