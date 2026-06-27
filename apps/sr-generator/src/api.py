"""sr-gen API — FastAPI server exposing report generation endpoints."""

from __future__ import annotations

import json
import os
import shutil
import tempfile
from datetime import date, datetime
from pathlib import Path
from typing import Annotated

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

# Load env before anything else touches os.environ
import sys as _sys
from pathlib import Path as _Path

from dotenv import load_dotenv as _load_dotenv

_explicit = os.environ.get("SR_GEN_ENV_FILE")
if _explicit:
    _load_dotenv(_Path(_explicit), override=False)
else:
    _candidates = [_Path.cwd()]
    if getattr(_sys, "frozen", False):
        _candidates.append(_Path(_sys.executable).parent)
    # walk up from __file__ to find monorepo root .env
    _here = _Path(__file__).resolve().parent
    for _p in _here.parents:
        if (_p / ".env").exists():
            _candidates.append(_p)
            break
    _loaded = False
    for _base in _candidates:
        _env = _base / ".env"
        if _env.exists():
            _load_dotenv(_env, override=False)
            _loaded = True
            break
    if not _loaded:
        _load_dotenv(override=False)

del _sys, _Path, _load_dotenv, _explicit, _candidates, _here, _p, _loaded, _base, _env

from constants import DATA_DIR
from services.db import get_db_apps
from pipeline.common import GenerateResult
from pipeline.db import generate_for_db_mapping
from pipeline.excel import generate_for_excel_mapping
from services.mapping import list_db_mapping_apps, list_excel_mapping_apps
from lib.settings import get_database_settings
from lib.report_filename import sanitize_for_filename

_SR_GEN_API_KEY = os.environ.get("SR_GEN_API_KEY", "").strip()

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="sr-gen API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_PROJECT_ROOT = DATA_DIR.parent
_GENERATED_DIR = _PROJECT_ROOT / "generated"
_SYNTHETIC_TEMPLATE = DATA_DIR / "templates" / "template_synthetic_monitoring.pptx"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class MappingInfo(BaseModel):
    name: str
    filename: str
    kind: str = Field(description="One of: db, excel, synthetic")


class DbApp(BaseModel):
    app_id: str
    app_name: str


class GenerateDbRequest(BaseModel):
    app_name: str
    app_id: str
    mapping_filename: str = Field(description="Filename within data/db/")
    master_date_from: date
    master_date_to: date


class GenerateResponse(BaseModel):
    app_name: str
    output_path: str | None
    success: bool
    message: str


class ReportInfo(BaseModel):
    filename: str
    path: str
    size_bytes: int
    created_at: datetime


class HealthResponse(BaseModel):
    status: str
    db_configured: bool
    db_connected: bool


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
def _verify_api_key(x_api_key: Annotated[str | None, Header()] = None) -> None:
    if _SR_GEN_API_KEY and x_api_key != _SR_GEN_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_database_settings()
    db_ok = False
    if settings.is_configured:
        try:
            from lib.db.postgres import _connect

            with _connect(settings):
                db_ok = True
        except Exception:
            pass
    return HealthResponse(
        status="ok",
        db_configured=settings.is_configured,
        db_connected=db_ok,
    )


# ---------------------------------------------------------------------------
# Apps / Mappings
# ---------------------------------------------------------------------------
@app.get("/apps/db", response_model=list[DbApp])
def list_db_apps_endpoint(
    _key: Annotated[None, Depends(_verify_api_key)] = None,
) -> list[DbApp]:
    try:
        apps = get_db_apps()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"DB error: {exc}")
    return [DbApp(app_id=a["app_id"], app_name=a["app_name"]) for a in apps]


@app.get("/apps/mappings", response_model=list[MappingInfo])
def list_mappings(
    _key: Annotated[None, Depends(_verify_api_key)] = None,
) -> list[MappingInfo]:
    results: list[MappingInfo] = []
    for name, path in list_db_mapping_apps():
        results.append(MappingInfo(name=name, filename=path.name, kind="db"))
    for name, path in list_excel_mapping_apps():
        results.append(MappingInfo(name=name, filename=path.name, kind="excel"))
    for path in sorted(DATA_DIR.glob("others/*.synthetic.mapping.json")):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            name = str(raw.get("name") or path.stem.replace(".synthetic.mapping", "")).strip()
        except Exception:
            name = path.stem.replace(".synthetic.mapping", "")
        results.append(MappingInfo(name=name, filename=path.name, kind="synthetic"))
    return results


# ---------------------------------------------------------------------------
# Generate: DB
# ---------------------------------------------------------------------------
@app.post("/generate/db", response_model=GenerateResponse)
def generate_db(
    req: GenerateDbRequest,
    _key: Annotated[None, Depends(_verify_api_key)] = None,
) -> GenerateResponse:
    mapping_path = DATA_DIR / "db" / req.mapping_filename
    if not mapping_path.exists():
        raise HTTPException(status_code=404, detail=f"Mapping not found: {req.mapping_filename}")

    settings = get_database_settings()
    if not settings.is_configured:
        raise HTTPException(status_code=400, detail="Database not configured (SR_GEN_DATABASE_URL).")

    result = generate_for_db_mapping(
        app_name=req.app_name,
        mapping_path=mapping_path,
        app_id=req.app_id,
        master_date_from=req.master_date_from,
        master_date_to=req.master_date_to,
        settings=settings,
        output_root=_PROJECT_ROOT,
    )
    return _to_response(result)


