import EventEmitter = require('events');
export interface Peer {
  bestHeight: number;
}
export type BitcoreP2pPool = EventEmitter & {
  connect: () => any;
  _connectedPeers: Peer[];
  sendMessage: (message: string) => any;
};
