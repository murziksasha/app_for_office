"""Vendor 120 static faces from one pinned Google Fonts revision.

The clone at %TEMP%\\folio-gf must already exist (depth 1, no checkout).
Blobs are read with git show so the working tree stays empty.
"""

from __future__ import annotations

import hashlib
import os
import re
import subprocess
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

REVISION = "6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec"
REPO = Path(os.environ["TEMP"]) / "folio-gf"
ROOT = Path(__file__).resolve().parents[1]
FILE_DIR = ROOT / "public" / "fonts" / "files"
LICENSE_DIR = ROOT / "public" / "fonts" / "licenses"
CATALOG_PATH = ROOT / "src" / "fonts" / "catalog.json"
FIXTURE_PATH = ROOT / "tests" / "fixtures" / "fonts"

SEEDS = [
    "Noto Sans",
    "Noto Serif",
    "Noto Sans Mono",
    "Inter",
    "Roboto",
    "Open Sans",
    "Montserrat",
    "Manrope",
    "Fira Code",
    "Source Serif 4",
]
CYCLE = ["serif", "sans-serif", "monospace", "display", "handwriting"]
CATEGORY_MAP = {
    "SERIF": "serif",
    "SANS_SERIF": "sans-serif",
    "MONOSPACE": "monospace",
    "DISPLAY": "display",
    "HANDWRITING": "handwriting",
}
REQUIRED = (
    "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ"
    "абвгґдеєжзиіїйклмнопрстуфхцчшщьюя"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    "0123456789"
    " .,;:!?\'\"()-/"
)
WIDTH_WORDS = (
    "condensed",
    "expanded",
    "compressed",
    "narrow",
    "ultra",
    "semicondensed",
    "semiexpanded",
)


BLOB_CACHE = Path(os.environ["TEMP"]) / "folio-font-blobs"


def git_bytes(path: str) -> bytes:
    key = hashlib.sha256(path.encode("utf-8")).hexdigest()
    cached = BLOB_CACHE / key
    if cached.exists():
        return cached.read_bytes()
    data = subprocess.check_output(
        ["git", "-C", str(REPO), "show", f"{REVISION}:{path}"],
        stderr=subprocess.DEVNULL,
    )
    BLOB_CACHE.mkdir(parents=True, exist_ok=True)
    cached.write_bytes(data)
    return data


def parse_metadata(text: str) -> dict | None:
    name = re.search(r'^name:\s*"([^"]+)"', text, re.M)
    category = re.search(r'^category:\s*"([^"]+)"', text, re.M)
    if not name or not category or category.group(1) not in CATEGORY_MAP:
        return None
    subsets = re.findall(r'^subsets:\s*"([^"]+)"', text, re.M)
    return {
        "family": name.group(1),
        "category": CATEGORY_MAP[category.group(1)],
        "subsets": subsets,
    }


