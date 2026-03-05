#!/usr/bin/env python3
import argparse
import csv
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.request import urlopen


DEFAULT_SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1aFVlaOqM4NeOZuB5DGw9v5xIequI-lY_JmmGN3Jr_UM/"
    "export?format=csv&gid=23324634"
)

REASON_MAP = {
    "JUNK": "JUNKING",
    "LOCA": "LOCAL ORDINANCE VIOLATION",
    "OTHE": "OTHER",
    "PANH": "PANHANDLING",
    "SOLI": "SOLICITATION",
    "SPER": "SUSPICIOUS PERSON",
    "SUSA": "SUSPICIOUS AUTO",
    "SUSI": "SUSPICIOUS INCIDENT",
    "SUSP": "SUSPICIOUS ACTIVITY",
    "TRES": "TRESPASS",
}

RACE_MAP = {
    "A": "Asian",
    "B": "Black",
    "H": "White",
    "I": "American Indian / Alaska Native",
    "U": "Unknown",
    "W": "White",
}


@dataclass
class StopRecord:
    fc_date: str
    fc_hour: str
    age: Optional[int]
    sex: str
    ethnic: str
    race_ethnicity_group: str
    juvenile: str
    reason: str
    arrest: str
    cfs_vs_oi: str
    narrative: str
    source_sheet: str


def clean(value: Optional[str]) -> str:
    return (value or "").strip()


def parse_time_code(raw_time: str) -> Optional[str]:
    text = clean(raw_time)
    if not text:
        return None
    digits = "".join(ch for ch in text if ch.isdigit())
    if not digits:
        return None
    if len(digits) <= 2:
        hour = int(digits)
        minute = 0
    elif len(digits) == 3:
        hour = int(digits[0])
        minute = int(digits[1:])
    else:
        hour = int(digits[:2])
        minute = int(digits[2:4])
    if hour > 23 or minute > 59:
        return None
    return f"{hour:02d}:{minute:02d}:00"


