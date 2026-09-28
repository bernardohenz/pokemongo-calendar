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
