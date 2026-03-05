export interface Stop {
  id: number;
  fc_date: string;
  fc_hour: string;
  age: number;
  sex: string;
  ethnic: string;
  race_ethnicity_group: string;
  juvenile: string;
  reason: string;
  arrest: string;
  cfs_vs_oi: string;
  narrative: string;
  source_sheet: string;
}

export interface Filters {
  year: string[];
  race: string[];
  sex: string[];
  reason: string[];
  arrest: string[];
  cfs_vs_oi: string[];
  juvenile: string[];
  month: string[];
  hour: string[];
  day: string[];
}

export const FILTER_KEYS: (keyof Filters)[] = [
  "year",
  "race",
  "sex",
  "reason",
  "arrest",
  "cfs_vs_oi",
  "juvenile",
  "month",
  "hour",
  "day",
];

export const FILTER_LABELS: Record<keyof Filters, string> = {
  year: "Year",
  race: "Race/Ethnicity",
  sex: "Sex",
  reason: "Reason",
  arrest: "Arrest",
  cfs_vs_oi: "Initiation",
  juvenile: "Juvenile",
  month: "Month",
  hour: "Hour",
  day: "Day of Week",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getYear(stop: Stop): string {
  return stop.fc_date.slice(0, 4);
}

export function getHour(stop: Stop): string {
  return stop.fc_hour.split(":")[0];
}

export function getDayOfWeek(stop: Stop): string {
  const d = new Date(stop.fc_date);
  return DAY_NAMES[d.getDay()];
}

export function normalizeSex(value: string | null | undefined): string {
  const v = (value ?? "").trim().toUpperCase();
  if (v === "M") return "M";
  if (v === "F") return "F";
  return "Unknown";
}

export function stopField(stop: Stop, key: keyof Filters): string {
  switch (key) {
    case "year":
      return getYear(stop);
    case "race":
      return stop.race_ethnicity_group;
    case "sex":
      return normalizeSex(stop.sex);
    case "reason":
      return stop.reason;
    case "arrest":
      return stop.arrest;
    case "cfs_vs_oi":
      return stop.cfs_vs_oi;
    case "juvenile":
      return stop.juvenile;
    case "month":
      return stop.source_sheet;
    case "hour":
      return getHour(stop);
    case "day":
      return getDayOfWeek(stop);
  }
}
