(function () {
  const STORAGE_KEY = "roll-and-write-pwa-custom-viewport-v1";
  const TAP_CANCEL_MS = 250;

  const diceRow = document.getElementById("diceRow");
  const pdfInput = document.getElementById("pdfInput");
  const pdfStage = document.getElementById("pdfStage");
  const pdfViewport = document.getElementById("pdfViewport");
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
    } catch (e) {
      return createInitialState();
    }
  }

  let state = loadState();
  let pendingPoint = null;
  let pdfDoc = null;
  let currentPdfName = "";
  let renderToken = 0;
  let isRollingAll = false;
  const rollingDiceIds = new Set();

  const view = {
    scale: Math.max(0.5, Math.min(3, state.zoom || 1)),
    offsetX: 0,
    offsetY: 0,
    minScale: 0.5,
    maxScale: 3,
    stageWidth: 0,
    stageHeight: 0
  };

  const gesture = {
    pointers: new Map(),
    mode: "none",
    startDistance: 0,
    startScale: 1,
    startMidWorldX: 0,
    startMidWorldY: 0,
    tapCandidate: null,
    suppressTapUntil: 0
  };

  function saveState() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        dice: state.dice,
        tool: state.tool,
        marks: state.marks,
        zoom: view.scale
      })
    );
  }

  function renderToolButtons() {
    toolNumber.classList.toggle("active", state.tool === "number");
    toolDot.classList.toggle("active", state.tool === "dot");
    toolCircle.classList.toggle("active", state.tool === "circle");
  }

  function renderZoomLabel() {
    zoomLabel.textContent = Math.round(view.scale * 100) + "%";
  }

  function renderDice() {
    diceRow.innerHTML = "";

    state.dice.forEach((die, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "die-button";
      button.disabled = isRollingAll || rollingDiceIds.has(die.id);
      button.setAttribute("aria-label", "Reroll die " + (index + 1));

      const face = document.createElement("div");
      face.className = "die-face " + die.color;
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
    pendingPoint = { page: page, x: x, y: y };
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
          value: value
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
      if (Math.sqrt(dx * dx + dy * dy) < 0.04) return i;
    }
    return -1;
  }

  function placeFromTool(pageNumber, x, y) {
    if (state.tool === "dot") {
      addMark({ id: makeId(), page: pageNumber, type: "dot", x: x, y: y });
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
        addMark({ id: makeId(), page: pageNumber, type: "circle", x: x, y: y });
      }
    }
  }

  function createMarkElement(mark) {
    const el = document.createElement("div");
    el.className = "mark " + mark.type;
    el.style.left = mark.x * 100 + "%";
    el.style.top = mark.y * 100 + "%";

    if (mark.type === "dot") return el;

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

  function renderAnnotationsForPage(pageNumber, layer) {
    layer.innerHTML = "";
    marksForPage(pageNumber).forEach((mark) => {
      layer.appendChild(createMarkElement(mark));
    });
  }

  function rerenderAnnotationsOnly() {
    pdfStage.querySelectorAll(".annotation-layer").forEach((layer) => {
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

  function applyTransform() {
    pdfStage.style.transform =
      "translate(" + view.offsetX + "px, " + view.offsetY + "px) scale(" + view.scale + ")";
    renderZoomLabel();
  }

  function clampOffsets() {
    const viewportWidth = pdfViewport.clientWidth;
    const viewportHeight = pdfViewport.clientHeight;
    const scaledWidth = view.stageWidth * view.scale;
    const scaledHeight = view.stageHeight * view.scale;

    if (scaledWidth <= viewportWidth) {
      view.offsetX = (viewportWidth - scaledWidth) / 2;
    } else {
      const minX = viewportWidth - scaledWidth;
      if (view.offsetX < minX) view.offsetX = minX;
      if (view.offsetX > 0) view.offsetX = 0;
    }

    if (scaledHeight <= viewportHeight) {
      view.offsetY = (viewportHeight - scaledHeight) / 2;
    } else {
      const minY = viewportHeight - scaledHeight;
      if (view.offsetY < minY) view.offsetY = minY;
      if (view.offsetY > 0) view.offsetY = 0;
    }
  }

  function worldPointFromScreen(clientX, clientY) {
    const rect = pdfViewport.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    return {
      x: (localX - view.offsetX) / view.scale,
      y: (localY - view.offsetY) / view.scale
    };
  }

  function setScaleAround(nextScale, worldX, worldY, anchorScreenX, anchorScreenY) {
    view.scale = Math.max(view.minScale, Math.min(view.maxScale, Number(nextScale.toFixed(3))));
    view.offsetX = anchorScreenX - worldX * view.scale;
    view.offsetY = anchorScreenY - worldY * view.scale;
    clampOffsets();
    applyTransform();
    state.zoom = view.scale;
    saveState();
  }

  function getDistance(a, b) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getMidpoint(a, b) {
    return {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2
    };
  }

  function hitTestPage(worldX, worldY) {
    const pageShells = Array.from(pdfStage.querySelectorAll(".page-shell"));

    for (let i = 0; i < pageShells.length; i += 1) {
      const shell = pageShells[i];
      const left = shell.offsetLeft;
      const top = shell.offsetTop;
      const width = shell.offsetWidth;
      const height = shell.offsetHeight;

      if (
        worldX >= left &&
        worldX <= left + width &&
        worldY >= top &&
        worldY <= top + height
      ) {
        return {
          page: Number(shell.dataset.page),
          x: (worldX - left) / width,
          y: (worldY - top) / height
        };
      }
    }

    return null;
  }

  function suppressTapTemporarily() {
    gesture.suppressTapUntil = Date.now() + TAP_CANCEL_MS;
  }

  function resetGestureMode() {
    gesture.mode = "none";
    gesture.startDistance = 0;
    gesture.startScale = view.scale;
    gesture.startMidWorldX = 0;
    gesture.startMidWorldY = 0;
    gesture.tapCandidate = null;
  }

  function updateGestureMode() {
    const pointers = Array.from(gesture.pointers.values());

    if (pointers.length >= 2) {
      const a = pointers[0];
      const b = pointers[1];
      const midpoint = getMidpoint(a, b);
      const midpointWorld = worldPointFromScreen(midpoint.x, midpoint.y);

      gesture.mode = "gesture";
      gesture.startDistance = getDistance(a, b);
      gesture.startScale = view.scale;
      gesture.startMidWorldX = midpointWorld.x;
      gesture.startMidWorldY = midpointWorld.y;
      gesture.tapCandidate = null;
      suppressTapTemporarily();
      return;
    }

    if (pointers.length === 1) {
      const p = pointers[0];
      gesture.mode = "tap";
      gesture.tapCandidate = {
        pointerId: p.pointerId,
        startX: p.clientX,
        startY: p.clientY
      };
      return;
    }

    resetGestureMode();
  }

  function handleViewportPointerDown(event) {
    event.preventDefault();
    pdfViewport.setPointerCapture(event.pointerId);

    gesture.pointers.set(event.pointerId, {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY
    });

    updateGestureMode();
  }

  function handleViewportPointerMove(event) {
    if (!gesture.pointers.has(event.pointerId)) return;
    event.preventDefault();

    gesture.pointers.set(event.pointerId, {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY
    });

    const pointers = Array.from(gesture.pointers.values());

    if (pointers.length >= 2) {
      const a = pointers[0];
      const b = pointers[1];
      const midpoint = getMidpoint(a, b);
      const dist = getDistance(a, b);

      if (!gesture.startDistance) {
        updateGestureMode();
        return;
      }

      const rawScale = gesture.startScale * (dist / gesture.startDistance);
      const nextScale = Math.max(view.minScale, Math.min(view.maxScale, rawScale));

      const rect = pdfViewport.getBoundingClientRect();
      const anchorScreenX = midpoint.x - rect.left;
      const anchorScreenY = midpoint.y - rect.top;

      view.scale = nextScale;
      view.offsetX = anchorScreenX - gesture.startMidWorldX * view.scale;
      view.offsetY = anchorScreenY - gesture.startMidWorldY * view.scale;

      clampOffsets();
      applyTransform();
      state.zoom = view.scale;
      saveState();
      suppressTapTemporarily();
      return;
    }

    if (gesture.mode === "tap" && gesture.tapCandidate) {
      const dx = event.clientX - gesture.tapCandidate.startX;
      const dy = event.clientY - gesture.tapCandidate.startY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        gesture.mode = "moved";
        gesture.tapCandidate = null;
        suppressTapTemporarily();
      }
    }
  }

  function handleViewportPointerUp(event) {
    if (!gesture.pointers.has(event.pointerId)) return;
    event.preventDefault();

    const hadTapCandidate =
      gesture.mode === "tap" &&
      gesture.tapCandidate &&
      gesture.tapCandidate.pointerId === event.pointerId &&
      Date.now() > gesture.suppressTapUntil;

    if (hadTapCandidate) {
      const world = worldPointFromScreen(event.clientX, event.clientY);
      const hit = hitTestPage(world.x, world.y);
      if (hit) {
        placeFromTool(hit.page, hit.x, hit.y);
      }
    }

    gesture.pointers.delete(event.pointerId);

    if (gesture.pointers.size > 0) {
      updateGestureMode();
    } else {
      resetGestureMode();
    }
  }

  function handleViewportPointerCancel(event) {
    gesture.pointers.delete(event.pointerId);
    suppressTapTemporarily();
    if (gesture.pointers.size > 0) {
      updateGestureMode();
    } else {
      resetGestureMode();
    }
  }

  async function renderPdf() {
    if (!pdfDoc) return;

    const myToken = ++renderToken;
    pdfStage.innerHTML = "";
    pdfStage.appendChild(makeLoadingCard("Rendering PDF..."));
    if (emptyState) emptyState.style.display = "none";

    const stageContent = document.createElement("div");
    stageContent.style.width = "760px";
    stageContent.style.maxWidth = "760px";

    const viewportWidth = Math.max(320, Math.min(760, pdfViewport.clientWidth - 20));

    for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
      if (myToken !== renderToken) return;

      const page = await pdfDoc.getPage(pageNumber);
      const rawViewport = page.getViewport({ scale: 1 });
      const fitWidth = viewportWidth - 20;
      const baseScale = fitWidth / rawViewport.width;
      const displayWidth = rawViewport.width * baseScale;
      const displayHeight = rawViewport.height * baseScale;

      const pageCard = document.createElement("div");
      pageCard.className = "page-card";
      pageCard.style.width = viewportWidth + "px";

      const meta = document.createElement("div");
      meta.className = "page-meta";
      meta.textContent = "Page " + pageNumber + " of " + pdfDoc.numPages;
      pageCard.appendChild(meta);

      const pageShell = document.createElement("div");
      pageShell.className = "page-shell";
      pageShell.dataset.page = String(pageNumber);
      pageShell.style.width = displayWidth + "px";
      pageShell.style.height = displayHeight + "px";

      const canvas = document.createElement("canvas");
      canvas.className = "page-canvas";

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(displayWidth * dpr);
      canvas.height = Math.floor(displayHeight * dpr);
      canvas.style.width = displayWidth + "px";
      canvas.style.height = displayHeight + "px";

      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      await page.render({
        canvasContext: ctx,
        viewport: page.getViewport({ scale: baseScale })
      }).promise;

      const annotationLayer = document.createElement("div");
      annotationLayer.className = "annotation-layer";
      annotationLayer.dataset.page = String(pageNumber);
      renderAnnotationsForPage(pageNumber, annotationLayer);

      pageShell.appendChild(canvas);
      pageShell.appendChild(annotationLayer);
      pageCard.appendChild(pageShell);
      stageContent.appendChild(pageCard);
    }

    if (myToken !== renderToken) return;

    pdfStage.innerHTML = "";
    pdfStage.appendChild(stageContent);

    const rect = stageContent.getBoundingClientRect();
    view.stageWidth = rect.width;
    view.stageHeight = rect.height;

    view.minScale = Math.min(
      1,
      Math.max(0.35, pdfViewport.clientWidth / Math.max(1, view.stageWidth))
    );

    if (view.scale < view.minScale) {
      view.scale = view.minScale;
    }

    clampOffsets();
    applyTransform();

    pdfNote.textContent = currentPdfName
      ? currentPdfName + " loaded. One tap places marks. Two fingers pan and zoom inside the PDF area."
      : "PDF loaded. One tap places marks. Two fingers pan and zoom inside the PDF area.";

    state.zoom = view.scale;
    saveState();
  }

  async function loadPdfFromArrayBuffer(buffer, fileName) {
    currentPdfName = fileName || "PDF";
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    pdfDoc = await loadingTask.promise;
    await renderPdf();
  }

  function updateZoom(deltaScale) {
    const rect = pdfViewport.getBoundingClientRect();
    const anchorScreenX = rect.width / 2;
    const anchorScreenY = rect.height / 2;
    const world = {
      x: (anchorScreenX - view.offsetX) / view.scale,
      y: (anchorScreenY - view.offsetY) / view.scale
    };
    setScaleAround(deltaScale, world.x, world.y, anchorScreenX, anchorScreenY);
    suppressTapTemporarily();
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

    zoomOutButton.addEventListener("click", function () {
      updateZoom(view.scale - 0.1);
    });
    zoomInButton.addEventListener("click", function () {
      updateZoom(view.scale + 0.1);
    });

    pdfInput.addEventListener("change", async function (event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const buffer = await file.arrayBuffer();
      await loadPdfFromArrayBuffer(buffer, file.name);
      suppressTapTemporarily();
    });

    closePadButton.addEventListener("click", closeNumberPad);
    numberPadBackdrop.addEventListener("click", function (event) {
      if (event.target === numberPadBackdrop) {
        closeNumberPad();
      }
    });

    pdfViewport.addEventListener("pointerdown", handleViewportPointerDown, { passive: false });
    pdfViewport.addEventListener("pointermove", handleViewportPointerMove, { passive: false });
    pdfViewport.addEventListener("pointerup", handleViewportPointerUp, { passive: false });
    pdfViewport.addEventListener("pointercancel", handleViewportPointerCancel, { passive: false });

    window.addEventListener("resize", function () {
      if (pdfDoc) {
        renderPdf();
        suppressTapTemporarily();
      }
    });
  }

  init();
})();
