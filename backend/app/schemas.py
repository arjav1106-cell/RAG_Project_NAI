from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class UserRead(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class VehicleInput(BaseModel):
    vehicle_type: Literal["car", "bike", "scooter"]
    label: str = Field(min_length=1, max_length=80)
    registration_number: str = Field(default="", max_length=32)
    make: str = Field(default="", max_length=80)
    model: str = Field(default="", max_length=80)
    year: int | None = Field(default=None, ge=1950, le=2100)

    @field_validator("registration_number")
    @classmethod
    def uppercase_registration(cls, value: str) -> str:
        return value.strip().upper()


class VehicleRead(VehicleInput):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PolicyInput(BaseModel):
    insurer: str = Field(default="", max_length=120)
    policy_number: str = Field(default="", max_length=120)
    policy_type: Literal["third_party", "own_damage", "comprehensive", "standalone"] = (
        "comprehensive"
    )
    own_damage: bool = True
    third_party: bool = True
    personal_accident: bool = False
    start_date: date | None = None
    end_date: date | None = None
    own_damage_start_date: date | None = None
    own_damage_end_date: date | None = None
    third_party_start_date: date | None = None
    third_party_end_date: date | None = None
    premium_amount: float | None = Field(default=None, ge=0)
    payment_frequency: Literal["one_time", "monthly", "quarterly", "annual", "unknown"] = "annual"
    add_ons: list[str] = Field(default_factory=list, max_length=30)
    notes: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def dates_not_reversed(self):
        pairs = [
            (self.start_date, self.end_date),
            (self.own_damage_start_date, self.own_damage_end_date),
            (self.third_party_start_date, self.third_party_end_date),
        ]
        if any(start and end and end < start for start, end in pairs):
            raise ValueError("Policy coverage end dates must be on or after their start dates")
        return self


class PolicyRead(PolicyInput):
    id: int
    vehicle_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ClaimInput(BaseModel):
    incident_date: date | None = None
    description: str = Field(min_length=3, max_length=5000)
    status: Literal["reported", "in_review", "approved", "rejected", "settled"] = "reported"
    claim_amount: float | None = Field(default=None, ge=0)
    notes: str = Field(default="", max_length=5000)


class ClaimRead(ClaimInput):
    id: int
    policy_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PaymentInput(BaseModel):
    paid_on: date
    amount: float = Field(gt=0)
    status: Literal["paid", "pending", "failed"] = "paid"
    reference: str = Field(default="", max_length=120)
    notes: str = Field(default="", max_length=2000)


class PaymentRead(PaymentInput):
    id: int
    policy_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DashboardReminder(BaseModel):
    kind: Literal["renewal", "expired", "coverage_gap"]
    severity: Literal["info", "warning", "urgent"]
    vehicle_id: int
    vehicle_label: str
    policy_id: int | None = None
    message: str
    due_date: date | None = None


class DashboardRead(BaseModel):
    vehicle_count: int
    active_policy_count: int
    open_claim_count: int
    reminders: list[DashboardReminder]
    vehicles: list[VehicleRead]


class CoverageComparison(BaseModel):
    vehicle_id: int
    vehicle_label: str
    insurer: str
    policy_type: str
    own_damage: bool
    third_party: bool
    personal_accident: bool
    add_ons: list[str]
    start_date: date | None
    end_date: date | None


class PolicyReview(BaseModel):
    insurer: str | None = Field(default=None, max_length=120)
    policy_number: str | None = Field(default=None, max_length=120)
    start_date: date | None = None
    end_date: date | None = None
    premium_amount: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def dates_not_reversed(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("Policy end date must be on or after its start date")
        return self


class DocumentRead(BaseModel):
    id: int
    policy_id: int
    claim_id: int | None
    original_name: str
    status: str
    extraction_error: str
    suggested_fields: dict
    created_at: datetime


class AssistantRequest(BaseModel):
    question: str = Field(min_length=3, max_length=4000)
    vehicle_id: int | None = None
    policy_id: int | None = None


class Citation(BaseModel):
    citation_id: str
    title: str
    publisher: str = ""
    url: str | None = None
    document_id: int | None = None
    location: str
    excerpt: str


class AssistantResponse(BaseModel):
    answer: str
    citations: list[Citation]
    insufficient_evidence: bool = False
    disclaimer: str
