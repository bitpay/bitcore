import { ChildProcess, fork } from 'child_process';
import * as crypto from 'crypto';
import * as path from 'path';
import * as readline from 'readline';

interface SecureProcessResponse {
  messageId: string;
  result?: any;
  error?: { message: string; stack?: string };
}

export class VaultWalletProxy {
  public walletAddresses: Map<string, string>;
  private secureProcess: ChildProcess | null = null;
  private publicKey: crypto.KeyObject | null = null;
  private pendingMessages: Map<
    string,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  >;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.walletAddresses = new Map<string, string>(); // { name: address }
    this.pendingMessages = new Map();
  }

  public async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        const secureProcessPath = path.join(__dirname, 'SecureProcess.js');
        this.secureProcess = fork(secureProcessPath);

        this.secureProcess.on('message', this.handleResponse.bind(this));
        this.secureProcess.on('error', (err) => {
          console.error('SecureProcess fork error:', err);
        });

        const publicKeyPem = await this.sendMessage<string>('getPublicKey', {});
        this.publicKey = crypto.createPublicKey({
          key: publicKeyPem,
          format: 'pem',
        });
      } catch (error) {
        this.initializationPromise = null;
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  private handleResponse(msg: SecureProcessResponse) {
    const { messageId, result, error } = msg;
    const promise = this.pendingMessages.get(messageId);
    if (promise) {
      if (error) {
        const err = new Error(error.message);
        err.stack = error.stack;
        promise.reject(err);
      } else {
        promise.resolve(result);
      }
      this.pendingMessages.delete(messageId);
    }
  }

  private sendMessage<T>(action: string, payload: any): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.secureProcess) {
        return reject(new Error('Secure process not initialized.'));
      }

      const messageId = crypto.randomBytes(16).toString('hex');
      this.pendingMessages.set(messageId, { resolve, reject });

      this.secureProcess.send({ action, payload, messageId });
    });
  }

  public async loadWallet({ name, storageType = 'Level' }: { name: string; storageType?: string }): Promise<string> {
    if (!name) {
      throw new Error('Wallet name must be provided in walletOptions.');
    }
    const publicAddress = await this.sendMessage<string>('loadWallet', { name, storageType });
    this.walletAddresses.set(name, publicAddress);
    return publicAddress;
  }

  public async addPassphrase(walletName: string): Promise<{ success: boolean }> {
    if (!this.publicKey) {
      throw new Error('Public key not available. Initialize the proxy first.');
    }

    // Check secure heap before each passphrase operation
    const isSecureHeapEnabled = await this.sendMessage<{ enabled: boolean; error?: string }>('checkSecureHeap', {});
    if (!isSecureHeapEnabled) {
      // @TODO this should kill the whole process
      throw new Error('Secure heap is not enabled. Cannot perform secure operations.');
    }
    

    const passphrase = await this.promptForPassphrase();
    const passphraseBuffer = Buffer.from(passphrase);
    const encryptedPassphrase = crypto.publicEncrypt(
      {
        key: this.publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      passphraseBuffer
    );
    crypto.randomFillSync(passphraseBuffer);

    const payload = {
      name: walletName,
      encryptedPassphrase: encryptedPassphrase.toString('base64'),
    };
    return this.sendMessage<{ success: boolean }>('addPassphrase', payload);
  }

  private promptForPassphrase(): Promise<string> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question('Enter passphrase: ', (passphrase) => {
        rl.close();
        resolve(passphrase);
      });
    });
  }

  public terminate() {
    if (this.secureProcess) {
      this.secureProcess.kill();
      this.secureProcess = null;
    }
  }
}
