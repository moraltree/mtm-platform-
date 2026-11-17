#!/usr/bin/env python3
"""Merlin's Story Factory - Hickory Hollow manuscript tooling.

Deterministic helpers so that word counts, chapter counts and checksums in
the production register come from the actual files rather than estimates.

Commands
--------
build    SOURCE.txt OUT.docx --ref HH-S01-001 --title "..." --created 2026-11-17 [--revised DATE]
         Build a Word manuscript from a plain-text source.
count    FILE.docx|FILE.txt [--json]
         Count chapters and narrated words; exit 1 if outside the rules.
freeze   FILE.docx
         Print SHA-256 of the narrated text and of the file bytes.
register OUT.xlsx --season 1|2
         Build an empty 30-story production register workbook.

Source format (plain UTF-8 text)
--------------------------------
    Chapter One — The Morning of the Crack
    <blank line>
    Paragraph text...
    <blank line>
    Paragraph text...

A line matching ``Chapter <One..Ten> — <heading>`` starts a chapter. Every
other non-blank block is one narrated paragraph. The title, copyright block,
chapter headings and "The End" are added by ``build`` and are never counted.

Narrated-word rule
------------------
Narrated words are the whitespace-separated tokens of chapter body
paragraphs that contain at least one letter or digit. Hyphenated and
apostrophe words count once ("cheek-pouch" = 1, "Grandpappy's" = 1).
Excluded: title, copyright/licensing block, story reference, chapter
headings, "The End", and anything after it.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

MIN_WORDS, MAX_WORDS, CHAPTERS = 5000, 6000, 10
WPM = 180
NUMBERS = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"]
CHAPTER_RE = re.compile(r"^Chapter\s+(" + "|".join(NUMBERS) + r")\s+[—-]\s+\S", re.I)
WORD_RE = re.compile(r"[A-Za-z0-9]")

# Copyright and licensing block, copied from the archived Season One masters.
# It was not written here. Change it only on a founder or legal instruction.
COPYRIGHT_LINES = [
    "Copyright © Stuart Taylor, 2026. All rights reserved.",
    "Moral Tree Media FZ-LLC — Authorised worldwide licensee.",
]

STATUSES = [
    "AWAITING TITLE / BRIEF",
    "CONCEPT READY",
    "DRAFT IN PROGRESS",
    "EDITORIAL REVIEW",
    "REVISION REQUIRED",
    "TRIPLE-LOCK PASS — AWAITING FOUNDER APPROVAL",
    "FOUNDER APPROVED",
    "PRODUCTION READY",
]


def count_words(text: str) -> int:
    return sum(1 for tok in text.split() if WORD_RE.search(tok))


def parse_source(text: str) -> list[tuple[str, list[str]]]:
    """Plain-text source -> [(chapter heading, [paragraphs])]."""
    chapters: list[tuple[str, list[str]]] = []
    for block in re.split(r"\n\s*\n", text.replace("\r\n", "\n")):
        block = " ".join(line.strip() for line in block.strip().splitlines())
        if not block:
            continue
        if CHAPTER_RE.match(block):
            chapters.append((block, []))
        elif chapters:
            if block.strip().lower() == "the end":
                break
            chapters[-1][1].append(block)
        else:
            raise SystemExit(f"Text found before the first chapter heading: {block[:60]!r}")
    return chapters


def parse_docx(path: Path) -> list[tuple[str, list[str]]]:
    import docx  # python-docx

    chapters: list[tuple[str, list[str]]] = []
    for para in docx.Document(str(path)).paragraphs:
        text = para.text.strip()
        if not text:
            continue
        if CHAPTER_RE.match(text):
            chapters.append((text, []))
        elif chapters:
            if text.lower() == "the end":
                break
            chapters[-1][1].append(text)
    return chapters


def load(path: Path) -> list[tuple[str, list[str]]]:
    if path.suffix.lower() == ".docx":
        return parse_docx(path)
    return parse_source(path.read_text(encoding="utf-8"))


def narrated_text(chapters: list[tuple[str, list[str]]]) -> str:
    out: list[str] = []
    for heading, paras in chapters:
        out.append(heading)
        out.extend(paras)
    return "\n".join(out) + "\n"


def report(chapters: list[tuple[str, list[str]]]) -> dict:
    per = [count_words(" ".join(p)) for _, p in chapters]
    total = sum(per)
    expected = [f"Chapter {n}" for n in NUMBERS]
    order_ok = [h.split("—")[0].split(" -")[0].strip().title() for h, _ in chapters] == expected
    problems = []
    if len(chapters) != CHAPTERS:
        problems.append(f"{len(chapters)} chapters (must be exactly {CHAPTERS})")
    elif not order_ok:
        problems.append("chapters are not numbered One to Ten in order")
    if total < MIN_WORDS:
        problems.append(f"{total} narrated words (minimum {MIN_WORDS})")
    if total > MAX_WORDS:
        problems.append(f"{total} narrated words (maximum {MAX_WORDS})")
    empty = [i + 1 for i, (_, p) in enumerate(chapters) if not p]
    if empty:
        problems.append(f"empty chapters: {empty}")
    return {
        "chapters": len(chapters),
        "per_chapter_words": per,
        "narrated_words": total,
        "minutes_at_180wpm": round(total / WPM, 1),
        "pass": not problems,
        "problems": problems,
    }


def cmd_count(args: argparse.Namespace) -> int:
    r = report(load(Path(args.file)))
    if args.json:
        print(json.dumps(r, indent=2))
    else:
        for i, w in enumerate(r["per_chapter_words"], 1):
            print(f"  Chapter {i:>2}: {w:>5} words")
        print(f"Chapters: {r['chapters']}  Narrated words: {r['narrated_words']}  "
              f"(~{r['minutes_at_180wpm']} min at {WPM} wpm)")
        print("STRUCTURE PASS" if r["pass"] else "STRUCTURE FAIL: " + "; ".join(r["problems"]))
    return 0 if r["pass"] else 1


def cmd_freeze(args: argparse.Namespace) -> int:
    path = Path(args.file)
    text = narrated_text(load(path))
    print("narrated_text_sha256", hashlib.sha256(text.encode("utf-8")).hexdigest())
    print("file_sha256         ", hashlib.sha256(path.read_bytes()).hexdigest())
    return 0


def cmd_build(args: argparse.Namespace) -> int:
    import docx
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Pt

    chapters = parse_source(Path(args.source).read_text(encoding="utf-8"))
    r = report(chapters)
    if not r["pass"] and not args.allow_fail:
        print("Refusing to build: " + "; ".join(r["problems"]), file=sys.stderr)
        return 1

    d = docx.Document()
    style = d.styles["Normal"]
    style.font.name = "Georgia"
    style.font.size = Pt(12)

    d.add_heading(args.title, level=0).alignment = WD_ALIGN_PARAGRAPH.CENTER
    for line in COPYRIGHT_LINES:
        d.add_paragraph(line).alignment = WD_ALIGN_PARAGRAPH.CENTER
    d.add_paragraph(f"Original creation date: {args.created}")
    d.add_paragraph(f"Revision date: {args.revised or args.created}")
    d.add_paragraph(f"Story reference: {args.ref}")

    for heading, paras in chapters:
        d.add_heading(heading, level=1)
        for p in paras:
            d.add_paragraph(p)
    d.add_paragraph("The End").alignment = WD_ALIGN_PARAGRAPH.CENTER

    d.core_properties.title = args.title
    d.core_properties.author = "Moral Tree Media FZ-LLC"
    d.core_properties.subject = args.ref
    d.save(args.out)

    # Re-open what was written and confirm nothing was lost on the way.
    back = report(parse_docx(Path(args.out)))
    if back["narrated_words"] != r["narrated_words"] or back["chapters"] != r["chapters"]:
        print("Built file does not match its source", file=sys.stderr)
        return 1
    print(f"Built {args.out}: {back['chapters']} chapters, {back['narrated_words']} narrated words")
    return 0


REGISTER_COLUMNS = [
    "Story ref", "Season", "No.", "Approved title", "Status", "Lead character(s)",
    "Supporting characters", "Primary moral lesson", "Secondary educational theme",
    "Season / setting", "Manuscript version", "Created", "Last revised",
    "Narrated words (counted)", "Chapters (counted)", "Piers score /10", "Lock 1 result",
    "Lock 2 result", "Lock 3 result", "Mira revisions", "Sherlock checks",
    "Outstanding exceptions", "Drive file name", "Drive file ID",
    "Narrated-text SHA-256", "File SHA-256", "Download-back verified",
    "Founder approval status", "Founder approval date / reference", "Notes",
]


def cmd_register(args: argparse.Namespace) -> int:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.worksheet.datavalidation import DataValidation

    s = int(args.season)
    wb = Workbook()
    ws = wb.active
    ws.title = f"Season {s:02d} register"
    ws.append(REGISTER_COLUMNS)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="3B5B3A")
        c.alignment = Alignment(wrap_text=True, vertical="top")
    for n in range(1, 31):
        ws.append([f"HH-S{s:02d}-{n:03d}", s, n, "", STATUSES[0]] + [""] * (len(REGISTER_COLUMNS) - 6)
                  + ["Not approved"])
    ws.freeze_panes = "E2"
    ws.auto_filter.ref = ws.dimensions
    widths = {"A": 13, "B": 7, "C": 5, "D": 36, "E": 30}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    dv = DataValidation(type="list", formula1='"' + ",".join(STATUSES) + '"', allow_blank=False)
    ws.add_data_validation(dv)
    dv.add(f"E2:E31")

    key = wb.create_sheet("Status key and rules")
    rows = [
        ["Status", "Meaning"],
        [STATUSES[0], "No founder-approved title or brief yet."],
        [STATUSES[1], "Edison concept and ten-chapter outline checked by Moneypenny and Merlin."],
        [STATUSES[2], "Roald Dahl drafting the full manuscript."],
        [STATUSES[3], "Lock One (Piers) and/or Locks Two and Three under way."],
        [STATUSES[4], "A lock found a defect; correction assigned to Roald Dahl or Mira."],
        [STATUSES[5], "All three locks passed and recorded. NOT founder approval."],
        [STATUSES[6], "Set ONLY after an explicit decision by Stuart Taylor, with its date/reference."],
        [STATUSES[7], "Founder-approved and handed over for downstream stages, when authorised."],
        [],
        ["Rule", "Detail"],
        ["Structure", "Exactly 10 chapters; 5,000-6,000 narrated words (target 5,300-5,700), counted by hh_factory.py."],
        ["Lock One", "Piers Morgan literary score at least 8.5/10."],
        ["Lock Two", "Moneypenny canon/continuity plus Sherlock facts. Bible v1.1 cast; v1.0 world rules."],
        ["Lock Three", "Dr Noura safeguarding and bedtime suitability plus narration readiness. A safeguarding failure blocks."],
        ["Independence", "Role assessments are made by one AI system in separate review passes. They are not independent human reviews."],
        ["Archives", "Never delete, overwrite, revise or restore archived manuscripts."],
    ]
    for r in rows:
        key.append(r)
    key.column_dimensions["A"].width = 46
    key.column_dimensions["B"].width = 110

    cp = wb.create_sheet("Batch checkpoints")
    cp.append(["Batch", "Date", "Stories", "Completed", "Word counts", "Triple-Lock results",
               "Saved locations", "Outstanding corrections", "Founder approvals pending",
               "Next in sequence", "Resource notes (Scrooge)"])
    wb.save(args.out)
    print(f"Built {args.out}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("build")
    b.add_argument("source")
    b.add_argument("out")
    b.add_argument("--ref", required=True)
    b.add_argument("--title", required=True)
    b.add_argument("--created", required=True)
    b.add_argument("--revised")
    b.add_argument("--allow-fail", action="store_true", help="build a draft even if structure fails")
    b.set_defaults(fn=cmd_build)

    c = sub.add_parser("count")
    c.add_argument("file")
    c.add_argument("--json", action="store_true")
    c.set_defaults(fn=cmd_count)

    f = sub.add_parser("freeze")
    f.add_argument("file")
    f.set_defaults(fn=cmd_freeze)

    r = sub.add_parser("register")
    r.add_argument("out")
    r.add_argument("--season", required=True, choices=["1", "2"])
    r.set_defaults(fn=cmd_register)

    args = p.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
