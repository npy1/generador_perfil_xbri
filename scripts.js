// Elementos
const upload = document.getElementById("upload");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const downloadBtn = document.getElementById("download");
const frameSelect = document.getElementById("frameSelect");
const zoomInput = document.getElementById("zoom");

// Estado
let photoImg = null;   // Image() de la foto
let frameImg = null;   // Image() del marco
let zoom = 1;          // zoom de la foto
const MAX_DIM = 2000;  // limita resolución para no agotar memoria

// Carga inicial del marco seleccionado
function loadFrame(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Lee archivo como ObjectURL (mejor memoria que FileReader para imágenes grandes)
function readFileURL(file) {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Calcula tamaño del lienzo con límite de resolución
function computeCanvasSize(w, h) {
  if (w <= MAX_DIM && h <= MAX_DIM) return { w, h };
  const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

// Dibuja foto + marco con zoom
function render() {
  if (!photoImg || !frameImg) return;

  // Lienzo: usamos la proporción del marco si existe; si no, la de la foto
  const baseW = frameImg.naturalWidth || photoImg.naturalWidth;
  const baseH = frameImg.naturalHeight || photoImg.naturalHeight;

  const { w: cw, h: ch } = computeCanvasSize(baseW, baseH);
  canvas.width = cw;
  canvas.height = ch;

  // Escalamos la foto para cubrir el lienzo (cover) con control de zoom
  const photoRatio = photoImg.naturalWidth / photoImg.naturalHeight;
  const canvasRatio = cw / ch;

  let drawW, drawH;
  if (canvasRatio > photoRatio) {
    // Lienzo más "ancho": cubrir por ancho
    drawW = cw * zoom;
    drawH = drawW / photoRatio;
  } else {
    // Lienzo más "alto": cubrir por alto
    drawH = ch * zoom;
    drawW = drawH * photoRatio;
  }

  // Centrado
  const dx = (cw - drawW) / 2;
  const dy = (ch - drawH) / 2;

  // Foto
  ctx.clearRect(0, 0, cw, ch);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(photoImg, dx, dy, drawW, drawH);

  // Marco (se estira exacto al lienzo)
  ctx.drawImage(frameImg, 0, 0, cw, ch);
}

// Handlers
upload.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    // Si no hay marco cargado aún, cárgalo ahora
    if (!frameImg) {
      frameImg = await loadFrame(frameSelect.value);
    }

    photoImg = await readFileURL(file);
    downloadBtn.disabled = false;
    render();
  } catch (err) {
    console.error(err);
    alert("No se pudo cargar la imagen. Intenta con otro archivo.");
  }
});

frameSelect.addEventListener("change", async (e) => {
  try {
    frameImg = await loadFrame(e.target.value);
    render();
  } catch {
    alert("No se pudo cargar el marco seleccionado.");
  }
});

zoomInput.addEventListener("input", (e) => {
  zoom = parseFloat(e.target.value || "1") || 1;
  render();
});

downloadBtn.addEventListener("click", () => {
  if (!canvas.width || !canvas.height) return;
  const link = document.createElement("a");
  link.download = "foto-con-marco.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// Carga un marco por defecto al iniciar (por si el usuario cambia el zoom antes de subir foto)
(async () => {
  try {
    frameImg = await loadFrame(frameSelect.value);
  } catch {
    // silencioso
  }
})();
