from io import BytesIO

import pymupdf
from PIL import Image

from app.services.document_ingestion import extract_pdf, make_chunks


def test_policy_chunking_keeps_headings_paragraphs_and_page_metadata():
    chunks = make_chunks(
        [
            {
                "page_number": 4,
                "text": (
                    "4. OWN DAMAGE COVER\n"
                    "The insurer covers accidental loss or damage to the insured vehicle, subject to terms.\n\n"
                    "5. EXCLUSIONS\n"
                    "Normal wear and tear and mechanical breakdown are excluded from this sample cover."
                ),
            }
        ],
        size=300,
    )

    assert len(chunks) == 2
    assert chunks[0]["page_number"] == 4
    assert chunks[0]["section"] == "4. OWN DAMAGE COVER"
    assert "accidental loss or damage" in chunks[0]["content"]
    assert chunks[1]["section"] == "5. EXCLUSIONS"
    assert "Normal wear and tear" in chunks[1]["content"]


def test_policy_chunking_caps_long_paragraphs_without_losing_page_number():
    chunks = make_chunks(
        [{"page_number": 2, "text": "Policy wording continues here. " * 100}], size=300
    )

    assert len(chunks) > 1
    assert all(len(chunk["content"]) <= 300 for chunk in chunks)
    assert all(chunk["page_number"] == 2 for chunk in chunks)


def test_scanned_pdf_uses_ocr_for_pages_without_extractable_text(tmp_path, monkeypatch):
    image_buffer = BytesIO()
    Image.new("RGB", (300, 180), "white").save(image_buffer, format="PNG")
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_image(pymupdf.Rect(0, 0, 300, 180), stream=image_buffer.getvalue())
    pdf_path = tmp_path / "scanned-policy.pdf"
    pdf.save(pdf_path)
    pdf.close()
    calls = []

    def fake_ocr(image, lang):
        calls.append((image.size, lang))
        return "Scanned policy wording recognized by OCR."

    monkeypatch.setattr("app.services.document_ingestion.pytesseract.image_to_string", fake_ocr)

    pages = extract_pdf(pdf_path)

    assert pages == [{"page_number": 1, "text": "Scanned policy wording recognized by OCR."}]
    assert calls == [((1190, 1684), "eng")]
