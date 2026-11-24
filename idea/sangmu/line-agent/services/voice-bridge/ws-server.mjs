// Minimal WebSocket server side (RFC 6455) so the spike needs no extra packages.
// It handles what Twilio Media Streams sends: masked text frames, ping, close,
// and fragmented messages. Outgoing frames are unmasked text frames.
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";

const handshakeGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export function acceptWebSocket(request, socket, head) {
  const key = request.headers["sec-websocket-key"];
  if (!key || request.headers.upgrade?.toLowerCase() !== "websocket") {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    return null;
  }
  const accept = createHash("sha1").update(key + handshakeGuid).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  socket.setNoDelay(true);
  return new ServerWebSocket(socket, head);
}

class ServerWebSocket extends EventEmitter {
  #socket;
  #buffer = Buffer.alloc(0);
  #fragments = [];
  #fragmentOpcode = 0;
  #closed = false;

  constructor(socket, head) {
    super();
    this.#socket = socket;
    socket.on("data", (chunk) => this.#receive(chunk));
    socket.on("close", () => this.#finish());
    socket.on("error", (error) => this.emit("error", error));
    if (head?.length) queueMicrotask(() => this.#receive(head));
  }

  get isOpen() {
    return !this.#closed;
  }

  send(text) {
    if (this.#closed) return;
    this.#socket.write(frame(0x1, Buffer.from(text, "utf8")));
  }

  close(code = 1000) {
    if (this.#closed) return;
    const payload = Buffer.alloc(2);
    payload.writeUInt16BE(code);
    this.#socket.write(frame(0x8, payload));
    this.#socket.end();
    this.#finish();
  }

  #finish() {
    if (this.#closed) return;
    this.#closed = true;
    this.emit("close");
  }

  #receive(chunk) {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    for (;;) {
      const parsed = parseFrame(this.#buffer);
      if (!parsed) return;
      this.#buffer = this.#buffer.subarray(parsed.length);
      this.#handle(parsed);
      if (this.#closed) return;
    }
  }

  #handle({ fin, opcode, payload }) {
    if (opcode === 0x8) {
      this.close();
      return;
    }
    if (opcode === 0x9) {
      this.#socket.write(frame(0xa, payload));
      return;
    }
    if (opcode === 0xa) return;
    if (opcode === 0x0) {
      this.#fragments.push(payload);
    } else {
      this.#fragmentOpcode = opcode;
      this.#fragments = [payload];
    }
    if (!fin) return;
    const message = Buffer.concat(this.#fragments);
    this.#fragments = [];
    if (this.#fragmentOpcode === 0x1) this.emit("message", message.toString("utf8"));
  }
}

function parseFrame(buffer) {
  if (buffer.length < 2) return null;
  const fin = (buffer[0] & 0x80) !== 0;
  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let length = buffer[1] & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    length = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }
  const maskLength = masked ? 4 : 0;
  if (buffer.length < offset + maskLength + length) return null;
  const mask = masked ? buffer.subarray(offset, offset + 4) : null;
  const start = offset + maskLength;
  const payload = Buffer.from(buffer.subarray(start, start + length));
  if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
  return { fin, opcode, payload, length: start + length };
}

function frame(opcode, payload) {
  const length = payload.length;
  let header;
  if (length < 126) {
    header = Buffer.from([0x80 | opcode, length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}
