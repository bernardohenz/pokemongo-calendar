# Pokémon GO Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static month calendar that reads one JSON file per Pokémon GO event and shows the current month, with the selected day's name, time, description, and tags.

**Architecture:** `model.js` holds parsing, date math, and the view model. `node --test` covers that file. `calendar.js` fetches `eventos/index.json`, then each listed file, and paints the view model into the page. No build step and no runtime dependencies. Dates are parsed as local calendar fields, never with `new Date("YYYY-MM-DD")`, because that form is UTC and shifts the day.

**Tech Stack:** HTML, CSS, ES modules, Node.js built-in test runner.

---

## File map

- `package.json` — `"type": "module"` so Node can import the model. Not required by the host.
- `model.js` — parse events and the index, decide which days they cover, build the month grid and the panel data.
- `test/model.test.js` — unit tests for `model.js`.
- `calendar.js` — fetch files, keep the visible month and the selected day, render DOM.
- `index.html` — page shell in Portuguese.
- `styles.css` — layout and tag colors.
- `eventos/index.json` — manual list of filenames.
- `eventos/2026-10-07-mega-latios.json` and `eventos/2026-10-12-community-day-eevee.json` — examples.
- `README.md` — how to add an event and how to open the page.

`model.js` is an addition to the spec's file list so the date rules can be tested without a browser. The hosted site is still the HTML, CSS, JS, and `eventos/` folder.

## Task 1: Parse an event

**Files:**
- Create: `package.json`
- Create: `model.js`
- Create: `test/model.test.js`

- [ ] **Step 1: Write the failing test**

Create `package.json`:

```json
{
  "name": "pokemongo-calendar",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

Create `test/model.test.js`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";
import { colorTag, parseEvent } from "../model.js";

test("parses an all-day event and keeps the end date", () => {
  const parsed = parseEvent({
    name: "Raids Mega Latios",
    description: "Latios em mega raids a semana inteira.",
    start: "2026-10-07",
    end: "2026-10-14",
    tags: ["mega"],
    pokemon: "Latios",
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.event.name, "Raids Mega Latios");
  assert.equal(parsed.event.allDay, true);
  assert.equal(parsed.event.colorTag, "mega");
  assert.equal(parsed.event.tags.length, 1);
  assert.equal(parsed.event.pokemon, undefined);
  assert.equal(parsed.event.startMs < parsed.event.endMs, true);
  const covers14 = parsed.event.endMs > new Date(2026, 9, 14, 12).getTime();
  const covers15 = parsed.event.endMs > new Date(2026, 9, 15, 0).getTime();
  assert.equal(covers14, true);
  assert.equal(covers15, false);
});

test("parses a timed window as half-open", () => {
  const parsed = parseEvent({
    name: "Community Day: Eevee",
    description: "Eevee com shiny boost.",
    start: "2026-10-12T14:00",
    end: "2026-10-12T17:00",
    tags: ["shiny-boost", "dia-comunitario", "free"],
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.event.allDay, false);
  assert.equal(parsed.event.colorTag, "dia-comunitario");
  assert.equal(parsed.event.endMs, new Date(2026, 9, 12, 17, 0).getTime());
});

test("a single all-day date is valid and a zero-length window is not", () => {
  assert.equal(parseEvent({ name: "Dia", start: "2026-10-12", end: "2026-10-12", tags: [] }).ok, true);
  assert.equal(
    parseEvent({ name: "Vazio", start: "2026-10-12T14:00", end: "2026-10-12T14:00" }).ok,
    false,
  );
});

test("rejects broken events", () => {
  assert.equal(parseEvent({ name: " ", start: "2026-10-12", end: "2026-10-12" }).reason, "name ausente ou vazio");
  assert.equal(parseEvent({ name: "X", description: 1, start: "2026-10-12", end: "2026-10-12" }).reason, "description inválida");
  assert.equal(parseEvent({ name: "X", start: "2026-10-12", end: "2026-10-12T18:00" }).reason, "start e end precisam ser ambos data ou ambos data e hora");
  assert.equal(parseEvent({ name: "X", start: "2026-02-31", end: "2026-02-31" }).reason, "data inválida");
  assert.equal(parseEvent({ name: "X", start: "2026-10-14", end: "2026-10-07" }).reason, "start depois de end");
  assert.equal(parseEvent({ name: "X", start: "2026-10-12", end: "2026-10-12", tags: ["mega", 1] }).reason, "tags inválidas");
  assert.equal(parseEvent(["nope"]).reason, "o arquivo não é um objeto");
});

test("missing description and tags become blanks", () => {
  const parsed = parseEvent({ name: "Spotlight", start: "2026-10-22T18:00", end: "2026-10-22T19:00" });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.event.description, "");
  assert.deepEqual(parsed.event.tags, []);
  assert.equal(parsed.event.colorTag, "neutral");
});

test("color follows tag priority, not array order", () => {
  assert.equal(colorTag(["free", "pago"]), "pago");
  assert.equal(colorTag(["raid"]), "neutral");
  assert.equal(colorTag([]), "neutral");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because `../model.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `model.js`:

