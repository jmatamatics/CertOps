import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from jinja2 import Environment, FileSystemLoader

from backend.graph import graph, CertOpsState, PIPELINE_STEPS, ARTIFACT_TO_NODE

app = FastAPI(title="CertOps API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"

jinja_env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))

TRACK_MAP = {
    "ai_champion": "AI Champion",
    "user": "M365 Copilot User",
}

REVERSE_TRACK_MAP = {v: k for k, v in TRACK_MAP.items()}


class GenerateRequest(BaseModel):
    track: str


class GenerateResponse(BaseModel):
    thread_id: str
    competency_framework: dict
    learning_progression: dict
    assessments: list[dict]
    rubrics: list[dict]
    item_bank: list[dict]
    blueprint: dict


class EditRequest(BaseModel):
    thread_id: str
    artifact_key: str
    updated_data: Any


class EditResponse(BaseModel):
    thread_id: str
    competency_framework: dict
    learning_progression: dict
    assessments: list[dict]
    rubrics: list[dict]
    item_bank: list[dict]
    blueprint: dict


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/steps")
def steps():
    return {"steps": PIPELINE_STEPS}


@app.get("/cached/{track_key}")
def cached(track_key: str):
    """Return pre-generated JSON for a track (ai_champion or user)."""
    path = DATA_DIR / f"certops_{track_key}_output.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No cached data for '{track_key}'")
    return json.loads(path.read_text())


ARTIFACT_KEYS = [
    "competency_framework", "learning_progression",
    "assessments", "rubrics", "item_bank", "blueprint",
]


def _extract_artifacts(state: dict, thread_id: str) -> dict:
    return {"thread_id": thread_id, **{k: state[k] for k in ARTIFACT_KEYS}}


def _cache_artifacts(artifacts: dict, track: str) -> None:
    track_key = REVERSE_TRACK_MAP.get(track)
    if track_key:
        cache_path = DATA_DIR / f"certops_{track_key}_output.json"
        to_cache = {k: artifacts[k] for k in ARTIFACT_KEYS}
        cache_path.write_text(json.dumps(to_cache, indent=2))


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    initial_state: CertOpsState = {
        "track": req.track,
        "documents": [],
        "tavily_context": "",
        "competency_framework": None,
        "learning_progression": None,
        "assessments": None,
        "rubrics": None,
        "item_bank": None,
        "blueprint": None,
    }

    try:
        result = graph.invoke(initial_state, config=config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    artifacts = _extract_artifacts(result, thread_id)
    _cache_artifacts(artifacts, req.track)
    return GenerateResponse(**artifacts)


@app.post("/edit", response_model=EditResponse)
def edit(req: EditRequest):
    if req.artifact_key not in ARTIFACT_TO_NODE:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid artifact_key '{req.artifact_key}'. Must be one of: {list(ARTIFACT_TO_NODE.keys())}",
        )

    config = {"configurable": {"thread_id": req.thread_id}}
    node_name = ARTIFACT_TO_NODE[req.artifact_key]

    try:
        graph.update_state(
            config,
            values={req.artifact_key: req.updated_data},
            as_node=node_name,
        )
        result = graph.invoke(None, config=config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    artifacts = _extract_artifacts(result, req.thread_id)
    _cache_artifacts(artifacts, result.get("track", ""))
    return EditResponse(**artifacts)


@app.get("/export/{track_key}/html", response_class=HTMLResponse)
def export_html(track_key: str):
    """Render a self-contained HTML certification report."""
    path = DATA_DIR / f"certops_{track_key}_output.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No cached data for '{track_key}'")

    data = json.loads(path.read_text())
    template = jinja_env.get_template("certification_report.html")
    html = template.render(
        data=data,
        generated_date=datetime.now().strftime("%B %d, %Y"),
    )
    return HTMLResponse(content=html)
