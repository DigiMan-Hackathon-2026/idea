import type { SubwayLine } from "./subway-stations";

export type ArrowDirection = "left" | "right" | "up";
export type ImageBox = { x: number; y: number; width: number; height: number };
export type TransferArrow = ImageBox & { direction: ArrowDirection };
export type SignPanel = { arrow: TransferArrow; label: ImageBox; line: SubwayLine | null };

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

function readBadge(frame: ImageData, badge: Component, channel: number, opposition: number) {
  const { data, width } = frame;
  const chroma = (x: number, y: number) => {
    const pixel = (Math.floor(y) * width + Math.floor(x)) * 4;
    return data[pixel + channel] - data[pixel + opposition];
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
      if (background >= 30 && chroma(badge.x + dx, y) < background * 0.63) ink.push([dx, dy]);
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

const arrowDirections = ["up", "left", "right", "down"] as const;

function rateArrow(mask: Uint8Array, stride: number, box: ImageBox, direction: typeof arrowDirections[number], tilt: number) {
  const sine = Math.sin(tilt);
  const cosine = Math.cos(tilt);
  let common = 0;
  let union = 0;
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const a = (x + 0.5) / box.width;
      const b = (y + 0.5) / box.height;
      const [dx, dy] = direction === "up" ? [a, b] : direction === "left" ? [b, a] : direction === "right" ? [b, 1 - a] : [a, 1 - b];
      const u = 0.5 + (dx - 0.5) * cosine - (dy - 0.5) * sine;
      const v = 0.5 + (dx - 0.5) * sine + (dy - 0.5) * cosine;
      const expected = Math.min(distance(u, v, 0.5, 0.08, 0.5, 0.94),
        distance(u, v, 0.5, 0.08, 0.08, 0.51), distance(u, v, 0.5, 0.08, 0.92, 0.51)) < 0.085;
      const seen = Boolean(mask[(box.y + y) * stride + box.x + x]);
      if (expected && seen) common++;
      if (expected || seen) union++;
    }
  }
  return common / union;
}

function readArrow(mask: Uint8Array, stride: number, box: ImageBox, minimum = 0.57): ArrowDirection | null {
  const straight = arrowDirections.map((direction) => ({ direction, score: rateArrow(mask, stride, box, direction, 0) }));
  const needsTilt = straight.every(({ score }) => score < 0.64);
  const scores = (needsTilt ? straight.map(({ direction, score }) => ({
    direction,
    score: Math.max(score, ...[-0.18, 0.18].map((tilt) => rateArrow(mask, stride, box, direction, tilt))),
  })) : straight).sort((a, b) => b.score - a.score);
  const [best, runnerUp] = scores;
  if (best.direction === "down" || best.score < minimum || best.score - runnerUp.score < 0.15) return null;
  return best.direction;
}

const badgeColors: Record<SubwayLine, [number, number]> = {
  1: [2, 0], 2: [1, 0], 3: [0, 2], 4: [2, 0], 5: [2, 1],
  6: [0, 2], 7: [1, 2], 8: [0, 1], 9: [0, 2],
};

function colorFitsLine(line: SubwayLine, red: number, green: number, blue: number) {
  switch (line) {
    case 1: return blue - red > 45 && blue - green > 32;
    case 2: return green - red > 52 && green - blue > 30;
    case 3: return red > 165 && green > 78 && red - blue > 90 && green - blue > 30 && red >= green - 16;
    case 4: return blue - red > 55 && green - red > 53;
    case 5: return blue - green > 26 && red - green > 10 && blue - red > 10;
    case 6: return red - blue > 60 && red - green > 34 && green - blue > 15;
    case 7: return green - blue > 42 && green >= red - 12 && red > 60 && red < 160;
    case 8: return red - green > 70 && blue - green > 28;
    case 9: return red - blue > 24 && green > 95 && green - blue > 11 && red - green < 36 && red < 220;
  }
}

// Keep the entire arrow inside a sign-height band and within the closest
// neighboring arrow's section. Yellow exit panels are excluded independently.
function exitColor(frame: ImageData, box: ImageBox) {
  const { data, width } = frame;
  let yellow = 0;
  let total = 0;
  for (let y = box.y; y < box.y + box.height; y += 3) {
    for (let x = box.x; x < box.x + box.width; x += 3) {
      const pixel = (y * width + x) * 4;
      if (data[pixel] > 185 && data[pixel + 1] > 156 && data[pixel + 2] < 90) yellow++;
      total++;
    }
  }
  return yellow / total;
}