```javascript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json model.js test/model.test.js
git commit -m "$(cat <<'EOF'
Parse event JSON into local time ranges.

EOF
)"
```

## Task 2: Which days an event covers

**Files:**
- Modify: `model.js`
- Modify: `test/model.test.js`

- [ ] **Step 1: Write the failing test**

Add `eventCoversDay` and `formatEventWhen` to the import in `test/model.test.js`, and append:

```javascript
test("all-day events include the end date and timed events stop at the end clock", () => {
  const raid = parseEvent({ name: "Raid", start: "2026-10-07", end: "2026-10-14" }).event;
  const community = parseEvent({
    name: "Community Day",
    start: "2026-10-12T14:00",
    end: "2026-10-12T17:00",
  }).event;
  const overnight = parseEvent({
    name: "Noite",
    start: "2026-10-12T23:00",
    end: "2026-10-13T01:00",
  }).event;
  const endsAtMidnight = parseEvent({
    name: "Até meia-noite",
    start: "2026-10-12T22:00",
    end: "2026-10-13T00:00",
  }).event;

  assert.equal(eventCoversDay(raid, 2026, 9, 7), true);
  assert.equal(eventCoversDay(raid, 2026, 9, 14), true);
  assert.equal(eventCoversDay(raid, 2026, 9, 15), false);
  assert.equal(eventCoversDay(community, 2026, 9, 12), true);
  assert.equal(eventCoversDay(community, 2026, 9, 13), false);
  assert.equal(eventCoversDay(overnight, 2026, 9, 12), true);
  assert.equal(eventCoversDay(overnight, 2026, 9, 13), true);
  assert.equal(eventCoversDay(endsAtMidnight, 2026, 9, 13), false);
  assert.equal(formatEventWhen(raid), "dia inteiro");
  assert.equal(formatEventWhen(community), "14:00–17:00");
});
```

The dash in `"14:00–17:00"` is an en dash, U+2013.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because `eventCoversDay` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `model.js`:

```javascript
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
```

Use an en dash in the returned string.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model.js test/model.test.js
git commit -m "$(cat <<'EOF'
Decide which calendar days an event covers.

EOF
)"
```

## Task 3: Month grid and navigation

**Files:**
- Modify: `model.js`
- Modify: `test/model.test.js`

- [ ] **Step 1: Write the failing test**

Add `buildMonthGrid`, `monthTitle`, `shiftMonth`, and `goToToday` to the import, and append:

```javascript
test("September 2026 starts on Tuesday and keeps Monday as the first column", () => {
  const cells = buildMonthGrid(2026, 8);
  assert.equal(cells.length % 7, 0);
  assert.deepEqual(cells[0], { year: 2026, monthIndex: 7, day: 31, inMonth: false });
  assert.deepEqual(cells[1], { year: 2026, monthIndex: 8, day: 1, inMonth: true });
  assert.equal(cells.at(-1).inMonth, false);
  assert.equal(monthTitle(2026, 8), "setembro 2026");
});

