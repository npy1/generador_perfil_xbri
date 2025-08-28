// ====== Configuración de máscara (0..1 relativo al marco) ======
// Si no usas máscara (la foto debe verse en TODO el marco), pon enabled: false
const MASK = {
  enabled: false,  // true si quieres recorte en un rectángulo
  left: 0.20,
  top: 0.20,
  width: 0.60,
  height: 0.60
};

// ====== Elementos y estado ======
const $ = (s) => document.querySelector(s);
const statusEl = $("#status");
const frameInput = $("#frameInput");          // puede no existir si usas marco fijo en código
const frameLabel = $("#frameLabel");          // idem
const changeFrameBtn = $("#changeFrame");     // idem
const photoInput = $("#photoInput");
const zoomInput = $("#zoom");
const downloadBtn = $("#download");
const centerBtn = $("#centerBtn");
const resetBtn = $("#resetBtn");
const canvas = $("#canvas");
const ctx = canvas.getContext("2d");

let frameImg = null;   // Marco fijo (PNG con transparencia)
let photoImg = null;   // Foto actual

let zoom = 1;          // <- zoom libre: SIN mínimo forzado
let panX = 0;          // desplazamiento px relativo al centro de la zona visible
let panY = 0;
const MAX_DIM = 3000;
const FRAME_KEY = "fixedFrameDataURL";

// Interacción de arrastre
let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let panStartX = 0;
let panStartY = 0;

// ====== Utilidades ======
function setStatus(msg, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#fca5a5" : "";
}

function readFileAsDataURL(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(new Error("No se pudo leer el archivo"));
    fr.readAsDataURL(file);
  });
}

function loadImageFromURL(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("No se pudo cargar la imagen"));
    img.src = url; // DataURL, sin CORS
  });
}

function computeCanvasSize(w, h) {
  if (w <= MAX_DIM && h <= MAX_DIM) return { w, h };
  const s = Math.min(MAX_DIM / w, MAX_DIM / h);
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

function maskRectPx() {
  // Área visible para la foto (si MASK.enabled) o todo el lienzo
  if (!MASK.enabled) {
    return { x: 0, y: 0, w: canvas.width, h: canvas.height, cx: canvas.width/2, cy: canvas.height/2 };
  }
  const x = Math.round(MASK.left * canvas.width);
  const y = Math.round(MASK.top * canvas.height);
  const w = Math.round(MASK.width * canvas.width);
  const h = Math.round(MASK.height * canvas.height);
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

function clampPan() {
  // Limita pan para que no se vaya "infinitamente" (margen generoso)
  if (!photoImg) return;
  const area = maskRectPx();
  const photoRatio = photoImg.naturalWidth / photoImg.naturalHeight;

  let drawW, drawH;
  if ((area.w / area.h) > photoRatio) {
    drawW = area.w * zoom;
    drawH = drawW / photoRatio;
  } else {
    drawH = area.h * zoom;
    drawW = drawH * photoRatio;
  }

  const maxOffsetX = Math.max(drawW, area.w) * 1.5;
  const maxOffsetY = Math.max(drawH, area.h) * 1.5;

  panX = Math.max(-maxOffsetX, Math.min(maxOffsetX, panX));
  panY = Math.max(-maxOffsetY, Math.min(maxOffsetY, panY));
}

// ====== Render ======
function render() {
  if (!frameImg) return;

  // Canvas = tamaño del marco (siempre)
  const { w: cw, h: ch } = computeCanvasSize(frameImg.naturalWidth, frameImg.naturalHeight);
  canvas.width = cw;
  canvas.height = ch;
// Fondo blanco siempre
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, cw, ch);

  // Dibuja foto (debajo) con pan/zoom LIBRES
  if (photoImg) {
    clampPan();

    const { x, y, w, h, cx, cy } = maskRectPx();
    const photoRatio = photoImg.naturalWidth / photoImg.naturalHeight;
    const areaRatio = w / h;

    let drawW, drawH;
    if (areaRatio > photoRatio) {
      drawW = w * zoom;
      drawH = drawW / photoRatio;
    } else {
      drawH = h * zoom;
      drawW = drawH * photoRatio;
    }

    const dx = Math.round(cx - drawW / 2 + panX);
    const dy = Math.round(cy - drawH / 2 + panY);

    ctx.save();
    if (MASK.enabled) {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(photoImg, dx, dy, drawW, drawH);
    ctx.restore();
  }

  // Dibuja el marco por encima (siempre del tamaño del lienzo)
  ctx.drawImage(frameImg, 0, 0, cw, ch);

  // UI
  const uiEnabled = Boolean(photoImg);
  downloadBtn.disabled = !uiEnabled;
  centerBtn.disabled = !uiEnabled;
  resetBtn.disabled = !uiEnabled;
}

// ====== Eventos ======
if (frameInput) {
  frameInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes("png")) {
      setStatus("El marco debe ser un PNG (con transparencia).", true);
      return;
    }
    try {
      setStatus("Cargando marco...");
      const dataURL = await readFileAsDataURL(file);
      frameImg = await loadImageFromURL(dataURL);
      localStorage.setItem(FRAME_KEY, dataURL);

      frameInput.disabled = true;
      if (frameLabel) frameLabel.textContent = "Marco cargado ✔️";
      if (changeFrameBtn) changeFrameBtn.style.display = "inline-block";

      setStatus("Marco fijo listo. Ahora sube una foto.");
      render();
    } catch (err) {
      console.error(err);
      setStatus("No se pudo cargar el marco.", true);
    }
  });
}

