(function () {
  const STORAGE_KEY = "roll-and-write-pwa-game-state-v1";

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

    state.dice.forEach((die, index) => {
      const button = document.createElement("button");
      button.className = "die-button";
      button.type = "button";
      button.setAttribute("aria-label", "Reroll die " + (index + 1));

      const face = document.createElement("div");
      face.className = "die-face " + die.color;
      face.textContent = die.value;

      button.appendChild(face);
      button.onclick = async () => {
        for (let i = 0; i < 5; i++) {
          die.value = roll();
          renderDice();
          await sleep(90);
        }
        saveState();
      };

      diceRow.appendChild(button);
    });
  }

  async function rerollAll() {
    for (let i = 0; i < 5; i++) {
      state.dice.forEach((d) => {
        d.value = roll();
      });
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

  function setTool(tool) {
    state.tool = tool;
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

    if (mark.type === "dot") {
      return el;
    }

    if (mark.type === "number") {
      el.textContent = mark.value;
      return el;
    }

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

  function openNumberPad(point) {
    pendingPoint = point;
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
      button.onclick = () => {
        if (!pendingPoint) return;
        addMark({
          id: makeId(),
          page: pendingPoint.page,
          type: "number",
          x: pendingPoint.x,
          y: pendingPoint.y,
          value: value
        });
        closeNumberPad();
      };
      numberGrid.appendChild(button);
    });
  }

  function findNearbyCircle(page, x, y) {
    for (let i = state.marks.length - 1; i >= 0; i--) {
      const m = state.marks[i];
      if (m.page !== page) continue;
      if (m.type !== "circle" && m.type !== "circlex") continue;

      const dx = m.x - x;
      const dy = m.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.04) {
        return i;
      }
    }
    return -1;
  }

  function handlePageTap(pageNumber, event) {
    const shell = event.currentTarget;
    const rect = shell.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    if (state.tool === "dot") {
      addMark({
        id: makeId(),
        page: pageNumber,
        type: "dot",
        x: x,
        y: y
      });
      return;
    }

    if (state.tool === "number") {
      openNumberPad({
        page: pageNumber,
        x: x,
        y: y
      });
      return;
    }

    if (state.tool === "circle") {
      const existing = findNearbyCircle(pageNumber, x, y);
      if (existing !== -1) {
        if (state.marks[existing].type === "circle") {
          state.marks[existing].type = "circlex";
          saveState();
          rerenderAnnotationsOnly();
        }
      } else {
        addMark({
          id: makeId(),
          page: pageNumber,
          type: "circle",
          x: x,
          y: y
        });
      }
    }
  }

  async function renderPdf() {
    if (!pdfDoc) return;

    const token = ++renderToken;
    pdfStage.innerHTML = "";

    if (emptyState) {
      emptyState.style.display = "none";
    }

    const loadingCard = document.createElement("div");
    loadingCard.className = "loading-card";
    loadingCard.textContent = "Rendering PDF...";
    pdfStage.appendChild(loadingCard);

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      if (token !== renderToken) return;

      const page = await pdfDoc.getPage(p);
      const rawViewport = page.getViewport({ scale: 1 });
      const maxWidth = Math.min(900, pdfViewport.clientWidth - 20);
      const scale = maxWidth / rawViewport.width;
      const renderViewport = page.getViewport({ scale });

      const pageCard = document.createElement("div");
      pageCard.className = "page-card";

      const meta = document.createElement("div");
      meta.className = "page-meta";
      meta.textContent = "Page " + p + " of " + pdfDoc.numPages;
      pageCard.appendChild(meta);

      const shell = document.createElement("div");
      shell.className = "page-shell";
      shell.dataset.page = String(p);

      const canvas = document.createElement("canvas");
      canvas.className = "page-canvas";

      const ctx = canvas.getContext("2d");
      canvas.width = Math.floor(renderViewport.width);
      canvas.height = Math.floor(renderViewport.height);
      canvas.style.width = renderViewport.width + "px";
      canvas.style.height = renderViewport.height + "px";

      await page.render({
        canvasContext: ctx,
        viewport: renderViewport
      }).promise;

      const layer = document.createElement("div");
      layer.className = "annotation-layer";
      layer.dataset.page = String(p);

      shell.appendChild(canvas);
      shell.appendChild(layer);
      shell.onclick = function (event) {
        handlePageTap(p, event);
      };

      pageCard.appendChild(shell);

      if (token === renderToken) {
        if (p === 1) {
          pdfStage.innerHTML = "";
        }
        pdfStage.appendChild(pageCard);
      }
    }

    rerenderAnnotationsOnly();
  }

  async function loadPdf(buffer, name) {
    currentPdfName = name;
    pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;

    if (emptyState) {
      emptyState.style.display = "none";
    }

    pdfNote.textContent = currentPdfName + " loaded.";
    await renderPdf();
  }

  function saveGameToFile() {
    const blob = new Blob(
      [
        JSON.stringify({
          state: state,
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
    state = data.state || createInitialState();
    saveState();
    renderDice();
    renderToolButtons();
    rerenderAnnotationsOnly();

    if (data.pdfName) {
      pdfNote.textContent = 'Game loaded. Please load PDF "' + data.pdfName + '".';
    } else {
      pdfNote.textContent = "Game loaded.";
    }
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
    buildNumberPad();
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
      await loadPdf(buf, f.name);
    };

    gameInput.onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const data = JSON.parse(await f.text());
      loadGame(data);
    };

    closePadButton.onclick = closeNumberPad;
    numberPadBackdrop.onclick = function (event) {
      if (event.target === numberPadBackdrop) {
        closeNumberPad();
      }
    };
  }

  init();
})();
