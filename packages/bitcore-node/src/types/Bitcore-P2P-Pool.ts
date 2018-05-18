import EventEmitter = require('events');
export type Peer = {bestHeight: number};
export type BitcoreP2pPool = EventEmitter & {
  connect: () => any, _connectedPeers: Peer[];
  sendMessage: (message: string) => any;
};