if (changeFrameBtn) {
  changeFrameBtn.addEventListener("click", () => {
    if (!frameInput) return;
    frameInput.disabled = false;
    if (frameLabel) frameLabel.textContent = "Cargar marco (PNG)";
    setStatus("Selecciona un nuevo PNG para el marco.");
  });
}

photoInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    setStatus("Cargando foto...");
    const dataURL = await readFileAsDataURL(file);
    photoImg = await loadImageFromURL(dataURL);
    setStatus("Foto cargada ✔️");

    // Al cargar foto nueva: tomar el zoom actual del slider y centrar
    zoom = parseFloat(zoomInput.value || "1") || 1;
    panX = 0; 
    panY = 0;

    render();
  } catch (err) {
    console.error(err);
    setStatus("No se pudo cargar la foto.", true);
  }
});

zoomInput.addEventListener("input", () => {
  // Zoom LIBRE (sin mínimo): permite alejar tanto como permita el slider
  const requested = parseFloat(zoomInput.value || "1") || 1;
  zoom = requested;
  render();
});

centerBtn.addEventListener("click", () => {
  panX = 0;
  panY = 0;
  render();
});

resetBtn.addEventListener("click", () => {
  // Reset "visual": zoom = 1 (o el valor por defecto del slider) y centrado
  zoom = 1;
  if (zoomInput) zoomInput.value = "1";
  panX = 0; 
  panY = 0;
  render();
});

downloadBtn.addEventListener("click", () => {
  if (!canvas.width || !canvas.height) return;
  const a = document.createElement("a");
  a.download = "foto-con-marco.png";
  a.href = canvas.toDataURL("image/png");
  a.click();
});

// ====== Pan: mouse/touch ======
function clientXY(ev) {
  if (ev.touches && ev.touches[0]) {
    return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
  }
  return { x: ev.clientX, y: ev.clientY };
}

canvas.addEventListener("mousedown", (e) => {
  if (!photoImg) return;
  dragging = true;
  const { x, y } = clientXY(e);
  dragStartX = x;
  dragStartY = y;
  panStartX = panX;
  panStartY = panY;
});
canvas.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const { x, y } = clientXY(e);
  panX = panStartX + (x - dragStartX);
  panY = panStartY + (y - dragStartY);
  render();
});
canvas.addEventListener("mouseup", () => { dragging = false; });
canvas.addEventListener("mouseleave", () => { dragging = false; });

canvas.addEventListener("touchstart", (e) => {
  if (!photoImg) return;
  dragging = true;
  const { x, y } = clientXY(e);
  dragStartX = x;
  dragStartY = y;
  panStartX = panX;
  panStartY = panY;
}, { passive: true });
canvas.addEventListener("touchmove", (e) => {
  if (!dragging) return;
  const { x, y } = clientXY(e);
  panX = panStartX + (x - dragStartX);
  panY = panStartY + (y - dragStartY);
  render();
}, { passive: true });
canvas.addEventListener("touchend", () => { dragging = false; });

// ====== Inicio ======
(async function init() {
  try {
    // Opción A: recuperar marco guardado
    const savedFrame = localStorage.getItem(FRAME_KEY);
    if (savedFrame) {
      frameImg = await loadImageFromURL(savedFrame);
      if (frameInput) frameInput.disabled = true;
      if (frameLabel) frameLabel.textContent = "Marco cargado ✔️";
      if (changeFrameBtn) changeFrameBtn.style.display = "inline-block";
      setStatus("Marco fijo listo. Sube tu foto.");
    } else {
      // Opción B: cargar automáticamente un archivo local fijo
      // Descomenta la línea siguiente si quieres usar siempre "marco.png" (en la misma carpeta):
      // frameImg = await loadImageFromURL("marco.png"), setStatus("Marco fijo cargado automáticamente.");
      setStatus("Carga un marco PNG (con transparencia).");
    }
    render();
  } catch (err) {
    console.error(err);
    setStatus("No se pudo restaurar/cargar el marco.", true);
  }
})();
