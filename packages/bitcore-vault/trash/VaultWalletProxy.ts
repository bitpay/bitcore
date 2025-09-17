// VaultWalletProxy.ts
import { BufferIO } from 'bufferio'
import { ChildProcess, fork } from 'child_process';
import { constants, publicEncrypt, randomFillSync } from 'crypto';
import { resolve } from 'path';

export interface KeyImport {
  address: string;
  privKey?: string;
  pubKey?: string;
  path?: string;
}

interface Pending { resolve: (v: any) => void; reject: (e: any) => void }

const CHILD_MODULE = resolve(__dirname, 'vault-child.js'); // static child entrypoint (transpiled)

export class VaultWalletProxy {
  private child: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private closed = false;
  // @TODO fix type
  private vaultPubKey: any = null;
  public wallets: Map<string, string> = new Map(); // keys are wallet names, values are public addresses

  // Promise that resolves when child's public key is received
  private childPublicKeyPromise: Promise<Buffer> | null = null;
  private childPublicKeyResolve?: (b: Buffer) => void;
  private childPublicKeyReject?: (e: any) => void;

  constructor(private childModulePath: string = CHILD_MODULE) {
    // constructor allows overriding in tests, but production code should use static CHILD_MODULE.
  }

  /**
   * Start the child process and (optionally) perform the encrypted-passphrase handshake
   * by sending the encrypted passphrase.
   */
  public async start(): Promise<void> {
    if (this.closed) throw new Error('VaultWalletProxy is closed.');
    if (this.child) throw new Error('Child already started.');

    // Prepare child public key promise
    this.childPublicKeyPromise = new Promise<Buffer>((resolve, reject) => {
      this.childPublicKeyResolve = resolve;
      this.childPublicKeyReject = reject;
    });

    // Enforced fork options
    const forkOptions = {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'] as any,
      execArgv: ['--secure-heap=2048', '--expose-gc'], // explicitly set secure flags; nothing inherited - especially debug
      env: { ...process.env, NODE_OPTIONS: '' },
      detached: false,
    };

    this.child = fork(this.childModulePath, [], forkOptions);

    this.child.on('message', this.onChildMessage);
    this.child.on('exit', this.onChildExit);
    this.child.on('error', this.onChildError);

    // Get vault's public key
    const pub = await this.childPublicKeyPromise;

    let passphraseBuf: any;
    try {
      // Get passphrase as buffer
      const bufferIO = new BufferIO();
      passphraseBuf = await bufferIO.readIn('Enter vault password: ');
      // Here primarily for type-narrowing + useful runtime assurance
      if (!Buffer.isBuffer(passphraseBuf)) {
        // @TODO 
        throw new Error('TODO - what should happen here');
      }
      console.log(passphraseBuf);
      await this.sendEncryptedPassphraseWithPublicKey(pub, passphraseBuf);
    } finally {
      if (Buffer.isBuffer(passphraseBuf)) {
        randomFillSync(passphraseBuf);
      }
    }
  }

  /**
   * Implementation note: The script should govern loadWallet over a user-defined loop. The user should be able to continuously add wallets until they execute a quit command
   */
  public async loadWallet({ name, storageType = 'Level' }: { name: string, storageType?: string }) {
    /**
     * Send loadWallet msg to child process
     * This should load the wallet to the child process & store it in a Map<string, Wallet>
     * Then it should call sendEncryptedPassphraseWithPublicKey
     */
    
    // Once wallet is loaded - set the wallet public address
    this.wallets.set(name, 'TODO: get and add address');
  }

