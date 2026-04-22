import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { type Identify } from "@libp2p/identify";
import { type Libp2p } from "libp2p";
import type { PriceMessage } from "./types.js";
type P2PPubSub = ReturnType<ReturnType<typeof gossipsub>>;
interface P2PServices {
    [serviceName: string]: unknown;
    pubsub: P2PPubSub;
    identify: Identify;
}
export type P2PNode = Libp2p<P2PServices>;
export interface P2PNodeConfig {
    listenHost?: string;
    listenPort?: number;
    mdnsIntervalMs?: number;
    mdnsServiceTag?: string;
    nodeName?: string;
    bootstrapPeers?: string[];
}
export declare function createP2PNode(config?: P2PNodeConfig): Promise<P2PNode>;
export declare function publishPrices(node: P2PNode, message: PriceMessage): Promise<void>;
export declare function subscribePrices(node: P2PNode, handler: (message: PriceMessage) => void): void;
export {};
//# sourceMappingURL=p2p.d.ts.map