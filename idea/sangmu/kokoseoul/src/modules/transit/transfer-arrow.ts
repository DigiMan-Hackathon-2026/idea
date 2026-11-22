export type ArrowDirection = "left" | "right" | "up";
export type ImageBox = { x: number; y: number; width: number; height: number };
export type TransferArrow = ImageBox & { direction: ArrowDirection };

type Component = ImageBox & { area: number };

function components(mask: Uint8Array, width: number, height: number) {
  const queue = new Int32Array(mask.length);
  const result: Component[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1) continue;
    let left = width;
    let right = 0;
    let top = height;
    let bottom = 0;
    let count = 1;
    queue[0] = start;
    mask[start] = 2;

    for (let index = 0; index < count; index++) {
      const pixel = queue[index];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      for (const next of [x > 0 ? pixel - 1 : -1, x < width - 1 ? pixel + 1 : -1, pixel - width, pixel + width]) {
        if (mask[next] !== 1) continue;
        mask[next] = 2;
        queue[count++] = next;
      }
    }

    if (count >= 28) result.push({ x: left, y: top, width: right - left + 1, height: bottom - top + 1, area: count });
  }
  return result;
}

const digitPatterns = [
  ["01110", "11011", "11011", "11011", "11011", "11011", "01110"],
  ["01100", "11100", "01100", "01100", "01100", "01100", "11110"],
  ["01110", "11011", "00011", "00110", "01100", "11000", "11111"],
  ["11110", "00011", "00011", "01110", "00011", "00011", "11110"],
  ["00110", "01110", "11110", "11010", "11111", "00010", "00010"],
  ["11111", "11000", "11000", "11110", "00011", "00011", "11110"],
  ["01110", "11000", "11000", "11110", "11011", "11011", "01110"],
  ["11111", "00011", "00010", "00110", "00100", "01100", "01100"],
  ["01110", "11011", "11011", "01110", "11011", "11011", "01110"],
  ["01110", "11011", "11011", "01111", "00011", "00011", "01110"],
];

function readBadge(frame: ImageData, badge: Component) {
  const { data, width } = frame;
  const chroma = (x: number, y: number) => {
    const pixel = (Math.floor(y) * width + Math.floor(x)) * 4;
    return data[pixel] - data[pixel + 2];
  };

  const ink: [number, number][] = [];
  const startX = Math.ceil(badge.width * 0.22);
  const endX = Math.floor(badge.width * 0.78);
  for (let dy = Math.ceil(badge.height * 0.2); dy < badge.height * 0.8; dy++) {
    const y = badge.y + dy;
    const leftChroma = chroma(badge.x + startX - 1, y);
    const rightChroma = chroma(badge.x + endX + 1, y);
    for (let dx = startX; dx <= endX; dx++) {
      const position = (dx - startX + 1) / (endX - startX + 2);
      const background = leftChroma + (rightChroma - leftChroma) * position;
      if (background >= 55 && chroma(badge.x + dx, y) < background * 0.63) ink.push([dx, dy]);
    }
  }
  if (ink.length < 10) return null;
  const xs = ink.map(([x]) => x);
  const ys = ink.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const digitWidth = Math.max(...xs) - left + 1;
  const digitHeight = Math.max(...ys) - top + 1;
  if (digitWidth < badge.width * 0.22 || digitHeight < badge.height * 0.34 || digitHeight < digitWidth * 1.15) return null;

  const cells = new Uint16Array(35);
  for (const [x, y] of ink) {
    const column = Math.floor((x - left) * 5 / digitWidth);
    const row = Math.floor((y - top) * 7 / digitHeight);
    cells[row * 5 + column]++;
  }
  const cellArea = digitWidth * digitHeight / cells.length;
  const scorePattern = (pattern: string[]) => [...pattern.join("")].reduce((sum, mark, index) => {
    const fill = Math.min(1, cells[index] / (cellArea * 0.8));
    return sum + (mark === "1" ? fill : 1 - fill);
  }, 0) / cells.length;
  const roundedThree = ["01110", "11011", "00111", "00111", "00011", "11111", "01110"];
  const scores = digitPatterns.map((pattern, digit) => ({
    digit,
    score: digit === 3 ? Math.max(scorePattern(pattern), scorePattern(roundedThree)) : scorePattern(pattern),
  })).sort((a, b) => b.score - a.score);
  const [best, runnerUp] = scores;
  if (best.score < 0.72 || best.score - runnerUp.score < 0.045) return null;
  return best.digit;
}