def slug(family: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", family.lower()).strip("-")


def cmap_of(font: TTFont) -> set[int]:
    table = font.getBestCmap() or {}
    return set(table)


def covers(font: TTFont) -> bool:
    have = cmap_of(font)
    return all(ord(ch) in have for ch in REQUIRED)


def embedding(font: TTFont) -> str:
    fs = int(font["OS/2"].fsType) if "OS/2" in font else 0
    if fs & 0x0002:
        return "restricted"
    if fs & 0x0004:
        return "preview"
    if fs & 0x0008:
        return "editable"
    return "installable"


def set_names(font: TTFont, family: str, style: str) -> None:
    full = family if style == "Regular" else f"{family} {style}"
    ps = re.sub(r"[^A-Za-z0-9-]", "", f"{family}-{style}")
    name = font["name"]
    for name_id, value in (
        (1, family),
        (2, style),
        (4, full),
        (6, ps),
        (16, family),
        (17, style),
    ):
        name.setName(value, name_id, 3, 1, 0x409)
        try:
            name.setName(value, name_id, 1, 0, 0)
        except Exception:
            pass


def pin_axes(font: TTFont, weight: float) -> dict[str, float] | None:
    if "fvar" not in font:
        return {}
    loc: dict[str, float] = {}
    for axis in font["fvar"].axes:
        tag = axis.axisTag
        if tag == "wght":
            if weight > axis.maxValue + 0.1 and weight >= 650:
                return None
            loc[tag] = min(max(weight, axis.minValue), axis.maxValue)
        elif tag == "opsz":
            loc[tag] = min(max(14, axis.minValue), axis.maxValue)
        elif tag == "wdth":
            loc[tag] = min(max(100, axis.minValue), axis.maxValue)
        elif tag == "ital":
            loc[tag] = axis.defaultValue
        else:
            loc[tag] = axis.defaultValue
    return loc


def realize(raw: bytes, weight: int | None) -> TTFont | None:
    font = TTFont(io_bytes(raw))
    if weight is None or "fvar" not in font:
        return font
    loc = pin_axes(font, weight)
    if loc is None:
        return None
    if not loc:
        return font
    return instantiateVariableFont(font, loc, inplace=False, overlap=True)


def io_bytes(raw: bytes):
    import io

    return io.BytesIO(raw)


def is_width_variant(name: str) -> bool:
    stem = Path(name).stem.lower().replace(" ", "")
    return any(word in stem for word in WIDTH_WORDS)


def static_style(name: str) -> str | None:
    if is_width_variant(name):
        return None
    stem = Path(name).stem.lower()
    stem = stem.replace("_", "-")
    if "bolditalic" in stem or "bold-italic" in stem:
        return "boldItalic"
    if stem.endswith("-bold") or stem.endswith("bold"):
        if "italic" in stem:
            return "boldItalic"
        return "bold"
    if stem.endswith("-italic") or stem.endswith("italic"):
        return "italic"
    if stem.endswith("-regular") or stem.endswith("regular"):
        return "regular"
    return None


def choose_sources(paths: list[str]) -> dict[str, tuple[str, int | None]]:
    fonts = [p for p in paths if p.lower().endswith((".ttf", ".otf"))]
    static = [p for p in fonts if "/static/" in p.replace("\\", "/")]
    chosen: dict[str, tuple[str, int | None]] = {}
    for path in static:
        style = static_style(path)
        if style and style not in chosen:
            chosen[style] = (path, None)
    if "regular" in chosen:
        return chosen
    roman = [
        p
        for p in fonts
        if "/static/" not in p.replace("\\", "/")
        and "[" in Path(p).name
        and "italic" not in Path(p).name.lower()
    ]
    italic = [
        p
        for p in fonts
        if "/static/" not in p.replace("\\", "/")
        and "[" in Path(p).name
        and "italic" in Path(p).name.lower()
    ]
    roman.sort(key=lambda p: len(Path(p).name))
    italic.sort(key=lambda p: len(Path(p).name))
    if not roman:
        return {}
    out = {
        "regular": (roman[0], 400),
        "bold": (roman[0], 700),
    }
    if italic:
        out["italic"] = (italic[0], 400)
        out["boldItalic"] = (italic[0], 700)
    return out


def license_path(paths: list[str]) -> str | None:
    for name in ("OFL.txt", "LICENSE.txt", "LICENSE"):
        for path in paths:
            if Path(path).name.upper() == name.upper():
                return path
    return None


def spdx(text: str) -> str:
    if "SIL Open Font License" in text:
        return "OFL-1.1"
    if "Apache License" in text:
        return "Apache-2.0"
    return "custom"


def build_face(raw: bytes, weight: int | None, family: str, style: str) -> tuple[bytes, dict] | None:
    style_name = {
        "regular": "Regular",
        "bold": "Bold",
        "italic": "Italic",
        "boldItalic": "Bold Italic",
    }[style]
    try:
        font = realize(raw, weight)
    except Exception as err:
        print(f"  instance failed {family} {style}: {err}")
        return None
    if font is None:
        return None
    try:
        if not covers(font):
            return None
        embed = embedding(font)
        if embed == "restricted":
            return None
        set_names(font, family, style_name)
        import io

        buf = io.BytesIO()
        font.save(buf)
        data = buf.getvalue()
    except Exception as err:
        print(f"  save failed {family} {style}: {err}")
        return None
    info = {
        "style": style,
        "weight": 700 if style in ("bold", "boldItalic") else 400,
        "italic": style in ("italic", "boldItalic"),
        "embedding": embed,
        "sha256": hashlib.sha256(data).hexdigest(),
    }
    return data, info


def write_partial_fixture() -> None:
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    FIXTURE_PATH.mkdir(parents=True, exist_ok=True)

    def pen_for(name: str):
        pen = TTGlyphPen(None)
        if name == "A":
            pen.moveTo((50, 0))
            pen.lineTo((450, 0))
            pen.lineTo((250, 700))
            pen.closePath()
        elif name == "space":
            pass
        return pen.glyph()

    fb = FontBuilder(1000, isTTF=True)
    order = [".notdef", "space", "A"]
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({32: "space", 65: "A"})
    fb.setupGlyf({name: pen_for(name) for name in order})
    fb.setupHorizontalMetrics({name: (500, 50) for name in order})
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({"familyName": "Folio Partial", "styleName": "Regular"})
    fb.setupOS2()
    fb.setupPost()
    fb.save(str(FIXTURE_PATH / "partial-latin.ttf"))

    fb2 = FontBuilder(1000, isTTF=True)
    fb2.setupGlyphOrder(order)
    fb2.setupCharacterMap({32: "space", 65: "A"})
    metrics = {name: (500, 50) for name in order}
    metrics["A"] = (520, 50)
    fb2.setupGlyf({name: pen_for(name) for name in order})
    fb2.setupHorizontalMetrics(metrics)
    fb2.setupHorizontalHeader(ascent=800, descent=-200)
    fb2.setupNameTable({"familyName": "Folio Partial", "styleName": "Regular"})
    fb2.setupOS2()
    fb2.setupPost()
    fb2.save(str(FIXTURE_PATH / "partial-latin-conflict.ttf"))
    (FIXTURE_PATH / "not-a-font.bin").write_bytes(b"this is not a font")


def main() -> int:
    head = subprocess.check_output(["git", "-C", str(REPO), "rev-parse", "HEAD"], text=True).strip()
    if head != REVISION:
        print(f"Expected {REVISION}, clone is {head}", file=sys.stderr)
        return 1
    listing = subprocess.check_output(
        ["git", "-C", str(REPO), "ls-tree", "-r", "--name-only", REVISION],
        text=True,
        encoding="utf-8",
    )
    paths = [line.strip() for line in listing.splitlines() if line.strip()]
    by_dir: dict[str, list[str]] = {}
    metas: list[str] = []
    for path in paths:
        if path.endswith("/METADATA.pb") or path.endswith("METADATA.pb"):
            metas.append(path)
        parent = path.rsplit("/", 1)[0]
        by_dir.setdefault(parent, []).append(path)

    families: dict[str, dict] = {}
    print(f"Reading {len(metas)} metadata files")
    for index, meta_path in enumerate(metas, 1):
        if index % 400 == 0:
            print(f"  metadata {index}/{len(metas)}")
        try:
            text = git_bytes(meta_path).decode("utf-8", "replace")
        except subprocess.CalledProcessError:
            continue
        parsed = parse_metadata(text)
        if not parsed:
            continue
        if "cyrillic" not in parsed["subsets"]:
            continue
        directory = meta_path.rsplit("/", 1)[0]
        parsed["dir"] = directory
        parsed["files"] = by_dir.get(directory, [])
        families[parsed["family"]] = parsed

    print(f"Cyrillic candidates: {len(families)}")
    selected: list[dict] = []
    seen: set[str] = set()

    def accept(meta: dict) -> bool:
        if meta["family"] in seen:
            return False
        sources = choose_sources(meta["files"])
        if "regular" not in sources:
            print(f"  skip {meta['family']}: no regular source")
            return False
        lic = license_path(meta["files"])
        if not lic:
            print(f"  skip {meta['family']}: no license")
            return False
        cache: dict[str, bytes] = {}
        faces = []
        face_bytes: list[tuple[str, bytes]] = []
        for style in ("regular", "bold", "italic", "boldItalic"):
            if style not in sources:
                continue
            src, weight = sources[style]
            if src not in cache:
                try:
                    cache[src] = git_bytes(src)
                except subprocess.CalledProcessError as err:
                    print(f"  skip {meta['family']}: cannot read {src} ({err})")
                    return False
            built = build_face(cache[src], weight, meta["family"], style)
            if built is None:
                if style == "regular":
                    print(f"  skip {meta['family']}: regular failed coverage or embedding")
                    return False
                continue
            data, info = built
            file_name = f"{slug(meta['family'])}-{style}.ttf"
            info["file"] = file_name
            faces.append(info)
            face_bytes.append((file_name, data))
        if not any(face["style"] == "regular" for face in faces):
            return False
        license_text = git_bytes(lic)
        selected.append(
            {
                "family": meta["family"],
                "category": meta["category"],
                "license": spdx(license_text.decode("utf-8", "replace")),
                "licenseFile": f"{slug(meta['family'])}.txt",
                "licenseBytes": license_text,
                "coverage": "full",
                "faces": faces,
                "faceBytes": face_bytes,
            }
        )
        seen.add(meta["family"])
        print(f"  accepted {len(selected):03d} {meta['family']} ({len(faces)} faces)")
        return True

    for seed in SEEDS:
        meta = families.get(seed)
        if not meta:
            print(f"Seed missing from candidates: {seed}", file=sys.stderr)
            return 1
        if not accept(meta):
            print(f"Seed rejected: {seed}", file=sys.stderr)
            return 1

    grouped = {cat: [] for cat in CYCLE}
    for meta in families.values():
        if meta["family"] in seen:
            continue
        grouped[meta["category"]].append(meta)
    for cat in CYCLE:
        grouped[cat].sort(key=lambda item: item["family"].lower())
    pointers = {cat: 0 for cat in CYCLE}

    while len(selected) < 120:
        progressed = False
        for cat in CYCLE:
            if len(selected) >= 120:
                break
            items = grouped[cat]
            while pointers[cat] < len(items):
                meta = items[pointers[cat]]
                pointers[cat] += 1
                if meta["family"] in seen:
                    continue
                progressed = True
                accept(meta)
                break
        if not progressed:
            break

    if len(selected) < 120:
        print(f"Only selected {len(selected)} families", file=sys.stderr)
        return 1

    if FILE_DIR.exists():
        for child in FILE_DIR.glob("*.ttf"):
            child.unlink()
    if LICENSE_DIR.exists():
        for child in LICENSE_DIR.glob("*.txt"):
            child.unlink()
    FILE_DIR.mkdir(parents=True, exist_ok=True)
    LICENSE_DIR.mkdir(parents=True, exist_ok=True)

    catalog_families = []
    for entry in selected:
        (LICENSE_DIR / entry["licenseFile"]).write_bytes(entry["licenseBytes"])
        for file_name, data in entry["faceBytes"]:
            (FILE_DIR / file_name).write_bytes(data)
        catalog_families.append(
            {
                "family": entry["family"],
                "category": entry["category"],
                "license": entry["license"],
                "licenseFile": entry["licenseFile"],
                "coverage": "full",
                "faces": entry["faces"],
            }
        )

    import json

    catalog = {
        "revision": REVISION,
        "source": "https://github.com/google/fonts",
        "families": catalog_families,
    }
    CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_PATH.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    write_partial_fixture()
    print(f"Wrote {len(catalog_families)} families to {CATALOG_PATH}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as err:
        print(err, file=sys.stderr)
        raise
