import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { Client } from '@bitpay-labs/bitcore-client';
import { expect } from 'chai';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { EventService } from '../../../src/services/event';
import { SocketService } from '../../../src/services/socket';

// Real Socket.IO messages, isolated from MongoDB, chain workers and fixed ports.
describe('Socket room validation', function() {
  let server: Server;
  let service: SocketService;
  let client: ClientSocket;
  const prefix = '/BTC/regtest/';

  beforeEach(async () => {
    server = createServer();
    service = new SocketService({ eventService: new EventService() });
    service.serviceConfig = { bwsKeys: [] };
    service.start({ server });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    client = io(`http://127.0.0.1:${port}`, { transports: ['websocket'], reconnection: false });
    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
  });

  afterEach(async () => {
    client?.disconnect();
    await service.stop();
    await new Promise<void>(resolve => service.io!.close(() => resolve()));
  });

  const failure = () => new Promise<any>(resolve => client.once('failure', resolve));
  const serverSocket = () => service.io!.sockets.sockets.get(client.id!)!;
  // A failure response to a subsequent message proves earlier joins were processed.
  const flush = async () => {
    const rejected = failure();
    client.emit('room', prefix + 'wallet');
    await rejected;
  };

  for (const room of [null, 5, [], {}]) {
    it(`rejects a non-string room ${JSON.stringify(room)} and accepts a subsequent public subscription`, async () => {
      const rejected = failure();
      client.emit('room', room);
      await rejected;
      expect([...serverSocket().rooms]).to.deep.equal([client.id]);
      client.emit('room', prefix + 'inv');
      await flush();
      expect(serverSocket().rooms.has(prefix + 'inv')).to.equal(true);
    });
  }

  for (const kind of ['missing', 'null']) {
    it(`rejects ${kind} wallets authentication without joining the room`, async () => {
      const rejected = failure();
      if (kind === 'missing') client.emit('room', prefix + 'wallets');
      else client.emit('room', prefix + 'wallets', null);
      await rejected;
      expect(serverSocket().rooms.has(prefix + 'wallets')).to.equal(false);
      await flush();
    });
  }

  it('rejects a signed object public key and accepts a subsequent string public key', async () => {
    const key = new BitcoreLib.PrivateKey();
    const signer = new Client({ apiUrl: 'http://localhost/api', authKey: key });
    const request = { method: 'socket', url: 'http://localhost/api' };
    const payload = { message: signer.getMessage(request), signature: signer.sign(request) };
    const rejected = failure();
    client.emit('room', prefix + 'wallet', {
      ...payload, pubKey: { ...key.toPublicKey().toObject(), toString: 1 }
    });
    await rejected;
    expect([...serverSocket().rooms]).to.deep.equal([client.id]);
    const pubKey = key.toPublicKey().toString();
    client.emit('room', prefix + 'wallet', { ...payload, pubKey });
    await flush();
    expect(serverSocket().rooms.has(prefix + pubKey)).to.equal(true);
  });
});
