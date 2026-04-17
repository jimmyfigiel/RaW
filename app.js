(function () {
  const STORAGE_KEY = "roll-and-write-pwa-state-v2";

  const diceRow = document.getElementById("diceRow");
  const annotationLayer = document.getElementById("annotationLayer");
  const board = document.getElementById("board");

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
      if (!parsed || !Array.isArray(parsed.dice) || !Array.isArray(parsed.marks)) {
        return createInitialState();
      }
      return {
        dice: parsed.dice,
        tool: parsed.tool || "number",
        marks: parsed.marks
      };
    } catch (err) {
      return createInitialState();
    }
  }

  let state = loadState();
  let pendingPoint = null;

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function setTool(nextTool) {
    state.tool = nextTool;
    renderToolButtons();
    saveState();
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
      button.type = "button";
      button.className = "die-button";
      button.setAttribute("aria-label", "Reroll die " + (index + 1));

      const face = document.createElement("div");
      face.className = "die-face " + die.color;
      face.textContent = String(die.value);

      button.appendChild(face);
      button.addEventListener("click", function () {
        die.value = roll();
        saveState();
        renderDice();
      });

      diceRow.appendChild(button);
    });
  }

  function renderMarks() {
    annotationLayer.innerHTML = "";

    state.marks.forEach((mark) => {
      const el = document.createElement("div");
      el.className = "mark " + mark.type;
      el.style.left = (mark.x * 100) + "%";
      el.style.top = (mark.y * 100) + "%";

      if (mark.type === "dot") {
        annotationLayer.appendChild(el);
        return;
      }

      if (mark.type === "number") {
        el.textContent = mark.value;
        annotationLayer.appendChild(el);
        return;
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

        annotationLayer.appendChild(el);
      }
    });
  }

  function renderSheetGrid() {
    const svg = document.querySelector(".sheet-svg");
    const gridDataEl = document.getElementById("gridData");
    if (!svg || !gridDataEl) return;

    let cfg;
    try {
      cfg = JSON.parse(gridDataEl.textContent);
    } catch (e) {
      return;
    }

    for (let r = 0; r < cfg.rows; r += 1) {
      for (let c = 0; c < cfg.cols; c += 1) {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const x = cfg.startX + c * cfg.stepX + cfg.size / 2;
        const y = cfg.startY + r * cfg.stepY + cfg.size / 2;
        circle.setAttribute("cx", String(x));
        circle.setAttribute("cy", String(y));
        circle.setAttribute("r", String(cfg.size / 2));
        circle.setAttribute("class", "sheet-circle");
        circle.setAttribute("fill", "none");
        circle.setAttribute("stroke", "#c4c8cf");
        circle.setAttribute("stroke-width", "2");
        svg.appendChild(circle);
      }
    }
  }

  function rerollAll() {
    state.dice = state.dice.map((die) => ({
      id: die.id,
      color: die.color,
      value: roll()
    }));
    saveState();
    renderDice();
  }

  function undo() {
    state.marks = state.marks.slice(0, -1);
    saveState();
    renderMarks();
  }

  function addMark(mark) {
    state.marks.push(mark);
    saveState();
    renderMarks();
  }

  function findNearbyCircle(x, y) {
    for (let i = state.marks.length - 1; i >= 0; i -= 1) {
      const mark = state.marks[i];
      if (mark.type !== "circle" && mark.type !== "circlex") continue;

      const dx = mark.x - x;
      const dy = mark.y - y;

      if (Math.sqrt(dx * dx + dy * dy) < 0.04) {
        return i;
      }
    }
    return -1;
  }

  function openNumberPad(x, y) {
    pendingPoint = { x, y };
    numberPadBackdrop.classList.remove("hidden");
  }

  function closeNumberPad() {
    pendingPoint = null;
    numberPadBackdrop.classList.add("hidden");
  }

  function placeFromTool(x, y) {
    if (state.tool === "dot") {
      addMark({
        id: makeId(),
        type: "dot",
        x,
        y
      });
      return;
    }

    if (state.tool === "number") {
      openNumberPad(x, y);
      return;
    }

    if (state.tool === "circle") {
      const idx = findNearbyCircle(x, y);
      if (idx !== -1) {
        if (state.marks[idx].type === "circle") {
          state.marks[idx].type = "circlex";
          saveState();
          renderMarks();
        }
      } else {
        addMark({
          id: makeId(),
          type: "circle",
          x,
          y
        });
      }
    }
  }

  function handleBoardClick(event) {
    const rect = board.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    placeFromTool(x, y);
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

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("./service-worker.js").catch(function () {});
      });
    }
  }

  function init() {
    renderSheetGrid();
    renderToolButtons();
    renderDice();
    renderMarks();
    buildNumberPad();
    registerServiceWorker();

    toolNumber.addEventListener("click", function () {
      setTool("number");
    });

    toolDot.addEventListener("click", function () {
      setTool("dot");
    });

    toolCircle.addEventListener("click", function () {
      setTool("circle");
    });

    undoButton.addEventListener("click", undo);
    rollAllButton.addEventListener("click", rerollAll);
    board.addEventListener("click", handleBoardClick);
    closePadButton.addEventListener("click", closeNumberPad);
    numberPadBackdrop.addEventListener("click", function (event) {
      if (event.target === numberPadBackdrop) {
        closeNumberPad();
      }
    });
  }

  init();
})();
