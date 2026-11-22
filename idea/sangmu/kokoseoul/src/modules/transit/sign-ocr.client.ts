import type { Worker } from "tesseract.js";

const assetPath = "/subway-sign-ocr";

export async function createSignReader(onError: () => void): Promise<Worker> {
  const { createWorker, OEM } = await import("tesseract.js");
  return createWorker(["kor", "eng"], OEM.LSTM_ONLY, {
    workerPath: `${assetPath}/worker.min.js`,
    corePath: `${assetPath}/tesseract-core-lstm.js`,
    langPath: assetPath,
    workerBlobURL: false,
    errorHandler: onError,
  });
}

export async function signPhotoCanvas(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo canvas is unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Only level a crop when a strong sign edge runs across most of it.
function estimateStripTilt({ data, width, height }: ImageData) {
  const span = width * 0.72;
  if (width < 75 || width < height * 1.3) return 0;
  const read = (x: number, y: number) => {
    const index = (Math.round(y) * width + Math.round(x)) * 4;
    return (data[index] + data[index + 1] + data[index + 2]) / 3;
  };
  const candidates = [0, -0.07, 0.07, -0.14, 0.14].map((slope) => {
    let best = 0;
    const margin = Math.ceil(Math.abs(slope) * span / 2) + 4;
    for (let y = Math.max(margin, 12); y < height - Math.max(margin, 12); y += 2) {
      let gradient = 0;
      let agreement = 0;
      for (let i = 0; i < 16; i++) {
        const offset = (i / 15 - 0.5) * span;
        const x = width / 2 + offset;
        const sampleY = y + offset * slope;
        const edge = read(x, sampleY + 2) - read(x, sampleY - 2);
        gradient += edge;
        agreement += Math.abs(edge) > 24 ? Math.sign(edge) : 0;
      }
      if (Math.abs(agreement) >= 11) best = Math.max(best, Math.abs(gradient) / 16);
    }
    return { slope, score: best };
  });
  const [level] = candidates;
  const best = candidates.reduce((current, candidate) => candidate.score > current.score ? candidate : current);
  return best.score > 39 && best.score > level.score * 1.18 ? Math.atan(best.slope) : 0;
}

// Orange transfer strips carry pale lettering on the line-color background.
function stripInk(context: CanvasRenderingContext2D, width: number, height: number) {
  const pixels = context.getImageData(0, 0, width, height);
  const { data } = pixels;
  const rows = [];
  for (let y = 8; y < height - 8; y++) {
    let warm = 0;
    for (let x = 8; x < width - 8; x += 2) {
      const pixel = (y * width + x) * 4;
      if (data[pixel] > 125 && data[pixel] - data[pixel + 1] > 18
        && data[pixel] - data[pixel + 2] > 35) warm++;
    }
    if (warm > (width - 16) * 0.24) rows.push(y);
  }
  if (rows.length < Math.max(14, height * 0.33)) return false;
  const top = rows[0];
  const bottom = rows.at(-1)!;
  for (let pixel = 0; pixel < data.length; pixel += 4) {
    const y = Math.floor(pixel / (4 * width));
    const min = Math.min(data[pixel], data[pixel + 1], data[pixel + 2]);
    const max = Math.max(data[pixel], data[pixel + 1], data[pixel + 2]);
    const paleInk = y >= top && y <= bottom && min > 147 && max - min < 66;
    const value = paleInk ? Math.max(0, 210 - (min - 147) * 8) : 255;
    data[pixel] = data[pixel + 1] = data[pixel + 2] = value;
  }
  context.putImageData(pixels, 0, 0);
  return true;
}

function codeInkThreshold({ data, width, height }: ImageData) {
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const radiusX = Math.max(1, centerX - 8);
  const radiusY = Math.max(1, centerY - 8);
  const values = [];
  for (let y = 8; y < height - 8; y++) {
    for (let x = 8; x < width - 8; x++) {
      if (((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2 > 0.87) continue;
      const i = (y * width + x) * 4;
      values.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }
  }
  values.sort((a, b) => a - b);
  if (!values.length) return 100;
  const dark = values[Math.floor(values.length * 0.18)];
  const background = values[Math.floor(values.length * 0.54)];
  return Math.min(background - 11, (dark + background) / 2);
}

export async function readSignRegion(
  worker: Worker,
  source: HTMLCanvasElement,
  bounds: { x: number; y: number; width: number; height: number },
  kind: "label" | "code" | "station" = "label",
) {
  const scale = Math.min(3, Math.max(1, 126 / bounds.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(bounds.width * scale) + 16;
  canvas.height = Math.ceil(bounds.height * scale) + 16;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, bounds.x, bounds.y, bounds.width, bounds.height,
    8, 8, bounds.width * scale, bounds.height * scale);
  if (kind === "label") {
    const tilt = estimateStripTilt(context.getImageData(0, 0, canvas.width, canvas.height));
    if (tilt) {
      const rotated = document.createElement("canvas");
      rotated.width = canvas.width;
      rotated.height = canvas.height + Math.ceil(Math.abs(Math.sin(tilt)) * canvas.width);
      const transform = rotated.getContext("2d");
      if (transform) {
        transform.fillStyle = "#fff";
        transform.fillRect(0, 0, rotated.width, rotated.height);
        transform.translate(rotated.width / 2, rotated.height / 2);
        transform.rotate(-tilt);
        transform.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        canvas.height = rotated.height;
        context.drawImage(rotated, 0, 0);
      }
    }
  }
  const raw = kind === "label" ? null : context.getImageData(0, 0, canvas.width, canvas.height);
  const inkThreshold = kind === "code" && raw ? codeInkThreshold(raw) : 0;
  function drawReadableInk(threshold: number) {
    if (!raw) return;
    const pixels = new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const gray = pixels.data[i] * 0.299 + pixels.data[i + 1] * 0.587 + pixels.data[i + 2] * 0.114;
      const value = kind === "code" ? (gray < threshold ? 0 : 255) : (gray - 90) * 2.05;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
    }
    context!.putImageData(pixels, 0, 0);
  }
  drawReadableInk(inkThreshold);
  const cleanedStrip = kind === "label" && stripInk(context, canvas.width, canvas.height);
  const { PSM } = await import("tesseract.js");
  const mode = kind === "code" ? PSM.SINGLE_WORD : kind === "station" || cleanedStrip ? PSM.SPARSE_TEXT : PSM.SINGLE_BLOCK;
  const options = { tessedit_pageseg_mode: mode, tessedit_char_whitelist: kind === "code" ? "0123456789P-" : "" };
  await worker.setParameters(options);
  let { data } = await worker.recognize(canvas);
  if (kind === "code" && data.confidence < 76) {
    // Small station numbers can look narrower after scaling camera frames.
    const retryCanvas = document.createElement("canvas");
    const width = Math.round(canvas.width * 1.3);
    retryCanvas.width = width + 24;
    retryCanvas.height = canvas.height + 16;
    const retryContext = retryCanvas.getContext("2d");
    if (retryContext) {
      retryContext.fillStyle = "#fff";
      retryContext.fillRect(0, 0, retryCanvas.width, retryCanvas.height);
      retryContext.drawImage(canvas, 12, 8, width, canvas.height);
      const retry = await worker.recognize(retryCanvas);
      if (retry.data.confidence > data.confidence) data = retry.data;
    }
  }
  return { text: data.text, confidence: data.confidence, coloredStrip: cleanedStrip };
}
