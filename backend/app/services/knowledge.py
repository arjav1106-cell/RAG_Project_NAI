import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import KnowledgeChunk, KnowledgeSource

SOURCE_FILE = Path(__file__).resolve().parents[1] / "knowledge" / "sources.json"


def seed_knowledge(db: Session) -> int:
    sources = json.loads(SOURCE_FILE.read_text(encoding="utf-8"))
    inserted = 0
    for item in sources:
        source = db.scalar(select(KnowledgeSource).where(KnowledgeSource.title == item["title"]))
        if source:
            content_changed = source.content != item["content"]
            source.publisher = item["publisher"]
            source.url = item["url"]
            source.effective_date = item["effective_date"]
            source.content = item["content"]
            chunks = list(
                db.scalars(select(KnowledgeChunk).where(KnowledgeChunk.source_id == source.id))
            )
            if chunks:
                for chunk in chunks:
                    if chunk.section != item["section"] or chunk.content != item["content"]:
                        chunk.section = item["section"]
                        chunk.content = item["content"]
                        chunk.embedding = None
                    elif content_changed:
                        chunk.embedding = None
            else:
                db.add(
                    KnowledgeChunk(
                        source_id=source.id,
                        page_number=None,
                        section=item["section"],
                        content=item["content"],
                        embedding=None,
                    )
                )
            continue
        source = KnowledgeSource(
            title=item["title"],
            publisher=item["publisher"],
            url=item["url"],
            effective_date=item["effective_date"],
            content=item["content"],
        )
        db.add(source)
        db.flush()
        db.add(
            KnowledgeChunk(
                source_id=source.id,
                page_number=None,
                section=item["section"],
                content=item["content"],
                embedding=None,
            )
        )
        inserted += 1
    db.commit()
    return inserted
