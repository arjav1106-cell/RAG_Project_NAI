from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db import get_db
from app.models import User
from app.schemas import AssistantRequest, AssistantResponse
from app.services.ollama import OllamaUnavailable
from app.services.rag import answer_question

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/ask", response_model=AssistantResponse)
async def ask(
    payload: AssistantRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.vehicle_id is not None and payload.policy_id is not None:
        from sqlalchemy import select

        from app.models import Policy

        policy = db.scalar(
            select(Policy).where(Policy.id == payload.policy_id, Policy.owner_id == user.id)
        )
        if policy is None or policy.vehicle_id != payload.vehicle_id:
            raise HTTPException(
                status_code=404, detail="The selected policy does not belong to this vehicle"
            )
    try:
        return await answer_question(
            db,
            user,
            payload.question.strip(),
            vehicle_id=payload.vehicle_id,
            policy_id=payload.policy_id,
        )
    except OllamaUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
