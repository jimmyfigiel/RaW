(function () {
  const STORAGE_KEY = "roll-and-write-pwa-game-state-v1";
  const TAP_CANCEL_MS = 250;

  const diceRow = document.getElementById("diceRow");
  const pdfInput = document.getElementById("pdfInput");
  const gameInput = document.getElementById("gameInput");
  const saveGameButton = document.getElementById("saveGameButton");
  const pdfStage = document.getElementById("pdfStage");
  const pdfViewport = document.getElementById("pdfViewport");
  const pdfNote = document.getElementById("pdfNote");
  const emptyState = document.getElementById("emptyState");

  const toolNumber = document.getElementById("toolNumber");
  const toolDot = document.getElementById("toolDot");
  const toolCircle = document.getElementById("toolCircle");
  const undoButton = document.getElementById("undoButton");
  const rollAllButton = document.getElementById("rollAllButton");

  const numberPadBackdrop = document.getElementById("numberPadBackdrop");
  const closePadButton = document.getElementById("closePadButton");
  const numberGrid = document.getElementById("numberGrid");

  function roll() {
    return Math.floor(Math.random() * 6) + 1;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function makeId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return Date.now() + "-" + Math.random().toString(16).slice(2);
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
      marks: []
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createInitialState();
      const parsed = JSON.parse(raw);
      return {
        dice: parsed.dice || createInitialState().dice,
        tool: parsed.tool || "number",
        marks: parsed.marks || []
      };
    } catch {
      return createInitialState();
    }
  }

  let state = loadState();
  let pendingPoint = null;
  let pdfDoc = null;
  let currentPdfName = "";
  let renderToken = 0;

  const view = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    minScale: 1,
    maxScale: 6,
    stageWidth: 0,
    stageHeight: 0
  };

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function renderToolButtons() {
    toolNumber.classList.toggle("active", state.tool === "number");
    toolDot.classList.toggle("active", state.tool === "dot");
    toolCircle.classList.toggle("active", state.tool === "circle");
  }

  function renderDice() {
    diceRow.innerHTML = "";
    state.dice.forEach((die) => {
      const btn = document.createElement("button");
      btn.className = "die-button";

      const face = document.createElement("div");
      face.className = "die-face " + die.color;
      face.textContent = die.value;

      btn.appendChild(face);
      btn.onclick = async () => {
        for (let i = 0; i < 5; i++) {
          die.value = roll();
          renderDice();
          await sleep(90);
        }
        saveState();
      };

      diceRow.appendChild(btn);
    });
  }

  async function rerollAll() {
    for (let i = 0; i < 5; i++) {
      state.dice.forEach((d) => (d.value = roll()));
      renderDice();
      await sleep(90);
    }
    saveState();
  }

  function undo() {
    state.marks.pop();
    saveState();
    rerenderAnnotationsOnly();
  }

  function setTool(t) {
    state.tool = t;
    saveState();
    renderToolButtons();
  }

  function addMark(mark) {
    state.marks.push(mark);
    saveState();
    rerenderAnnotationsOnly();
  }

  function createMarkElement(mark) {
    const el = document.createElement("div");
    el.className = "mark " + mark.type;
    el.style.left = mark.x * 100 + "%";
    el.style.top = mark.y * 100 + "%";

    if (mark.type === "number") el.textContent = mark.value;
    if (mark.type === "dot") return el;

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

  function rerenderAnnotationsOnly() {
    document.querySelectorAll(".annotation-layer").forEach((layer) => {
      const page = Number(layer.dataset.page);
      layer.innerHTML = "";
      state.marks
        .filter((m) => m.page === page)
        .forEach((m) => layer.appendChild(createMarkElement(m)));
    });
  }

  async function renderPdf() {
    if (!pdfDoc) return;

    const token = ++renderToken;
    pdfStage.innerHTML = "";

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      if (token !== renderToken) return;

      const page = await pdfDoc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const scale = pdfViewport.clientWidth / viewport.width;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width * scale;
      canvas.height = viewport.height * scale;
      canvas.style.width = "100%";

      await page.render({
        canvasContext: ctx,
        viewport: page.getViewport({ scale })
      }).promise;

      const shell = document.createElement("div");
      shell.className = "page-shell";
      shell.dataset.page = p;

      const layer = document.createElement("div");
      layer.className = "annotation-layer";
      layer.dataset.page = p;

      shell.appendChild(canvas);
      shell.appendChild(layer);
      pdfStage.appendChild(shell);
    }

    rerenderAnnotationsOnly();
  }

  async function loadPdf(buffer, name) {
    currentPdfName = name;
    pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
    renderPdf();
  }

  function saveGameToFile() {
    const blob = new Blob(
      [
        JSON.stringify({
          state,
          view,
          pdfName: currentPdfName
        })
      ],
      { type: "application/json" }
    );

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "game.json";
    a.click();
  }

  function loadGame(data) {
    state = data.state;
    saveState();
    renderDice();
    renderToolButtons();
    rerenderAnnotationsOnly();
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", async function () {
        try {
          const registration = await navigator.serviceWorker.register("./service-worker.js");
          await registration.update();
        } catch (error) {
          console.error("Service worker registration failed:", error);
        }
      });
    }
  }

  function init() {
    renderDice();
    renderToolButtons();
    registerServiceWorker();

    toolNumber.onclick = () => setTool("number");
    toolDot.onclick = () => setTool("dot");
    toolCircle.onclick = () => setTool("circle");
    undoButton.onclick = undo;
    rollAllButton.onclick = rerollAll;
    saveGameButton.onclick = saveGameToFile;

    pdfInput.onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const buf = await f.arrayBuffer();
      loadPdf(buf, f.name);
    };

    gameInput.onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const data = JSON.parse(await f.text());
      loadGame(data);
    };
  }

  init();
})();
