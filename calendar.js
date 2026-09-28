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
