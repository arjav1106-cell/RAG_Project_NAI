import json

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db import get_db
from app.models import Claim, Policy, PolicyDocument, PremiumPayment, User, Vehicle
from app.schemas import (
    ClaimInput,
    ClaimRead,
    PaymentInput,
    PaymentRead,
    PolicyInput,
    PolicyRead,
    VehicleInput,
    VehicleRead,
)
from app.services.document_ingestion import delete_stored_file

router = APIRouter(tags=["garage"])


def owned_vehicle(db: Session, user_id: int, vehicle_id: int) -> Vehicle:
    vehicle = db.scalar(
        select(Vehicle).where(Vehicle.id == vehicle_id, Vehicle.owner_id == user_id)
    )
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


def owned_policy(db: Session, user_id: int, policy_id: int) -> Policy:
    policy = db.scalar(select(Policy).where(Policy.id == policy_id, Policy.owner_id == user_id))
    if policy is None:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


@router.get("/vehicles", response_model=list[VehicleRead])
def list_vehicles(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return list(
        db.scalars(select(Vehicle).where(Vehicle.owner_id == user.id).order_by(Vehicle.id.desc()))
    )


@router.post("/vehicles", response_model=VehicleRead, status_code=201)
def create_vehicle(
    payload: VehicleInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    vehicle = Vehicle(owner_id=user.id, **payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.patch("/vehicles/{vehicle_id}", response_model=VehicleRead)
def update_vehicle(
    vehicle_id: int,
    payload: VehicleInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    vehicle = owned_vehicle(db, user.id, vehicle_id)
    for key, value in payload.model_dump().items():
        setattr(vehicle, key, value)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/vehicles/{vehicle_id}", status_code=204)
def delete_vehicle(
    vehicle_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    vehicle = owned_vehicle(db, user.id, vehicle_id)
    storage_names = list(
        db.scalars(
            select(PolicyDocument.storage_name).where(
                PolicyDocument.owner_id == user.id,
                PolicyDocument.policy_id.in_(
                    select(Policy.id).where(Policy.vehicle_id == vehicle.id)
                ),
            )
        )
    )
    db.delete(vehicle)
    db.commit()
    for storage_name in storage_names:
        delete_stored_file(storage_name)
    return Response(status_code=204)


@router.get("/policies", response_model=list[PolicyRead])
def list_policies(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    policies = db.scalars(
        select(Policy).where(Policy.owner_id == user.id).order_by(Policy.end_date)
    )
    result = []
    for policy in policies:
        data = {column.key: getattr(policy, column.key) for column in Policy.__table__.columns}
        data["add_ons"] = json.loads(policy.add_ons or "[]")
        result.append(PolicyRead.model_validate(data))
    return result


@router.post("/vehicles/{vehicle_id}/policies", response_model=PolicyRead, status_code=201)
def create_policy(
    vehicle_id: int,
    payload: PolicyInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    owned_vehicle(db, user.id, vehicle_id)
    policy_data = payload.model_dump()
    policy_data["add_ons"] = json.dumps(policy_data["add_ons"])
    policy = Policy(owner_id=user.id, vehicle_id=vehicle_id, **policy_data)
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return PolicyRead.model_validate(
        {
            **payload.model_dump(),
            "id": policy.id,
            "vehicle_id": vehicle_id,
            "created_at": policy.created_at,
        }
    )


@router.patch("/policies/{policy_id}", response_model=PolicyRead)
def update_policy(
    policy_id: int,
    payload: PolicyInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    policy = owned_policy(db, user.id, policy_id)
    for key, value in payload.model_dump().items():
        setattr(policy, key, json.dumps(value) if key == "add_ons" else value)
    db.commit()
    db.refresh(policy)
    response = payload.model_dump()
    response.update(id=policy.id, vehicle_id=policy.vehicle_id, created_at=policy.created_at)
    return PolicyRead.model_validate(response)


@router.delete("/policies/{policy_id}", status_code=204)
def delete_policy(
    policy_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    policy = owned_policy(db, user.id, policy_id)
    storage_names = list(
        db.scalars(
            select(PolicyDocument.storage_name).where(
                PolicyDocument.policy_id == policy.id,
                PolicyDocument.owner_id == user.id,
            )
        )
    )
    db.delete(policy)
    db.commit()
    for storage_name in storage_names:
        delete_stored_file(storage_name)
    return Response(status_code=204)


@router.get("/policies/{policy_id}/claims", response_model=list[ClaimRead])
def list_claims(
    policy_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    owned_policy(db, user.id, policy_id)
    return list(
        db.scalars(
            select(Claim)
            .where(Claim.policy_id == policy_id, Claim.owner_id == user.id)
            .order_by(Claim.incident_date.desc())
        )
    )


@router.post("/policies/{policy_id}/claims", response_model=ClaimRead, status_code=201)
def create_claim(
    policy_id: int,
    payload: ClaimInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    owned_policy(db, user.id, policy_id)
    claim = Claim(owner_id=user.id, policy_id=policy_id, **payload.model_dump())
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return claim


@router.patch("/claims/{claim_id}", response_model=ClaimRead)
def update_claim(
    claim_id: int,
    payload: ClaimInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    claim = db.scalar(select(Claim).where(Claim.id == claim_id, Claim.owner_id == user.id))
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found")
    for key, value in payload.model_dump().items():
        setattr(claim, key, value)
    db.commit()
    db.refresh(claim)
    return claim


@router.get("/policies/{policy_id}/payments", response_model=list[PaymentRead])
def list_payments(
    policy_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    owned_policy(db, user.id, policy_id)
    return list(
        db.scalars(
            select(PremiumPayment)
            .where(PremiumPayment.policy_id == policy_id, PremiumPayment.owner_id == user.id)
            .order_by(PremiumPayment.paid_on.desc())
        )
    )


@router.post("/policies/{policy_id}/payments", response_model=PaymentRead, status_code=201)
def create_payment(
    policy_id: int,
    payload: PaymentInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    owned_policy(db, user.id, policy_id)
    payment = PremiumPayment(owner_id=user.id, policy_id=policy_id, **payload.model_dump())
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.delete("/payments/{payment_id}", status_code=204)
def delete_payment(
    payment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    payment = db.scalar(
        select(PremiumPayment).where(
            PremiumPayment.id == payment_id, PremiumPayment.owner_id == user.id
        )
    )
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(payment)
    db.commit()
    return Response(status_code=204)
