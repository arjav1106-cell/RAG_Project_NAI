import type {
  AssistantResponse,
  Claim,
  CoverageComparison,
  Dashboard,
  GrievanceGuidance,
  Payment,
  Policy,
  PolicyDocument,
  User,
  Vehicle,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(body.detail)
      ? body.detail.map((item: { msg?: string }) => item.msg).join(" ")
      : body.detail;
    throw new ApiError(
      detail || "Something went wrong. Please try again.",
      response.status,
    );
  }
  return body as T;
}

const json = (method: string, payload?: unknown): RequestInit => ({
  method,
  ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
});

export const api = {
  me: () => request<User>("/auth/me"),
  register: (email: string, password: string) =>
    request<User>("/auth/register", json("POST", { email, password })),
  login: (email: string, password: string) =>
    request<User>("/auth/login", json("POST", { email, password })),
  logout: () => request<void>("/auth/logout", json("POST")),
  vehicles: () => request<Vehicle[]>("/vehicles"),
  createVehicle: (payload: Omit<Vehicle, "id" | "created_at">) =>
    request<Vehicle>("/vehicles", json("POST", payload)),
  updateVehicle: (id: number, payload: Omit<Vehicle, "id" | "created_at">) =>
    request<Vehicle>(`/vehicles/${id}`, json("PATCH", payload)),
  deleteVehicle: (id: number) =>
    request<void>(`/vehicles/${id}`, json("DELETE")),
  policies: () => request<Policy[]>("/policies"),
  createPolicy: (vehicleId: number, payload: Partial<Policy>) =>
    request<Policy>(`/vehicles/${vehicleId}/policies`, json("POST", payload)),
  updatePolicy: (id: number, payload: Partial<Policy>) =>
    request<Policy>(`/policies/${id}`, json("PATCH", payload)),
  deletePolicy: (id: number) =>
    request<void>(`/policies/${id}`, json("DELETE")),
  dashboard: () => request<Dashboard>("/dashboard"),
  compareCoverage: () => request<CoverageComparison[]>("/coverage-comparison"),
  claims: (policyId: number) =>
    request<Claim[]>(`/policies/${policyId}/claims`),
  createClaim: (policyId: number, payload: Partial<Claim>) =>
    request<Claim>(`/policies/${policyId}/claims`, json("POST", payload)),
  updateClaim: (claimId: number, payload: Partial<Claim>) =>
    request<Claim>(`/claims/${claimId}`, json("PATCH", payload)),
  payments: (policyId: number) =>
    request<Payment[]>(`/policies/${policyId}/payments`),
  createPayment: (policyId: number, payload: Partial<Payment>) =>
    request<Payment>(`/policies/${policyId}/payments`, json("POST", payload)),
  deletePayment: (paymentId: number) =>
    request<void>(`/payments/${paymentId}`, json("DELETE")),
  documents: (policyId: number) =>
    request<PolicyDocument[]>(`/policies/${policyId}/documents`),
  uploadDocument: (policyId: number, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<PolicyDocument>(`/policies/${policyId}/documents`, {
      method: "POST",
      body,
    });
  },
  uploadClaimDocument: (claimId: number, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<PolicyDocument>(`/claims/${claimId}/documents`, {
      method: "POST",
      body,
    });
  },
  reviewDocument: (documentId: number, fields: Record<string, unknown>) =>
    request<PolicyDocument>(
      `/documents/${documentId}/review`,
      json("POST", fields),
    ),
  deleteDocument: (documentId: number) =>
    request<void>(`/documents/${documentId}`, json("DELETE")),
  ask: (question: string, vehicleId?: number, policyId?: number) =>
    request<AssistantResponse>(
      "/assistant/ask",
      json("POST", { question, vehicle_id: vehicleId, policy_id: policyId }),
    ),
  grievanceGuidance: () => request<GrievanceGuidance>("/grievance-guidance"),
};

export function documentUrl(documentId: number) {
  return `/api/documents/${documentId}/download`;
}
