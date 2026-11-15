import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CarFront,
  FileCheck2,
  MessageCircleMore,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  PageHeading,
  SectionHeading,
  LoadingState,
  EmptyState,
} from "../components/ui";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import type { Dashboard, Policy } from "../lib/types";

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.dashboard(), api.policies()])
      .then(([dashboard, policyList]) => {
        setData(dashboard);
        setPolicies(policyList);
      })
      .catch((cause) =>
        setError(cause.message || "Your dashboard could not be loaded."),
      );
  }, []);

  if (error)
    return (
      <div className="page-stack">
        <PageHeading
          eyebrow="YOUR GARAGE AT A GLANCE"
          title="Welcome to Vahana"
        />
        <div className="notice notice-error">{error}</div>
      </div>
    );
  if (!data) return <LoadingState />;

  const upcoming = data.reminders.filter(
    (item) => item.kind === "renewal" || item.kind === "expired",
  );
  const totalPremium = policies.reduce(
    (total, policy) => total + (policy.premium_amount ?? 0),
    0,
  );
  const primary = data.vehicles[0];

  return (
    <div className="page-stack dashboard-page">
      <PageHeading
        eyebrow="YOUR GARAGE AT A GLANCE"
        title="Welcome to Vahana"
        description="A calmer view of every vehicle, policy, and date that matters."
        actions={
          <Link className="button button-primary" to="/garage">
            <CarFront size={16} /> Manage garage <ArrowRight size={15} />
          </Link>
        }
      />
      <section className="hero-banner">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span className="hero-kicker-dot" /> YOUR PROTECTION, IN ONE PLACE
          </span>
          <h2>
            Know what you own.
            <br />
            <em>Know what’s covered.</em>
          </h2>
          <p>
            Keep every policy close, understand the fine print, and get ahead of
            renewal dates.
          </p>
          <div className="hero-actions">
            <Link to="/policies" className="button button-light">
              Explore your policies <ArrowRight size={15} />
            </Link>
            <Link to="/assistant" className="hero-text-link">
              Ask your policy assistant <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-sun" />
          <div className="hero-car">
            <CarFront size={62} strokeWidth={1.2} />
          </div>
          <div className="hero-road" />
          <div className="hero-mini-card">
            <span className="mini-card-icon">
              <ShieldCheck size={15} />
            </span>
            <span>
              <strong>All in one place</strong>
              <small>Your garage, your way</small>
            </span>
            <span className="mini-card-spark">✦</span>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          label="Vehicles in garage"
          value={data.vehicle_count}
          detail={
            data.vehicle_count
              ? "Across your personal garage"
              : "Add your first vehicle"
          }
          icon={<CarFront size={18} />}
          tone="blue"
          trend={data.vehicle_count ? "Your garage" : "Getting started"}
        />
        <MetricCard
          label="Active policies"
          value={data.active_policy_count}
          detail={
            data.active_policy_count
              ? "Across all your vehicles"
              : "Add policy details"
          }
          icon={<ShieldCheck size={18} />}
          tone="green"
          trend={
            data.active_policy_count ? "Cover tracked" : "No active cover yet"
          }
        />
        <MetricCard
          label="Needs your attention"
          value={upcoming.length + data.open_claim_count}
          detail={`${upcoming.length} renewal · ${data.open_claim_count} open claim${data.open_claim_count === 1 ? "" : "s"}`}
          icon={<TriangleAlert size={18} />}
          tone="amber"
          trend={upcoming.length ? "Review soon" : "You’re all caught up"}
        />
        <MetricCard
          label="Premium amounts tracked"
          value={formatCurrency(totalPremium)}
          detail="Recorded amounts; schedules may differ"
          icon={<FileCheck2 size={18} />}
          tone="lilac"
          trend={
            policies.length
              ? `${policies.length} policy record${policies.length === 1 ? "" : "s"}`
              : "No policy records yet"
          }
        />
      </section>

      <div className="dashboard-columns">
        <section className="surface-card renewal-panel">
          <SectionHeading
            title="Coming up"
            subtitle="Renewal dates and coverage notes"
            action={
              <Link to="/policies" className="text-link">
                See all <ArrowRight size={14} />
              </Link>
            }
          />
          {data.reminders.length === 0 ? (
            <EmptyState
              title="No dates to chase"
              text="When you add a policy, we’ll keep renewal dates and coverage periods in view."
              action={
                <Link
                  to="/policies"
                  className="button button-secondary button-small"
                >
                  Add a policy
                </Link>
              }
            />
          ) : (
            <div className="reminder-list">
              {data.reminders.slice(0, 5).map((reminder, index) => (
                <div
                  className="reminder-row"
                  key={`${reminder.kind}-${reminder.policy_id}-${index}`}
                >
                  <div
                    className={`reminder-icon reminder-${reminder.severity}`}
                  >
                    {reminder.kind === "coverage_gap" ? (
                      <ShieldAlert size={17} />
                    ) : (
                      <TriangleAlert size={17} />
                    )}
                  </div>
                  <div className="reminder-copy">
                    <strong>{reminder.vehicle_label}</strong>
                    <span>{reminder.message}</span>
                  </div>
                  <div className="reminder-date">
                    {reminder.due_date
                      ? formatDate(reminder.due_date)
                      : "Review"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="surface-card garage-panel">
          <SectionHeading
            title="Your garage"
            subtitle="Vehicles and their cover"
            action={
              <Link to="/garage" className="icon-link" aria-label="Open garage">
                <ArrowRight size={17} />
              </Link>
            }
          />
          {data.vehicles.length === 0 ? (
            <EmptyState
              title="Your garage starts here"
              text="Add a car, bike, or scooter to bring its insurance into your workspace."
              action={
                <Link
                  to="/garage"
                  className="button button-secondary button-small"
                >
                  Add a vehicle
                </Link>
              }
            />
          ) : (
            <div className="garage-mini-list">
              {data.vehicles.slice(0, 4).map((vehicle) => {
                const vehiclePolicies = policies.filter(
                  (policy) => policy.vehicle_id === vehicle.id,
                );
                const nextPolicy = vehiclePolicies.sort((a, b) =>
                  (a.end_date ?? "9999").localeCompare(b.end_date ?? "9999"),
                )[0];
                return (
                  <Link
                    className="garage-mini-row"
                    to="/policies"
                    key={vehicle.id}
                  >
                    <div
                      className={`vehicle-avatar vehicle-${vehicle.vehicle_type}`}
                    >
                      <CarFront size={19} />
                    </div>
                    <div className="garage-mini-info">
                      <strong>{vehicle.label}</strong>
                      <span>
                        {vehicle.registration_number ||
                          [vehicle.make, vehicle.model]
                            .filter(Boolean)
                            .join(" ") ||
                          vehicle.vehicle_type}
                      </span>
                    </div>
                    <div className="garage-mini-policy">
                      {nextPolicy ? (
                        <>
                          <strong>
                            {nextPolicy.insurer || "Policy added"}
                          </strong>
                          <span>Until {formatDate(nextPolicy.end_date)}</span>
                        </>
                      ) : (
                        <span className="muted">No policy linked</span>
                      )}
                    </div>
                    <ArrowRight size={15} className="row-arrow" />
                  </Link>
                );
              })}
            </div>
          )}
          {primary && (
            <Link className="garage-footer-link" to="/assistant">
              <MessageCircleMore size={15} /> Ask about {primary.label}
              <ArrowRight size={14} />
            </Link>
          )}
        </section>
      </div>

      <section className="tip-banner">
        <div className="tip-icon">
          <ShieldCheck size={18} />
        </div>
        <div>
          <strong>Policy answers come with their sources.</strong>
          <span>
            Your assistant points back to the clauses and official guidance
            behind its explanation.
          </span>
        </div>
        <Link to="/assistant" className="text-link">
          Ask a question <ArrowRight size={14} />
        </Link>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone,
  trend,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
  tone: string;
  trend: string;
}) {
  const positive = trend.includes("tracked") || trend.includes("garage");
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon metric-${tone}`}>{icon}</span>
      </div>
      <strong
        className={`metric-value ${typeof value === "string" ? "metric-currency" : ""}`}
      >
        {value}
      </strong>
      <div className="metric-bottom">
        <span>{detail}</span>
        <span className={`metric-trend ${positive ? "trend-positive" : ""}`}>
          {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {trend}
        </span>
      </div>
    </article>
  );
}
