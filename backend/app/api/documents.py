import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.config import get_settings
from app.db import get_db
from app.models import Claim, Policy, PolicyDocument, User
from app.schemas import DocumentRead, PolicyReview
from app.services.document_ingestion import (
    DocumentProcessingError,
    delete_stored_file,
    extract_pdf,
    index_document,
    save_upload,
    suggest_policy_fields,
)
from app.services.ollama import OllamaClient

router = APIRouter(tags=["documents"])


def owned_policy(db: Session, user_id: int, policy_id: int) -> Policy:
    policy = db.scalar(select(Policy).where(Policy.id == policy_id, Policy.owner_id == user_id))
    if policy is None:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


def owned_document(db: Session, user_id: int, document_id: int) -> PolicyDocument:
    document = db.scalar(
        select(PolicyDocument).where(
            PolicyDocument.id == document_id, PolicyDocument.owner_id == user_id
        )
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


def to_read(document: PolicyDocument) -> DocumentRead:
    return DocumentRead(
        id=document.id,
        policy_id=document.policy_id,
        claim_id=document.claim_id,
        original_name=document.original_name,
        status=document.status,
        extraction_error=document.extraction_error,
        suggested_fields=json.loads(document.suggested_fields or "{}"),
        created_at=document.created_at,
    )


async def upload_document(
    policy: Policy,
    user: User,
    upload: UploadFile,
    db: Session,
    claim_id: int | None = None,
) -> DocumentRead:
    settings = get_settings()
    if Path(upload.filename or "").suffix.lower() != ".pdf" or upload.content_type not in {
        "application/pdf",
        "application/octet-stream",
        None,
    }:
        raise HTTPException(status_code=415, detail="Upload a PDF policy document")
    content = await upload.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413, detail=f"PDF files must be {settings.max_upload_mb} MB or smaller"
        )
    if not content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=415, detail="The uploaded file does not contain a valid PDF signature"
        )
    storage_name, path = save_upload(upload.filename or "policy.pdf", content)
    document = PolicyDocument(
        owner_id=user.id,
        policy_id=policy.id,
        claim_id=claim_id,
        original_name=Path(upload.filename or "policy.pdf").name[:255],
        storage_name=storage_name,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    try:
        pages = extract_pdf(path, tesseract_cmd=settings.tesseract_cmd or None)
        document.extracted_text = "\n\n".join(
            f"[Page {page['page_number']}]\n{page['text']}"
            for page in pages
            if str(page["text"]).strip()
        )
        document.suggested_fields = json.dumps(suggest_policy_fields(document.extracted_text))
        document.status = "extracted"
        db.commit()
        await index_document(document, pages, db, OllamaClient())
    except DocumentProcessingError as exc:
        document.status = "error"
        document.extraction_error = str(exc)
        db.commit()
    except Exception:
        db.rollback()
        document = db.get(PolicyDocument, document.id)
        if document:
            document.status = "error"
            document.extraction_error = (
                "Document processing failed. Check server logs and try again."
            )
            db.commit()
    return to_read(document)


@router.post("/policies/{policy_id}/documents", response_model=DocumentRead, status_code=201)
async def upload_policy_document(
    policy_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    policy = owned_policy(db, user.id, policy_id)
    return await upload_document(policy, user, file, db)


@router.post("/claims/{claim_id}/documents", response_model=DocumentRead, status_code=201)
async def upload_claim_document(
    claim_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    claim = db.scalar(select(Claim).where(Claim.id == claim_id, Claim.owner_id == user.id))
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found")
    policy = owned_policy(db, user.id, claim.policy_id)
    return await upload_document(policy, user, file, db, claim_id)


@router.get("/policies/{policy_id}/documents", response_model=list[DocumentRead])
def list_documents(
    policy_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    owned_policy(db, user.id, policy_id)
    documents = db.scalars(
        select(PolicyDocument).where(
            PolicyDocument.policy_id == policy_id, PolicyDocument.owner_id == user.id
        )
    )
    return [to_read(document) for document in documents]


@router.get("/documents/{document_id}", response_model=DocumentRead)
def get_document(
    document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return to_read(owned_document(db, user.id, document_id))


@router.post("/documents/{document_id}/review", response_model=DocumentRead)
def review_document(
    document_id: int,
    payload: PolicyReview,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = owned_document(db, user.id, document_id)
    policy = owned_policy(db, user.id, document.policy_id)
    fields = payload.model_dump(exclude_unset=True)
    for name, value in fields.items():
        if value is not None:
            setattr(policy, name, value)
    db.commit()
    return to_read(document)


@router.post("/documents/{document_id}/index", response_model=DocumentRead)
async def reindex_document(
    document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    document = owned_document(db, user.id, document_id)
    path = get_settings().data_dir / Path(document.storage_name).name
    try:
        pages = extract_pdf(path)
        await index_document(document, pages, db, OllamaClient())
    except DocumentProcessingError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return to_read(document)


@router.get("/documents/{document_id}/download")
def download_document(
    document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    document = owned_document(db, user.id, document_id)
    path = get_settings().data_dir / Path(document.storage_name).name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Stored document file is missing")
    return FileResponse(path, filename=document.original_name, media_type="application/pdf")


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(
    document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    document = owned_document(db, user.id, document_id)
    storage_name = document.storage_name
    db.delete(document)
    db.commit()
    delete_stored_file(storage_name)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
