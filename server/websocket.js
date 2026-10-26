// Minimale WebSocket-implementatie (RFC 6455) zonder dependencies: handshake, frames lezen/schrijven, ping/pong.
import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_FRAME = 65536,
  MAX_BUFFER = 1 << 20,
  SLOW_CLIENT_BYTES = 2e6;
const OP = { cont: 0x0, text: 0x1, bin: 0x2, close: 0x8, ping: 0x9, pong: 0xa };

export class WsSocket {
  /** @param {import('node:net').Socket} sock */
  constructor(sock) {
    this.sock = sock;
    this.buf = Buffer.alloc(0);
    this.frag = [];
    this.closed = false;
    this.pongAt = Date.now();
    this.onmessage = null;
    this.onclose = null;
    sock.setNoDelay(true);
    sock.on('data', d => this.#onData(d));
    sock.on('close', () => this.#closed());
    sock.on('error', () => {});
  }
  #onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    if (this.buf.length > MAX_BUFFER) return this.close();
    let buf = this.buf;
    while (buf.length >= 2) {
      const b0 = buf[0],
        b1 = buf[1],
        fin = !!(b0 & 0x80),
        op = b0 & 0x0f,
        masked = !!(b1 & 0x80);
      let n = b1 & 0x7f,
        off = 2;
      if (n === 126) {
        if (buf.length < 4) break;
        n = buf.readUInt16BE(2);
        off = 4;
      } else if (n === 127) {
        if (buf.length < 10) break;
        n = Number(buf.readBigUInt64BE(2));
        off = 10;
      }
      if (n > MAX_FRAME) return this.close();
      const ml = masked ? 4 : 0;
      if (buf.length < off + ml + n) break;
      let payload = buf.subarray(off + ml, off + ml + n);
      if (masked) {
        const mk = buf.subarray(off, off + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mk[i & 3];
      }
      buf = buf.subarray(off + ml + n);
      if (op === OP.close) return this.close();
      if (op === OP.ping) {
        this.#raw(OP.pong, payload);
        continue;
      }
      if (op === OP.pong) {
        this.pongAt = Date.now();
        continue;
      }
      if (op === OP.text || op === OP.bin || op === OP.cont) {
        this.frag.push(payload);
        if (fin) {
          const msg = Buffer.concat(this.frag).toString('utf8');
          this.frag = [];
          this.onmessage?.(msg);
          if (this.closed) return;
        }
      }
    }
    this.buf = buf;
  }
  #raw(op, data) {
    if (this.closed || this.sock.destroyed) return;
    let hdr;
    if (data.length < 126) hdr = Buffer.from([0x80 | op, data.length]);
    else if (data.length < 65536) {
      hdr = Buffer.alloc(4);
      hdr[0] = 0x80 | op;
      hdr[1] = 126;
      hdr.writeUInt16BE(data.length, 2);
    } else {
      hdr = Buffer.alloc(10);
      hdr[0] = 0x80 | op;
      hdr[1] = 127;
      hdr.writeBigUInt64BE(BigInt(data.length), 2);
    }
    this.sock.write(Buffer.concat([hdr, data]));
  }
  /** Stuur tekst (string of object als JSON). Trage clients slaan updates over i.p.v. de server te laten vollopen. */
  send(obj) {
    if (this.closed || this.sock.destroyed || this.sock.writableLength > SLOW_CLIENT_BYTES) return;
    this.#raw(OP.text, Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)));
  }
  ping() {
    this.#raw(OP.ping, Buffer.alloc(0));
  }
  close() {
    if (!this.closed) {
      try {
        this.sock.destroy();
      } catch {}
    }
    this.#closed();
  }
  #closed() {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }
}

/** Handshake voor een 'upgrade'-verzoek op `path`. Geeft een WsSocket terug, of null (verbinding dan gesloten). */
export function acceptUpgrade(req, socket, path = '/ws') {
  const key = req.headers['sec-websocket-key'];
  if (new URL(req.url, 'http://x').pathname !== path || (req.headers.upgrade || '').toLowerCase() !== 'websocket' || !key) {
    socket.destroy();
    return null;
  }
  const accept = crypto
    .createHash('sha1')
    .update(key + GUID)
    .digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n',
  );
  return new WsSocket(socket);
}
