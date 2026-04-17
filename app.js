(function () {
  const diceRow = document.getElementById("diceRow");
  const board = document.getElementById("board");
  const marksLayer = document.getElementById("marksLayer");
  const statusText = document.getElementById("statusText");
  const installButton = document.getElementById("installButton");

  const toolButtons = {
    number: document.getElementById("toolNumber"),
    dot: document.getElementById("toolDot"),
    circle: document.getElementById("toolCircle"),
  };

  const undoButton = document.getElementById("undoButton");
  const rollButton = document.getElementById("rollButton");

  const state = {
    dice: [roll(), roll(), roll(), roll(), roll(), roll()],
    tool: "dot",
    marks: [],
  };

  let deferredPrompt = null;

  function roll() {
    return Math.floor(Math.random() * 6) + 1;
  }

  function saveState() {
    try {
      localStorage.setItem("roll-and-write-pwa-state", JSON.stringify(state));
    } catch (error) {
      console.warn("Could not save state", error);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem("roll-and-write-pwa-state");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.dice) && parsed.dice.length === 6) {
        state.dice = parsed.dice;
      }
      if (parsed.tool === "number" || parsed.tool === "dot" || parsed.tool === "circle") {
        state.tool = parsed.tool;
      }
      if (Array.isArray(parsed.marks)) {
        state.marks = parsed.marks;
      }
    } catch (error) {
      console.warn("Could not load state", error);
    }
  }

  function renderDice() {
    diceRow.innerHTML = "";
    state.dice.forEach(function (value, index) {
      const button = document.createElement("button");
      button.className = "die " + (index < 3 ? "die-white" : "die-black");
      button.textContent = String(value);
      button.addEventListener("click", function () {
        state.dice[index] = roll();
        saveState();
        renderDice();
      });
      diceRow.appendChild(button);
    });
  }

  function renderTools() {
    Object.keys(toolButtons).forEach(function (key) {
      if (state.tool === key) {
        toolButtons[key].classList.add("active");
      } else {
        toolButtons[key].classList.remove("active");
      }
    });

    const names = {
      number: "Number",
      dot: "Dot",
      circle: "O/X",
    };

    statusText.textContent = "Tool: " + names[state.tool];
  }

  function renderMarks() {
    marksLayer.innerHTML = "";
    state.marks.forEach(function (mark) {
      const el = document.createElement("div");
      el.style.left = (mark.x * 100) + "%";
      el.style.top = (mark.y * 100) + "%";

      if (mark.type === "dot") {
        el.className = "mark-dot";
      } else if (mark.type === "number") {
        el.className = "mark-number";
        el.textContent = mark.value;
      } else if (mark.type === "circle" || mark.type === "circleX") {
        el.className = "mark-circle" + (mark.type === "circleX" ? " crossed" : "");
        const helper = document.createElement("span");
        el.appendChild(helper);
      }

      marksLayer.appendChild(el);
    });
  }

  function setTool(tool) {
    state.tool = tool;
    saveState();
    renderTools();
  }

  function rerollAll() {
    state.dice = state.dice.map(function () {
      return roll();
    });
    saveState();
    renderDice();
  }

  function undo() {
    state.marks = state.marks.slice(0, -1);
    saveState();
    renderMarks();
  }

  function boardPointFromEvent(event) {
    const rect = board.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    return { x: x, y: y };
  }

  function findNearbyCircle(x, y) {
    for (let i = state.marks.length - 1; i >= 0; i -= 1) {
      const mark = state.marks[i];
      if (mark.type !== "circle" && mark.type !== "circleX") continue;
      const dx = mark.x - x;
      const dy = mark.y - y;
      if (Math.sqrt((dx * dx) + (dy * dy)) < 0.05) {
        return i;
      }
    }
    return -1;
  }

  function handleBoardClick(event) {
    const point = boardPointFromEvent(event);

    if (state.tool === "dot") {
      state.marks.push({ type: "dot", x: point.x, y: point.y });
      saveState();
      renderMarks();
      return;
    }

    if (state.tool === "number") {
      const value = window.prompt("Enter number");
      if (!value) return;
      state.marks.push({ type: "number", x: point.x, y: point.y, value: value });
      saveState();
      renderMarks();
      return;
    }

    if (state.tool === "circle") {
      const existingIndex = findNearbyCircle(point.x, point.y);
      if (existingIndex !== -1) {
        state.marks[existingIndex].type = "circleX";
      } else {
        state.marks.push({ type: "circle", x: point.x, y: point.y });
      }
      saveState();
      renderMarks();
    }
  }

  function registerInstallPrompt() {
    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      deferredPrompt = event;
      installButton.classList.remove("hidden");
    });

    installButton.addEventListener("click", async function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch (error) {
        console.warn("Install prompt failed", error);
      }
      deferredPrompt = null;
      installButton.classList.add("hidden");
    });
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("./service-worker.js").catch(function (error) {
          console.warn("Service worker registration failed", error);
        });
      });
    }
  }

  function bindEvents() {
    toolButtons.number.addEventListener("click", function () {
      setTool("number");
    });

    toolButtons.dot.addEventListener("click", function () {
      setTool("dot");
    });

    toolButtons.circle.addEventListener("click", function () {
      setTool("circle");
    });

    undoButton.addEventListener("click", undo);
    rollButton.addEventListener("click", rerollAll);
    board.addEventListener("click", handleBoardClick);
  }

  loadState();
  bindEvents();
  renderDice();
  renderTools();
  renderMarks();
  registerInstallPrompt();
  registerServiceWorker();
})();
