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
  if (kind !== "label") {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const [r, g, b] = [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]];
      // Color belongs to the badge. Preserve its neutral dark characters.
      const gray = r * 0.299 + g * 0.587 + b * 0.114;
      const value = kind === "code" ? (Math.max(r, g, b) < 115 ? 0 : 255) : (gray - 90) * 2.05;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
    }
    context.putImageData(pixels, 0, 0);
  }
  const cleanedStrip = kind === "label" && stripInk(context, canvas.width, canvas.height);
  const { PSM } = await import("tesseract.js");
  const mode = kind === "code" ? PSM.SINGLE_WORD : kind === "station" || cleanedStrip ? PSM.SPARSE_TEXT : PSM.SINGLE_BLOCK;
  const options = { tessedit_pageseg_mode: mode, tessedit_char_whitelist: kind === "code" ? "0123456789P-" : "" };
  await worker.setParameters(options);
  const { data } = await worker.recognize(canvas);
  return { text: data.text, confidence: data.confidence, coloredStrip: cleanedStrip };
}
