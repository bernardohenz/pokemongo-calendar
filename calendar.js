import { TAG_LABELS, TAG_PRIORITY, goToToday, parseEvent, parseIndex, shiftMonth, todayParts, viewModel } from "./model.js";

const state = {
  events: [],
  issues: [],
  visibleYear: 0,
  visibleMonth: 0,
  selected: null,
  today: null,
  enabledTags: [...TAG_PRIORITY],
};

const monthTitleNode = document.querySelector("#month-title");
const gridNode = document.querySelector("#grid");
const headingNode = document.querySelector("#day-heading");
const eventsNode = document.querySelector("#day-events");
const issuesNode = document.querySelector("#issues");
const filtersNode = document.querySelector("#filters");

function paint() {
  const view = viewModel(state);
  monthTitleNode.textContent = view.title;
  paintFilters();
  paintIssues(view.issues);
  paintGrid(view.cells);
  paintPanel(view.panel);
}

function paintFilters() {
  for (const button of filtersNode.querySelectorAll("button")) {
    const on = state.enabledTags.includes(button.dataset.tag);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  }
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
    title.className = "event-title";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "event-toggle";
    toggle.setAttribute("aria-expanded", "false");
    const name = document.createElement("span");
    name.className = "event-name";
    const mark = document.createElement("span");
    mark.className = "dot";
    mark.dataset.tag = event.colorTag;
    const label = document.createElement("span");
    label.textContent = event.name;
    name.append(mark, label);
    toggle.append(name);
    const body = document.createElement("div");
    body.className = "event-body";
    body.hidden = true;
    toggle.addEventListener("click", () => {
      const open = body.hidden;
      body.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    title.append(toggle);
    const when = document.createElement("p");
    when.className = "when";
    when.textContent = event.when;
    body.append(when);
    if (event.description.length > 0) {
      const description = document.createElement("ul");
      description.className = "description";
      for (const item of event.description) {
        const line = document.createElement("li");
        line.textContent = item;
        description.append(line);
      }
      body.append(description);
    }
    if (event.coordinates.length > 0) {
      const coordinates = document.createElement("ul");
      coordinates.className = "coordinates";
      for (const point of event.coordinates) {
        const item = document.createElement("li");
        const text = `${point.lat}, ${point.lng}`;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "coordinate";
        button.textContent = text;
        button.title = "Copiar coordenada";
        button.addEventListener("click", async () => {
          try {
            await copyText(text);
          } catch {
            return;
          }
          button.textContent = "Copiado";
          clearTimeout(button.copyTimer);
          button.copyTimer = setTimeout(() => {
            button.textContent = text;
          }, 1200);
        });
        item.append(button);
        if (point.note) {
          const note = document.createElement("span");
          note.className = "coordinate-note";
          note.textContent = point.note;
          item.append(note);
        }
        coordinates.append(item);
      }
      body.append(coordinates);
    }
    if (event.tags.length > 0) {
      const tags = document.createElement("ul");
      tags.className = "tags";
      for (const tag of event.tags) {
        const item = document.createElement("li");
        item.textContent = TAG_LABELS[tag] ?? tag;
        tags.append(item);
      }
      body.append(tags);
    }
    if (event.images.length > 0) {
      const gallery = document.createElement("div");
      gallery.className = "images";
      for (const src of event.images) {
        const link = document.createElement("a");
        link.href = src;
        link.target = "_blank";
        link.rel = "noopener";
        const img = document.createElement("img");
        img.src = src;
        img.alt = event.name;
        link.append(img);
        gallery.append(link);
      }
      body.append(gallery);
    }
    article.append(title, body);
    eventsNode.append(article);
  }
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.append(area);
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  return copied ? Promise.resolve() : Promise.reject(new Error("copy failed"));
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

for (const tag of TAG_PRIORITY) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "filter";
  button.dataset.tag = tag;
  button.textContent = TAG_LABELS[tag];
  button.addEventListener("click", () => {
    if (state.enabledTags.includes(tag)) {
      state.enabledTags = state.enabledTags.filter((item) => item !== tag);
    } else {
      state.enabledTags = [...state.enabledTags, tag];
    }
    paint();
  });
  filtersNode.append(button);
}

const opened = goToToday();
state.today = opened.selected;
state.visibleYear = opened.visibleYear;
state.visibleMonth = opened.visibleMonth;
state.selected = opened.selected;
paint();
load();
