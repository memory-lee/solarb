/**
 * P2P communication layer using TCP sockets with JSON-line protocol.
 *
 * Architecture:
 *   Watcher (publisher) → TCP server on a known port
 *   Detector (subscriber) → TCP client connects to Watcher
 *
 * Messages are newline-delimited JSON (JSON-lines / NDJSON).
 * Supports multiple simultaneous subscribers (fan-out).
 * Auto-reconnect on disconnect.
 */
import { createServer, createConnection, Socket, Server } from "net";
import { PriceMessage } from "./index.js";

// ── Publisher (Watcher side) ───────────────────────────────────────

export interface P2PPublisher {
  port: number;
  server: Server;
  clients: Set<Socket>;
  publish: (msg: PriceMessage) => void;
}

/**
 * Start a TCP server that broadcasts PriceMessages to all connected peers.
 */
export function createPublisher(port: number): Promise<P2PPublisher> {
  const clients = new Set<Socket>();

  const server = createServer((socket) => {
    const addr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[P2P] Peer connected: ${addr}`);
    clients.add(socket);

    socket.on("close", () => {
      console.log(`[P2P] Peer disconnected: ${addr}`);
      clients.delete(socket);
    });

    socket.on("error", (err) => {
      console.error(`[P2P] Peer error (${addr}):`, err.message);
      clients.delete(socket);
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      console.log(`[P2P] Publisher listening on tcp://0.0.0.0:${port}`);
      console.log(`[P2P] Peers can connect to: tcp://127.0.0.1:${port}`);

      const publisher: P2PPublisher = {
        port,
        server,
        clients,
        publish(msg: PriceMessage) {
          const line = JSON.stringify(msg) + "\n";
          for (const client of clients) {
            try {
              client.write(line);
            } catch {
              // client disconnected, will be cleaned up
            }
          }
          if (clients.size > 0) {
            console.log(
              `[P2P] Published ${msg.prices.length} prices to ${clients.size} peer(s)`
            );
          }
        },
      };

      resolve(publisher);
    });

    server.on("error", reject);
  });
}

// ── Subscriber (Detector side) ─────────────────────────────────────

export interface P2PSubscriberConfig {
  /** Host of the publisher (Watcher) */
  host: string;
  /** Port of the publisher (Watcher) */
  port: number;
  /** Auto-reconnect delay in ms (default 3000) */
  reconnectMs?: number;
}

/**
 * Connect to a Watcher's TCP server and receive PriceMessages.
 * Automatically reconnects on disconnect.
 */
export function createSubscriber(
  config: P2PSubscriberConfig,
  handler: (msg: PriceMessage) => void
): void {
  const { host, port, reconnectMs = 3000 } = config;
  let buffer = "";

  function connect() {
    console.log(`[P2P] Connecting to publisher at ${host}:${port}...`);

    const socket = createConnection({ host, port }, () => {
      console.log(`[P2P] Connected to publisher at ${host}:${port}`);
    });

    socket.setEncoding("utf8");

    socket.on("data", (chunk: string) => {
      buffer += chunk;
      // Process complete JSON lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer
      for (const line of lines) {
        if (line.trim()) {
          try {
            const msg = JSON.parse(line) as PriceMessage;
            handler(msg);
          } catch (err) {
            console.error("[P2P] Failed to parse message:", err);
          }
        }
      }
    });

    socket.on("close", () => {
      console.log(
        `[P2P] Disconnected from publisher. Reconnecting in ${reconnectMs}ms...`
      );
      setTimeout(connect, reconnectMs);
    });

    socket.on("error", (err) => {
      console.error(`[P2P] Connection error:`, err.message);
      // 'close' event will fire after this, triggering reconnect
    });
  }

  connect();
}
