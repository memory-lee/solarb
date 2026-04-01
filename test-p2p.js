/**
 * Quick standalone test: two libp2p nodes with gossipsub.
 * Run: node test-p2p.js
 */
import { createLibp2p } from "libp2p";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { identify } from "@libp2p/identify";

const TOPIC = "test/topic/1.0.0";

async function createNode(port) {
  const node = await createLibp2p({
    addresses: { listen: [`/ip4/127.0.0.1/tcp/${port}`] },
    transports: [tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
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
  await node.start();
  console.log(`Node started on port ${port}, PeerId: ${node.peerId.toString()}`);
  return node;
}

async function main() {
  // Create two nodes
  const nodeA = await createNode(9001);
  const nodeB = await createNode(9002);

  // Subscribe nodeB to the topic
  const pubsubB = nodeB.services.pubsub;
  pubsubB.subscribe(TOPIC);
  pubsubB.addEventListener("message", (evt) => {
    if (evt.detail.topic === TOPIC) {
      const text = new TextDecoder().decode(evt.detail.data);
      console.log(`\n>>> nodeB RECEIVED: ${text}\n`);
    }
  });
  console.log("nodeB subscribed to topic");

  // Subscribe nodeA too (for mesh formation)
  const pubsubA = nodeA.services.pubsub;
  pubsubA.subscribe(TOPIC);
  console.log("nodeA subscribed to topic");

  // Connect A -> B
  const addrB = nodeB.getMultiaddrs()[0];
  console.log(`Dialing nodeB at ${addrB.toString()}...`);
  await nodeA.dial(addrB);
  console.log("Connected!");

  // Wait for gossipsub mesh to form
  console.log("Waiting for gossipsub mesh...");
  for (let i = 1; i <= 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const peersA = pubsubA.getSubscribers(TOPIC).map((p) => p.toString());
    const peersB = pubsubB.getSubscribers(TOPIC).map((p) => p.toString());
    console.log(`  tick ${i}: nodeA sees ${peersA.length} topic peers, nodeB sees ${peersB.length} topic peers`);

    if (peersA.length > 0 && peersB.length > 0) {
      console.log("Mesh formed! Publishing test message...");
      const data = new TextEncoder().encode("hello from nodeA");
      await pubsubA.publish(TOPIC, data);
      console.log("Published! Waiting 2s for delivery...");
      await new Promise((r) => setTimeout(r, 2000));
      break;
    }
  }

  // Check protocols
  console.log("\nnodeA protocols:", nodeA.getProtocols());
  console.log("nodeB protocols:", nodeB.getProtocols());

  // Check connections
  const connsA = nodeA.getConnections();
  console.log(`\nnodeA connections: ${connsA.length}`);
  for (const conn of connsA) {
    console.log(`  peer: ${conn.remotePeer.toString()}, streams: ${conn.streams.length}`);
    for (const s of conn.streams) {
      console.log(`    stream: ${s.protocol} (${s.direction})`);
    }
  }

  await nodeA.stop();
  await nodeB.stop();
  process.exit(0);
}

main().catch(console.error);
