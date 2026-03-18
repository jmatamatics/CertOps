"""Seed the learner_profiles table (or file-based results/) with realistic fake exam data.

Usage:
    uv run python -m backend.seed_results
"""

import json
import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PROGRAMS_DIR = DATA_DIR / "programs"
RESULTS_DIR = DATA_DIR / "results"

NAMES = [
    "Alex Rivera", "Jordan Patel", "Casey Morgan", "Taylor Chen",
    "Sam Nakamura", "Drew Washington", "Jamie O'Brien", "Riley Kim",
    "Morgan Foster", "Avery Singh", "Quinn Hernandez", "Dakota Lee",
    "Reese Thompson", "Skyler Nguyen", "Blake Martinez", "Cameron Davis",
    "Emery Clark", "Finley Adams", "Harper Wilson", "Kai Robinson",
    "Lane Scott", "Micah Turner", "Noel Garcia", "Parker Evans",
    "Rowan Hall", "Sage Mitchell", "Tatum Wright", "Val Cooper",
    "Wren Phillips", "Zion Carter",
]

DOMAINS_BY_TRACK = {
    "ai_champion": [
        "Copilot Studio Agent Development",
        "Conversational AI Design",
        "Integration & Extensibility",
        "Governance & Security",
    ],
    "user": [
        "Productivity & Document Authoring",
        "Communication & Collaboration",
        "Data Analysis with Copilot",
        "Prompting & Interaction",
    ],
    "default": [
        "Core Competency",
        "Applied Knowledge",
        "Practical Skills",
        "Professional Standards",
    ],
}

SUMMARY_TEMPLATES_PASS = [
    "Strong performance across all domains. Demonstrated expert-level understanding of {d1} and solid competence in {d2}.",
    "Consistently above threshold. Particularly strong in {d1}, with competent performance in remaining domains.",
    "Well-prepared candidate showing broad competency. Minor gaps in {d2} but overall a clear pass.",
    "Exceeded expectations in {d1} and {d2}. Solid foundational knowledge throughout.",
]

SUMMARY_TEMPLATES_FAIL = [
    "Fell below threshold in {d1} and {d2}. Recommend focused study on these domains before retaking.",
    "Demonstrated novice-level understanding in most domains. Needs significant preparation in {d1}.",
    "Partial competency shown but insufficient overall score. Strongest in {d2}, weakest in {d1}.",
    "Did not meet minimum requirements. Recommend reviewing all course materials, especially {d1}.",
]


def _generate_domain_breakdown(domains: list[str], passed: bool) -> dict:
    breakdown = {}
    for domain in domains:
        if passed:
            score = round(random.uniform(1.8, 3.0), 2)
        else:
            score = round(random.uniform(1.0, 2.4), 2)

        if score >= 2.5:
            level = "expert"
        elif score >= 1.7:
            level = "competent"
        else:
            level = "novice"

        breakdown[domain] = {
            "score": score,
            "items_count": random.randint(3, 6),
            "level": level,
        }
    return breakdown


def _generate_summary(passed: bool, domains: list[str]) -> str:
    d1, d2 = random.sample(domains, 2)
    templates = SUMMARY_TEMPLATES_PASS if passed else SUMMARY_TEMPLATES_FAIL
    return random.choice(templates).format(d1=d1, d2=d2)


def _get_programs() -> list[dict]:
    """Fetch programs from DB or file system."""
    database_url = os.getenv("DATABASE_URL")

    if database_url:
        try:
            import psycopg
            conn = psycopg.Connection.connect(database_url, autocommit=True, prepare_threshold=0)
            with conn.cursor() as cur:
                cur.execute("SELECT id, name, track_key FROM programs")
                cols = [desc[0] for desc in cur.description]
                programs = [dict(zip(cols, row)) for row in cur.fetchall()]
            conn.close()
            return programs
        except Exception as e:
            print(f"DB connection failed: {e}. Falling back to file-based.")

    programs = []
    if PROGRAMS_DIR.exists():
        for f in PROGRAMS_DIR.glob("*.json"):
            data = json.loads(f.read_text())
            programs.append({
                "id": data["id"],
                "name": data.get("name", "Unknown"),
                "track_key": data.get("track_key", "default"),
            })
    return programs


