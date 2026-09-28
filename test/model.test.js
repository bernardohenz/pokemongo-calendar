import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildMonthGrid,
  TAG_PRIORITY,
  colorTag,
  eventCoversDay,
  eventMatchesFilters,
  formatEventWhen,
  goToToday,
  monthTitle,
  parseEvent,
  parseIndex,
  shiftMonth,
  viewModel,
} from "../model.js";

test("parses an all-day event and keeps the end date", () => {
  const parsed = parseEvent({
    name: "Raids Mega Latios",
    description: ["Latios em mega raids a semana inteira."],
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
    description: ["Eevee com shiny boost."],
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
  assert.equal(parseEvent({ name: "X", description: "texto", start: "2026-10-12", end: "2026-10-12" }).reason, "description inválida");
  assert.equal(parseEvent({ name: "X", start: "2026-10-12", end: "2026-10-12T18:00" }).reason, "start e end precisam ser ambos data ou ambos data e hora");
  assert.equal(parseEvent({ name: "X", start: "2026-02-31", end: "2026-02-31" }).reason, "data inválida");
  assert.equal(parseEvent({ name: "X", start: "2026-10-14", end: "2026-10-07" }).reason, "start depois de end");
  assert.equal(parseEvent({ name: "X", start: "2026-10-12", end: "2026-10-12", tags: ["mega", 1] }).reason, "tags inválidas");
  assert.equal(parseEvent(["nope"]).reason, "o arquivo não é um objeto");
});

test("missing description, tags and images become blanks", () => {
  const parsed = parseEvent({ name: "Spotlight", start: "2026-10-22T18:00", end: "2026-10-22T19:00" });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.event.description, []);
  assert.deepEqual(parsed.event.tags, []);
  assert.deepEqual(parsed.event.images, []);
  assert.deepEqual(parsed.event.coordinates, []);
  assert.equal(parsed.event.colorTag, "neutral");
});

test("images are optional relative paths", () => {
  const parsed = parseEvent({
    name: "Resumo",
    start: "2026-10-17T11:00",
    end: "2026-10-17T17:00",
    images: ["eventos/imagens/resumo.jpg"],
  });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.event.images, ["eventos/imagens/resumo.jpg"]);
  assert.equal(
    parseEvent({ name: "X", start: "2026-10-17", end: "2026-10-17", images: "foto.jpg" }).reason,
    "images inválidas",
  );
  assert.equal(
    parseEvent({ name: "X", start: "2026-10-17", end: "2026-10-17", images: [" "] }).reason,
    "images inválidas",
  );
  assert.equal(
    parseEvent({ name: "X", start: "2026-10-17", end: "2026-10-17", images: ["../foto.jpg"] }).reason,
    "caminho de imagem inválido",
  );
  assert.equal(
    parseEvent({ name: "X", start: "2026-10-17", end: "2026-10-17", images: ["https://exemplo/foto.jpg"] }).reason,
    "caminho de imagem inválido",
  );
});

test("filters follow the dot color, not the other tags", () => {
  const freeOnly = parseEvent({ name: "Grátis", start: "2026-10-17", end: "2026-10-17", tags: ["free"] }).event;
  const both = parseEvent({ name: "Mega grátis", start: "2026-10-17", end: "2026-10-17", tags: ["mega", "free"] }).event;
  const plain = parseEvent({ name: "Outro", start: "2026-10-17", end: "2026-10-17", tags: ["raid"] }).event;
  assert.equal(eventMatchesFilters(freeOnly, ["mega"]), false);
  assert.equal(eventMatchesFilters(both, ["mega"]), true);
  assert.equal(eventMatchesFilters(both, ["free"]), false);
  assert.equal(eventMatchesFilters(plain, ["mega"]), true);
  assert.equal(eventMatchesFilters(freeOnly, TAG_PRIORITY), true);

  const view = viewModel({
    events: [freeOnly, both],
    issues: [],
    visibleYear: 2026,
    visibleMonth: 9,
    selected: { year: 2026, monthIndex: 9, day: 17 },
    today: { year: 2026, monthIndex: 8, day: 28 },
    enabledTags: ["mega"],
  });
  const day = view.cells.find((cell) => cell.inMonth && cell.day === 17);
  assert.deepEqual(day.dots.map((dot) => dot.name), ["Mega grátis"]);
  assert.deepEqual(view.panel.events.map((event) => event.name), ["Mega grátis"]);
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
  assert.equal(formatEventWhen(raid, 2026, 9, 7), "dia inteiro");
  assert.equal(formatEventWhen(community, 2026, 9, 12), "14:00–17:00");
});

