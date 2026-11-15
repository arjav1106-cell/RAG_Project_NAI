export type User = { id: number; email: string; created_at: string };

export type Vehicle = {
  id: number;
  vehicle_type: "car" | "bike" | "scooter";
  label: string;
  registration_number: string;
  make: string;
  model: string;
  year: number | null;
  created_at: string;
};

export type Policy = {
  id: number;
  vehicle_id: number;
  insurer: string;
  policy_number: string;
  policy_type: "third_party" | "own_damage" | "comprehensive" | "standalone";
  own_damage: boolean;
  third_party: boolean;
  personal_accident: boolean;
  start_date: string | null;
  end_date: string | null;
  own_damage_start_date: string | null;
  own_damage_end_date: string | null;
  third_party_start_date: string | null;
  third_party_end_date: string | null;
  premium_amount: number | null;
  payment_frequency: string;
  add_ons: string[];
  notes: string;
  created_at: string;
};

export type Claim = {
  id: number;
  policy_id: number;
  incident_date: string | null;
  description: string;
  status: "reported" | "in_review" | "approved" | "rejected" | "settled";
  claim_amount: number | null;
  notes: string;
  created_at: string;
};

export type Payment = {
  id: number;
  policy_id: number;
  paid_on: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  reference: string;
  notes: string;
  created_at: string;
};

export type PolicyDocument = {
  id: number;
  policy_id: number;
  claim_id: number | null;
  original_name: string;
  status: "uploaded" | "extracted" | "indexed" | "error";
  extraction_error: string;
  suggested_fields: Record<string, string | number>;
  created_at: string;
};

export type Reminder = {
  kind: "renewal" | "expired" | "coverage_gap";
  severity: "info" | "warning" | "urgent";
  vehicle_id: number;
  vehicle_label: string;
  policy_id: number | null;
  message: string;
  due_date: string | null;
};

export type Dashboard = {
  vehicle_count: number;
  active_policy_count: number;
  open_claim_count: number;
  reminders: Reminder[];
  vehicles: Vehicle[];
};

export type Citation = {
  citation_id: string;
  title: string;
  publisher: string;
  url: string | null;
  document_id: number | null;
  location: string;
  excerpt: string;
};

export type AssistantResponse = {
  answer: string;
  citations: Citation[];
  insufficient_evidence: boolean;
  disclaimer: string;
};

export type CoverageComparison = {
  vehicle_id: number;
  vehicle_label: string;
  insurer: string;
  policy_type: string;
  own_damage: boolean;
  third_party: boolean;
  personal_accident: boolean;
  add_ons: string[];
  start_date: string | null;
  end_date: string | null;
};

export type GrievanceGuidance = {
  steps: string[];
  official_url: string;
  safety_note: string;
  source_checked: string;
};