def _get_domains_for_program(prog: dict) -> list[str]:
    """Try to extract real domain names from the saved program artifacts."""
    track_key = prog.get("track_key", "default")

    if PROGRAMS_DIR.exists():
        prog_file = PROGRAMS_DIR / f"{prog['id']}.json"
        if prog_file.exists():
            data = json.loads(prog_file.read_text())
            artifacts = data.get("artifacts", {})
            fw = artifacts.get("competency_framework", {})
            domains = fw.get("domains", [])
            if domains:
                return [d["name"] for d in domains]

    return DOMAINS_BY_TRACK.get(track_key, DOMAINS_BY_TRACK["default"])


def seed():
    programs = _get_programs()

    if not programs:
        print("No programs found. Create some programs first (via /programs POST or the UI).")
        return

    database_url = os.getenv("DATABASE_URL")
    use_db = bool(database_url)

    db_conn = None
    if use_db:
        try:
            import psycopg
            db_conn = psycopg.Connection.connect(database_url, autocommit=True, prepare_threshold=0)
        except Exception as e:
            print(f"DB connection failed: {e}. Writing to files instead.")
            use_db = False

    if not use_db:
        RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Found {len(programs)} program(s). Seeding results ({'database' if use_db else 'file-based'})...")

    now = datetime.now(timezone.utc)
    total_inserted = 0

    for prog in programs:
        domains = _get_domains_for_program(prog)
        num_learners = random.randint(15, 25)
        learners = random.sample(NAMES, min(num_learners, len(NAMES)))

        program_records = []

        for learner_name in learners:
            learner_id = learner_name.lower().replace(" ", ".").replace("'", "")
            passed = random.random() < 0.70

            breakdown = _generate_domain_breakdown(domains, passed)
            scores = [d["score"] for d in breakdown.values()]
            overall = round(sum(scores) / len(scores), 2)

            if passed and overall < 2.0:
                overall = round(random.uniform(2.0, 2.6), 2)
            elif not passed and overall >= 2.0:
                overall = round(random.uniform(1.2, 1.9), 2)

            summary = _generate_summary(passed, domains)
            days_ago = random.randint(0, 30)
            hours_ago = random.randint(0, 23)
            created_at = (now - timedelta(days=days_ago, hours=hours_ago)).isoformat()
            thread_id = str(uuid.uuid4())

            record = {
                "learner_id": learner_id,
                "program_id": prog["id"],
                "thread_id": thread_id,
                "passed": passed,
                "overall_score": overall,
                "domain_breakdown": breakdown,
                "summary": summary,
                "created_at": created_at,
            }

            if use_db:
                try:
                    with db_conn.cursor() as cur:
                        cur.execute(
                            "INSERT INTO learner_profiles "
                            "(learner_id, program_id, thread_id, passed, overall_score, domain_breakdown, summary, created_at) "
                            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) "
                            "ON CONFLICT DO NOTHING",
                            (
                                learner_id, prog["id"], thread_id,
                                passed, overall, json.dumps(breakdown),
                                summary, created_at,
                            ),
                        )
                    total_inserted += 1
                except Exception as e:
                    print(f"  Skipped: {e}")
            else:
                program_records.append(record)
                total_inserted += 1

        if not use_db and program_records:
            out_path = RESULTS_DIR / f"{prog['id']}.json"
            out_path.write_text(json.dumps(program_records, indent=2))

        print(f"  {prog['name']}: seeded {len(learners)} learner results")

    if db_conn:
        db_conn.close()

    print(f"\nDone. Inserted {total_inserted} records total.")


if __name__ == "__main__":
    seed()
