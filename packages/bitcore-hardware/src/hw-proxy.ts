import Burner from './burner/adapter.js';
import Ledger from './ledger/adapter.js';
import { BurnerChainType, ChainType } from './types/chains.js';
import { Hardware } from './types/modules.js';
import { TransactionType } from './types/tx.js';
import type { EveryUtxoType } from '@bitpay-labs/crypto-wallet-core/ts_build/src/transactions/btc/index.js';

export type Vendor = 'ledger' | 'burner';
export type Connection = 'usb' | 'speculos' | 'nfc';

export class HardwareProxy implements Hardware {
  devices: Record<Vendor, Record<string, Hardware>> = {
    ledger: {},
    burner: {}
  };;
  private vendorClasses: Record<Vendor, new (config?: any) => Hardware> = {
    ledger: Ledger,
    burner: Burner
  };

  /**
   * Create and connect to every device.
   * Must be called before any other method.
   *
   * ```JavaScript
   * await HwProxy.connect();
   * ```
   */
  async connect() {
    // Release any existing sessions so they don't keep talking to the devices
    await this.disconnect();
    await this.tryCreateAndConnect('ledger', 'speculos');
    await this.tryCreateAndConnect('ledger', 'usb');
    await this.tryCreateAndConnect('burner', 'nfc');
  }

  async tryCreateAndConnect(vendor: Vendor, connection: Connection) {
    try {
      this.devices[vendor][connection] = new this.vendorClasses[vendor]({ connection });
      await this.devices[vendor][connection].connect();
    } catch {
      if (this.devices[vendor][connection]) {
        await this.devices[vendor][connection].disconnect();
        delete this.devices[vendor][connection];
      }
    }
  }

  /**
   * Disconnect from every device.
   *
   * ```JavaScript
   * await HwProxy.disconnect();
   * ```
   */
  async disconnect() {
    await this.runParallel('disconnect');
    this.devices = {
      ledger: {},
      burner: {}
    };
  }

  /**
   * Call a method on every connected device at the same time.
   *
   * @param method name of the method to call on each device
   * @param params passed to each device's method
   * @returns the result from each device
   */
  private async runParallel(method: keyof Hardware, params?: any) {
    if (this.devices == undefined) {
      return;
    }
    const promises: Promise<any>[] = [];
    for (const vendor of Object.values(this.devices)) {
      for (const device of Object.values(vendor)) {
        promises.push(device[method](params));
      }
    }
    return Promise.all(promises);
  };

  /**
   * Get the adapter object instance.
   * Allows access to public variables and some methods.
   *
   * ```JavaScript
   * const ledger = HwProxy.get('ledger', 'speculos');
   * const burner = HwProxy.get('burner');
   * ```
   *
   * @param vendor ledger or burner
   * @param connection the connection type: usb, speculos, or nfc
   * @returns the adapter instance
   */
  get(vendor: 'ledger', connection: 'usb' | 'speculos'): Ledger
  get(vendor: 'burner', connection?: 'nfc'): Burner
  get(vendor: Vendor, connection?: Connection): Hardware
  get(vendor: Vendor, connection?: Connection): Hardware {
    if (!this.devices) {
      throw new Error('Please connect the Hardware Proxy');
    }
    if (vendor === 'burner') {
      connection = 'nfc';
    }
    if (connection === undefined) {
      throw new Error(`Connection needs to be specified for ${vendor}`);
    }
    return this.devices[vendor][connection];
  }
  
