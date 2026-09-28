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
