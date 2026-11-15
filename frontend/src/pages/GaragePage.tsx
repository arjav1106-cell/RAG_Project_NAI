import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Bike,
  CarFront,
  CirclePlus,
  Pencil,
  Trash2,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  EmptyState,
  FormField,
  LoadingState,
  Modal,
  Notice,
  PageHeading,
} from "../components/ui";
import { api, ApiError } from "../lib/api";
import type { Vehicle } from "../lib/types";

type VehicleForm = Omit<Vehicle, "id" | "created_at">;
const emptyVehicle: VehicleForm = {
  vehicle_type: "car",
  label: "",
  registration_number: "",
  make: "",
  model: "",
  year: null,
};

export function GaragePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<
    Awaited<ReturnType<typeof api.policies>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Vehicle | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [garage, policyList] = await Promise.all([
        api.vehicles(),
        api.policies(),
      ]);
      setVehicles(garage);
      setPolicies(policyList);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "We couldn't load your garage.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const saveVehicle = async (payload: VehicleForm) => {
    try {
      if (modal && modal !== "new") await api.updateVehicle(modal.id, payload);
      else await api.createVehicle(payload);
      setModal(null);
      setNotice(
        modal === "new"
          ? "Vehicle added to your garage."
          : "Vehicle details updated.",
      );
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Vehicle could not be saved.",
      );
    }
  };

  const removeVehicle = async (vehicle: Vehicle) => {
    if (!window.confirm(`Remove ${vehicle.label} and its linked policies?`))
      return;
    try {
      await api.deleteVehicle(vehicle.id);
      setNotice(`${vehicle.label} was removed from your garage.`);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Vehicle could not be removed.",
      );
    }
  };

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="YOUR VEHICLES"
        title="My garage"
        description="A home for every car, bike, and scooter you insure."
        actions={
          <button
            className="button button-primary"
            onClick={() => setModal("new")}
          >
            <CirclePlus size={16} /> Add vehicle
          </button>
        }
      />
      {notice && <Notice>{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="garage-summary-strip">
        <span>
          <strong>{vehicles.length}</strong>{" "}
          {vehicles.length === 1 ? "vehicle" : "vehicles"}
        </span>
        <span className="summary-dot" />
        <span>
          <strong>{policies.length}</strong> linked{" "}
          {policies.length === 1 ? "policy" : "policies"}
        </span>
        <span className="summary-helper">
          Your details are private to your account
        </span>
      </div>
      {loading ? (
        <LoadingState label="Loading your vehicles…" />
      ) : vehicles.length === 0 ? (
        <section className="surface-card large-empty">
          <EmptyState
            title="Your garage is ready"
            text="Add your first car, bike, or scooter. You can attach policies from different insurers later."
            action={
              <button
                className="button button-primary"
                onClick={() => setModal("new")}
              >
                <CirclePlus size={16} /> Add a vehicle
              </button>
            }
          />
        </section>
      ) : (
        <div className="vehicle-grid">
          {vehicles.map((vehicle) => {
            const linked = policies.filter(
              (policy) => policy.vehicle_id === vehicle.id,
            );
            const Icon =
              vehicle.vehicle_type === "bike"
                ? Bike
                : vehicle.vehicle_type === "scooter"
                  ? Zap
                  : CarFront;
            return (
              <article className="vehicle-card" key={vehicle.id}>
                <div className="vehicle-card-top">
                  <div
                    className={`vehicle-avatar vehicle-${vehicle.vehicle_type}`}
                  >
                    <Icon size={21} />
                  </div>
                  <span className={`type-pill type-${vehicle.vehicle_type}`}>
                    {vehicle.vehicle_type}
                  </span>
                  <div className="vehicle-actions">
                    <button
                      aria-label={`Edit ${vehicle.label}`}
                      className="icon-button"
                      onClick={() => setModal(vehicle)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      aria-label={`Remove ${vehicle.label}`}
                      className="icon-button danger-icon"
                      onClick={() => void removeVehicle(vehicle)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h2>{vehicle.label}</h2>
                <div className="vehicle-registration">
                  {vehicle.registration_number || "Registration not added"}
                </div>
                <div className="vehicle-specs">
                  {[vehicle.make, vehicle.model, vehicle.year]
                    .filter(Boolean)
                    .join(" · ") || "Add make and model details"}
                </div>
                <div className="vehicle-card-divider" />
                <div className="vehicle-cover-row">
                  <div className="vehicle-cover-icon">
                    <span
                      className={
                        linked.length ? "cover-dot-active" : "cover-dot-idle"
                      }
                    />
                  </div>
                  <div>
                    <strong>
                      {linked.length
                        ? `${linked.length} linked ${linked.length === 1 ? "policy" : "policies"}`
                        : "No policies linked"}
                    </strong>
                    <span>
                      {linked.length
                        ? linked
                            .map(
                              (policy) => policy.insurer || "Insurer not added",
                            )
                            .join(" · ")
                        : "Add policy details to track cover"}
                    </span>
                  </div>
                </div>
                <Link to="/policies" className="vehicle-card-link">
                  Manage insurance <ArrowRight size={15} />
                </Link>
              </article>
            );
          })}
        </div>
      )}

      {modal && (
        <VehicleModal
          initial={modal === "new" ? emptyVehicle : modal}
          title={modal === "new" ? "Add a vehicle" : "Edit vehicle details"}
          onClose={() => setModal(null)}
          onSave={saveVehicle}
        />
      )}
    </div>
  );
}

function VehicleModal({
  initial,
  title,
  onClose,
  onSave,
}: {
  initial: VehicleForm | Vehicle;
  title: string;
  onClose: () => void;
  onSave: (payload: VehicleForm) => Promise<void>;
}) {
  const [form, setForm] = useState<VehicleForm>({
    ...emptyVehicle,
    ...initial,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.label.trim()) {
      setError("Give this vehicle a name so it’s easy to find.");
      return;
    }
    setBusy(true);
    try {
      await onSave({ ...form, year: form.year || null });
    } catch {
      setError("Vehicle could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={title}
      description="Add details to help you recognize this vehicle."
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={submit}>
        <FormField label="Vehicle type">
          <select
            value={form.vehicle_type}
            onChange={(event) =>
              setForm({
                ...form,
                vehicle_type: event.target.value as VehicleForm["vehicle_type"],
              })
            }
          >
            <option value="car">Car</option>
            <option value="bike">Motorcycle</option>
            <option value="scooter">Scooter</option>
          </select>
        </FormField>
        <FormField label="Name in your garage">
          <input
            autoFocus
            maxLength={80}
            placeholder="e.g. Weekend ride"
            value={form.label}
            onChange={(event) =>
              setForm({ ...form, label: event.target.value })
            }
            required
          />
        </FormField>
        <div className="form-row">
          <FormField label="Make">
            <input
              maxLength={80}
              placeholder="e.g. Honda"
              value={form.make}
              onChange={(event) =>
                setForm({ ...form, make: event.target.value })
              }
            />
          </FormField>
          <FormField label="Model">
            <input
              maxLength={80}
              placeholder="e.g. City"
              value={form.model}
              onChange={(event) =>
                setForm({ ...form, model: event.target.value })
              }
            />
          </FormField>
        </div>
        <div className="form-row">
          <FormField label="Registration number">
            <input
              maxLength={32}
              placeholder="e.g. MH 02 AB 1234"
              value={form.registration_number}
              onChange={(event) =>
                setForm({
                  ...form,
                  registration_number: event.target.value.toUpperCase(),
                })
              }
            />
          </FormField>
          <FormField label="Year">
            <input
              type="number"
              min={1950}
              max={2100}
              placeholder="2024"
              value={form.year ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  year: event.target.value ? Number(event.target.value) : null,
                })
              }
            />
          </FormField>
        </div>
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
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
            type="submit"
            disabled={busy}
          >
            {busy ? "Saving…" : "Save vehicle"}
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
