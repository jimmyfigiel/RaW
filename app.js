import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";

const STORAGE_KEY = "roll-and-write-pwa-pdf-state-v1";

const diceRow = document.getElementById("diceRow");
const pdfInput = document.getElementById("pdfInput");
const pdfViewer = document.getElementById("pdfViewer");
const pdfNote = document.getElementById("pdfNote");
const emptyState = document.getElementById("emptyState");

const toolNumber = document.getElementById("toolNumber");
const toolDot = document.getElementById("toolDot");
const toolCircle = document.getElementById("toolCircle");
const undoButton = document.getElementById("undoButton");
const rollAllButton = document.getElementById("rollAllButton");

const zoomOutButton = document.getElementById("zoomOutButton");
const zoomInButton = document.getElementById("zoomInButton");
const zoomLabel = document.getElementById("zoomLabel");

const numberPadBackdrop = document.getElementById("numberPadBackdrop");
const closePadButton = document.getElementById("closePadButton");
const numberGrid = document.getElementById("numberGrid");

function roll() {
  return Math.floor(Math.random() * 6) + 1;
}

function makeId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Date.now() + "-" + Math.random().toString(16).slice(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createInitialState() {
  return {
    dice: [
      { id: "w1", color: "white", value: roll() },
      { id: "w2", color: "white", value: roll() },
      { id: "w3", color: "white", value: roll() },
      { id: "b1", color: "black", value: roll() },
      { id: "b2", color: "black", value: roll() },
      { id: "b3", color: "black", value: roll() }
    ],
    tool: "number",
    marks: [],
    zoom: 1
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    return {
      dice: Array.isArray(parsed.dice) ? parsed.dice : createInitialState().dice,
      tool: parsed.tool || "number",
      marks: Array.isArray(parsed.marks) ? parsed.marks : [],
      zoom: typeof parsed.zoom === "number" ? parsed.zoom : 1
    };
  } catch (err) {
    return createInitialState();
  }
}

let state = loadState();
let pendingPoint = null;
let pdfDoc = null;
let currentPdfName = "";
let currentPdfData = null;
let renderToken = 0;
let isRollingAll = false;
const rollingDiceIds = new Set();

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      dice: state.dice,
      tool: state.tool,
      marks: state.marks,
      zoom: state.zoom
    })
  );
}

function renderToolButtons() {
  toolNumber.classList.toggle("active", state.tool === "number");
  toolDot.classList.toggle("active", state.tool === "dot");
  toolCircle.classList.toggle("active", state.tool === "circle");
}

function renderZoomLabel() {
  zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
}

function renderDice() {
  diceRow.innerHTML = "";

  state.dice.forEach((die, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "die-button";
    button.disabled = isRollingAll || rollingDiceIds.has(die.id);
    button.setAttribute("aria-label", `Reroll die ${index + 1}`);

    const face = document.createElement("div");
    face.className = `die-face ${die.color}`;
    face.textContent = String(die.value);

    button.appendChild(face);
    button.addEventListener("click", function () {
      rerollOneAnimated(die.id);
    });

    diceRow.appendChild(button);
  });
}

async function animateDieRoll(die) {
  for (let i = 0; i < 5; i += 1) {
    die.value = roll();
    renderDice();
    await sleep(90);
  }
}

async function rerollOneAnimated(dieId) {
  if (isRollingAll || rollingDiceIds.has(dieId)) return;

  const die = state.dice.find((item) => item.id === dieId);
  if (!die) return;

  rollingDiceIds.add(dieId);
  renderDice();

  await animateDieRoll(die);

  rollingDiceIds.delete(dieId);
  saveState();
  renderDice();
}

async function rerollAll() {
  if (isRollingAll || rollingDiceIds.size > 0) return;

  isRollingAll = true;
  renderDice();

  for (let i = 0; i < 5; i += 1) {
    state.dice.forEach((die) => {
      die.value = roll();
    });
    renderDice();
    await sleep(90);
  }

  isRollingAll = false;
  saveState();
  renderDice();
}

function undo() {
  state.marks = state.marks.slice(0, -1);
  saveState();
  rerenderAnnotationsOnly();
}