function distance(x: number, y: number, startX: number, startY: number, endX: number, endY: number) {
  const dx = endX - startX;
  const dy = endY - startY;
  const along = Math.max(0, Math.min(1, ((x - startX) * dx + (y - startY) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - startX - along * dx, y - startY - along * dy);
}

function readArrow(mask: Uint8Array, stride: number, box: ImageBox): ArrowDirection | null {
  const scores = (["up", "left", "right", "down"] as const).map((direction) => {
    let common = 0;
    let union = 0;
    for (let y = 0; y < box.height; y++) {
      for (let x = 0; x < box.width; x++) {
        const a = (x + 0.5) / box.width;
        const b = (y + 0.5) / box.height;
        const [u, v] = direction === "up" ? [a, b] : direction === "left" ? [b, a] : direction === "right" ? [b, 1 - a] : [a, 1 - b];
        const expected = Math.min(distance(u, v, 0.5, 0.08, 0.5, 0.94),
          distance(u, v, 0.5, 0.08, 0.08, 0.51), distance(u, v, 0.5, 0.08, 0.92, 0.51)) < 0.085;
        const seen = Boolean(mask[(box.y + y) * stride + box.x + x]);
        if (expected && seen) common++;
        if (expected || seen) union++;
      }
    }
    return { direction, score: common / union };
  }).sort((a, b) => b.score - a.score);
  const [best, runnerUp] = scores;
  if (best.direction === "down" || best.score < 0.57 || best.score - runnerUp.score < 0.15) return null;
  return best.direction;
}

// This pilot recognizes the round, warm-colored Line 3 badge and the arrow immediately to its left.
export function detectLineThreeArrow(frame: ImageData): TransferArrow | null {
  const { data, width, height } = frame;
  const gold = new Uint8Array(width * height);
  const pale = new Uint8Array(width * height);
  for (let i = 0; i < gold.length; i++) {
    const pixel = i * 4;
    const red = data[pixel];
    const green = data[pixel + 1];
    const blue = data[pixel + 2];
    gold[i] = Number(red > 165 && green > 78 && red - blue > 90 && green - blue > 30 && red >= green - 16);
    pale[i] = Number(blue > 174 && green > 182 && red > 182 && Math.max(red, green, blue) - Math.min(red, green, blue) < 42);
  }
  const badges = components(gold, width, height).filter((box) => box.width >= 14 && box.width <= width * 0.2
    && box.height / box.width > 0.77 && box.height / box.width < 1.23
    && box.area / (box.width * box.height) > 0.4 && box.area / (box.width * box.height) < 0.81
    && readBadge(frame, box) === 3);
  if (badges.length !== 1) return null;
  const [badge] = badges;
  const arrows = components(pale, width, height).flatMap(({ x, y, width, height }) => {
    const box = { x, y, width, height };
    const gap = badge.x - (box.x + box.width);
    const offset = Math.abs((box.y + box.height / 2) - (badge.y + badge.height / 2));
    if (gap < 0 || gap > badge.width * 0.9 || offset > badge.height * 0.23
      || box.width < badge.width * 0.59 || box.width > badge.width * 1.4
      || box.height < badge.height * 0.54 || box.height > badge.height * 1.43) return [];
    const direction = readArrow(pale, frame.width, box);
    return direction ? [{ ...box, direction }] : [];
  });
  return arrows.length === 1 ? arrows[0] : null;
}
