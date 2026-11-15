from io import BytesIO

import pymupdf
from PIL import Image

from app.services.document_ingestion import extract_pdf


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
