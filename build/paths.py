"""Shared, configurable paths for the CFD TV data builders.

Nothing here is box-specific. Override with environment variables (see ../.env.example):
  CFD_TV_SITE      site root to read verify/ from and write channels.json + data/ into (default: repo root)
  CFD_DATA_DIR     search path for source exports, ':'-separated like $PATH (default: <repo>/data/sources)
  CFD_TMP_DIR      scratch dir for downloaded HTML (default: <repo>/build/.cache)
  CFD_VERIFY_DATE  date stamp used in verify/ file names (default: 2026-10-06)
"""
import os
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SITE = Path(os.environ.get("CFD_TV_SITE") or REPO).resolve()
DATA_DIRS = [Path(p).expanduser() for p in (os.environ.get("CFD_DATA_DIR") or str(REPO / "data" / "sources")).split(os.pathsep) if p]
TMP = Path(os.environ.get("CFD_TMP_DIR") or (REPO / "build" / ".cache"))
VERIFY_DATE = os.environ.get("CFD_VERIFY_DATE", "2026-10-06")


def site(*parts) -> Path:
    return SITE.joinpath(*parts)


def verify(kind: str) -> Path:
    """kind: 'yt-verified' | 'yt-oembed' | 'spotify-oembed'"""
    return SITE / "verify" / f"{kind}-{VERIFY_DATE}.json"


def tmp(name: str) -> Path:
    TMP.mkdir(parents=True, exist_ok=True)
    return TMP / name


def source(name: str) -> Path:
    """Find a source export by file name on the CFD_DATA_DIR search path."""
    for d in DATA_DIRS:
        p = d / name
        if p.exists():
            return p
    raise FileNotFoundError(
        f"{name} not found on CFD_DATA_DIR ({os.pathsep.join(map(str, DATA_DIRS))}). "
        "Copy it into data/sources/ or point CFD_DATA_DIR at the folder that has it."
    )
