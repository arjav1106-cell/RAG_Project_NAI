import re
import uuid
from datetime import datetime
from pathlib import Path

import pymupdf
import pytesseract
from PIL import Image

from app.core.config import get_settings
from app.models import KnowledgeChunk, PolicyDocument
from app.services.ollama import OllamaClient, OllamaUnavailable


class DocumentProcessingError(ValueError):
    pass


def extract_pdf(path: Path, tesseract_cmd: str | None = None) -> list[dict[str, str | int]]:
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
    try:
        pdf = pymupdf.open(path)
    except (pymupdf.FileDataError, RuntimeError) as exc:
        raise DocumentProcessingError("This file is not a readable PDF.") from exc
    if not pdf.page_count:
        raise DocumentProcessingError("The PDF has no pages.")
    pages: list[dict[str, str | int]] = []
    for number, page in enumerate(pdf, start=1):
        text = page.get_text("text").strip()
        if len(text) < 40:
            try:
                pixmap = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
                image = Image.frombytes("RGB", [pixmap.width, pixmap.height], pixmap.samples)
                text = pytesseract.image_to_string(image, lang="eng").strip()
            except (pytesseract.TesseractNotFoundError, pytesseract.TesseractError) as exc:
                raise DocumentProcessingError(
                    "This PDF appears scanned. Install Tesseract OCR to read scanned pages."
                ) from exc
        pages.append({"page_number": number, "text": text})
    if not any(str(page["text"]).strip() for page in pages):
        raise DocumentProcessingError(
            "No readable text was found. Check the scan quality and try again."
        )
    return pages


def suggest_policy_fields(text: str) -> dict:
    patterns = {
        "policy_number": r"(?:policy\s*(?:no\.?|number|#))\s*[:\-]?\s*([A-Z0-9\-/]{5,})",
        "insurer": r"(?:insurer|insurance company)\s*[:\-]\s*([^\n]{2,100})",
        "premium_amount": r"(?:total premium|premium amount|gross premium)\s*[:₹\s]*(?:Rs\.?|INR)?\s*([0-9,]+(?:\.\d{1,2})?)",
        "start_date": r"(?:policy start|period of insurance\s+from|from)\s*[:\-]?\s*((?:\d{4}[/-]\d{1,2}[/-]\d{1,2})|(?:\d{1,2}[/-]\d{1,2}[/-]\d{4})|(?:\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}))",
        "end_date": r"(?:policy end|to)\s*[:\-]?\s*((?:\d{4}[/-]\d{1,2}[/-]\d{1,2})|(?:\d{1,2}[/-]\d{1,2}[/-]\d{4})|(?:\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}))",
    }
    suggestions = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            value = match.group(1).strip(" .,:;\n")
            if key == "premium_amount":
                value = float(value.replace(",", ""))
            elif key in {"start_date", "end_date"}:
                parsed = None
                for date_format in (
                    "%Y-%m-%d",
                    "%Y/%m/%d",
                    "%d/%m/%Y",
                    "%d-%m-%Y",
                    "%d %b %Y",
                    "%d %B %Y",
                ):
                    try:
                        parsed = datetime.strptime(value, date_format).date()
                        break
                    except ValueError:
                        continue
                if parsed:
                    value = parsed.isoformat()
            suggestions[key] = value
    return suggestions


def make_chunks(
    page_texts: list[dict[str, str | int]], size: int = 1000, overlap: int = 120
) -> list[dict]:
    """Split policy pages on headings and paragraph boundaries, with a bounded fallback."""
    chunks: list[dict] = []
    for page in page_texts:
        section = ""
        paragraph_lines: list[str] = []
        groups: list[tuple[str, str]] = []

        def flush_paragraph(section_value: str, lines=paragraph_lines, target=groups) -> None:
            paragraph = " ".join(line.strip() for line in lines).strip()
            if paragraph:
                target.append((section_value, paragraph))
            lines.clear()

        for raw_line in str(page["text"]).splitlines():
            line = raw_line.strip()
            if not line:
                flush_paragraph(section)
                continue
            is_heading = bool(
                re.match(r"^(?:section|clause)\s+[\w.-]+\b", line, re.IGNORECASE)
                or re.match(r"^\d+(?:\.\d+)*[.)]?\s+\S", line)
                or (
                    len(line) <= 120
                    and sum(char.isalpha() for char in line) >= 4
                    and sum(char.islower() for char in line) <= 2
                )
            )
            if is_heading:
                flush_paragraph(section)
                section = line[:255]
                groups.append((section, line))
            else:
                paragraph_lines.append(line)
        flush_paragraph(section)

        current_section = ""
        current_parts: list[str] = []

        def emit(
            section_value: str, page_number=int(page["page_number"]), parts=current_parts
        ) -> None:
            content = "\n\n".join(parts).strip()
            if len(content) >= 50:
                chunks.append(
                    {
                        "page_number": page_number,
                        "section": section_value[:255],
                        "content": content,
                    }
                )
            parts.clear()

        for group_section, paragraph in groups:
            if len(paragraph) > size:
                emit(current_section)
                start = 0
                while start < len(paragraph):
                    end = min(start + size, len(paragraph))
                    if end < len(paragraph):
                        boundary = max(
                            paragraph.rfind(". ", start, end), paragraph.rfind(" ", start, end)
                        )
                        if boundary > start + size // 2:
                            end = boundary + (1 if paragraph[boundary] == "." else 0)
                    piece = paragraph[start:end].strip()
                    if len(piece) >= 50:
                        chunks.append(
                            {
                                "page_number": int(page["page_number"]),
                                "section": group_section[:255],
                                "content": piece,
                            }
                        )
                    if end >= len(paragraph):
                        break
                    start = max(start + 1, end - overlap)
                continue
            proposed = "\n\n".join([*current_parts, paragraph])
            if current_parts and (group_section != current_section or len(proposed) > size):
                emit(current_section)
            if not current_parts:
                current_section = group_section
            current_parts.append(paragraph)
        emit(current_section)
    return chunks


async def index_document(
    document: PolicyDocument, page_texts: list[dict], db, client: OllamaClient
) -> str:
    chunks = make_chunks(page_texts)
    if not chunks:
        raise DocumentProcessingError("No sufficiently long text sections were found to index.")
    embedded = []
    try:
        for chunk in chunks:
            chunk["embedding"] = await client.embed(chunk["content"])
            embedded.append(chunk)
    except OllamaUnavailable:
        document.status = "extracted"
        document.extraction_error = "Text extracted. Start Ollama to make this policy searchable."
        db.commit()
        return document.status
    db.query(KnowledgeChunk).filter(KnowledgeChunk.document_id == document.id).delete()
    db.add_all(
        [
            KnowledgeChunk(
                owner_id=document.owner_id,
                document_id=document.id,
                page_number=chunk["page_number"],
                section=chunk["section"],
                content=chunk["content"],
                embedding=chunk["embedding"],
            )
            for chunk in embedded
        ]
    )
    document.status = "indexed"
    document.extraction_error = ""
    db.commit()
    return document.status


def save_upload(filename: str, content: bytes) -> tuple[str, Path]:
    settings = get_settings()
    storage_name = f"{uuid.uuid4().hex}.pdf"
    path = settings.data_dir / storage_name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return storage_name, path


def delete_stored_file(storage_name: str) -> None:
    path = get_settings().data_dir / Path(storage_name).name
    if path.exists():
        path.unlink()
