import { useEffect, useState } from "react";
import { ArrowRight, Check, Minus, Scale, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import {
  EmptyState,
  LoadingState,
  Notice,
  PageHeading,
  SectionHeading,
} from "../components/ui";
import { api, ApiError } from "../lib/api";
import { formatDate, titleCase } from "../lib/format";
import type { CoverageComparison } from "../lib/types";

export function ComparePage() {
  const [rows, setRows] = useState<CoverageComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .compareCoverage()
      .then(setRows)
      .catch((cause) =>
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Coverage records could not be loaded.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="SEE THE DIFFERENCES"
        title="Compare cover"
        description="A side-by-side view of the protections and add-ons recorded across your garage."
        actions={
          <Link className="button button-secondary" to="/policies">
            <ShieldCheck size={15} /> Manage policies
          </Link>
        }
      />
      {error && <Notice tone="error">{error}</Notice>}
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <section className="surface-card large-empty">
          <EmptyState
            title="No policies to compare yet"
            text="Add policies from different insurers to see their recorded cover and add-ons side by side."
            action={
              <Link className="button button-primary" to="/policies">
                Add a policy <ArrowRight size={15} />
              </Link>
            }
          />
        </section>
      ) : (
        <>
          <div className="compare-intro">
            <div className="compare-intro-icon">
              <Scale size={20} />
            </div>
            <div>
              <strong>Compare what’s recorded—not a claim decision.</strong>
              <span>
                Use each policy’s issued wording for exact limits, exclusions,
                and conditions.
              </span>
            </div>
            <span className="compare-count">{rows.length} policies</span>
          </div>
          <section className="surface-card comparison-surface">
            <SectionHeading
              title="Coverage at a glance"
              subtitle="The details below come from the records in your garage."
            />
            <div className="table-scroll">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Vehicle & provider</th>
                    <th>Policy type</th>
                    <th>Third party</th>
                    <th>Own damage</th>
                    <th>Personal accident</th>
                    <th>Policy period</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.vehicle_id}-${index}`}>
                      <td>
                        <div className="compare-vehicle">
                          <span className="compare-vehicle-icon">
                            <ShieldCheck size={15} />
                          </span>
                          <span>
                            <strong>{row.vehicle_label}</strong>
                            <small>
                              {row.insurer || "Insurer not entered"}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="type-pill type-comparison">
                          {titleCase(row.policy_type)}
                        </span>
                      </td>
                      <td>
                        <CoverageValue enabled={row.third_party} />
                      </td>
                      <td>
                        <CoverageValue enabled={row.own_damage} />
                      </td>
                      <td>
                        <CoverageValue enabled={row.personal_accident} />
                      </td>
                      <td>
                        <span className="period-value">
                          {formatDate(row.start_date)}
                          <small>to {formatDate(row.end_date)}</small>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="surface-card addons-surface">
            <SectionHeading
              title="Add-ons recorded"
              subtitle="Check your policy documents to confirm exact limits and conditions."
            />
            <div className="addon-comparison-list">
              {rows.map((row, index) => (
                <div
                  className="addon-comparison-row"
                  key={`${row.vehicle_id}-${index}`}
                >
                  <div>
                    <strong>{row.vehicle_label}</strong>
                    <span>{row.insurer || "Insurer not entered"}</span>
                  </div>
                  <div className="addon-tags">
                    {row.add_ons.length ? (
                      row.add_ons.map((addon) => (
                        <span key={addon}>{addon}</span>
                      ))
                    ) : (
                      <span className="muted">No add-ons recorded</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function CoverageValue({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <span className="coverage-yes">
      <Check size={14} /> Recorded
    </span>
  ) : (
    <span className="coverage-no">
      <Minus size={14} /> Not recorded
    </span>
  );
}
