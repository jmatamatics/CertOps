import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from jinja2 import Environment, FileSystemLoader

from backend.graph import graph, CertOpsState, PIPELINE_STEPS, ARTIFACT_TO_NODE, db_conn
from backend.ingest import process_content

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


class SaveProgramRequest(BaseModel):
    name: str
    track_key: str
    artifacts: dict


class UpdateProgramRequest(BaseModel):
    artifacts: dict


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


@app.post("/generate-custom", response_model=GenerateResponse)
async def generate_custom(
    name: str = Form(...),
    description: str = Form(...),
    urls: str = Form("[]"),
    files: list[UploadFile] = File(default=[]),
):
    url_list = json.loads(urls) if urls else []

    file_contents: list[tuple[str, bytes]] = []
    for f in files:
        content = await f.read()
        file_contents.append((f.filename or "upload", content))

    chunks = process_content(url_list, file_contents)
    if not chunks:
        raise HTTPException(status_code=400, detail="No content could be extracted from the provided URLs or files.")

    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    initial_state: CertOpsState = {
        "track": name,
        "documents": chunks,
        "tavily_context": description,
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
    return GenerateResponse(**artifacts)


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


# ── Programs CRUD ──

PROGRAMS_DIR = DATA_DIR / "programs"
PROGRAMS_DIR.mkdir(parents=True, exist_ok=True)


def _programs_use_db() -> bool:
    return db_conn is not None


def _program_summary(row: dict) -> dict:
    artifacts = row["artifacts"] if isinstance(row["artifacts"], dict) else json.loads(row["artifacts"])
    fw = artifacts.get("competency_framework", {})
    domains = fw.get("domains", [])
    return {
        "id": row["id"],
        "name": row["name"],
        "track_key": row["track_key"],
        "created_at": row["created_at"],
        "domain_count": len(domains),
        "skill_count": sum(len(d.get("skills", [])) for d in domains),
    }


@app.get("/programs")
def list_programs():
    if _programs_use_db():
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, track_key, artifacts, created_at FROM programs ORDER BY created_at DESC"
            )
            cols = [desc[0] for desc in cur.description]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        return [_program_summary(_row_to_dict(r)) for r in rows]
    else:
        programs = []
        for f in sorted(PROGRAMS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            data = json.loads(f.read_text())
            programs.append(_program_summary(data))
        return programs


@app.get("/programs/{program_id}")
def get_program(program_id: str):
    if _programs_use_db():
        with db_conn.cursor() as cur:
            cur.execute("SELECT * FROM programs WHERE id = %s", (program_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Program not found")
            cols = [desc[0] for desc in cur.description]
            data = dict(zip(cols, row))
        return _row_to_dict(data)
    else:
        path = PROGRAMS_DIR / f"{program_id}.json"
        if not path.exists():
            raise HTTPException(status_code=404, detail="Program not found")
        return json.loads(path.read_text())


@app.post("/programs")
def create_program(req: SaveProgramRequest):
    program_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    program = {
        "id": program_id,
        "name": req.name,
        "track_key": req.track_key,
        "artifacts": req.artifacts,
        "created_at": now,
        "updated_at": now,
    }

    if _programs_use_db():
        with db_conn.cursor() as cur:
            cur.execute(
                "INSERT INTO programs (id, name, track_key, artifacts, created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (program_id, req.name, req.track_key, json.dumps(req.artifacts), now, now),
            )
    else:
        (PROGRAMS_DIR / f"{program_id}.json").write_text(json.dumps(program, indent=2))

    return program


@app.put("/programs/{program_id}")
def update_program(program_id: str, req: UpdateProgramRequest):
    now = datetime.now(timezone.utc).isoformat()

    if _programs_use_db():
        with db_conn.cursor() as cur:
            cur.execute("SELECT id FROM programs WHERE id = %s", (program_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Program not found")
            cur.execute(
                "UPDATE programs SET artifacts = %s, updated_at = %s WHERE id = %s",
                (json.dumps(req.artifacts), now, program_id),
            )
            cur.execute("SELECT * FROM programs WHERE id = %s", (program_id,))
            cols = [desc[0] for desc in cur.description]
            row = dict(zip(cols, cur.fetchone()))
        return _row_to_dict(row)
    else:
        path = PROGRAMS_DIR / f"{program_id}.json"
        if not path.exists():
            raise HTTPException(status_code=404, detail="Program not found")
        program = json.loads(path.read_text())
        program["artifacts"] = req.artifacts
        program["updated_at"] = now
        path.write_text(json.dumps(program, indent=2))
        return program


@app.delete("/programs/{program_id}")
def delete_program(program_id: str):
    if _programs_use_db():
        with db_conn.cursor() as cur:
            cur.execute("DELETE FROM programs WHERE id = %s RETURNING id", (program_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Program not found")
    else:
        path = PROGRAMS_DIR / f"{program_id}.json"
        if not path.exists():
            raise HTTPException(status_code=404, detail="Program not found")
        path.unlink()

    return {"status": "deleted"}


def _row_to_dict(row: dict) -> dict:
    """Normalize a database row so artifacts is always a dict and datetimes are strings."""
    result = dict(row)
    if isinstance(result.get("artifacts"), str):
        result["artifacts"] = json.loads(result["artifacts"])
    for key in ("created_at", "updated_at"):
        val = result.get(key)
        if val and not isinstance(val, str):
            result[key] = val.isoformat()
    return result