function setTool(nextTool) {
  state.tool = nextTool;
  saveState();
  renderToolButtons();
}

function openNumberPad(page, x, y) {
  pendingPoint = { page, x, y };
  numberPadBackdrop.classList.remove("hidden");
}

function closeNumberPad() {
  pendingPoint = null;
  numberPadBackdrop.classList.add("hidden");
}

function buildNumberPad() {
  const values = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  numberGrid.innerHTML = "";

  values.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "number-pick";
    button.textContent = value;
    button.addEventListener("click", function () {
      if (!pendingPoint) return;

      addMark({
        id: makeId(),
        page: pendingPoint.page,
        type: "number",
        x: pendingPoint.x,
        y: pendingPoint.y,
        value
      });

      closeNumberPad();
    });

    numberGrid.appendChild(button);
  });
}

function addMark(mark) {
  state.marks.push(mark);
  saveState();
  rerenderAnnotationsOnly();
}

function marksForPage(pageNumber) {
  return state.marks.filter((mark) => mark.page === pageNumber);
}

function findNearbyCircle(pageNumber, x, y) {
  for (let i = state.marks.length - 1; i >= 0; i -= 1) {
    const mark = state.marks[i];
    if (mark.page !== pageNumber) continue;
    if (mark.type !== "circle" && mark.type !== "circlex") continue;

    const dx = mark.x - x;
    const dy = mark.y - y;

    if (Math.sqrt(dx * dx + dy * dy) < 0.04) {
      return i;
    }
  }
  return -1;
}

function placeFromTool(pageNumber, x, y) {
  if (state.tool === "dot") {
    addMark({
      id: makeId(),
      page: pageNumber,
      type: "dot",
      x,
      y
    });
    return;
  }

  if (state.tool === "number") {
    openNumberPad(pageNumber, x, y);
    return;
  }

  if (state.tool === "circle") {
    const idx = findNearbyCircle(pageNumber, x, y);
    if (idx !== -1) {
      if (state.marks[idx].type === "circle") {
        state.marks[idx].type = "circlex";
        saveState();
        rerenderAnnotationsOnly();
      }
    } else {
      addMark({
        id: makeId(),
        page: pageNumber,
        type: "circle",
        x,
        y
      });
    }
  }
}

function createMarkElement(mark) {
  const el = document.createElement("div");
  el.className = `mark ${mark.type}`;
  el.style.left = `${mark.x * 100}%`;
  el.style.top = `${mark.y * 100}%`;

  if (mark.type === "dot") {
    return el;
  }

  if (mark.type === "number") {
    el.textContent = mark.value;
    return el;
  }

  if (mark.type === "circle" || mark.type === "circlex") {
    const ring = document.createElement("div");
    ring.className = "circle-ring";
    el.appendChild(ring);

    if (mark.type === "circlex") {
      const a = document.createElement("div");
      a.className = "x-line a";
      const b = document.createElement("div");
      b.className = "x-line b";
      el.appendChild(a);
      el.appendChild(b);
    }

    return el;
  }

  return el;
}

function renderAnnotationsForPage(pageNumber, layer) {
  layer.innerHTML = "";
  const pageMarks = marksForPage(pageNumber);

  pageMarks.forEach((mark) => {
    layer.appendChild(createMarkElement(mark));
  });
}

function rerenderAnnotationsOnly() {
  const layers = pdfViewer.querySelectorAll(".annotation-layer");
  layers.forEach((layer) => {
    const pageNumber = Number(layer.dataset.page);
    renderAnnotationsForPage(pageNumber, layer);
  });
}

function makeLoadingCard(text) {
  const div = document.createElement("div");
  div.className = "loading-card";
  div.textContent = text;
  return div;
}

