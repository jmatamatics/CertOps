"""Procedural memory — per-user customizable exam agent prompts stored in Qdrant."""

from __future__ import annotations

import hashlib
import json
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from pathlib import Path
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    PointStruct,
    VectorParams,
    PayloadSchemaType,
    Filter,
    FieldCondition,
    MatchValue,
)

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION = "certops_procedural_memory"
VECTOR_SIZE = 4

_client: QdrantClient | None = None


def _get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    return _client


_collection_ready = False


def ensure_collection():
    global _collection_ready
    if _collection_ready:
        return

    client = _get_client()
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION not in existing:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )

    for field in ("namespace", "program_id"):
        try:
            client.create_payload_index(
                collection_name=COLLECTION,
                field_name=field,
                field_schema=PayloadSchemaType.KEYWORD,
            )
        except Exception:
            pass

    _collection_ready = True


def get_user_namespace(email: str) -> str:
    return hashlib.sha256(email.lower().strip().encode()).hexdigest()[:16]


DEFAULT_MEMORIES = {
    "evaluator_system_prompt": (
        "You are an expert certification exam evaluator. Score the learner's response.\n\n"
        "## Scoring Guidelines\n"
        "- **3 (expert)**: Demonstrates deep, specific knowledge. Addresses the core "
        "of the question with concrete details, tools, or techniques. May use a "
        "different but equally valid approach from the model answer.\n"
        "- **2 (competent)**: Shows solid understanding of the domain. Covers the main "
        "points but may lack some specificity or miss secondary considerations. "
        "A practitioner could execute based on this answer.\n"
        "- **1 (novice)**: Vague, superficial, or significantly off-topic. Lacks "
        "actionable detail or demonstrates fundamental misunderstanding.\n\n"
        "IMPORTANT: The model answer is a REFERENCE, not a checklist. A response that "
        "demonstrates equivalent expertise using different specific tools, approaches, "
        "or examples should still score highly. Evaluate KNOWLEDGE DEPTH, not exact match.\n\n"
        "Set confidence to 'clear' if the level is obvious, or 'borderline' if "
        "a follow-up probe would help disambiguate."
    ),
    "probe_evaluator_prompt": (
        "You are an expert certification exam evaluator. The learner gave an initial "
        "response and then answered a follow-up probe. Re-evaluate holistically, "
        "considering BOTH responses together.\n\n"
        "Score 3 (expert) if the combined responses show deep knowledge, "
        "2 (competent) if they show solid practical understanding, "
        "1 (novice) only if fundamentally lacking. "
        "Evaluate KNOWLEDGE DEPTH, not exact match to the model answer. "
        "Set confidence to 'clear' this time."
    ),
    "result_analyst_prompt": (
        "You are a certification exam results analyst. Generate a clear, "
        "encouraging but honest summary of the learner's performance."
    ),
    "question_format_template": "**Question {number} of {total}** — _{domain}_\n\n{stem}",
    "welcome_message": "",
    "farewell_message": "",
    "pass_thresholds": {
        "overall_min": 2.0,
        "domain_min": 2.0,
        "weak_domain_floor": 1.5,
    },
    "scoring_scale": {
        "expert": {"min_score": 2.5, "label": "expert"},
        "competent": {"min_score": 1.7, "label": "competent"},
        "novice": {"min_score": 0, "label": "novice"},
    },
    "max_exam_items": 20,
    "min_items_per_domain": 2,
}


def get_default_memories() -> dict:
    return json.loads(json.dumps(DEFAULT_MEMORIES))


def _point_id(namespace: str, program_id: str) -> str:
    raw = f"{namespace}:{program_id}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, raw))


def save_memories(namespace: str, program_id: str, memories: dict) -> dict:
    ensure_collection()
    client = _get_client()

    merged = get_default_memories()
    merged.update(memories)

    point = PointStruct(
        id=_point_id(namespace, program_id),
        vector=[0.0] * VECTOR_SIZE,
        payload={
            "namespace": namespace,
            "program_id": program_id,
            "memories": json.dumps(merged),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    client.upsert(collection_name=COLLECTION, points=[point])
    return merged


def load_memories(namespace: str, program_id: str) -> dict:
    ensure_collection()
    client = _get_client()

    results = client.scroll(
        collection_name=COLLECTION,
        scroll_filter=Filter(
            must=[
                FieldCondition(key="namespace", match=MatchValue(value=namespace)),
                FieldCondition(key="program_id", match=MatchValue(value=program_id)),
            ]
        ),
        limit=1,
    )

    points = results[0]
    if points:
        return json.loads(points[0].payload["memories"])

    return get_default_memories()


def reset_memories(namespace: str, program_id: str) -> dict:
    ensure_collection()
    client = _get_client()

    client.delete(
        collection_name=COLLECTION,
        points_selector=[_point_id(namespace, program_id)],
    )

    return get_default_memories()