  /**
   * Sign a transaction with a hardware device
   *
   * ```JavaScript
   * const signedTx = await HwProxy.sign({
   *  vendor: 'ledger',
   *  connection: 'speculos',
   *  chain: 'BTC',
   *  tx,
   *  utxos
   * });
   * ```
   *
   * @param params.vendor ledger or burner
   * @param params.connection the connection type
   * @param params.chain BTC, ETH, SOL, etc.
   * @param params.tx unsigned transaction. String or some object.
   * @param params.utxos the utxos being spent.
   * @param params.prevTxs ledger BCH, DOGE, and LTC only, raw hex of input transactions.
   * @param params.password burner only, the password of the burner device
   * @returns signed transaction as a string
   */
  async sign(params: {
    vendor: 'ledger';
    connection: 'usb' | 'speculos';
    chain: 'BTC';
    tx: string;
    utxos: EveryUtxoType[];
  }): Promise<string>
  async sign(params: {
    vendor: 'ledger';
    connection: 'usb' | 'speculos';
    chain: 'BTC';
    tx: object;
    utxos?: EveryUtxoType[];
  }): Promise<string>
  async sign(params: {
    vendor: 'ledger';
    connection: 'usb' | 'speculos';
    chain: 'BCH' | 'DOGE' | 'LTC';
    tx: string;
    utxos: EveryUtxoType[];
    prevTxs: string[];
  }): Promise<string>
  async sign(params: {
    vendor: 'ledger';
    connection: 'usb' | 'speculos';
    chain: 'BCH' | 'DOGE' | 'LTC';
    tx: object;
    utxos?: EveryUtxoType[];
    prevTxs: string[];
  }): Promise<string>
  async sign(params: {
    vendor: 'ledger';
    connection: 'usb' | 'speculos';
    chain: 'ETH' | 'SOL';
    tx: string;
  }): Promise<string>
  async sign(params: {
    vendor: 'burner';
    connection?: 'nfc';
    chain: 'BTC';
    tx: string;
    utxos: EveryUtxoType[];
    password: string;
  }): Promise<string>
  async sign(params: {
    vendor: 'burner';
    connection?: 'nfc';
    chain: 'BTC';
    tx: object;
    utxos?: EveryUtxoType[];
    password: string;
  }): Promise<string>
  async sign(params: {
    vendor: 'burner';
    connection?: 'nfc';
    chain: 'ETH';
    tx: string;
    password: string;
  }): Promise<string>
  async sign(params: {
    vendor: Vendor;
    connection?: Connection;
    chain: ChainType;
    tx: TransactionType;
    utxos?: EveryUtxoType[];
    prevTxs?: string[];
    password?: string;
  }): Promise<string> {
    const { vendor, connection } = params;
    return this.get(vendor, connection).sign(params);
  }

  /**
   * Get the address of a hardware wallet
   *
   * ```JavaScript
   * const address = await HwProxy.getAddress({
   *  vendor: 'ledger',
   *  connection: 'speculos',
   *  chain: 'BTC'
   * });
   * ```
   *
   * @param params.vendor ledger or burner
   * @param params.connection type of connection usb, speculos, or nfc
   * @param params.chain BTC, BCH, ETH, etc.
   * @returns address as a string
   */
  async getAddress(params: {
    vendor: 'ledger';
    connection: 'usb' | 'speculos';
    chain: ChainType;
  }): Promise<string>
  async getAddress(params: {
    vendor: 'burner';
    connection?: 'nfc';
    chain: BurnerChainType;
  }): Promise<string>
  async getAddress(params: {
    vendor: Vendor;
    connection?: Connection;
    chain: ChainType;
  }): Promise<string> {
    const { vendor, connection } = params;
    return this.get(vendor, connection).getAddress(params);
  }

  /**
   * Get the public key of a hardware device
   *
   * ```JavaScript
   * const publicKey = await HwProxy.getPublicKey({
   *  vendor: 'ledger',
   *  connection: 'speculos',
   *  chain: 'BTC'
   * });
   * ```
   *
   * @param params.vendor ledger or burner
   * @param params.connection the connection type
   * @param params.chain BTC, ETH, SOL, etc.
   * @returns public key as a string
   */
  async getPublicKey(params: {
    vendor: 'ledger';
    connection: 'usb' | 'speculos';
    chain: ChainType;
  }): Promise<string>
  async getPublicKey(params: {
    vendor: 'burner';
    connection?: 'nfc';
  }): Promise<string>
  async getPublicKey(params: {
    vendor: Vendor;
    connection?: Connection;
    chain?: ChainType;
  }): Promise<string> {
    const { vendor, connection } = params;
    return this.get(vendor, connection).getPublicKey(params);
  }

  /**
   * Check if a vendor supports a chain.
   * Narrows the type of chain so it can be passed to the other methods.
   *
   * ```JavaScript
   * if (HwProxy.isValidChain('ledger', chain)) {
   *   const address = await HwProxy.getAddress({ vendor: 'ledger', connection: 'speculos', chain });
   * }
   * ```
   *
   * @param vendor ledger or burner
   * @param chain BTC, ETH, SOL, etc.
   * @returns true if the vendor supports the chain
   */
  isValidChain(vendor: 'burner', chain: string): chain is BurnerChainType;
  isValidChain(vendor: 'ledger', chain: string): chain is ChainType;
  isValidChain(vendor: Vendor, chain: string): chain is ChainType;
  isValidChain(vendor: Vendor, chain: string): boolean {
    switch (vendor) {
      case 'ledger':
        return Ledger.isValidChain(chain);
      case 'burner':
        return Burner.isValidChain(chain);
    }
  }
}

/**
 * Shared {@link HardwareProxy} instance.
 *
 * ```JavaScript
 * import { HwProxy } from '@bitpay-labs/bitcore-hardware';
 *
 * await HwProxy.connect();
 * const address = await HwProxy.getAddress({ vendor: 'ledger', connection: 'speculos', chain: 'BTC' });
 * await HwProxy.disconnect();
 * ```
 */
const HwProxy = new HardwareProxy();
export default HwProxy;
