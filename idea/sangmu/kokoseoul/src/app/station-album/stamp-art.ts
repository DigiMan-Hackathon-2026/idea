export const stampPixels = 960;

export type StampMotif = "dancheong" | "pine" | "roof" | "cloud" | "knot" | "tile" | "lattice" | "flower" | "wave";

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawMotif(ctx: CanvasRenderingContext2D, motif: StampMotif) {
  switch (motif) {
    case "dancheong":
    case "flower":
    case "knot":
    case "tile": {
      const petals = motif === "flower" ? 5 : motif === "knot" ? 4 : 6;
      if (motif === "tile") {
        ring(ctx, 0, 0, 29);
        ring(ctx, 0, 0, 26);
      }
      for (let i = 0; i < petals; i++) {
        ctx.save();
        ctx.rotate((i / petals) * Math.PI * 2);
        ctx.beginPath();
        if (motif === "dancheong") {
          ctx.moveTo(0, -1);
          ctx.quadraticCurveTo(-13, -6, 0, -23);
          ctx.quadraticCurveTo(13, -6, 0, -1);
        } else {
          ctx.ellipse(0, -13, 6, 10, 0, 0, Math.PI * 2);
        }
        ctx.stroke();
        if (motif === "knot") {
          ctx.beginPath();
          ctx.ellipse(0, -13, 3, 7, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (motif === "flower") ring(ctx, 0, 0, 3);
      break;
    }
    case "pine":
      ctx.fillRect(-2, 11, 4, 17);
      for (let i = 0; i < 3; i++) {
        const y = -28 + i * 11;
        const halfWidth = 16 + i * 8;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(halfWidth, y + 21);
        ctx.lineTo(0, y + 12);
        ctx.lineTo(-halfWidth, y + 21);
        ctx.closePath();
        ctx.fill();
      }
      break;
    case "roof":
      ctx.beginPath();
      ctx.moveTo(-39, 0);
      ctx.quadraticCurveTo(-22, 0, 0, -25);
      ctx.quadraticCurveTo(22, 0, 39, 0);
      ctx.lineTo(33, 5);
      ctx.lineTo(-33, 5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-27, 5);
      ctx.lineTo(-27, 26);
      ctx.lineTo(27, 26);
      ctx.lineTo(27, 5);
      ctx.stroke();
      ctx.strokeRect(-8, 11, 16, 15);
      break;
    case "cloud":
      for (const [x, y] of [[-17, 4], [0, -8], [17, 4]]) {
        ctx.beginPath();
        ctx.ellipse(x, y, 13, 11, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillRect(-34, 22, 68, 1.5);
      ctx.fillRect(-34, 26, 68, 1.5);
      break;
    case "lattice":
      ctx.strokeRect(-38, -30, 76, 60);
      ctx.strokeRect(-34, -26, 68, 52);
      ctx.beginPath();
      for (const x of [-17, 0, 17]) {
        ctx.moveTo(x, -26);
        ctx.lineTo(x, 26);
      }
      for (const y of [-9, 9]) {
        ctx.moveTo(-34, y);
        ctx.lineTo(34, y);
      }
      ctx.stroke();
      break;
    case "wave":
      for (const y of [-12, 2, 16]) {
        ctx.beginPath();
        ctx.moveTo(-36, y);
        for (let x = -36; x < 36; x += 24) {
          ctx.quadraticCurveTo(x + 12, y - 18, x + 24, y);
        }
        ctx.stroke();
      }
      break;
  }
}

export function drawStamp(
  canvas: HTMLCanvasElement,
  { color, motif, lineLabel, stationName, character }: {
    color: string; motif: StampMotif; lineLabel: string; stationName: string;
    character?: CanvasImageSource;
  },
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  // Match the album's 62% line color over roof-tile gray in sRGB.
  const lineColor = Number.parseInt(color.slice(1), 16);
  const rgb = [80, 78, 73].map((base, index) => {
    const channel = (lineColor >>> ((2 - index) * 8)) & 255;
    return Math.round(channel * 0.62 + base * 0.38);
  });
  const ink = `rgb(${rgb.join(",")})`;

  ctx.setTransform(stampPixels / 240, 0, 0, stampPixels / 240, 0, 0);
  ctx.clearRect(0, 0, 240, 240);
  ctx.fillStyle = "#f7f5ef";
  ctx.beginPath();
  ctx.arc(120, 120, 119.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ring(ctx, 120, 120, 118);
  ring(ctx, 120, 120, 114);
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.setLineDash([3, 2]);
  ctx.lineWidth = 1;
  ring(ctx, 120, 120, 109);
  ctx.restore();

  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (character) {
    for (let index = 0; index < 16; index++) {
      ctx.save();
      ctx.translate(120, 120);
      ctx.rotate(index * Math.PI / 8);
      ctx.translate(0, -103);
      ctx.scale(0.12, 0.12);
      ctx.lineWidth = 4;
      drawMotif(ctx, motif);
      ctx.restore();
    }
    ctx.drawImage(character, 32, 29, 176, 176);
    ctx.font = '800 13px system-ui, "Malgun Gothic", "Yu Gothic", sans-serif';
    ctx.fillText(lineLabel, 120, 48, 158);
    ctx.font = '900 23px system-ui, "Malgun Gothic", "Yu Gothic", sans-serif';
    ctx.fillText(stationName, 120, 193, 156);
    return true;
  }

  ctx.font = '800 14px "Malgun Gothic", "Yu Gothic", sans-serif';
  ctx.fillText(lineLabel, 120, 68, 158);
  ctx.save();
  ctx.translate(120, 115);
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawMotif(ctx, motif);
  ctx.restore();
  ctx.font = '900 24px Batang, "Yu Mincho", serif';
  ctx.fillText(stationName, 120, 167, 176);
  return true;
}
