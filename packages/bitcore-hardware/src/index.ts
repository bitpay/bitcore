import Burner from './burner.js';
import Ledger from './ledger/wallet.js';
import { Base } from './types/base.js';
import { ChainType } from './types/chains.js';
import { EveryUtxoType, TransactionType } from './types/txTypes.js';

export type Wallet = 'ledger' | 'burner';
export type Transport = 'hid' | 'speculos' | 'nfc';

export class HardwareProxy implements Base {
  wallets: Record<Wallet, Record<string, Base>> | undefined;
  
  async connect() {
    this.wallets = {
      ledger: {
        speculos: new Ledger({ transport: 'speculos' }),
      },
      burner: {
        nfc: new Burner(),
      }
    };
    return this.runParallel('connect');
  }

  async disconnect() {
    return this.runParallel('disconnect');
  }

  async runParallel(method: keyof Base, params?: any) {
    if (this.wallets == undefined) {
      return;
    }
    const promises: Promise<any>[] = [];
    for (const company of Object.values(this.wallets)) {
      for (const wallet of Object.values(company)) {
        promises.push(wallet[method](params));
      }
    }
    return Promise.all(promises);
  };

  get(wallet: 'ledger', transport: 'hid' | 'speculos'): Ledger
  get(wallet: 'burner', transport?: 'nfc'): Burner
  get(wallet: Wallet, transport: Transport): Base
  get(wallet: Wallet, transport?: Transport): Base {
    if (!this.wallets) {
      throw new Error('Please connect the Hardware Proxy');
    }
    if (transport == undefined) {
      transport = 'nfc';
    }
    return this.wallets[wallet][transport];
  }

  
  /**
   * Get the address of a hardware wallet on a chain
   * 
   * ```JavaScript
   * const address = await HwProxy.getAddress({
   *  wallet: 'ledger',
   *  transport: 'speculos',
   *  chain: 'BTC'
   * });
   * ```
   * 
   * @param params.wallet ledger or burner
   * @param params.transport the transport connection type
   * @param params.chain
   * @return address as a string
   */
  async getAddress(params: {
    wallet: 'ledger';
    transport: 'hid' | 'speculos';
    chain: ChainType;
  })
  async getAddress(params: {
    wallet: 'burner';
    transport: 'nfc';
    chain: 'BTC' | 'ETH';
  })
  async getAddress(params: {
    wallet: Wallet;
    transport: Transport;
    chain?: ChainType;
  }) {
    const { wallet, transport } = params;
    return this.get(wallet, transport).getAddress(params);
  }

  
  async getPublicKey(params: {
    wallet: 'ledger';
    transport: 'hid' | 'speculos';
    chain: ChainType;
  })
  async getPublicKey(params: {
    wallet: 'burner';
    transport: 'nfc';
  })
  async getPublicKey(params: {
    wallet: Wallet;
    transport: Transport;
    chain?: ChainType;
  }) {
    const { wallet, transport } = params;
    return this.get(wallet, transport).getPublicKey(params);
  }

  async sign(params: {
    wallet: 'ledger';
    transport: 'hid' | 'speculos';
    chain: ChainType;
    tx: TransactionType;
    utxos?: EveryUtxoType[];
    prevTxs?: string[];
  })
  async sign(params: {
    wallet: 'burner';
    transport: 'nfc';
    chain: 'BTC' | 'ETH';
    tx: TransactionType;
    utxos?: EveryUtxoType[];
    password: string;
  })
  async sign(params: {
    wallet: Wallet;
    transport: Transport;
    chain: ChainType;
    tx: TransactionType;
    utxos?: EveryUtxoType[];
    prevTxs?: string[];
    password?: string;
  }) {
    const { wallet, transport } = params;
    return this.get(wallet, transport).sign(params);
  }

  isValidChain(wallet: 'burner', chain: string): chain is 'BTC' | 'ETH';
  isValidChain(wallet: 'ledger', chain: string): chain is ChainType;
  isValidChain(wallet: Wallet, chain: string): boolean {
    switch (wallet) {
      case 'ledger':
        return Ledger.isValidChain(chain);
      case 'burner':
        return Burner.isValidChain(chain);
    }
  }
}

export const HwProxy = new HardwareProxy();

export {
  Ledger,
  Burner
};
