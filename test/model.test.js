import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonthGrid,
  colorTag,
  eventCoversDay,
  formatEventWhen,
  goToToday,
  monthTitle,
  parseEvent,
  parseIndex,
  shiftMonth,
} from "../model.js";

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
