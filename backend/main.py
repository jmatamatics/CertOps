import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import csv
import io

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel
from jinja2 import Environment, FileSystemLoader

from langgraph.types import Command

from backend.graph import graph, CertOpsState, PIPELINE_STEPS, ARTIFACT_TO_NODE, db_conn
from backend.exam_graph import exam_graph
from backend.ingest import process_content, embed_program_docs
from backend.procedural_memory import (
    get_user_namespace,
    get_default_memories,
    load_memories,
    save_memories,
    reset_memories,
)

app = FastAPI(title="CertOps Studio API", version="2.0.0")

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

DEFAULT_USER_EMAIL = "default@certops.local"

TRACK_MAP = {
    "ai_champion": "AI Champion",
    "user": "M365 Copilot User",
}

REVERSE_TRACK_MAP = {v: k for k, v in TRACK_MAP.items()}


class GenerateRequest(BaseModel):
    track: str


class GenerateResponse(BaseModel):
    thread_id: str
    program_id: str | None = None
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
    artifacts: dict | None = None
    name: str | None = None


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


def _cache_artifacts(artifacts: dict, track: str, cache_key: str | None = None) -> None:
    key = cache_key or REVERSE_TRACK_MAP.get(track)
    if key:
        cache_path = DATA_DIR / f"certops_{key}_output.json"
        to_cache = {k: artifacts[k] for k in ARTIFACT_KEYS}
        cache_path.write_text(json.dumps(to_cache, indent=2))


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    initial_state: CertOpsState = {
        "track": req.track,
        "documents": [],
        "document_sources": [],
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
    track = result.get("track", "")
    _cache_artifacts(artifacts, track, cache_key=None if REVERSE_TRACK_MAP.get(track) else req.thread_id)
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

    program_id = str(uuid.uuid4())
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    embed_program_docs(program_id, chunks, sources=url_list or None)

    initial_state: CertOpsState = {
        "track": name,
        "documents": [],
        "document_sources": url_list,
        "tavily_context": description,
        "program_id": program_id,
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
    artifacts["program_id"] = program_id
    _cache_artifacts(artifacts, name, cache_key=thread_id)
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
            updates, params = ["updated_at = %s"], [now]
            if req.artifacts is not None:
                updates.append("artifacts = %s")
                params.append(json.dumps(req.artifacts))
            if req.name is not None:
                updates.append("name = %s")
                params.append(req.name)
            params.append(program_id)
            cur.execute(
                f"UPDATE programs SET {', '.join(updates)} WHERE id = %s",
                tuple(params),
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
        if req.artifacts is not None:
            program["artifacts"] = req.artifacts
        if req.name is not None:
            program["name"] = req.name
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


@app.post("/programs/{program_id}/documents")
async def add_program_documents(
    program_id: str,
    urls: str = Form("[]"),
    files: list[UploadFile] = File(default=[]),
):
    """Add more documents to an existing program's knowledge base in Qdrant."""
    url_list = json.loads(urls) if urls else []

    file_contents: list[tuple[str, bytes]] = []
    for f in files:
        content = await f.read()
        file_contents.append((f.filename or "upload", content))

    chunks = process_content(url_list, file_contents)
    if not chunks:
        raise HTTPException(status_code=400, detail="No content could be extracted.")

    count = embed_program_docs(program_id, chunks, sources=url_list or None)
    return {"status": "ok", "chunks_added": count}


@app.get("/programs/{program_id}/report", response_class=HTMLResponse)
def program_report(program_id: str, download: bool = False):
    """Render an HTML certification report from a saved program's artifacts."""
    raw = get_program(program_id)
    artifacts = raw.get("artifacts", raw)
    program_name = raw.get("name", "certification")
    template = jinja_env.get_template("certification_report.html")
    html = template.render(
        data=artifacts,
        generated_date=datetime.now().strftime("%B %d, %Y"),
    )
    if download:
        safe_name = "".join(c if c.isalnum() or c in " -_" else "" for c in program_name).strip().replace(" ", "_")
        return HTMLResponse(
            content=html,
            headers={"Content-Disposition": f'attachment; filename="{safe_name}_report.html"'},
        )
    return HTMLResponse(content=html)



# ── Results Dashboard ──

RESULTS_DIR = DATA_DIR / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def _load_file_results(program_id: str | None = None) -> list[dict]:
    """Load learner results from JSON files on disk."""
    all_results: list[dict] = []
    for f in RESULTS_DIR.glob("*.json"):
        data = json.loads(f.read_text())
        records = data if isinstance(data, list) else [data]
        for r in records:
            if program_id and r.get("program_id") != program_id:
                continue
            if isinstance(r.get("domain_breakdown"), str):
                r["domain_breakdown"] = json.loads(r["domain_breakdown"])
            all_results.append(r)
    all_results.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return all_results


@app.get("/programs/{program_id}/results")
def program_results(program_id: str):
    """All exam attempts for a program."""
    if _programs_use_db():
        try:
            with db_conn.cursor() as cur:
                cur.execute(
                    "SELECT learner_id, program_id, thread_id, passed, overall_score, "
                    "domain_breakdown, summary, created_at "
                    "FROM learner_profiles WHERE program_id = %s ORDER BY created_at DESC",
                    (program_id,),
                )
                cols = [desc[0] for desc in cur.description]
                rows = [dict(zip(cols, row)) for row in cur.fetchall()]
            for r in rows:
                if isinstance(r.get("domain_breakdown"), str):
                    r["domain_breakdown"] = json.loads(r["domain_breakdown"])
                if r.get("created_at") and not isinstance(r["created_at"], str):
                    r["created_at"] = r["created_at"].isoformat()
            return rows
        except Exception:
            return []
    return _load_file_results(program_id)


@app.get("/programs/{program_id}/results/export")
def program_results_export(program_id: str):
    """Export exam results for a program as CSV."""
    rows = program_results(program_id)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["learner_id", "passed", "overall_score", "summary", "date"])
    for r in rows:
        writer.writerow([
            r.get("learner_id", ""),
            r.get("passed", ""),
            round(r.get("overall_score", 0), 2),
            r.get("summary", ""),
            r.get("created_at", ""),
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{program_id}_results.csv"'},
    )


@app.get("/results/summary")
def results_summary():
    """Aggregate exam stats per program for the dashboard list view."""
    if _programs_use_db():
        try:
            with db_conn.cursor() as cur:
                cur.execute(
                    "SELECT lp.program_id, "
                    "COUNT(*) AS total_attempts, "
                    "SUM(CASE WHEN lp.passed THEN 1 ELSE 0 END) AS passed_count, "
                    "AVG(lp.overall_score) AS avg_score, "
                    "MAX(lp.created_at) AS last_attempt, "
                    "p.name AS program_name "
                    "FROM learner_profiles lp "
                    "LEFT JOIN programs p ON lp.program_id = p.id "
                    "GROUP BY lp.program_id, p.name "
                    "ORDER BY last_attempt DESC"
                )
                cols = [desc[0] for desc in cur.description]
                rows = [dict(zip(cols, row)) for row in cur.fetchall()]
            for r in rows:
                if r.get("last_attempt") and not isinstance(r["last_attempt"], str):
                    r["last_attempt"] = r["last_attempt"].isoformat()
                if r.get("avg_score") is not None:
                    r["avg_score"] = round(float(r["avg_score"]), 2)
                r["passed_count"] = int(r.get("passed_count", 0))
                r["total_attempts"] = int(r.get("total_attempts", 0))
            return rows
        except Exception:
            return []

    all_results = _load_file_results()
    program_names: dict[str, str] = {}
    for f in sorted(PROGRAMS_DIR.glob("*.json")):
        data = json.loads(f.read_text())
        program_names[data["id"]] = data.get("name", data["id"])

    grouped: dict[str, list[dict]] = {}
    for r in all_results:
        pid = r.get("program_id", "unknown")
        grouped.setdefault(pid, []).append(r)

    summaries = []
    for pid, records in grouped.items():
        total = len(records)
        passed = sum(1 for r in records if r.get("passed"))
        avg = sum(r.get("overall_score", 0) for r in records) / total if total else 0
        last = max((r.get("created_at", "") for r in records), default="")
        summaries.append({
            "program_id": pid,
            "program_name": program_names.get(pid, pid),
            "total_attempts": total,
            "passed_count": passed,
            "avg_score": round(avg, 2),
            "last_attempt": last,
        })
    summaries.sort(key=lambda s: s["last_attempt"], reverse=True)
    return summaries


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


# ── Adaptive Exam ──

class ExamStartRequest(BaseModel):
    program_id: str
    learner_id: str


class ExamRespondRequest(BaseModel):
    thread_id: str
    message: str


def _exam_snapshot(config: dict) -> dict:
    """Read the exam graph state and return a serialisable response."""
    state_snapshot = exam_graph.get_state(config)
    values = state_snapshot.values
    is_waiting = bool(state_snapshot.next)

    interrupt_value = None
    if is_waiting and state_snapshot.tasks:
        for task in state_snapshot.tasks:
            if hasattr(task, "interrupts") and task.interrupts:
                interrupt_value = task.interrupts[0].value
                break

    return {
        "thread_id": config["configurable"]["thread_id"],
        "status": "awaiting_response" if is_waiting else ("complete" if values.get("exam_complete") else "processing"),
        "interrupt": interrupt_value,
        "messages": values.get("messages", []),
        "progress": {
            "items_completed": len(values.get("items_administered", [])),
            "total_items": len(values.get("items_administered", [])) + len(values.get("items_remaining", [])) + (1 if values.get("current_item") else 0),
            "domain_proficiency": values.get("domain_proficiency", {}),
        },
        "result": values.get("result_summary") if values.get("exam_complete") else None,
    }


@app.post("/exam/start")
def exam_start(req: ExamStartRequest, user: str = DEFAULT_USER_EMAIL):
    """Start a new adaptive exam session."""
    raw = get_program(req.program_id)
    artifacts = raw.get("artifacts", raw)

    namespace = get_user_namespace(user)
    pm = load_memories(namespace, req.program_id)

    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "program_id": req.program_id,
        "learner_id": req.learner_id,
        "program_name": raw.get("name", "Certification Exam"),
        "item_bank": artifacts.get("item_bank", []),
        "rubrics": artifacts.get("rubrics", []),
        "framework": artifacts.get("competency_framework", {}),
        "assessments": artifacts.get("assessments", []),
        "items_remaining": [],
        "domain_rubrics": {},
        "current_item": None,
        "current_domain": "",
        "current_evaluation": None,
        "probed": False,
        "messages": [],
        "items_administered": [],
        "domain_proficiency": {},
        "procedural_memory": pm,
        "exam_complete": False,
        "passed": None,
        "result_summary": None,
    }

    try:
        exam_graph.invoke(initial_state, config=config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return _exam_snapshot(config)


@app.post("/exam/respond")
def exam_respond(req: ExamRespondRequest):
    """Submit a learner response and continue the exam."""
    config = {"configurable": {"thread_id": req.thread_id}}

    try:
        exam_graph.invoke(Command(resume=req.message), config=config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    snapshot = _exam_snapshot(config)

    if snapshot["status"] == "complete" and snapshot["result"]:
        _save_exam_result(
            learner_id=req.thread_id,
            config=config,
            result=snapshot["result"],
        )

    return snapshot


def _save_exam_result(learner_id: str, config: dict, result: dict):
    """Persist exam result to the learner_profiles table."""
    values = exam_graph.get_state(config).values
    if not _programs_use_db():
        return
    try:
        with db_conn.cursor() as cur:
            cur.execute(
                "INSERT INTO learner_profiles (learner_id, program_id, thread_id, passed, overall_score, domain_breakdown, summary) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (
                    values.get("learner_id", learner_id),
                    values.get("program_id", ""),
                    config["configurable"]["thread_id"],
                    result.get("passed", False),
                    result.get("overall_score", 0),
                    json.dumps(result.get("domain_breakdown", {})),
                    result.get("summary", ""),
                ),
            )
    except Exception:
        pass


@app.get("/exam/status/{thread_id}")
def exam_status(thread_id: str):
    """Get current exam session state."""
    config = {"configurable": {"thread_id": thread_id}}
    try:
        return _exam_snapshot(config)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/learners/{learner_id}/history")
def learner_history(learner_id: str):
    """Get a learner's past exam attempts."""
    if not _programs_use_db():
        return []
    try:
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT learner_id, program_id, thread_id, passed, overall_score, "
                "domain_breakdown, summary, created_at "
                "FROM learner_profiles WHERE learner_id = %s ORDER BY created_at DESC",
                (learner_id,),
            )
            cols = [desc[0] for desc in cur.description]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        for r in rows:
            if isinstance(r.get("domain_breakdown"), str):
                r["domain_breakdown"] = json.loads(r["domain_breakdown"])
            if r.get("created_at") and not isinstance(r["created_at"], str):
                r["created_at"] = r["created_at"].isoformat()
        return rows
    except Exception:
        return []


# ── Agent Configuration (Procedural Memory) ──


class AgentConfigRequest(BaseModel):
    memories: dict


@app.get("/agent-config/defaults")
def agent_config_defaults():
    return get_default_memories()


@app.get("/agent-config/{program_id}")
def get_agent_config(program_id: str, user: str = DEFAULT_USER_EMAIL):
    namespace = get_user_namespace(user)
    return load_memories(namespace, program_id)


@app.put("/agent-config/{program_id}")
def update_agent_config(program_id: str, req: AgentConfigRequest, user: str = DEFAULT_USER_EMAIL):
    namespace = get_user_namespace(user)
    return save_memories(namespace, program_id, req.memories)


@app.post("/agent-config/{program_id}/reset")
def reset_agent_config(program_id: str, user: str = DEFAULT_USER_EMAIL):
    namespace = get_user_namespace(user)
    return reset_memories(namespace, program_id)
