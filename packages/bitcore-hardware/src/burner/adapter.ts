import EventEmitter from 'events';
import { execHaloCmdPCSC } from '@arx-research/libhalo/api/desktop';
import CWC, { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { NFC } from 'nfc-pcsc';
import { BurnerChainType } from '../types/chains.js';
import { Hardware } from '../types/modules.js';
import { TransactionType } from '../types/tx.js';
import Util from '../util.js';
import { CommandNameType, DataType, Reader } from './types.js';
import type { EveryUtxoType } from '@bitpay-labs/crypto-wallet-core/ts_build/src/transactions/btc/index.js';

const { Address, PublicKey, crypto } = BitcoreLib;

/**
 * Fetch address, public key and sign transactions using the burner card.
 */
export default class Burner implements Hardware {
  nfc: EventEmitter = new NFC();
  reader?: Reader;
  private SLOT = 9;

  /**
   * Sends all commands to the device and recieves all responses
   */
  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const onReader = (reader: Reader) => {
        clearTimeout(timer);
        this.reader = reader;
        this.reader.autoProcessing = false;
        resolve(true);
      };
  
      const timer = setTimeout(() => {
        this.nfc.removeListener('reader', onReader);
        reject(new Error('No NFC reader detected within 5000ms'));
      }, 5000);
  
      this.nfc.once('reader', onReader);
    });
  }

  async disconnect() { };

  async sign(params: {
    chain: 'ETH';
    tx: string;
    password: string;
  })
  async sign(params: {
    chain: 'BTC';
    tx: string;
    utxos: EveryUtxoType[];
    password: string;
  })
  async sign(params: {
    chain: 'BTC';
    tx: object;
    utxos?: EveryUtxoType[];
    password: string;
  })
  async sign(params: {
    chain: BurnerChainType;
    tx: TransactionType;
    utxos?: EveryUtxoType[];
    password: string;
  }) {
    switch (params.chain) {
      case 'ETH':
        return this.signEth(params);
      case 'BTC':
        return this.signBtc(params);
      default:
        throw new Error(`Invalid chain ${params.chain}. Should be BTC or ETH.`);
    }
  }
  
  async signBtc(params: {
    tx: TransactionType;
    utxos?: EveryUtxoType[];
    password: string;
  }) {
    const { tx, utxos, password } = params;
    const bitcoreTx = Util.buildTransaction(tx, utxos);

    const commands: CommandType[] = [];
    for (let i = 0; i < bitcoreTx.inputs.length; i++) {
      const sighash = CWC.Transactions.getSighash({ chain: 'BTC', tx: bitcoreTx, index: i });
      commands.push({
        name: 'sign',
        digest: sighash,
        password,
        keyNo: this.SLOT
      });
    };
    const responses = await this.sendManyCommands(commands);
    
    for (let i = 0; i < bitcoreTx.inputs.length; i++) {
      const response = responses[i];
      const publicKey = new PublicKey(response.publicKey);
      const signature = crypto.Signature.fromString(response.signature.der);
      signature.pubKey = BitcoreLib.crypto.Point.pointToCompressed(publicKey.point).toString('hex');
  
      CWC.Transactions.applySignature({
        chain: 'BTC',
        tx: bitcoreTx,
        signature,
        index: i
      });
    }

    return bitcoreTx.serialize();
  }

  async signEth(params: { tx: string; password: string }) {
    const { tx, password } = params;
    
    const sighash = CWC.Transactions.getSighash({
      chain: 'ETH',
      tx
    });
    
    const response = await this.sendCommand({
      name: 'sign',
      digest: sighash,
      password,
      keyNo: this.SLOT
    });
    const signature = response.signature.ether;
    
    const signedTx = CWC.Transactions.applySignature({
      chain: 'ETH',
      tx,
      signature
    });

    return signedTx;
  }

  async getPublicKey() {
    return (await this.getData(
      [{ type: 'publicKey' }]
    ) as any).publicKey[this.SLOT].value;
  }

  async getAddress(params: {
    chain: BurnerChainType;
  }) {
    switch (params.chain) {
      case 'ETH':
        return this.getAddressEth();
      case 'BTC':
      default:
        return this.getAddressBtc();
    }
  }

  async getAddressBtc() {
    const data: any = await this.getData([{ type: 'compressedPublicKey' }]);
    try {
      const pubKey = PublicKey.fromString(data.compressedPublicKey[this.SLOT].value);
      const address = Address.fromPublicKey(pubKey, 'livenet', 'witnesspubkeyhash');
      return address.toString();
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  async getAddressEth() {
    const data: any = await this.getData([{ type: 'publicKey' }]);

    try {
      const address = CWC.ethers.computeAddress('0x' + data.publicKey[this.SLOT].value);
      return address.toString();
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  /**
   *
   * @param req
   * @returns
   */
  async getData(req: Array<{ type: DataType }>) {
    return this.sendCommand({
      name: 'get_data_struct_v2',
      spec: req.map(({ type }) => ({ type, index: this.SLOT }))
    });
  }

  /**
   * Sends a command to the device when it is scanned with an NFC reader.
   * 
   * @param command command to send
   * @returns response from the device
   */
  async sendCommand(command: CommandType): Promise<Record<string, any>> {
    return this.sendManyCommands([command]).then(responses => responses[0]);
  }

  /**
   * Sends commands to the device when it is scanned with an NFC reader.
   * 
   * Waits for a reader and card to be detected, then sends each command in order.
   * Rejects if the NFC, the reader, or any command fails.
   * 
   * @param commands commands to send
   * @returns responses from the device
   */
  async sendManyCommands(commands: CommandType[]): Promise<Record<string, any>[]> {
    return new Promise(async (resolve, reject) => {
      if (this.reader === undefined)
        return reject('Reader not connected');

      this.reader.once('card', async () => {
        if (this.reader === undefined)
          return reject();
        try {
          const responses: Record<string, any>[] = [];
          for (const command of commands) {
            responses.push(await execHaloCmdPCSC(command, this.reader));
          }
          resolve(responses);
        } catch (e) {
          reject(e);
        }
      });

      this.reader.once('error', (e) => {
        reject(e);
      });
    });
  }

  static isValidChain(value: string): value is BurnerChainType {
    return ['BTC', 'ETH'].includes(value);
  }
}

type CommandType = Record<string, any> & {
  name: CommandNameType;
  password?: string;
  keyNo?: number;
};
