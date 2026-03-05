#!/usr/bin/env python3
import argparse
import re
import sqlite3
from collections import Counter
from datetime import datetime
from pathlib import Path

import pdfplumber


DATE_FORMATS = [
    "%A, %B %d, %Y",
    "%A %B %d %Y",
]

TIME_AMPM_RE = re.compile(r"^(\d{1,4})(AM|PM)$", re.IGNORECASE)
TIME_NUMERIC_RE = re.compile(r"^\d{1,4}$")
REASON_PREFIX_RE = re.compile(r"^[A-Z]{3,6}\s*-\s*(.+)$")

ARREST_PATTERNS = [
    re.compile(r"\barrest(?:ed)?\b", re.IGNORECASE),
    re.compile(r"\btaken into custody\b", re.IGNORECASE),
    re.compile(r"\bplaced into custody\b", re.IGNORECASE),
    re.compile(r"\btransported to (?:the )?station\b", re.IGNORECASE),
    re.compile(r"\btot station\b", re.IGNORECASE),
    re.compile(r"\bbooked\b", re.IGNORECASE),
    re.compile(r"\bjuvenile detention\b", re.IGNORECASE),
]
ARREST_NEGATIVE_PATTERNS = [
    re.compile(r"\bnot arrested\b", re.IGNORECASE),
    re.compile(r"\bno arrest\b", re.IGNORECASE),
]


