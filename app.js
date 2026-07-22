(() => {
  "use strict";

  const viewport = document.getElementById("viewport");
  const stage = document.getElementById("stage");
  const boardContent = document.getElementById("boardContent");
  const zoomValue = document.getElementById("zoomValue");
  const hint = document.getElementById("hint");
  const svg = document.getElementById("connectors");
  const importInput = document.getElementById("layoutImport");
  const toast = document.getElementById("editorToast");

  const STAGE_WIDTH = 5000;
  const STAGE_HEIGHT = 3600;
  const CONTENT_WIDTH = 1800;
  const CONTENT_HEIGHT = 1350;
  const CONTENT_LEFT = 1600;
  const CONTENT_TOP = 1100;
  const MIN_SCALE = 0.20;
  const MAX_SCALE = 1.8;
  const STORAGE_KEY = "airtaskerMindmapFullCanvasLayoutV3";

  let scale = 0.75;
  let x = 20;
  let y = 20;
  let canvasDragging = false;
  let lastX = 0;
  let lastY = 0;
  let editMode = false;
  let activeDrag = null;
  let toastTimer = null;

  const connections = [
    ["hub", "daily-title", "blue"],
    ["hub", "proposal-title", "purple"],
    ["hub", "services-title", "green"],
    ["hub", "scope-title", "orange"],
    ["hub", "followup-title", "pink"],
    ["hub", "trust-title", "yellow"],
    ["hub", "tracker-title", "violet"],
    ["hub", "checklist-title", "teal"],

    ["daily-title", "daily-windows", "blue"],
    ["daily-title", "daily-volume", "blue"],
    ["daily-title", "daily-score", "blue"],
    ["daily-title", "daily-walk", "blue"],

    ["proposal-title", "proposal-steps", "purple"],
    ["proposal-title", "proposal-base", "purple"],
    ["proposal-title", "proposal-rules", "purple"],

    ["services-title", "services-list", "green"],
    ["services-title", "services-rule", "green"],

    ["scope-title", "scope-list", "orange"],
    ["followup-title", "followup-card", "pink"],
    ["trust-title", "trust-card", "yellow"],

    ["tracker-title", "tracker-fields", "violet"],
    ["tracker-title", "tracker-metrics", "violet"],
    ["tracker-title", "tracker-review", "violet"],

    ["checklist-title", "checklist-strip", "teal"]
  ];

  const colors = {
    blue: "#2563eb",
    purple: "#6d5ce7",
    green: "#16a34a",
    orange: "#f97316",
    pink: "#ec4899",
    yellow: "#eab308",
    violet: "#9333ea",
    teal: "#0f9ea8"
  };

  function showToast(message, type = "") {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `editor-toast is-visible${type ? ` is-${type}` : ""}`;

    toastTimer = window.setTimeout(() => {
      toast.className = "editor-toast";
    }, 2800);
  }

  function getStageNodeElements() {
    return [...boardContent.querySelectorAll(".node[id]")];
  }

  function getEditableTextElements(node) {
    const selector = [
      "h1", "h2", "h3", "p", "li", "td", "th", "blockquote", ".branch-note",
      "article > strong", "article > span"
    ].join(",");

    const candidates = node.matches(selector)
      ? [node]
      : [...node.querySelectorAll(selector)];

    return candidates.filter((element) => {
      if (element.closest(".editor-handle, .resize-handle")) return false;
      if (element.matches("input, button")) return false;

      const editableAncestor = element.parentElement?.closest(
        "h1,h2,h3,p,li,td,th,blockquote,.branch-note"
      );

      if (
        editableAncestor &&
        editableAncestor !== node &&
        !element.matches("article > strong, article > span")
      ) {
        return false;
      }

      return true;
    });
  }

  function setTextEditing(enabled) {
    getStageNodeElements().forEach((node) => {
      getEditableTextElements(node).forEach((element) => {
        element.contentEditable = enabled ? "true" : "false";
        element.spellcheck = enabled;
      });
    });
  }

  function createEditorHandles() {
    getStageNodeElements().forEach((node) => {
      if (!node.querySelector(":scope > .editor-handle")) {
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "editor-handle";
        handle.textContent = "Drag";
        handle.setAttribute("aria-label", `Drag ${node.id}`);
        node.appendChild(handle);
      }

      if (!node.querySelector(":scope > .resize-handle")) {
        const resize = document.createElement("span");
        resize.className = "resize-handle";
        resize.setAttribute("role", "button");
        resize.setAttribute("aria-label", `Resize ${node.id}`);
        resize.tabIndex = 0;
        node.appendChild(resize);
      }
    });
  }

  function setEditorButtons(enabled) {
    document.querySelectorAll(".editor-only").forEach((button) => {
      button.disabled = !enabled;
    });

    const toggle = document.querySelector("[data-action='edit-mode']");
    toggle.classList.toggle("is-active", enabled);
    toggle.setAttribute("aria-pressed", String(enabled));
    toggle.textContent = enabled ? "Lock Editing" : "Unlock Editing";
  }

  function toggleEditMode(forceValue) {
    editMode = typeof forceValue === "boolean" ? forceValue : !editMode;
    document.body.classList.toggle("editor-active", editMode);
    setTextEditing(editMode);
    setEditorButtons(editMode);

    if (!editMode && document.activeElement?.isContentEditable) {
      document.activeElement.blur();
    }

    showToast(
      editMode
        ? "Editing unlocked. Drag components anywhere on the full white canvas."
        : "Editing locked. Canvas navigation is active.",
      editMode ? "success" : ""
    );
  }

  function getAbsolutePosition(element) {
    let left = 0;
    let top = 0;
    let current = element;

    while (current && current !== stage) {
      left += current.offsetLeft;
      top += current.offsetTop;
      current = current.offsetParent;
    }

    return { left, top };
  }

  function pointFor(element, target) {
    const aPos = getAbsolutePosition(element);
    const bPos = getAbsolutePosition(target);

    const a = {
      left: aPos.left,
      top: aPos.top,
      right: aPos.left + element.offsetWidth,
      bottom: aPos.top + element.offsetHeight,
      cx: aPos.left + element.offsetWidth / 2,
      cy: aPos.top + element.offsetHeight / 2
    };

    const b = {
      left: bPos.left,
      top: bPos.top,
      right: bPos.left + target.offsetWidth,
      bottom: bPos.top + target.offsetHeight,
      cx: bPos.left + target.offsetWidth / 2,
      cy: bPos.top + target.offsetHeight / 2
    };

    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return {
        start: dx >= 0 ? { x: a.right, y: a.cy } : { x: a.left, y: a.cy },
        end: dx >= 0 ? { x: b.left, y: b.cy } : { x: b.right, y: b.cy }
      };
    }

    return {
      start: dy >= 0 ? { x: a.cx, y: a.bottom } : { x: a.cx, y: a.top },
      end: dy >= 0 ? { x: b.cx, y: b.top } : { x: b.cx, y: b.bottom }
    };
  }

  function pathData(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      const bend = Math.max(45, Math.abs(dx) * 0.42);
      const direction = Math.sign(dx || 1);
      return `M ${start.x} ${start.y} C ${start.x + direction * bend} ${start.y}, ${end.x - direction * bend} ${end.y}, ${end.x} ${end.y}`;
    }

    const bend = Math.max(45, Math.abs(dy) * 0.42);
    const direction = Math.sign(dy || 1);
    return `M ${start.x} ${start.y} C ${start.x} ${start.y + direction * bend}, ${end.x} ${end.y - direction * bend}, ${end.x} ${end.y}`;
  }

  function drawConnections() {
    svg.querySelectorAll(".connector").forEach((element) => element.remove());

    connections.forEach(([fromId, toId, colorName]) => {
      const from = document.getElementById(fromId);
      const to = document.getElementById(toId);
      if (!from || !to) return;

      const { start, end } = pointFor(from, to);
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", "connector");
      path.setAttribute("d", pathData(start, end));
      path.setAttribute("stroke", colors[colorName]);
      path.setAttribute("marker-end", `url(#arrow-${colorName})`);
      svg.appendChild(path);
    });
  }

  function applyTransform() {
    stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    zoomValue.value = `${Math.round(scale * 100)}%`;
    zoomValue.textContent = `${Math.round(scale * 100)}%`;
  }

  function fitToScreen() {
    const padding = 34;
    const availableW = viewport.clientWidth - padding * 2;
    const availableH = viewport.clientHeight - padding * 2;

    // Frame the mind map while retaining the much larger surrounding workspace.
    scale = Math.min(availableW / CONTENT_WIDTH, availableH / CONTENT_HEIGHT);
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));

    x = (viewport.clientWidth - CONTENT_WIDTH * scale) / 2 - CONTENT_LEFT * scale;
    y = (viewport.clientHeight - CONTENT_HEIGHT * scale) / 2 - CONTENT_TOP * scale;
    applyTransform();
  }

  function resetView() {
    fitToScreen();
  }

  function zoomAt(nextScale, clientX, clientY) {
    nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
    const rect = viewport.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const stageX = (px - x) / scale;
    const stageY = (py - y) / scale;

    x = px - stageX * nextScale;
    y = py - stageY * nextScale;
    scale = nextScale;
    applyTransform();
  }

  function beginNodeInteraction(event, node, mode) {
    if (!editMode) return;

    event.preventDefault();
    event.stopPropagation();

    activeDrag = {
      mode,
      node,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: node.offsetLeft,
      startTop: node.offsetTop,
      startWidth: node.offsetWidth,
      startHeight: node.offsetHeight
    };

    node.classList.add(mode === "move" ? "is-moving" : "is-resizing");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateNodeInteraction(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;

    const dx = (event.clientX - activeDrag.startClientX) / scale;
    const dy = (event.clientY - activeDrag.startClientY) / scale;
    const node = activeDrag.node;

    if (activeDrag.mode === "move") {
      node.style.left = `${Math.round(activeDrag.startLeft + dx)}px`;
      node.style.top = `${Math.round(activeDrag.startTop + dy)}px`;
    } else {
      const minWidth = node.classList.contains("branch-title") ? 150 : 160;
      const minHeight = node.classList.contains("branch-title") ? 42 : 70;
      node.style.width = `${Math.round(Math.max(minWidth, activeDrag.startWidth + dx))}px`;
      node.style.height = `${Math.round(Math.max(minHeight, activeDrag.startHeight + dy))}px`;
      node.style.maxHeight = "none";
    }

    drawConnections();
  }

  function endNodeInteraction(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;

    activeDrag.node.classList.remove("is-moving", "is-resizing");
    activeDrag = null;
  }

  function bindEditorHandles() {
    getStageNodeElements().forEach((node) => {
      const dragHandle = node.querySelector(":scope > .editor-handle");
      const resizeHandle = node.querySelector(":scope > .resize-handle");

      if (dragHandle && dragHandle.dataset.bound !== "true") {
        dragHandle.dataset.bound = "true";
        dragHandle.addEventListener("pointerdown", (event) => beginNodeInteraction(event, node, "move"));
        dragHandle.addEventListener("pointermove", updateNodeInteraction);
        dragHandle.addEventListener("pointerup", endNodeInteraction);
        dragHandle.addEventListener("pointercancel", endNodeInteraction);
      }

      if (resizeHandle && resizeHandle.dataset.bound !== "true") {
        resizeHandle.dataset.bound = "true";
        resizeHandle.addEventListener("pointerdown", (event) => beginNodeInteraction(event, node, "resize"));
        resizeHandle.addEventListener("pointermove", updateNodeInteraction);
        resizeHandle.addEventListener("pointerup", endNodeInteraction);
        resizeHandle.addEventListener("pointercancel", endNodeInteraction);
      }
    });
  }

  function collectLayout() {
    const components = {};

    getStageNodeElements().forEach((node) => {
      const clone = node.cloneNode(true);
      clone.querySelectorAll(".editor-handle, .resize-handle").forEach((handle) => handle.remove());
      clone.querySelectorAll("[contenteditable]").forEach((element) => {
        element.removeAttribute("contenteditable");
        element.removeAttribute("spellcheck");
      });

      components[node.id] = {
        left: node.style.left || null,
        top: node.style.top || null,
        width: node.style.width || null,
        height: node.style.height || null,
        html: clone.innerHTML
      };
    });

    const checklist = [...boardContent.querySelectorAll("#checklist-strip input[type='checkbox']")]
      .map((input) => input.checked);

    return {
      version: 3,
      canvas: {
        width: STAGE_WIDTH,
        height: STAGE_HEIGHT,
        contentLeft: CONTENT_LEFT,
        contentTop: CONTENT_TOP
      },
      savedAt: new Date().toISOString(),
      components,
      checklist
    };
  }

  function applyLayout(layout, options = {}) {
    if (!layout || typeof layout !== "object" || !layout.components) {
      throw new Error("The imported file is not a valid Airtasker mind-map layout.");
    }

    Object.entries(layout.components).forEach(([id, state]) => {
      const node = document.getElementById(id);
      if (!node || !state) return;

      node.style.left = state.left || "";
      node.style.top = state.top || "";
      node.style.width = state.width || "";
      node.style.height = state.height || "";
      node.style.maxHeight = state.height ? "none" : "";

      if (typeof state.html === "string") {
        node.innerHTML = state.html;
      }
    });

    createEditorHandles();
    bindEditorHandles();

    if (Array.isArray(layout.checklist)) {
      [...boardContent.querySelectorAll("#checklist-strip input[type='checkbox']")]
        .forEach((input, index) => {
          input.checked = Boolean(layout.checklist[index]);
        });
    }

    setTextEditing(editMode);
    drawConnections();

    if (!options.silent) {
      showToast("Layout loaded successfully.", "success");
    }
  }

  function saveLayout() {
    const layout = collectLayout();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    showToast("Layout saved in this browser.", "success");
  }

  function loadSavedLayout() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    try {
      applyLayout(JSON.parse(raw), { silent: true });
      return true;
    } catch (error) {
      console.warn("Saved layout could not be loaded:", error);
      return false;
    }
  }

  function exportLayout() {
    const layout = collectLayout();
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `airtasker-mindmap-layout-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("Layout JSON exported.", "success");
  }

  function importLayout(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const layout = JSON.parse(String(reader.result));
        applyLayout(layout);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
      } catch (error) {
        showToast(error.message || "Could not import the layout.", "error");
      } finally {
        importInput.value = "";
      }
    };
    reader.onerror = () => {
      showToast("The layout file could not be read.", "error");
      importInput.value = "";
    };
    reader.readAsText(file);
  }

  function resetLayout() {
    const confirmed = window.confirm(
      "Reset every component to its original position, size, and text on the full canvas? Export the current layout first if you may need it."
    );

    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }

  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (activeDrag) return;
    if (event.target.closest("[contenteditable='true'], input, button, .node")) return;

    canvasDragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture(event.pointerId);
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!canvasDragging) return;
    x += event.clientX - lastX;
    y += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    applyTransform();
  });

  viewport.addEventListener("pointerup", (event) => {
    canvasDragging = false;
    viewport.classList.remove("is-dragging");

    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  });

  viewport.addEventListener("pointercancel", () => {
    canvasDragging = false;
    viewport.classList.remove("is-dragging");
  });

  viewport.addEventListener("wheel", (event) => {
    if (document.activeElement?.isContentEditable) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    zoomAt(scale * factor, event.clientX, event.clientY);
  }, { passive: false });

  boardContent.addEventListener("input", (event) => {
    if (!editMode || !event.target.isContentEditable) return;
    drawConnections();
  });

  document.querySelector("[data-action='zoom-in']").addEventListener("click", () => {
    const rect = viewport.getBoundingClientRect();
    zoomAt(scale * 1.12, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  document.querySelector("[data-action='zoom-out']").addEventListener("click", () => {
    const rect = viewport.getBoundingClientRect();
    zoomAt(scale / 1.12, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  document.querySelector("[data-action='fit']").addEventListener("click", fitToScreen);
  document.querySelector("[data-action='reset-view']").addEventListener("click", resetView);
  document.querySelector("[data-action='edit-mode']").addEventListener("click", () => toggleEditMode());
  document.querySelector("[data-action='save-layout']").addEventListener("click", saveLayout);
  document.querySelector("[data-action='export-layout']").addEventListener("click", exportLayout);
  document.querySelector("[data-action='import-layout']").addEventListener("click", () => importInput.click());
  document.querySelector("[data-action='reset-layout']").addEventListener("click", resetLayout);

  importInput.addEventListener("change", () => importLayout(importInput.files?.[0]));

  document.querySelector("[data-action='fullscreen']").addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      showToast("Fullscreen is unavailable in this browser.", "error");
    }
  });

  document.querySelector("[data-action='print']").addEventListener("click", () => window.print());

  window.addEventListener("keydown", (event) => {
    const modifier = event.ctrlKey || event.metaKey;

    if (modifier && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (editMode) saveLayout();
    }

    if (event.key === "Escape" && editMode) {
      toggleEditMode(false);
    }
  });

  window.addEventListener("resize", drawConnections);

  window.addEventListener("load", () => {
    createEditorHandles();
    bindEditorHandles();
    const restored = loadSavedLayout();
    drawConnections();
    fitToScreen();
    setEditorButtons(false);

    if (restored) {
      showToast("Your saved full-canvas layout was restored.", "success");
    }

    window.setTimeout(() => {
      hint.style.opacity = "0";
    }, 6500);
  });
})();