function createPageTapHandlers(pageShell, pageNumber) {
  const pointerState = {
    map: {}
  };

  pageShell.addEventListener("pointerdown", (event) => {
    const isTouch = event.pointerType === "touch";
    const activeTouches = isTouch ? Object.keys(pointerState.map).length + 1 : 1;

    pointerState.map[event.pointerId] = {
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      multiTouch: activeTouches > 1
    };

    if (activeTouches > 1) {
      Object.keys(pointerState.map).forEach((key) => {
        pointerState.map[key].multiTouch = true;
      });
    }
  });

  pageShell.addEventListener("pointermove", (event) => {
    const tracker = pointerState.map[event.pointerId];
    if (!tracker) return;

    const dx = event.clientX - tracker.startX;
    const dy = event.clientY - tracker.startY;

    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      tracker.moved = true;
    }
  });

  pageShell.addEventListener("pointerup", (event) => {
    const tracker = pointerState.map[event.pointerId];
    if (!tracker) return;

    const shouldPlace = !tracker.moved && !tracker.multiTouch;
    delete pointerState.map[event.pointerId];

    if (!shouldPlace) return;

    const rect = pageShell.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

    placeFromTool(pageNumber, x, y);
  });

  pageShell.addEventListener("pointercancel", (event) => {
    delete pointerState.map[event.pointerId];
  });
}

async function renderPdf() {
  if (!pdfDoc) return;

  const myToken = ++renderToken;
  pdfViewer.innerHTML = "";
  pdfViewer.appendChild(makeLoadingCard("Rendering PDF..."));
  if (emptyState) emptyState.style.display = "none";

  const nextViewer = document.createElement("div");

  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
    if (myToken !== renderToken) return;

    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: state.zoom });

    const pageCard = document.createElement("div");
    pageCard.className = "page-card";

    const meta = document.createElement("div");
    meta.className = "page-meta";
    meta.textContent = `Page ${pageNumber} of ${pdfDoc.numPages}`;
    pageCard.appendChild(meta);

    const pageShell = document.createElement("div");
    pageShell.className = "page-shell";
    pageShell.style.aspectRatio = `${viewport.width} / ${viewport.height}`;

    const canvas = document.createElement("canvas");
    canvas.className = "page-canvas";
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext("2d");
    await page.render({
      canvasContext: ctx,
      viewport
    }).promise;

    const annotationLayer = document.createElement("div");
    annotationLayer.className = "annotation-layer";
    annotationLayer.dataset.page = String(pageNumber);

    renderAnnotationsForPage(pageNumber, annotationLayer);

    pageShell.appendChild(canvas);
    pageShell.appendChild(annotationLayer);
    createPageTapHandlers(pageShell, pageNumber);

    pageCard.appendChild(pageShell);
    nextViewer.appendChild(pageCard);
  }

  if (myToken !== renderToken) return;

  pdfViewer.innerHTML = "";
  pdfViewer.appendChild(nextViewer);

  pdfNote.textContent = currentPdfName
    ? `${currentPdfName} loaded. Scroll through pages below. Tap to place marks.`
    : "PDF loaded. Scroll through pages below. Tap to place marks.";
}

async function loadPdfFromArrayBuffer(buffer, fileName) {
  currentPdfData = buffer;
  currentPdfName = fileName || "PDF";
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  pdfDoc = await loadingTask.promise;
  await renderPdf();
}

function updateZoom(nextZoom) {
  state.zoom = Math.max(0.5, Math.min(3, Number(nextZoom.toFixed(2))));
  saveState();
  renderZoomLabel();

  if (pdfDoc) {
    renderPdf();
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./service-worker.js").catch(function () {});
    });
  }
}

function init() {
  renderDice();
  renderToolButtons();
  renderZoomLabel();
  buildNumberPad();
  registerServiceWorker();

  toolNumber.addEventListener("click", () => setTool("number"));
  toolDot.addEventListener("click", () => setTool("dot"));
  toolCircle.addEventListener("click", () => setTool("circle"));
  undoButton.addEventListener("click", undo);
  rollAllButton.addEventListener("click", rerollAll);

  zoomOutButton.addEventListener("click", () => updateZoom(state.zoom - 0.1));
  zoomInButton.addEventListener("click", () => updateZoom(state.zoom + 0.1));

  pdfInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    await loadPdfFromArrayBuffer(buffer, file.name);
  });

  closePadButton.addEventListener("click", closeNumberPad);
  numberPadBackdrop.addEventListener("click", (event) => {
    if (event.target === numberPadBackdrop) {
      closeNumberPad();
    }
  });
}

init();