def parse_fc_datetime(fcdate: str, fctime: str) -> Optional[datetime]:
    text = clean(fcdate)
    if not text:
        return None

    # First try full datetime from Fcdate.
    for fmt in ("%m/%d/%y %H:%M", "%m/%d/%Y %H:%M"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            pass

    # Then parse date only and combine with Fctime.
    parsed_date = None
    for fmt in ("%m/%d/%y", "%m/%d/%Y"):
        try:
            parsed_date = datetime.strptime(text, fmt).date()
            break
        except ValueError:
            pass
    if parsed_date is None:
        return None

    parsed_time = parse_time_code(fctime) or "00:00:00"
    hour, minute, second = [int(x) for x in parsed_time.split(":")]
    return datetime(
        parsed_date.year,
        parsed_date.month,
        parsed_date.day,
        hour,
        minute,
        second,
    )


def map_race_and_ethnicity(raw_race: str) -> tuple[str, str]:
    code = clean(raw_race).upper()
    race_group = RACE_MAP.get(code)
    if race_group is None:
        race_group = "Unknown" if not code else code.title()

    if code == "H":
        ethnic = "H"
    elif code in {"", "U"}:
        ethnic = "U"
    else:
        ethnic = "N"
    return race_group, ethnic


def map_reason(raw_reason: str) -> str:
    code = clean(raw_reason).upper()
    if not code:
        return "UNKNOWN"
    return REASON_MAP.get(code, code)


def map_sex(raw_sex: str) -> str:
    code = clean(raw_sex).upper()
    if code in {"M", "F"}:
        return code
    return "U"


def parse_age(raw_age: str) -> Optional[int]:
    text = clean(raw_age)
    if not text:
        return None
    if text.isdigit():
        return int(text)
    return None


def juvenile_from_age(age: Optional[int]) -> str:
    if age is None:
        return "Unknown"
    return "Juvenile" if age < 18 else "Not Juvenile"


def build_narrative(row: dict[str, str]) -> str:
    name_id = clean(row.get("Name Id"))
    street_nbr = clean(row.get("Streetnbr"))
    street = clean(row.get("Street"))
    city = clean(row.get("City"))
    state = clean(row.get("State"))
    zip_code = clean(row.get("Zip"))
    zone = clean(row.get("Zone"))
    reason_code = clean(row.get("Reasoncode")).upper()

    address_parts = [part for part in [street_nbr, street] if part]
    locality_parts = [part for part in [city, state, zip_code] if part]
    address = " ".join(address_parts).strip()
    locality = ", ".join(locality_parts).strip()

    details = [f"Legacy import record ({reason_code or 'UNKNOWN'})."]
    if name_id:
        details.append(f"name_id={name_id}.")
    if address:
        details.append(f"location={address}.")
    if locality:
        details.append(f"locality={locality}.")
    if zone:
        details.append(f"zone={zone}.")
    return " ".join(details)


def row_to_record(row: dict[str, str]) -> Optional[StopRecord]:
    parsed_dt = parse_fc_datetime(row.get("Fcdate", ""), row.get("Fctime", ""))
    if parsed_dt is None:
        return None

    age = parse_age(row.get("Age", ""))
    race_group, ethnic = map_race_and_ethnicity(row.get("Race", ""))
    reason = map_reason(row.get("Reasoncode", ""))

    return StopRecord(
        fc_date=parsed_dt.strftime("%Y-%m-%dT%H:%M:%S"),
        fc_hour=parsed_dt.strftime("%H:%M:%S"),
        age=age,
        sex=map_sex(row.get("Sex", "")),
        ethnic=ethnic,
        race_ethnicity_group=race_group,
        juvenile=juvenile_from_age(age),
        reason=reason,
        arrest="Unknown",
        cfs_vs_oi="Unknown",
        narrative=build_narrative(row),
        source_sheet=parsed_dt.strftime("%b %Y"),
    )


def fetch_rows(sheet_url: str) -> list[dict[str, str]]:
    with urlopen(sheet_url) as response:
        text = response.read().decode("utf-8-sig")
    reader = csv.DictReader(text.splitlines())
    return [dict(row) for row in reader]


def insert_records(
    db_path: Path,
    records: list[StopRecord],
    allow_existing_legacy: bool,
) -> tuple[int, int]:
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        if not allow_existing_legacy:
            cur.execute(
                "SELECT COUNT(*) FROM stops WHERE fc_date < '2021-01-01T00:00:00'"
            )
            existing = cur.fetchone()[0]
            if existing > 0:
                raise RuntimeError(
                    "Legacy records already exist (fc_date < 2021-01-01). "
                    "Use --allow-existing-legacy to append anyway."
                )

        inserted = 0
        for rec in records:
            cur.execute(
                """
                INSERT INTO stops (
                    fc_date, fc_hour, age, sex, ethnic, race_ethnicity_group,
                    juvenile, reason, arrest, cfs_vs_oi, narrative, source_sheet
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    rec.fc_date,
                    rec.fc_hour,
                    rec.age,
                    rec.sex,
                    rec.ethnic,
                    rec.race_ethnicity_group,
                    rec.juvenile,
                    rec.reason,
                    rec.arrest,
                    rec.cfs_vs_oi,
                    rec.narrative,
                    rec.source_sheet,
                ),
            )
            inserted += 1

        conn.commit()
        cur.execute("SELECT COUNT(*) FROM stops")
        total = cur.fetchone()[0]
        return inserted, total
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import 2015-2020 legacy Google Sheet rows into pedestrian-stops.db"
    )
    parser.add_argument(
        "--db",
        default="pedestrian-stops.db",
        help="Path to SQLite DB (default: pedestrian-stops.db)",
    )
    parser.add_argument(
        "--sheet-url",
        default=DEFAULT_SHEET_URL,
        help="Google Sheet CSV export URL",
    )
    parser.add_argument(
        "--allow-existing-legacy",
        action="store_true",
        help="Allow import even if pre-2021 rows already exist",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and map rows without writing to DB",
    )
    args = parser.parse_args()

    rows = fetch_rows(args.sheet_url)
    records: list[StopRecord] = []
    skipped = 0
    for row in rows:
        rec = row_to_record(row)
        if rec is None:
            skipped += 1
            continue
        records.append(rec)

    if not records:
        raise RuntimeError("No rows could be parsed from the sheet")

    min_date = min(r.fc_date for r in records)
    max_date = max(r.fc_date for r in records)

    if args.dry_run:
        print(
            f"Dry run parsed {len(records)} rows (skipped {skipped}); "
            f"date range {min_date} .. {max_date}"
        )
        return

    inserted, total = insert_records(
        db_path=Path(args.db),
        records=records,
        allow_existing_legacy=args.allow_existing_legacy,
    )
    print(f"Inserted {inserted} rows (skipped {skipped}) into {args.db}")
    print(f"Mapped date range: {min_date} .. {max_date}")
    print(f"Total rows in stops: {total}")


if __name__ == "__main__":
    main()
