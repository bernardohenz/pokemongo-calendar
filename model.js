export const TAG_PRIORITY = [
  "dia-comunitario",
  "shiny-boost",
  "mega",
  "pago",
  "free",
];

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function colorTag(tags) {
  for (const tag of TAG_PRIORITY) {
    if (tags.includes(tag)) return tag;
  }
  return "neutral";
}

function parts(value) {
  if (typeof value !== "string") return null;
  const asDate = DATE_ONLY.exec(value);
  if (asDate) {
    return { allDay: true, y: Number(asDate[1]), m: Number(asDate[2]), d: Number(asDate[3]), hh: 0, mm: 0 };
  }
  const asTime = DATE_TIME.exec(value);
  if (asTime) {
    return {
      allDay: false,
      y: Number(asTime[1]),
      m: Number(asTime[2]),
      d: Number(asTime[3]),
      hh: Number(asTime[4]),
      mm: Number(asTime[5]),
    };
  }
  return null;
}

function realDate(part) {
  if (part.m < 1 || part.m > 12 || part.hh > 23 || part.mm > 59) return null;
  const dt = new Date(part.y, part.m - 1, part.d, part.hh, part.mm, 0, 0);
  if (
    dt.getFullYear() !== part.y ||
    dt.getMonth() !== part.m - 1 ||
    dt.getDate() !== part.d ||
    dt.getHours() !== part.hh ||
    dt.getMinutes() !== part.mm
  ) {
    return null;
  }
  return dt;
}

export function parseEvent(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, reason: "o arquivo não é um objeto" };
  }
  if (typeof data.name !== "string" || data.name.trim() === "") {
    return { ok: false, reason: "name ausente ou vazio" };
  }
  if (data.description !== undefined && typeof data.description !== "string") {
    return { ok: false, reason: "description inválida" };
  }
  if (typeof data.start !== "string" || typeof data.end !== "string") {
    return { ok: false, reason: "start ou end ausente" };
  }
  const start = parts(data.start);
  const end = parts(data.end);
  if (!start || !end) {
    return { ok: false, reason: "start e end precisam ser AAAA-MM-DD ou AAAA-MM-DDTHH:MM" };
  }
  if (start.allDay !== end.allDay) {
    return { ok: false, reason: "start e end precisam ser ambos data ou ambos data e hora" };
  }
  if (!realDate(start) || !realDate(end)) {
    return { ok: false, reason: "data inválida" };
  }

  const startMs = start.allDay
    ? new Date(start.y, start.m - 1, start.d).getTime()
    : new Date(start.y, start.m - 1, start.d, start.hh, start.mm).getTime();
  const endMs = start.allDay
    ? new Date(end.y, end.m - 1, end.d + 1).getTime()
    : new Date(end.y, end.m - 1, end.d, end.hh, end.mm).getTime();
  if (startMs >= endMs) {
    return { ok: false, reason: "start depois de end" };
  }

  const tags = data.tags === undefined ? [] : data.tags;
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string")) {
    return { ok: false, reason: "tags inválidas" };
  }

  return {
    ok: true,
    event: {
      name: data.name,
      description: data.description ?? "",
      start: data.start,
      end: data.end,
      allDay: start.allDay,
      startMs,
      endMs,
      tags,
      colorTag: colorTag(tags),
    },
  };
}

export function eventCoversDay(event, year, monthIndex, day) {
  const start = new Date(year, monthIndex, day).getTime();
  const end = new Date(year, monthIndex, day + 1).getTime();
  return event.startMs < end && event.endMs > start;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatEventWhen(event) {
  if (event.allDay) return "dia inteiro";
  const start = new Date(event.startMs);
  const end = new Date(event.endMs);
  const clock = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${clock(start)}–${clock(end)}`;
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function buildMonthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;
  const start = new Date(year, monthIndex, 1 - lead);
  const cells = [];
  for (let i = 0; i < total; i += 1) {
    const cursor = new Date(start);
    cursor.setDate(start.getDate() + i);
    cells.push({
      year: cursor.getFullYear(),
      monthIndex: cursor.getMonth(),
      day: cursor.getDate(),
      inMonth: cursor.getMonth() === monthIndex && cursor.getFullYear() === year,
    });
  }
  return cells;
}

export function monthTitle(year, monthIndex) {
  return `${MONTHS[monthIndex]} ${year}`;
}

export function dayHeading(year, monthIndex, day) {
  return `${day} de ${MONTHS[monthIndex]}`;
}

export function todayParts(now = new Date()) {
  return { year: now.getFullYear(), monthIndex: now.getMonth(), day: now.getDate() };
}

function sameDay(a, b) {
  return a.year === b.year && a.monthIndex === b.monthIndex && a.day === b.day;
}

export function selectionForMonth(selected, year, monthIndex) {
  const grid = buildMonthGrid(year, monthIndex);
  if (grid.some((cell) => sameDay(cell, selected))) return selected;
  return { year, monthIndex, day: 1 };
}

export function shiftMonth(year, monthIndex, delta, selected) {
  const next = new Date(year, monthIndex + delta, 1);
  const visibleYear = next.getFullYear();
  const visibleMonth = next.getMonth();
  return {
    visibleYear,
    visibleMonth,
    selected: selectionForMonth(selected, visibleYear, visibleMonth),
  };
}

export function goToToday(now = new Date()) {
  const today = todayParts(now);
  return { visibleYear: today.year, visibleMonth: today.monthIndex, selected: today };
}

export function validateFilename(name) {
  if (name.trim() === "" || name.includes("/") || name.includes("\\") || name.includes("..")) {
    return { ok: false, reason: "caminho inválido" };
  }
  return { ok: true };
}

export function parseIndex(data) {
  if (!Array.isArray(data) || data.some((item) => typeof item !== "string")) {
    return { ok: false, reason: "O índice precisa ser uma lista de nomes de arquivo." };
  }
  const errors = [];
  const seen = new Set();
  const filenames = [];
  for (const name of data) {
    const check = validateFilename(name);
    if (!check.ok) {
      errors.push({ filename: name, reason: check.reason });
      continue;
    }
    if (seen.has(name)) continue;
    seen.add(name);
    filenames.push(name);
  }
  return { ok: true, filenames, errors };
}

function compareEvents(a, b) {
  return a.startMs - b.startMs || a.name.localeCompare(b.name, "pt");
}

export function viewModel({ events, issues, visibleYear, visibleMonth, selected, today }) {
  const cells = buildMonthGrid(visibleYear, visibleMonth).map((cell) => ({
    ...cell,
    isToday: sameDay(cell, today),
    isSelected: sameDay(cell, selected),
    dots: events
      .filter((event) => eventCoversDay(event, cell.year, cell.monthIndex, cell.day))
      .sort(compareEvents)
      .map((event) => ({ name: event.name, colorTag: event.colorTag })),
  }));
  const panelEvents = events
    .filter((event) => eventCoversDay(event, selected.year, selected.monthIndex, selected.day))
    .sort(compareEvents)
    .map((event) => ({
      name: event.name,
      when: formatEventWhen(event),
      description: event.description,
      tags: event.tags,
    }));
  return {
    title: monthTitle(visibleYear, visibleMonth),
    cells,
    issues,
    panel: {
      heading: dayHeading(selected.year, selected.monthIndex, selected.day),
      events: panelEvents,
    },
  };
}
