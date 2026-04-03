import * as http from 'http';
import * as https from 'https';
import * as worker from 'worker_threads';

interface RpcConfig {
  host: string;
  port: number | string;
  username: string;
  password: string;
  protocol?: string;
}

export class UtxoSyncWorker {
  private parentPort = worker.parentPort!;
  private rpc: RpcConfig = worker.workerData.rpc;
  private stopping = false;
  private isWorking = false;

  async start() {
    this.parentPort.on('message', this.messageHandler.bind(this));
  }

  async stop() {
    this.stopping = true;
    while (this.isWorking) {
      await new Promise(r => setTimeout(r, 100));
    }
    process.exit(0);
  }

  messageHandler(msg: any) {
    switch (msg.message) {
      case 'shutdown':
        this.stop();
        return;
      default:
        this.fetchBlock(msg);
    }
  }

  async fetchBlock({ hash, height }: { hash: string; height: number }) {
    if (this.stopping) return;
    this.isWorking = true;
    try {
      const rawBlock = await this.rpcGetRawBlock(hash);
      this.parentPort.postMessage({ message: 'sync', hash, height, rawBlock, threadId: worker.threadId });
    } catch (err: any) {
      this.parentPort.postMessage({
        message: 'sync', hash, height, notFound: true,
        error: err.message, threadId: worker.threadId
      });
    } finally {
      this.isWorking = false;
    }
  }

  rpcGetRawBlock(hash: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        jsonrpc: '1.0',
        id: `worker-${worker.threadId}`,
        method: 'getblock',
        params: [hash, 0] // verbosity 0 = raw serialized hex
      });

      const isHttps = this.rpc.protocol === 'https';
      const options: http.RequestOptions = {
        hostname: this.rpc.host,
        port: Number(this.rpc.port),
        method: 'POST',
        auth: `${this.rpc.username}:${this.rpc.password}`,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const req = (isHttps ? https : http).request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.error) {
              reject(new Error(result.error.message || JSON.stringify(result.error)));
            } else {
              resolve(result.result);
            }
          } catch {
            reject(new Error(`Failed to parse RPC response: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('RPC request timeout'));
      });
      req.write(body);
      req.end();
    });
  }
}

// Worker thread entry point
worker.parentPort!.once('message', async (msg) => {
  if (msg.message !== 'start') {
    throw new Error('Unknown startup message');
  }
  await new UtxoSyncWorker().start();
  worker.parentPort!.postMessage({ message: 'ready' });
});
