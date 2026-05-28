#!/usr/bin/env python3
"""
Replace the embedded Histogram+ custom visual inside the demo .pbix with
the freshly built .pbiviz, without opening Power BI Desktop.

Usage:
    python3 demo/update-pbix-visual.py
"""
import json
import shutil
import sys
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ONEDRIVE_PBIX = Path(
    "/mnt/c/Users/MKorb/OneDrive/01 Travel and work/01 MKO Contracting/04 AI stuff/AIprojects/projects/powerbi visuals/visuals/histogram-plus/demo.pbix"
)
GUID = "histogramPlus46DE41859B994C119A79AF0AC250DD22"
CV_DIR = f"Report/CustomVisuals/{GUID}"
RESOURCE_PATH = f"{CV_DIR}/resources/{GUID}.pbiviz.json"
PACKAGE_PATH = f"{CV_DIR}/package.json"


def find_latest_pbiviz() -> Path:
    dist = REPO / "dist"
    candidates = list(dist.glob(f"{GUID}.*.pbiviz"))
    if not candidates:
        sys.exit(f"no .pbiviz found in {dist}")
    def version_key(p: Path) -> tuple[int, ...]:
        stem = p.name.removeprefix(f"{GUID}.").removesuffix(".pbiviz")
        return tuple(int(part) for part in stem.split("."))
    candidates.sort(key=version_key)
    return candidates[-1]


def read_pbiviz_contents(pbiviz_path: Path) -> tuple[dict, dict]:
    """Open a .pbiviz (zip) and return (package.json, pbiviz.json)."""
    with zipfile.ZipFile(pbiviz_path) as z:
        package = json.loads(z.read("package.json"))
        # Locate the embedded pbiviz.json resource referenced by package.json
        resource_id = package["metadata"]["pbivizjson"]["resourceId"]
        resource_file = next(
            r["file"] for r in package["resources"] if r["resourceId"] == resource_id
        )
        pbiviz_json = json.loads(z.read(resource_file))
    return package, pbiviz_json


def update_pbix(pbix_path: Path, package: dict, pbiviz_json: dict) -> None:
    tmp_path = pbix_path.with_suffix(".pbix.tmp")
    package_bytes = json.dumps(package, separators=(",", ":")).encode()
    pbiviz_bytes = json.dumps(pbiviz_json, separators=(",", ":")).encode()
    with zipfile.ZipFile(pbix_path) as src, zipfile.ZipFile(
        tmp_path, "w", zipfile.ZIP_DEFLATED
    ) as dst:
        for info in src.infolist():
            if info.filename == PACKAGE_PATH:
                dst.writestr(info.filename, package_bytes)
            elif info.filename == RESOURCE_PATH:
                dst.writestr(info.filename, pbiviz_bytes)
            else:
                dst.writestr(info, src.read(info.filename))
    shutil.move(str(tmp_path), str(pbix_path))


def main() -> None:
    pbiviz_path = find_latest_pbiviz()
    if not ONEDRIVE_PBIX.exists():
        sys.exit(f"demo .pbix not found at {ONEDRIVE_PBIX}")
    package, pbiviz_json = read_pbiviz_contents(pbiviz_path)
    version = package["visual"]["version"]
    update_pbix(ONEDRIVE_PBIX, package, pbiviz_json)
    print(f"updated {ONEDRIVE_PBIX.name} with visual version {version}")
    print(f"source: {pbiviz_path.name}")


if __name__ == "__main__":
    main()
