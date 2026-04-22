import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { mdns } from "@libp2p/mdns";
import { tcp } from "@libp2p/tcp";
import { multiaddr } from "@multiformats/multiaddr";
import { createLibp2p } from "libp2p";
import { PRICE_TOPIC } from "./constants.js";
const DEFAULT_MDNS_SERVICE_TAG = "solarb.local";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
export async function createP2PNode(config = {}) {
    const { listenHost = "0.0.0.0", listenPort = 0, mdnsIntervalMs = 5_000, mdnsServiceTag = DEFAULT_MDNS_SERVICE_TAG, nodeName = "solarb-node", bootstrapPeers = [], } = config;
    const node = await createLibp2p({
        addresses: {
            listen: [`/ip4/${listenHost}/tcp/${listenPort}`],
        },
        transports: [tcp()],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
        peerDiscovery: [
            mdns({
                interval: mdnsIntervalMs,
                serviceTag: mdnsServiceTag,
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
        const localPeerId = node.peerId.toString();
        const remotePeerId = peer.id.toString();
        if (remotePeerId === localPeerId) {
            return;
        }
        if (node.getConnections(peer.id).length > 0) {
            return;
        }
        // Use a stable tie-breaker to avoid both peers dialing each other.
        if (localPeerId.localeCompare(remotePeerId) >= 0) {
            return;
        }
        console.log(`[P2P:${nodeName}] Discovered peer ${remotePeerId} via mDNS`);
        try {
            await node.dial(peer.multiaddrs);
            console.log(`[P2P:${nodeName}] Connected to discovered peer ${remotePeerId}`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[P2P:${nodeName}] Failed to dial discovered peer ${remotePeerId}: ${message}`);
        }
    });
    node.addEventListener("peer:connect", (event) => {
        console.log(`[P2P:${nodeName}] Peer connected: ${event.detail.toString()}`);
    });
    node.addEventListener("peer:disconnect", (event) => {
        console.log(`[P2P:${nodeName}] Peer disconnected: ${event.detail.toString()}`);
    });
    const listenAddrs = node
        .getMultiaddrs()
        .map((multiaddr) => multiaddr.toString())
        .join(", ");
    console.log(`[P2P:${nodeName}] Started with peerId ${node.peerId.toString()} listening on ${listenAddrs}`);
    console.log(`[P2P:${nodeName}] mDNS enabled (serviceTag=${mdnsServiceTag}, interval=${mdnsIntervalMs}ms)`);
    if (bootstrapPeers.length > 0) {
        setTimeout(async () => {
            if (node.getPeers().length > 0) {
                return;
            }
            console.log(`[P2P:${nodeName}] No peers found via mDNS after 10s, dialing ${bootstrapPeers.length} bootstrap peer(s)`);
            for (const addr of bootstrapPeers) {
                try {
                    await node.dial(multiaddr(addr));
                    console.log(`[P2P:${nodeName}] Connected to bootstrap peer ${addr}`);
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.warn(`[P2P:${nodeName}] Failed to dial bootstrap peer ${addr}: ${message}`);
                }
            }
        }, 10_000);
    }
    return node;
}
export async function publishPrices(node, message) {
    await node.services.pubsub.publish(PRICE_TOPIC, textEncoder.encode(JSON.stringify(message)));
    const peers = node.services.pubsub.getSubscribers(PRICE_TOPIC).length;
    console.log(`[P2P] Published ${message.prices.length} prices on ${PRICE_TOPIC} to ${peers} peer(s)`);
}
export function subscribePrices(node, handler) {
    node.services.pubsub.subscribe(PRICE_TOPIC);
    node.services.pubsub.addEventListener("message", (event) => {
        if (event.detail.topic !== PRICE_TOPIC) {
            return;
        }
        try {
            const message = JSON.parse(textDecoder.decode(event.detail.data));
            handler(message);
        }
        catch (error) {
            console.error("[P2P] Failed to decode price message:", error);
        }
    });
    console.log(`[P2P] Subscribed to ${PRICE_TOPIC}`);
}
//# sourceMappingURL=p2p.js.map