test("September 2026 starts on Tuesday and keeps Sunday as the first column", () => {
  const cells = buildMonthGrid(2026, 8);
  assert.equal(cells.length % 7, 0);
  assert.deepEqual(cells[0], { year: 2026, monthIndex: 7, day: 30, inMonth: false });
  assert.deepEqual(cells[2], { year: 2026, monthIndex: 8, day: 1, inMonth: true });
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

test("October 2026 shows the raid through the 14th and the community day hours", () => {
  const raid = parseEvent({
    name: "Raids Mega Latios",
    description: ["Latios em mega raids a semana inteira."],
    start: "2026-10-07",
    end: "2026-10-14",
    tags: ["mega"],
  }).event;
  const community = parseEvent({
    name: "Community Day: Eevee",
    description: ["Eevee com shiny boost.", "Evolução com movimento especial."],
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

test("windows mark only the listed days", () => {
  const parsed = parseEvent({
    name: "MLB",
    start: "2026-06-17",
    end: "2026-09-25",
    windows: [
      { start: "2026-06-17", end: "2026-06-17" },
      { start: "2026-09-25T19:10", end: "2026-09-25T23:00" },
    ],
  });
  assert.equal(parsed.ok, true);
  assert.equal(eventCoversDay(parsed.event, 2026, 5, 17), true);
  assert.equal(eventCoversDay(parsed.event, 2026, 5, 18), false);
  assert.equal(eventCoversDay(parsed.event, 2026, 8, 25), true);
  assert.equal(formatEventWhen(parsed.event, 2026, 8, 25), "19:10–23:00");
  assert.equal(formatEventWhen(parsed.event, 2026, 5, 17), "dia inteiro");
});

test("coordinates are an optional list of points", () => {
  const parsed = parseEvent({
    name: "Local",
    start: "2026-11-06T10:00",
    end: "2026-11-08T20:00",
    coordinates: [{ lat: 28.6315, lng: 77.2167, note: "Connaught Place" }],
  });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.event.coordinates, [{ lat: 28.6315, lng: 77.2167, note: "Connaught Place" }]);
  assert.equal(
    parseEvent({ name: "X", start: "2026-10-17", end: "2026-10-17", coordinates: ["28.6315, 77.2167"] }).reason,
    "coordinates inválidas",
  );
  assert.equal(
    parseEvent({ name: "X", start: "2026-10-17", end: "2026-10-17", coordinates: [{ lat: 91, lng: 0 }] }).reason,
    "coordinates inválidas",
  );
});

test("saved events use description lists and coordinates for local events", async () => {
  const dir = new URL("../eventos/", import.meta.url);
  const index = JSON.parse(await readFile(new URL("index.json", dir), "utf8"));
  const parsedIndex = parseIndex(index);
  assert.equal(parsedIndex.ok, true);
  assert.equal(parsedIndex.filenames.includes("2026-10-07-mega-latios.json"), false);
  assert.equal(parsedIndex.filenames.includes("2026-10-12-community-day-eevee.json"), false);
  const events = [];
  for (const filename of parsedIndex.filenames) {
    const raw = JSON.parse(await readFile(new URL(filename, dir), "utf8"));
    const parsed = parseEvent(raw);
    assert.equal(parsed.ok, true, filename);
    assert.equal(parsed.event.description.length > 0, true, filename);
    events.push(parsed.event);
    for (const image of parsed.event.images) {
      await access(new URL(`../${image}`, import.meta.url));
    }
  }

  const hatch = events.find((event) => event.name === "Dia de Chocar: Sandile");
  const wild = events.find((event) => event.name === "Área Selvagem Global 2026");
  const stores = events.find((event) => event.name === "TCG 30 anos: Mega Gengar nas lojas");
  const lights = events.find((event) => event.name === "Festival das Luzes na Índia");
  assert.equal(formatEventWhen(hatch, 2026, 9, 17), "11:00–17:00");
  assert.equal(eventCoversDay(hatch, 2026, 9, 17), true);
  assert.deepEqual(hatch.coordinates, []);
  assert.equal(formatEventWhen(wild, 2026, 10, 14), "10:00–18:00");
  assert.equal(eventCoversDay(wild, 2026, 10, 14), true);
  assert.equal(eventCoversDay(wild, 2026, 10, 15), true);
  assert.equal(eventCoversDay(wild, 2026, 10, 16), false);
  assert.deepEqual(stores.coordinates, [
    {
      lat: 40.7427,
      lng: -73.9925,
      note: "Loja perto de quem publicou o resumo; não faz parte de um mapa oficial",
    },
  ]);
  assert.equal(eventCoversDay(stores, 2026, 8, 27), true);
  assert.equal(eventCoversDay(stores, 2026, 9, 20), true);
  assert.equal(eventCoversDay(stores, 2026, 9, 21), false);
  assert.equal(lights.coordinates[0].lat, 28.6315);
  assert.equal(lights.coordinates[0].lng, 77.2167);
  assert.match(lights.coordinates[0].note, /Connaught Place/);
  assert.equal(eventCoversDay(lights, 2026, 10, 6), true);
  assert.equal(eventCoversDay(lights, 2026, 10, 8), true);
  assert.equal(eventCoversDay(lights, 2026, 10, 9), false);
});