  private async sendEncryptedPassphraseWithPublicKey(pubKeyPem: Buffer, passphraseBuf: Buffer): Promise<void> {
    if (!this.child) throw new Error('Child not started');

    // Encrypt with RSA-OAEP SHA-256
    const encrypted = publicEncrypt(
      {
        key: pubKeyPem,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      passphraseBuf
    );

    // Send ciphertext in a single IPC message
    await new Promise<void>((resolve, reject) => {
      this.child!.send({ type: 'encryptedInit', data: encrypted }, (err: Error | null) => {
        // scrub caller buffer immediately regardless of send success
        randomFillSync(passphraseBuf);

        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /** --- Wallet API mirror methods --- */

  public importKeys(params: { keys: KeyImport[]; rederiveAddys?: boolean }): Promise<any> {
    return this.sendRequest('importKeys', [params]);
  }

  public signTx(params: {
    tx: any;
    keys: any;
    utxos: any;
    passphrase?: any; // NOT used if using encrypted-init flow; child will ignore if present
    signingKeys?: any;
    changeAddressIdx?: any;
  }): Promise<any> {
    // Security: do not allow passing plaintext passphrase via this API.
    if (params && (params as any).passphrase) {
      return Promise.reject(new Error('Plaintext passphrase in signTx params is not allowed. Use encrypted init flow.'));
    }
    return this.sendRequest('signTx', [params]);
  }

  public derivePrivateKey(isChange: boolean, addressIndex: number): Promise<any> {
    return this.sendRequest('derivePrivateKey', [isChange, addressIndex]);
  }

  /** --- IPC request/response internals --- */

  private sendRequest(method: string, args: any[]): Promise<any> {
    if (!this.child || this.closed) return Promise.reject(new Error('Child not available'));

    const id = this.nextId++;
    const msg = { type: 'request', id, method, args };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });

      try {
        this.child!.send(msg, (err: Error | null) => {
          if (err) {
            this.pending.delete(id);
            reject(err);
          }
        });
      } catch (err) {
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  private onChildMessage = (raw: any) => {
    if (!raw || typeof raw !== 'object') return;

    if (raw.type === 'publicKey' && Buffer.isBuffer(raw.pub)) {
      // Receive the child's public key (PEM Buffer)
      if (this.childPublicKeyResolve) {
        this.childPublicKeyResolve(raw.pub);
        this.childPublicKeyResolve = undefined;
        this.childPublicKeyReject = undefined;
      }
      return;
    }

    if (raw.type === 'response' && typeof raw.id === 'number') {
      const id: number = raw.id;
      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);

      if (raw.error) {
        const e = new Error(raw.error.message || 'Child error');
        if (raw.error.stack) (e as any).stack = raw.error.stack;
        Object.assign(e, raw.error);
        pending.reject(e);
      } else {
        pending.resolve(raw.result);
      }
      return;
    }

    // Handle encryptedInitAck/nack (optional)
    if (raw.type === 'encryptedInitAck') {
      // we could track state; not required here
      return;
    }
    if (raw.type === 'encryptedInitNack') {
      // If the child nacked init, reject publicKey promise if waiting
      if (this.childPublicKeyReject) {
        this.childPublicKeyReject(new Error(raw.reason || 'Child rejected encrypted init'));
        this.childPublicKeyResolve = undefined;
        this.childPublicKeyReject = undefined;
      }
      return;
    }

    // ignore other messages for now
  };

  private onChildExit = (code: number | null, signal: NodeJS.Signals | null) => {
    const err = new Error(`Child exited unexpectedly (code=${String(code)}, signal=${String(signal)})`);
    // Reject publicKey promise if still pending
    if (this.childPublicKeyReject) {
      this.childPublicKeyReject(err);
      this.childPublicKeyResolve = undefined;
      this.childPublicKeyReject = undefined;
    }
    this.rejectAllPending(err);
    this.cleanupChild();
  };

  private onChildError = (err: Error) => {
    if (this.childPublicKeyReject) {
      this.childPublicKeyReject(err);
      this.childPublicKeyResolve = undefined;
      this.childPublicKeyReject = undefined;
    }
    this.rejectAllPending(err);
    this.cleanupChild();
  };

  public close(): void {
    this.closed = true;
    if (this.child && !this.child.killed) {
      try {
        this.child.kill();
      } catch {
        try {
          this.child.kill('SIGKILL');
        } catch {}
      }
    }
    this.rejectAllPending(new Error('VaultWalletProxy closed by caller'));
    this.cleanupChild();
  }

  private rejectAllPending(err: Error) {
    for (const [, p] of this.pending) {
      try {
        p.reject(err);
      } catch {}
    }
    this.pending.clear();
  }

  private cleanupChild() {
    if (!this.child) return;
    try {
      this.child.removeListener('message', this.onChildMessage);
      this.child.removeListener('exit', this.onChildExit);
      this.child.removeListener('error', this.onChildError);
    } catch {}
    this.child = null;
  }
}