function findLabelBox(frame: ImageData, arrow: TransferArrow, siblings: TransferArrow[], badge?: Component): ImageBox | null {
  const center = arrow.x + arrow.width / 2;
  const band = siblings.filter((other) =>
    Math.abs(other.y + other.height / 2 - arrow.y - arrow.height / 2) < arrow.height * 0.65);
  const leftNeighbor = band.filter((other) => other.x < arrow.x).at(-1);
  const rightNeighbor = band.find((other) => other.x > arrow.x);
  const top = Math.max(0, arrow.y - Math.round(arrow.height * 0.45));
  const bottom = Math.min(frame.height, arrow.y + Math.round(arrow.height * 1.45));
  let left = Math.max(0, Math.floor(center - arrow.width * (band.length > 1 ? 12 : 6)),
    leftNeighbor ? Math.floor((leftNeighbor.x + leftNeighbor.width + arrow.x) / 2) : 0);
  let right = Math.min(frame.width, Math.ceil(center + arrow.width * (band.length > 1 ? 12 : 6)),
    rightNeighbor ? Math.ceil((arrow.x + arrow.width + rightNeighbor.x) / 2) : frame.width);
  if (badge && badge.x > arrow.x) left = arrow.x;
  if (badge && badge.x < arrow.x) right = arrow.x + arrow.width;
  const tileWidth = Math.max(5, Math.round(arrow.width * 0.55));
  // A large contiguous yellow area is an exit panel. A round line badge
  // occupies too little of the band to form a full-height yellow tile.
  for (const side of [-1, 1]) {
    const edge = side < 0 ? arrow.x : arrow.x + arrow.width;
    for (let offset = 0; offset < (side < 0 ? edge - left : right - edge); offset += tileWidth) {
      const x = side < 0 ? edge - offset - tileWidth : edge + offset;
      if (x < left || x + tileWidth > right) break;
      const tile = { x, y: top, width: tileWidth, height: bottom - top };
      if (exitColor(frame, tile) <= 0.55) continue;
      if (side < 0) left = x + tileWidth;
      else right = x;
      break;
    }
  }
  const label = { x: left, y: top, width: right - left, height: bottom - top };
  return label.width > arrow.width * 1.4 && exitColor(frame, label) < 0.42 ? label : null;
}

export function findTransferPanels(frame: ImageData, line: SubwayLine): SignPanel[] {
  const { data, width, height } = frame;
  const [channel, opposition] = badgeColors[line];
  const color = new Uint8Array(width * height);
  const pale = new Uint8Array(width * height);
  for (let i = 0; i < color.length; i++) {
    const pixel = i * 4;
    const red = data[pixel];
    const green = data[pixel + 1];
    const blue = data[pixel + 2];
    color[i] = Number(colorFitsLine(line, red, green, blue));
    pale[i] = Number(blue > 174 && green > 182 && red > 182 && Math.max(red, green, blue) - Math.min(red, green, blue) < 42);
  }
  const badges = components(color, width, height).filter((box) => box.width >= 14 && box.width <= width * 0.2
    && box.height / box.width > 0.77 && box.height / box.width < 1.23
    && box.area / (box.width * box.height) > 0.4 && box.area / (box.width * box.height) < 0.81
    && readBadge(frame, box, channel, opposition) === line);
  const arrows = components(pale, width, height).flatMap(({ x, y, width: w, height: h, area }) => {
    if (w < 11 || h < 11 || w > width * 0.21 || h > height * 0.28 || w / h < 0.58 || w / h > 1.65
      || area / (w * h) < 0.11 || area / (w * h) > 0.53) return [];
    const box = { x, y, width: w, height: h };
    const direction = readArrow(pale, width, box);
    return direction ? [{ ...box, direction }] : [];
  }).sort((a, b) => a.x - b.x);
  if (arrows.length > 8) return [];

  const pairs = badges.flatMap((badge) => {
    const nearby = arrows.filter((arrow) => {
      const gap = Math.max(arrow.x - badge.x - badge.width, badge.x - arrow.x - arrow.width);
      const offset = Math.abs(arrow.y + arrow.height / 2 - badge.y - badge.height / 2);
      return gap >= 0 && gap <= badge.width * 0.9 && offset <= badge.height * 0.23
        && arrow.width >= badge.width * 0.59 && arrow.width <= badge.width * 1.4
        && arrow.height >= badge.height * 0.54 && arrow.height <= badge.height * 1.43;
    });
    return nearby.map((arrow) => ({ arrow, badge }));
  });
  return arrows.flatMap((arrow) => {
    const pair = pairs.find((candidate) => candidate.arrow === arrow);
    const uniqueBadge = pair && !pairs.some((other) => other !== pair && other.badge === pair.badge);
    const label = findLabelBox(frame, arrow, arrows, uniqueBadge ? pair.badge : undefined);
    return label ? [{ arrow, label, line: uniqueBadge ? line : null }] : [];
  });
}