# ---------------------------------------------------------------------------
# Generate: Excel
# ---------------------------------------------------------------------------
@app.post("/generate/excel", response_model=GenerateResponse)
async def generate_excel(
    app_name: str = Form(...),
    mapping_filename: str = Form(...),
    file: UploadFile = File(...),
    _key: Annotated[None, Depends(_verify_api_key)] = None,
) -> GenerateResponse:
    mapping_path = DATA_DIR / "excel" / mapping_filename
    if not mapping_path.exists():
        raise HTTPException(status_code=404, detail=f"Mapping not found: {mapping_filename}")

    suffix = Path(file.filename or "upload.xlsx").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    try:
        result = generate_for_excel_mapping(
            app_name=app_name,
            mapping_path=mapping_path,
            excel_path=tmp_path,
            output_root=_PROJECT_ROOT,
        )
    finally:
        tmp_path.unlink(missing_ok=True)

    return _to_response(result)


# ---------------------------------------------------------------------------
# Generate: Synthetic
# ---------------------------------------------------------------------------
@app.post("/generate/synthetic", response_model=GenerateResponse)
async def generate_synthetic(
    mapping_filename: str = Form(...),
    file: UploadFile = File(...),
    _key: Annotated[None, Depends(_verify_api_key)] = None,
) -> GenerateResponse:
    mapping_path = DATA_DIR / "others" / mapping_filename
    if not mapping_path.exists():
        raise HTTPException(status_code=404, detail=f"Mapping not found: {mapping_filename}")
    if not _SYNTHETIC_TEMPLATE.exists():
        raise HTTPException(status_code=500, detail="Synthetic monitoring template not found.")

    suffix = Path(file.filename or "upload.csv").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    try:
        from bptx import template as bptx_template
        from lib.data_processing import SyntheticAppMapping
        from generators.synthetic import process_synthetic_template

        mapping_obj = SyntheticAppMapping.from_file(mapping_path)

        now = datetime.now()
        generated_date = now.date().isoformat()
        generated_hhmmss = now.strftime("%H%M%S")
        app_name = mapping_obj.name or "synthetic"
        output_dir = _GENERATED_DIR / generated_date
        output_dir.mkdir(parents=True, exist_ok=True)
        out_path = output_dir / (
            f"Synthetic_{sanitize_for_filename(app_name)}_{generated_date}_{generated_hhmmss}.pptx"
        )

        with bptx_template(_SYNTHETIC_TEMPLATE) as ppt:
            process_synthetic_template(
                ppt,
                mapping_path=mapping_path,
                data_path=tmp_path,
            )
            ppt.save(out_path)

        return GenerateResponse(
            app_name=app_name,
            output_path=str(out_path),
            success=True,
            message=f"Generated {out_path.name}",
        )
    except Exception as exc:
        return GenerateResponse(
            app_name="synthetic",
            output_path=None,
            success=False,
            message=str(exc),
        )
    finally:
        tmp_path.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------
@app.get("/reports", response_model=list[ReportInfo])
def list_reports(
    _key: Annotated[None, Depends(_verify_api_key)] = None,
) -> list[ReportInfo]:
    reports: list[ReportInfo] = []
    if not _GENERATED_DIR.exists():
        return reports
    for path in sorted(_GENERATED_DIR.rglob("*.pptx"), key=lambda p: p.stat().st_mtime, reverse=True):
        stat = path.stat()
        reports.append(
            ReportInfo(
                filename=path.name,
                path=str(path.relative_to(_PROJECT_ROOT)),
                size_bytes=stat.st_size,
                created_at=datetime.fromtimestamp(stat.st_mtime),
            )
        )
    return reports


@app.get("/reports/{filename}")
def download_report(
    filename: str,
    _key: Annotated[None, Depends(_verify_api_key)] = None,
) -> FileResponse:
    matches = list(_GENERATED_DIR.rglob(filename))
    if not matches:
        raise HTTPException(status_code=404, detail="Report not found.")
    return FileResponse(
        path=matches[0],
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=filename,
    )


@app.delete("/reports/{filename}")
def delete_report(
    filename: str,
    _key: Annotated[None, Depends(_verify_api_key)] = None,
) -> dict[str, str]:
    matches = list(_GENERATED_DIR.rglob(filename))
    if not matches:
        raise HTTPException(status_code=404, detail="Report not found.")
    matches[0].unlink()
    return {"detail": f"Deleted {filename}"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _to_response(result: GenerateResult) -> GenerateResponse:
    return GenerateResponse(
        app_name=result.app_name,
        output_path=str(result.output_path) if result.output_path else None,
        success=result.success,
        message=result.message,
    )