test("changing month keeps a day that is still on the grid", () => {
  const kept = shiftMonth(2026, 8, 1, { year: 2026, monthIndex: 8, day: 28 });
  assert.equal(kept.visibleYear, 2026);
  assert.equal(kept.visibleMonth, 9);
  assert.deepEqual(kept.selected, { year: 2026, monthIndex: 8, day: 28 });

  const reset = shiftMonth(2026, 8, 1, { year: 2026, monthIndex: 8, day: 15 });
  assert.deepEqual(reset.selected, { year: 2026, monthIndex: 9, day: 1 });
});

test("goToToday selects the clock date", () => {
  const jumped = goToToday(new Date(2026, 8, 28, 15, 4));
  assert.deepEqual(jumped, {
    visibleYear: 2026,
    visibleMonth: 8,
    selected: { year: 2026, monthIndex: 8, day: 28 },
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because `buildMonthGrid` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `model.js`:

```javascript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model.js test/model.test.js
git commit -m "$(cat <<'EOF'
Build a Monday-first month grid and month changes.

EOF
)"
```

## Task 4: Parse the manual index

**Files:**
- Modify: `model.js`
- Modify: `test/model.test.js`

- [ ] **Step 1: Write the failing test**

Add `parseIndex` to the import, and append:

```javascript
test("index keeps unique safe filenames and reports bad paths", () => {
  const parsed = parseIndex([
    "2026-10-07-mega-latios.json",
    "2026-10-07-mega-latios.json",
    "../segredo.json",
    "pasta/evento.json",
  ]);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.filenames, ["2026-10-07-mega-latios.json"]);
  assert.equal(parsed.errors.length, 2);
  assert.equal(parsed.errors[0].reason, "caminho inválido");
});

test("index that is not a list of strings fails as a whole", () => {
  const parsed = parseIndex({ eventos: [] });
  assert.equal(parsed.ok, false);
  assert.equal(parsed.reason, "O índice precisa ser uma lista de nomes de arquivo.");
  assert.equal(parseIndex(["ok.json", 1]).ok, false);
  assert.deepEqual(parseIndex([]), { ok: true, filenames: [], errors: [] });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because `parseIndex` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `model.js`:

```javascript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model.js test/model.test.js
git commit -m "$(cat <<'EOF'
Validate the manual event index.

EOF
)"
```

## Task 5: View model for the month and the selected day

**Files:**
- Modify: `model.js`
- Modify: `test/model.test.js`

- [ ] **Step 1: Write the failing test**

Add `viewModel` to the import, and append:

```javascript
test("October 2026 shows the raid through the 14th and the community day hours", () => {
  const raid = parseEvent({
    name: "Raids Mega Latios",
    description: "Latios em mega raids a semana inteira.",
    start: "2026-10-07",
    end: "2026-10-14",
    tags: ["mega"],
  }).event;
  const community = parseEvent({
    name: "Community Day: Eevee",
    description: "Eevee com shiny boost. Evolução com movimento especial.",
    start: "2026-10-12T14:00",
    end: "2026-10-12T17:00",
    tags: ["shiny-boost", "dia-comunitario", "free"],
  }).event;
  const today = { year: 2026, monthIndex: 8, day: 28 };
  const october = viewModel({
    events: [community, raid],
    issues: [],
    visibleYear: 2026,
    visibleMonth: 9,
    selected: { year: 2026, monthIndex: 9, day: 12 },
    today,
  });

  assert.equal(october.title, "outubro 2026");
  const day = (n) => october.cells.find((cell) => cell.inMonth && cell.day === n);
  assert.deepEqual(day(7).dots.map((dot) => dot.colorTag), ["mega"]);
  assert.deepEqual(day(12).dots.map((dot) => dot.colorTag), ["mega", "dia-comunitario"]);
  assert.deepEqual(day(14).dots.map((dot) => dot.colorTag), ["mega"]);
  assert.deepEqual(day(15).dots, []);
  assert.equal(day(12).isToday, false);
  assert.equal(october.panel.heading, "12 de outubro");
  assert.equal(october.panel.events[1].name, "Community Day: Eevee");
  assert.equal(october.panel.events[1].when, "14:00–17:00");
  assert.deepEqual(october.panel.events[1].tags, ["shiny-boost", "dia-comunitario", "free"]);

  const fourteenth = viewModel({
    events: [raid, community],
    issues: [],
    visibleYear: 2026,
    visibleMonth: 9,
    selected: { year: 2026, monthIndex: 9, day: 14 },
    today,
  });
  assert.deepEqual(fourteenth.panel.events.map((event) => event.name), ["Raids Mega Latios"]);

  const fifteenth = viewModel({
    events: [raid, community],
    issues: [],
    visibleYear: 2026,
    visibleMonth: 9,
    selected: { year: 2026, monthIndex: 9, day: 15 },
    today,
  });
  assert.deepEqual(fifteenth.panel.events, []);
});
```

Sort is by `startMs`, so the all-day raid is listed before the 14:00 community day. The en dash in `14:00–17:00` is U+2013.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because `viewModel` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `model.js`:

```javascript
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
```

`sameDay` and `dayHeading` already exist from Task 3.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model.js test/model.test.js
git commit -m "$(cat <<'EOF'
Assemble the month grid and the selected day's events.

EOF
)"
```

## Task 6: Example event files

**Files:**
- Create: `eventos/index.json`
- Create: `eventos/2026-10-07-mega-latios.json`
- Create: `eventos/2026-10-12-community-day-eevee.json`
- Modify: `test/model.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/model.test.js`:

```javascript
import { readFile } from "node:fs/promises";

test("example files cover 7–14 October and not the 15th", async () => {
  const dir = new URL("../eventos/", import.meta.url);
  const index = JSON.parse(await readFile(new URL("index.json", dir), "utf8"));
  const parsedIndex = parseIndex(index);
  assert.equal(parsedIndex.ok, true);
  const events = [];
  for (const filename of parsedIndex.filenames) {
    const raw = JSON.parse(await readFile(new URL(filename, dir), "utf8"));
    const parsed = parseEvent(raw);
    assert.equal(parsed.ok, true, filename);
    events.push(parsed.event);
  }
  const view = viewModel({
    events,
    issues: [],
    visibleYear: 2026,
    visibleMonth: 9,
    selected: { year: 2026, monthIndex: 9, day: 12 },
    today: { year: 2026, monthIndex: 8, day: 28 },
  });
  const day = (n) => view.cells.find((cell) => cell.inMonth && cell.day === n);
  assert.equal(day(7).dots.length, 1);
  assert.equal(day(12).dots.length, 2);
  assert.equal(day(14).dots.length, 1);
  assert.equal(day(15).dots.length, 0);
  assert.equal(view.panel.events.some((event) => event.when === "14:00–17:00"), true);
});
```

Move that `readFile` import to the top of the file with the other imports. `parseIndex`, `parseEvent`, and `viewModel` are already imported.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because `eventos/index.json` does not exist.

- [ ] **Step 3: Write the example files**

`eventos/index.json`:

```json
[
  "2026-10-07-mega-latios.json",
  "2026-10-12-community-day-eevee.json"
]
```

`eventos/2026-10-07-mega-latios.json`:

```json
{
  "name": "Raids Mega Latios",
  "description": "Latios em mega raids a semana inteira.",
  "start": "2026-10-07",
  "end": "2026-10-14",
  "tags": ["mega"]
}
```

`eventos/2026-10-12-community-day-eevee.json`:

```json
{
  "name": "Community Day: Eevee",
  "description": "Eevee com shiny boost. Evolução com movimento especial.",
  "start": "2026-10-12T14:00",
  "end": "2026-10-12T17:00",
  "tags": ["shiny-boost", "dia-comunitario", "free"]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add eventos test/model.test.js
git commit -m "$(cat <<'EOF'
Add example October events for the empty calendar.

EOF
)"
```

## Task 7: Page shell and rendering

**Files:**
- Create: `index.html`
- Create: `calendar.js`

- [ ] **Step 1: Create the page shell**

`index.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Pokémon GO — calendário</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Boogaloo&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <header class="top">
      <h1 id="month-title">calendário</h1>
      <div class="nav">
        <button type="button" id="prev-month">Anterior</button>
        <button type="button" id="today">Hoje</button>
        <button type="button" id="next-month">Próximo</button>
      </div>
    </header>
    <p id="issues" class="issues" hidden></p>
    <main class="sheet">
      <section class="month" aria-label="Mês">
        <div class="weekdays" aria-hidden="true">
          <span>seg</span><span>ter</span><span>qua</span><span>qui</span><span>sex</span><span>sáb</span><span>dom</span>
        </div>
        <div id="grid" class="grid"></div>
      </section>
      <section class="day-panel" aria-live="polite">
        <h2 id="day-heading"></h2>
        <div id="day-events"></div>
      </section>
    </main>
    <script type="module" src="./calendar.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create the renderer**

`calendar.js`:

```javascript
import { goToToday, parseEvent, parseIndex, shiftMonth, todayParts, viewModel } from "./model.js";

const state = {
  events: [],
  issues: [],
  visibleYear: 0,
  visibleMonth: 0,
  selected: null,
  today: null,
};

const monthTitleNode = document.querySelector("#month-title");
const gridNode = document.querySelector("#grid");
const headingNode = document.querySelector("#day-heading");
const eventsNode = document.querySelector("#day-events");
const issuesNode = document.querySelector("#issues");

function paint() {
  const view = viewModel(state);
  monthTitleNode.textContent = view.title;
  paintIssues(view.issues);
  paintGrid(view.cells);
  paintPanel(view.panel);
}

function paintIssues(issues) {
  issuesNode.replaceChildren();
  if (issues.length === 0) {
    issuesNode.hidden = true;
    return;
  }
  issuesNode.hidden = false;
  for (const issue of issues) {
    const line = document.createElement("span");
    line.textContent = issue.filename ? `${issue.filename}: ${issue.reason}` : issue.reason;
    issuesNode.append(line);
  }
}

function paintGrid(cells) {
  gridNode.replaceChildren();
  for (const cell of cells) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day";
    if (!cell.inMonth) button.classList.add("is-outside");
    if (cell.isToday) button.classList.add("is-today");
    if (cell.isSelected) button.classList.add("is-selected");
    button.setAttribute("aria-pressed", cell.isSelected ? "true" : "false");
    if (cell.isToday) button.setAttribute("aria-current", "date");
    button.addEventListener("click", () => {
      state.selected = { year: cell.year, monthIndex: cell.monthIndex, day: cell.day };
      paint();
    });

    const number = document.createElement("span");
    number.className = "num";
    number.textContent = String(cell.day);
    button.append(number);

    if (cell.isToday) {
      const mark = document.createElement("span");
      mark.className = "today-mark";
      mark.textContent = "hoje";
      button.append(mark);
    }

    const dots = document.createElement("span");
    dots.className = "dots";
    for (const dot of cell.dots) {
      const mark = document.createElement("span");
      mark.className = "dot";
      mark.dataset.tag = dot.colorTag;
      mark.title = dot.name;
      dots.append(mark);
    }
    button.append(dots);
    gridNode.append(button);
  }
}

function paintPanel(panel) {
  headingNode.textContent = panel.heading;
  eventsNode.replaceChildren();
  if (panel.events.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Nenhum evento neste dia";
    eventsNode.append(empty);
    return;
  }
  for (const event of panel.events) {
    const article = document.createElement("article");
    article.className = "event";
    const title = document.createElement("h3");
    title.textContent = event.name;
    const when = document.createElement("p");
    when.className = "when";
    when.textContent = event.when;
    article.append(title, when);
    if (event.description) {
      const description = document.createElement("p");
      description.className = "description";
      description.textContent = event.description;
      article.append(description);
    }
    if (event.tags.length > 0) {
      const tags = document.createElement("ul");
      tags.className = "tags";
      for (const tag of event.tags) {
        const item = document.createElement("li");
        item.textContent = tag;
        tags.append(item);
      }
      article.append(tags);
    }
    eventsNode.append(article);
  }
}

async function loadOne(filename) {
  try {
    const response = await fetch(`eventos/${encodeURIComponent(filename)}`);
    if (!response.ok) {
      state.issues.push({ filename, reason: "arquivo ausente" });
      return null;
    }
    let data;
    try {
      data = await response.json();
    } catch {
      state.issues.push({ filename, reason: "JSON inválido" });
      return null;
    }
    const parsed = parseEvent(data);
    if (!parsed.ok) {
      state.issues.push({ filename, reason: parsed.reason });
      return null;
    }
    return parsed.event;
  } catch {
    state.issues.push({ filename, reason: "arquivo ausente" });
    return null;
  }
}

async function load() {
  try {
    const response = await fetch("eventos/index.json");
    if (!response.ok) {
      state.issues = [{ filename: null, reason: "Não foi possível ler o índice." }];
      paint();
      return;
    }
    let data;
    try {
      data = await response.json();
    } catch {
      state.issues = [{ filename: null, reason: "Não foi possível ler o índice." }];
      paint();
      return;
    }
    const index = parseIndex(data);
    if (!index.ok) {
      state.issues = [{ filename: null, reason: index.reason }];
      paint();
      return;
    }
    state.issues = index.errors.map((error) => ({ filename: error.filename, reason: error.reason }));
    const loaded = await Promise.all(index.filenames.map(loadOne));
    state.events = loaded.filter(Boolean);
  } catch {
    state.issues = [{ filename: null, reason: "Não foi possível ler o índice." }];
  }
  paint();
}

document.querySelector("#prev-month").addEventListener("click", () => {
  const next = shiftMonth(state.visibleYear, state.visibleMonth, -1, state.selected);
  state.visibleYear = next.visibleYear;
  state.visibleMonth = next.visibleMonth;
  state.selected = next.selected;
  paint();
});

document.querySelector("#next-month").addEventListener("click", () => {
  const next = shiftMonth(state.visibleYear, state.visibleMonth, 1, state.selected);
  state.visibleYear = next.visibleYear;
  state.visibleMonth = next.visibleMonth;
  state.selected = next.selected;
  paint();
});

document.querySelector("#today").addEventListener("click", () => {
  const next = goToToday();
  state.visibleYear = next.visibleYear;
  state.visibleMonth = next.visibleMonth;
  state.selected = next.selected;
  state.today = todayParts();
  paint();
});

const opened = goToToday();
state.today = opened.selected;
state.visibleYear = opened.visibleYear;
state.visibleMonth = opened.visibleMonth;
state.selected = opened.selected;
paint();
load();
```

Clicking a day only changes `state.selected`. It does not call `shiftMonth`, so a dimmed day from the neighboring month stays in the current grid.

- [ ] **Step 3: Commit**

```bash
git add index.html calendar.js
git commit -m "$(cat <<'EOF'
Render the month and the selected day from event files.

EOF
)"
```

`styles.css` does not exist yet. The page still loads; the next task supplies it. Do not commit a broken link as a follow-up fix — Task 8 adds the file before the page is checked in the browser.

## Task 8: Visual design

**Files:**
- Create: `styles.css`

The page is a paper field notebook checked in daylight, mostly on a phone. Display face is Boogaloo. Body face is Atkinson Hyperlegible. Do not swap in Inter, Roboto, Space Grotesk, or a purple-on-dark theme.

- [ ] **Step 1: Create `styles.css`**

```css
:root {
  --paper: oklch(0.96 0.018 95);
  --ink: oklch(0.28 0.04 150);
  --ink-soft: oklch(0.42 0.03 150);
  --line: oklch(0.86 0.02 95);
  --sheet: oklch(0.985 0.01 95);
  --outside: oklch(0.72 0.02 95);
  --today: oklch(0.9 0.06 145);
  --selected: oklch(0.93 0.035 95);
  --focus: oklch(0.45 0.12 145);
  --issue: oklch(0.42 0.12 35);
  --tag-dia-comunitario: oklch(0.55 0.14 150);
  --tag-shiny-boost: oklch(0.72 0.14 85);
  --tag-mega: oklch(0.55 0.16 35);
  --tag-pago: oklch(0.48 0.1 330);
  --tag-free: oklch(0.52 0.09 230);
  --tag-neutral: oklch(0.62 0.015 150);
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --font-display: "Boogaloo", "Arial Rounded MT Bold", sans-serif;
  --font-body: "Atkinson Hyperlegible", "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at 8% -20%, oklch(0.9 0.05 145 / 0.7), transparent 46%),
    var(--paper);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 1rem;
  line-height: 1.45;
}

.top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  max-width: 68rem;
  margin: 0 auto;
  padding: var(--space-6) var(--space-5) var(--space-4);
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2.6rem, 6vw, 4.4rem);
  font-weight: 400;
  line-height: 0.85;
}

