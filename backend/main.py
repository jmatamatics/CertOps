import json
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from jinja2 import Environment, FileSystemLoader

from backend.graph import graph, CertOpsState, PIPELINE_STEPS

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


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
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
        result = graph.invoke(initial_state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    output = {
        "competency_framework": result["competency_framework"],
        "learning_progression": result["learning_progression"],
        "assessments": result["assessments"],
        "rubrics": result["rubrics"],
        "item_bank": result["item_bank"],
        "blueprint": result["blueprint"],
    }

    track_key = REVERSE_TRACK_MAP.get(req.track)
    if track_key:
        cache_path = DATA_DIR / f"certops_{track_key}_output.json"
        cache_path.write_text(json.dumps(output, indent=2))

    return GenerateResponse(**output)


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