def clean_cell(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\n", " ")).strip()


def parse_date(date_text):
    text = clean_cell(date_text).replace(" ,", ",")
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    return None


def parse_time(raw_time):
    text = clean_cell(raw_time).upper().replace(" ", "")
    if not text:
        return None

    ampm = TIME_AMPM_RE.match(text)
    if ampm:
        digits = ampm.group(1)
        meridiem = ampm.group(2)
        if len(digits) <= 2:
            hour = int(digits)
            minute = 0
        elif len(digits) == 3:
            hour = int(digits[0])
            minute = int(digits[1:])
        else:
            hour = int(digits[:2])
            minute = int(digits[2:])
        if hour == 12:
            hour = 0
        if meridiem == "PM":
            hour += 12
        return f"{hour:02d}:{minute:02d}:00"

    if TIME_NUMERIC_RE.match(text):
        if len(text) <= 2:
            hour = int(text)
            minute = 0
        elif len(text) == 3:
            hour = int(text[0])
            minute = int(text[1:])
        else:
            hour = int(text[:2])
            minute = int(text[2:])
        return f"{hour:02d}:{minute:02d}:00"

    return None


def normalize_reason(raw_reason):
    text = clean_cell(raw_reason).upper()
    match = REASON_PREFIX_RE.match(text)
    if match:
        text = match.group(1).strip()
    text = (
        text.replace("SUSPCIOUS", "SUSPICIOUS")
        .replace("DESCRIPTOIN", "DESCRIPTION")
        .replace("PEROSN", "PERSON")
    )
    return text


def normalize_race(raw_race):
    text = clean_cell(raw_race)
    if not text:
        return text
    if "/" in text:
        return " / ".join(part.strip().title() for part in text.split("/"))
    return text.title()


def normalize_ethnic(raw_ethnic):
    text = clean_cell(raw_ethnic)
    if not text:
        return text
    if len(text) <= 2:
        return text.upper()
    if "/" in text:
        return " / ".join(part.strip().title() for part in text.split("/"))
    return text.title()


def normalize_sex(raw_sex):
    text = clean_cell(raw_sex).lower()
    if text.startswith("m"):
        return "M"
    if text.startswith("f"):
        return "F"
    return clean_cell(raw_sex)


def looks_like_sex(value):
    text = clean_cell(value).upper()
    return text in {"M", "F", "MALE", "FEMALE"}


def looks_like_reason(value):
    text = clean_cell(value).upper()
    if not text:
        return False
    markers = [
        "SUSP",
        "OTHER",
        "TRES",
        "LOCAL",
        "ORDINANCE",
        "AUTO",
        "WARNING",
        "INCIDENT",
        "ACTIVITY",
    ]
    return any(marker in text for marker in markers)


def map_cfs_vs_oi(officer_initiated, call_for_service):
    off_flag = "1" in clean_cell(officer_initiated)
    cfs_flag = "1" in clean_cell(call_for_service)
    if off_flag and not cfs_flag:
        return "Officer Initiated"
    if cfs_flag and not off_flag:
        return "Call for Service"
    if off_flag and cfs_flag:
        return "Officer Initiated"
    return "Call for Service"


def infer_arrest(narrative):
    text = clean_cell(narrative)
    if any(p.search(text) for p in ARREST_NEGATIVE_PATTERNS):
        return "N"
    if any(p.search(text) for p in ARREST_PATTERNS):
        return "Y"
    return "N"


def extract_records(pdf_path):
    records = []
    skipped_rows = 0

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            table = page.extract_table()
            if not table:
                continue
            for row_num, row in enumerate(table, start=1):
                cells = [clean_cell(cell) for cell in row]
                if not any(cells):
                    continue

                date_idx = None
                parsed_date = None
                for idx, cell in enumerate(cells):
                    dt = parse_date(cell)
                    if dt:
                        date_idx = idx
                        parsed_date = dt
                        break
                if date_idx is None:
                    continue

                # Ignore blank spacer columns and parse by ordered non-empty cells.
                tokens = [c for c in cells[date_idx:] if c]
                if len(tokens) < 7:
                    skipped_rows += 1
                    continue

                date_cell = tokens[0]
                time_cell = tokens[1]
                age_cell = tokens[2]
                race_cell = tokens[3]
                ethnic_cell = tokens[4]
                tail = tokens[5:]

                sex_cell = ""
                if tail and looks_like_sex(tail[0]):
                    sex_cell = tail[0]
                    tail = tail[1:]

                reason_idx = None
                for idx, tok in enumerate(tail):
                    if looks_like_reason(tok):
                        reason_idx = idx
                        break
                if reason_idx is None:
                    skipped_rows += 1
                    continue

                reason_cell = tail[reason_idx]
                post_reason = tail[reason_idx + 1 :]
                narrative_cell = post_reason[-1] if post_reason else ""
                if not narrative_cell:
                    skipped_rows += 1
                    continue

                parsed_time = parse_time(time_cell)
                if not parsed_time:
                    skipped_rows += 1
                    continue

                # Determine if the "1" marker is in officer-initiated or
                # call-for-service column based on its relative position.
                reason_col_idx = None
                for idx in range(date_idx, len(cells)):
                    if cells[idx] == reason_cell:
                        reason_col_idx = idx
                        break
                narrative_idx = max(
                    (idx for idx, val in enumerate(cells) if val),
                    default=-1,
                )
                marker_idxs = []
                if reason_col_idx is not None and narrative_idx > reason_col_idx:
                    for idx in range(reason_col_idx + 1, narrative_idx):
                        if cells[idx] in {"1", "I", "l"}:
                            marker_idxs.append(idx)
                off_marker = ""
                cfs_marker = ""
                if marker_idxs and reason_col_idx is not None and narrative_idx > reason_col_idx:
                    span = narrative_idx - reason_col_idx
                    for idx in marker_idxs:
                        ratio = (idx - reason_col_idx) / span
                        if ratio <= 0.5:
                            off_marker = "1"
                        else:
                            cfs_marker = "1"

                try:
                    age = int(re.sub(r"[^\d]", "", age_cell))
                except ValueError:
                    skipped_rows += 1
                    continue

                fc_date = f"{parsed_date.isoformat()}T{parsed_time}"
                source_sheet = parsed_date.strftime("%b %Y")
                sex = normalize_sex(sex_cell)
                reason = normalize_reason(reason_cell)
                race = normalize_race(race_cell)
                ethnic = normalize_ethnic(ethnic_cell)
                narrative = clean_cell(narrative_cell)

                if not narrative or not reason:
                    skipped_rows += 1
                    continue

                juvenile = "Juvenile" if age < 18 else "Not Juvenile"
                cfs_vs_oi = map_cfs_vs_oi(off_marker, cfs_marker)
                arrest = infer_arrest(narrative)

                records.append(
                    {
                        "fc_date": fc_date,
                        "fc_hour": parsed_time,
                        "age": age,
                        "sex": sex,
                        "ethnic": ethnic,
                        "race_ethnicity_group": race,
                        "juvenile": juvenile,
                        "reason": reason,
                        "arrest": arrest,
                        "cfs_vs_oi": cfs_vs_oi,
                        "narrative": narrative,
                        "source_sheet": source_sheet,
                        "_source": f"{pdf_path.name}:p{page_num}:r{row_num}",
                        "_raw_date": date_cell,
                    }
                )

    return records, skipped_rows


def insert_records(db_path, records):
    conn = sqlite3.connect(db_path)
    try:
        existing_before = {
            tuple(row)
            for row in conn.execute(
                """
                SELECT
                    fc_date, fc_hour, age, sex, ethnic, race_ethnicity_group, juvenile,
                    reason, arrest, cfs_vs_oi, narrative, source_sheet
                FROM stops
                """
            ).fetchall()
        }

        inserted = 0
        skipped_existing = 0
        with conn:
            for rec in records:
                key = (
                    rec["fc_date"],
                    rec["fc_hour"],
                    rec["age"],
                    rec["sex"],
                    rec["ethnic"],
                    rec["race_ethnicity_group"],
                    rec["juvenile"],
                    rec["reason"],
                    rec["arrest"],
                    rec["cfs_vs_oi"],
                    rec["narrative"],
                    rec["source_sheet"],
                )
                # Skip rows that already existed before this run, but allow
                # exact duplicates within the same source file.
                if key in existing_before:
                    skipped_existing += 1
                    continue
                conn.execute(
                    """
                    INSERT INTO stops (
                        fc_date, fc_hour, age, sex, ethnic, race_ethnicity_group,
                        juvenile, reason, arrest, cfs_vs_oi, narrative, source_sheet
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    key,
                )
                inserted += 1
        return inserted, skipped_existing
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Extract Q3/Q4 field contact PDFs and ingest into pedestrian-stops.db."
    )
    parser.add_argument(
        "--db",
        default="pedestrian-stops.db",
        help="Path to SQLite DB (default: pedestrian-stops.db)",
    )
    parser.add_argument(
        "--pdf",
        action="append",
        dest="pdfs",
        help="PDF file to ingest (can be used multiple times). Defaults to q3_field_stop.pdf and q4_field_stop.pdf.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and summarize only; do not insert into DB.",
    )
    args = parser.parse_args()

    db_path = Path(args.db)
    pdfs = [Path(p) for p in args.pdfs] if args.pdfs else [
        Path("q3_field_stop.pdf"),
        Path("q4_field_stop.pdf"),
    ]

    missing = [str(p) for p in pdfs if not p.exists()]
    if missing:
        raise SystemExit(f"Missing PDF(s): {', '.join(missing)}")
    if not db_path.exists():
        raise SystemExit(f"Missing SQLite DB: {db_path}")

    all_records = []
    total_skipped_parse = 0
    for pdf in pdfs:
        records, skipped = extract_records(pdf)
        all_records.extend(records)
        total_skipped_parse += skipped

    by_month = Counter(rec["source_sheet"] for rec in all_records)
    by_cfs_oi = Counter(rec["cfs_vs_oi"] for rec in all_records)
    by_arrest = Counter(rec["arrest"] for rec in all_records)

    print(f"Parsed records: {len(all_records)}")
    print(f"Skipped rows (parse issues): {total_skipped_parse}")
    print("Records by source_sheet:")
    for sheet in sorted(by_month):
        print(f"  {sheet}: {by_month[sheet]}")
    print("Records by cfs_vs_oi:")
    for label, count in by_cfs_oi.items():
        print(f"  {label}: {count}")
    print("Records by arrest:")
    for label, count in by_arrest.items():
        print(f"  {label}: {count}")

    if args.dry_run:
        return

    inserted, skipped_existing = insert_records(db_path, all_records)
    print(f"Inserted: {inserted}")
    print(f"Skipped existing: {skipped_existing}")


if __name__ == "__main__":
    main()