.nav {
  display: flex;
  gap: var(--space-2);
}

.nav button {
  font: inherit;
  color: var(--ink);
  background: var(--sheet);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
}

#today {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}

.issues {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-width: 68rem;
  margin: 0 auto;
  padding: 0 var(--space-5) var(--space-4);
  color: var(--issue);
}

.sheet {
  display: grid;
  gap: var(--space-6);
  max-width: 68rem;
  margin: 0 auto;
  padding: 0 var(--space-5) var(--space-7);
}

.weekdays,
.grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-1);
}

.weekdays {
  margin-bottom: var(--space-2);
}

.weekdays span {
  text-align: center;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.day {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  min-height: 4.6rem;
  padding: var(--space-2);
  font: inherit;
  color: inherit;
  text-align: left;
  background: var(--sheet);
  border: 1px solid var(--line);
  border-radius: 0.7rem;
  cursor: pointer;
}

.day.is-outside { color: var(--outside); }

.num {
  display: inline-grid;
  place-items: center;
  min-width: 1.7rem;
  height: 1.7rem;
  border-radius: 0.45rem;
  font-weight: 700;
}

.day.is-today .num {
  background: var(--today);
  box-shadow: inset 0 0 0 2px var(--ink);
}

.today-mark {
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.day.is-selected {
  background: var(--selected);
  border-color: var(--ink);
}

.dots {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: var(--tag-neutral);
}

.dot[data-tag="dia-comunitario"] { background: var(--tag-dia-comunitario); }
.dot[data-tag="shiny-boost"] { background: var(--tag-shiny-boost); }
.dot[data-tag="mega"] { background: var(--tag-mega); }
.dot[data-tag="pago"] { background: var(--tag-pago); }
.dot[data-tag="free"] { background: var(--tag-free); }

.day-panel h2 {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 2.8rem);
  font-weight: 400;
  line-height: 0.95;
}

.event + .event { margin-top: var(--space-5); }

.event h3 {
  margin: 0;
  font-size: 1.25rem;
}

.when {
  margin: var(--space-1) 0 0;
  color: var(--ink-soft);
}

.description {
  margin: var(--space-2) 0 0;
  max-width: 62ch;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
}

.tags li {
  padding: 2px var(--space-2);
  border-radius: 999px;
  background: oklch(0.92 0.02 95);
  font-size: 0.85rem;
}

.empty {
  margin: 0;
  color: var(--ink-soft);
}

button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

@media (min-width: 52rem) {
  .sheet {
    grid-template-columns: minmax(0, 1.7fr) minmax(16rem, 0.85fr);
    align-items: start;
    gap: var(--space-7);
  }
}

@media (max-width: 40rem) {
  .top { padding-top: var(--space-5); }
  .day {
    min-height: 3.3rem;
    padding: var(--space-1);
  }
  .today-mark {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
}
```

The today mark on a small screen is the ink ring around the number, plus the accessible name “hoje”. The ring is a shape, not a color swap. Do not add a thick left border on events, issues, or days.

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "$(cat <<'EOF'
Style the calendar as a daylight field notebook.

EOF
)"
```

## Task 9: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Calendário Pokémon GO

Página estática do mês corrente. Cada evento é um JSON em `eventos/`. O arquivo `eventos/index.json` lista os nomes desses arquivos.

## Abrir localmente

Na pasta do projeto:

```bash
python3 -m http.server
```

Abra `http://localhost:8000`. Abrir o `index.html` direto do disco não carrega os JSON.

## Adicionar um evento

Crie `eventos/AAAA-MM-DD-slug.json`:

```json
{
  "name": "Community Day: Eevee",
  "description": "Eevee com shiny boost.",
  "start": "2026-10-12T14:00",
  "end": "2026-10-12T17:00",
  "tags": ["shiny-boost", "dia-comunitario", "free"]
}
```

`start` e `end` são hora local, sem fuso. Os dois são uma data (`2026-10-07`) ou os dois são data e hora (`2026-10-12T14:00`). Num dia inteiro, a data final entra. Com hora, o fim é o instante em que o evento acaba.

Tags iniciais: `shiny-boost`, `mega`, `free`, `pago`, `dia-comunitario`. Outras tags aparecem do mesmo jeito.

Inclua o nome do arquivo em `eventos/index.json`:

```json
[
  "2026-10-07-mega-latios.json",
  "2026-10-12-community-day-eevee.json"
]
```

## Publicar

Suba a pasta como site estático (GitHub Pages, Cloudflare Pages ou Netlify). Não há build.

## Testes

```bash
npm test
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
Document how to add an event and open the calendar.

EOF
)"
```

## Task 10: Check the page in the browser

**Files:**
- Modify, then restore: `eventos/index.json`

- [ ] **Step 1: Run the unit tests**

Run: `npm test`

Expected: PASS

- [ ] **Step 2: Serve the folder**

Run: `python3 -m http.server 8765`

Open `http://localhost:8765`.

- [ ] **Step 3: Walk the month**

Confirm all of these:

- The visible month is the current month, and today is selected. Today has the word “hoje” or, on a narrow window, the ink ring, and `aria-current="date"`.
- Go to outubro 2026. Days 7 through 14 have a mega dot. Day 12 has two dots.
- Day 12 lists Raids Mega Latios as “dia inteiro” and Community Day: Eevee as `14:00–17:00`, with tags `shiny-boost`, `dia-comunitario`, and `free`.
- Day 14 lists only the raid. Day 15 says “Nenhum evento neste dia”.
- A dimmed day from setembro inside the outubro grid can be selected without leaving outubro.
- “Hoje” returns to the current month and selects today.
- From setembro 2026, “Próximo” lands on outubro. If the selected day was 15 de setembro, the selection becomes 1 de outubro. If it was 28 de setembro, that day stays selected.
- Buttons show a visible focus ring with the keyboard.

- [ ] **Step 4: Missing file**

Add `"ausente.json"` to `eventos/index.json` and reload. The note names `ausente.json`. The two real events still render. Remove `"ausente.json"` before finishing, and confirm `npm test` still passes.

- [ ] **Step 5: Narrow viewport**

At about 390px wide, the day panel sits below the grid, the seven columns remain usable, and the month can still be changed.