function coloredMarkers(frame: ImageData, guide: ImageBox) {
  const mask = new Uint8Array(guide.width * guide.height);
  for (let y = 0; y < guide.height; y++) {
    for (let x = 0; x < guide.width; x++) {
      const pixel = ((guide.y + y) * frame.width + guide.x + x) * 4;
      const red = frame.data[pixel];
      const green = frame.data[pixel + 1];
      const blue = frame.data[pixel + 2];
      const max = Math.max(red, green, blue);
      mask[y * guide.width + x] = Number(max > 118 && max - Math.min(red, green, blue) > 34);
    }
  }
  return components(mask, guide.width, guide.height);
}

// Screen-door strips often print a dark station code in a colored disc.
export function findPlatformSignRegions(frame: ImageData, guide: ImageBox) {
  const markers = coloredMarkers(frame, guide).filter(({ x, width, height, area }) =>
    x < guide.width * 0.68 && width >= 16 && width <= guide.width * 0.36
    && width / height >= 0.72 && width / height <= 1.5
    && area / (width * height) >= 0.48 && area / (width * height) <= 0.88)
    .sort((a, b) => b.area - a.area);
  const [first, second] = markers;
  if (!first || (second && second.area > first.area * 0.78)) return null;
  const badge = { ...first, x: first.x + guide.x, y: first.y + guide.y };
  const nameY = Math.max(0, Math.floor(badge.y - badge.height * 0.07));
  const nameX = Math.min(frame.width, badge.x + badge.width + 2);
  const nameRight = Math.min(frame.width, guide.x + guide.width, nameX + badge.width * 5.6);
  if (nameRight - nameX < badge.width) return null;
  const nameHeight = Math.min(frame.height - nameY, Math.round(badge.height * 1.2));
  return {
    code: { x: badge.x, y: badge.y, width: badge.width, height: badge.height },
    name: { x: nameX, y: nameY, width: nameRight - nameX, height: nameHeight },
  };
}


export function findPlatformDirectionRegion(frame: ImageData, current: ImageBox, name: ImageBox) {
  const center = current.y + current.height / 2;
  const y = Math.max(0, Math.floor(center - current.height * 0.59));
  const height = Math.min(frame.height - y, Math.ceil(current.height * 1.18));
  const mask = new Uint8Array(frame.width * height);

  for (let row = 0; row < height; row++) {
    for (let x = 0; x < frame.width; x++) {
      const i = ((y + row) * frame.width + x) * 4;
      const max = Math.max(frame.data[i], frame.data[i + 1], frame.data[i + 2]);
      const min = Math.min(frame.data[i], frame.data[i + 1], frame.data[i + 2]);
      mask[row * frame.width + x] = Number(max < 158 && max - min < 42);
    }
  }

  const arrows = components(mask, frame.width, height).flatMap((box) => {
    if (box.width < current.width * 0.36 || box.width > current.width * 1.45
      || box.height < current.height * 0.39 || box.height > current.height * 1.02
      || box.area / (box.width * box.height) > 0.56) return [];
    const direction = readArrow(mask, frame.width, box, 0.54);
    const leftGap = current.x - (box.x + box.width);
    const rightGap = box.x - (name.x + name.width);
    const isAdjacent = direction === "left" && leftGap >= 0 && leftGap <= current.width * 2.1
      || direction === "right" && box.x > current.x + current.width && rightGap >= -current.width && rightGap <= current.width * 3.7;
    return isAdjacent ? [{ ...box, y: box.y + y, direction }] : [];
  });
  if (arrows.length !== 1) return null;

  const [arrow] = arrows;
  const x = arrow.direction === "left" ? 0 : arrow.x + arrow.width;
  const width = arrow.direction === "left" ? arrow.x : frame.width - x;
  if (width < current.width * 0.32) return null;
  const side = { x, y, width, height };
  const markers = coloredMarkers(frame, side).filter((box) =>
    box.width >= current.width * 0.29 && box.width <= current.width * 0.91
    && box.height >= current.height * 0.26 && box.height <= current.height * 0.94
    && box.height / box.width > 0.68 && box.height / box.width < 1.42
    && box.area / (box.width * box.height) > 0.45 && box.area / (box.width * box.height) < 0.9);
  if (markers.length !== 1) return null;
  const [marker] = markers;
  return {
    code: { x: x + marker.x, y: y + marker.y, width: marker.width, height: marker.height },
    arrow,
  };
}
