/**
 * Standalone validation for the compatible libp2p + gossipsub + mDNS stack.
 * Run: node test-p2p.js
 */
import { createLibp2p } from "libp2p";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { identify } from "@libp2p/identify";
import { mdns } from "@libp2p/mdns";

const TOPIC = "solarb/test-p2p/1.0.0";
const MDNS_TAG = "solarb.local";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(label, predicate, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await delay(500);
  }

  throw new Error(`Timed out waiting for ${label} after ${timeoutMs}ms`);
}

async function createNode(name, port) {
  const node = await createLibp2p({
    addresses: {
      listen: [`/ip4/127.0.0.1/tcp/${port}`],
    },
    transports: [tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    peerDiscovery: [
      mdns({
        interval: 1_000,
        serviceTag: MDNS_TAG,
      }),
    ],
    services: {
      pubsub: gossipsub({
        emitSelf: false,
        floodPublish: true,
        fallbackToFloodsub: true,
        allowPublishToZeroTopicPeers: true,
      }),
      identify: identify(),
    },
  });

  node.addEventListener("peer:discovery", async (event) => {
    const peer = event.detail;
    const peerId = peer.id.toString();

    if (peerId === node.peerId.toString()) {
      return;
    }

    if (node.getConnections(peer.id).length > 0) {
      return;
    }

    console.log(`[${name}] discovered ${peerId} via mDNS`);

    try {
      await node.dial(peer.multiaddrs);
      console.log(`[${name}] dialed ${peerId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[${name}] dial failed for ${peerId}: ${message}`);
    }
  });

  node.addEventListener("peer:connect", (event) => {
    console.log(`[${name}] connected to ${event.detail.toString()}`);
  });

  node.addEventListener("peer:identify", (event) => {
    console.log(
      `[${name}] identified ${event.detail.peerId.toString()} with ${event.detail.protocols.length} protocol(s)`
    );
  });

  node.services.pubsub.subscribe(TOPIC);
  console.log(
    `[${name}] started on /ip4/127.0.0.1/tcp/${port} with peerId ${node.peerId.toString()}`
  );
  console.log(`[${name}] subscribed to ${TOPIC}`);

  return node;
}

async function main() {
  const nodeA = await createNode("nodeA", 9101);
  const nodeB = await createNode("nodeB", 9102);

  try {
    const received = new Promise((resolve) => {
      nodeB.services.pubsub.addEventListener("message", (event) => {
        if (event.detail.topic !== TOPIC) {
          return;
        }

        const text = textDecoder.decode(event.detail.data);
        console.log(`\n>>> nodeB RECEIVED: ${text}\n`);
        resolve(text);
      });
    });

    console.log("Waiting for mDNS discovery and gossipsub mesh...");
    await waitFor(
      "topic peers on both nodes",
      async () => {
        const peersA = nodeA.services.pubsub
          .getSubscribers(TOPIC)
          .map((peerId) => peerId.toString());
        const peersB = nodeB.services.pubsub
          .getSubscribers(TOPIC)
          .map((peerId) => peerId.toString());

        console.log(
          `  nodeA sees ${peersA.length} topic peer(s), nodeB sees ${peersB.length} topic peer(s)`
        );

        return peersA.length > 0 && peersB.length > 0;
      },
      15_000
    );

    console.log("Publishing test message from nodeA...");
    await nodeA.services.pubsub.publish(
      TOPIC,
      textEncoder.encode("hello from nodeA over mDNS + gossipsub")
    );

    await Promise.race([
      received,
      waitFor("message delivery", async () => false, 5_000),
    ]);

    const connsA = nodeA.getConnections();
    console.log(`nodeA connections: ${connsA.length}`);
    for (const conn of connsA) {
      console.log(
        `  peer: ${conn.remotePeer.toString()}, streams: ${conn.streams.length}`
      );
      for (const stream of conn.streams) {
        console.log(`    stream: ${stream.protocol} (${stream.direction})`);
      }
    }

    console.log("\nP2P validation succeeded.");
  } finally {
    await nodeA.stop();
    await nodeB.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
