import { execHaloCmdPCSC } from '@arx-research/libhalo/api/desktop';
import CWC, { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { NFC } from 'nfc-pcsc';
import { Base } from 'src/types/base.js';
import { CommandNameType, DataType } from './types/burnerTypes.js';
import { EveryUtxoType, TransactionType } from './types/txTypes.js';
import Util from './util.js';

const { Address, PublicKey, crypto } = BitcoreLib;

/**
 * Connect listens on the NFC reader for a card.
 * Methods queue a command to run when the card is scanned.
 */
export default class Burner implements Base {
  nfc?: NFC;
  // list of commands waiting to be sent to the wallet
  commandQueue = new Map<string, Record<string, any>>();
  // responses to all the commands from commandQueue
  responses = new Map<string, Record<string, any>>();

  /**
   * Queues a command to be sent off to the wallet when it is scanned with an NFC reader.
   * 
   * Logic for getting the response is not in this function, but in connect.
   * This function simply waits for the card listener to add the responses.
   * 
   * @param command command to queue
   * @returns response from the wallet
   */
  async sendCommand(command: CommandType): Promise<Record<string, any>> {
    return this.sendManyCommands([command]).then(responses => responses[0]);
  }

  /**
   * Queues commands to be sent off to the wallet when it is scanned with an NFC reader.
   * 
   * Logic for getting the response is not in this function, but in connect.
   * This function simply waits for the card listener to add the responses.
   * 
   * @param command commands to queue
   * @returns responses from the wallet
   */
  async sendManyCommands(commands: CommandType[]): Promise<Record<string, any>[]> {
    const ids: string[] = [];
    for (const command of commands) {
      for (let i = 0; i < 100; i++) {
        const id = command.name + '' + i;
        if (!this.commandQueue.has(id)) {
          this.commandQueue.set(id, command);
          ids.push(id);
          break;
        }
      }
    }
    return new Promise(async resolve1 => {
      const _responses: Record<string, object>[] = [];
      for (const id of ids) {
        while (this.responses.get(id) == undefined) {
          await new Promise(async resolve2 => setTimeout(resolve2, 500));
        }
        _responses.push(this.responses.get(id) ?? { error: 'no command' });
        this.responses.delete(id);
        this.commandQueue.delete(id);
      }
      resolve1(_responses);
    });
  }

  /**
   * Sends all commands to the wallet and recieves all responses
   */
  connect() {
    this.nfc = this.nfc ?? new NFC();

    this.nfc.on('reader', (reader) => {
      reader.autoProcessing = false;

      reader.on('card', async () => {
        try {
          for (const id of this.commandQueue.keys()) {
            this.responses.set(id, await execHaloCmdPCSC(this.commandQueue.get(id), reader));
          }
        } catch (e) {
          console.error(e);
        }
      });

      reader.on('error', (err) => {
        console.log(`${reader.reader.name} an error occurred`, err);
      });
    });

    this.nfc.on('error', (err) => {
      console.log('An error occurred', err);
    });
  }

  async sign(params: {
    chain: 'ETH';
    tx: string;
    index: number;
    password: string;
  })
  async sign(params: {
    chain: 'BTC';
    tx: string;
    utxos: EveryUtxoType[];
    index: number;
    password: string;
  })
  async sign(params: {
    chain: 'BTC';
    tx: object;
    utxos?: EveryUtxoType[];
    index: number;
    password: string;
  })
  async sign(params: {
    chain: 'BTC' | 'ETH';
    tx: TransactionType;
    utxos?: EveryUtxoType[];
    index: number;
    password: string;
  }) {
    switch (params.chain) {
      case 'ETH':
        return this.signEth(params);
      case 'BTC':
      default:
        return this.signBtc(params);
    }
  }
  
  async signBtc(params: {
    tx: TransactionType;
    utxos?: EveryUtxoType[];
    index: number;
    password: string;
  }) {
    const { tx, utxos, index, password } = params;
    const bitcoreTx = Util.buildTransaction(tx, utxos);

    const commands: CommandType[] = [];
    for (let i = 0; i < bitcoreTx.inputs.length; i++) {
      const sighash = CWC.Transactions.getSighash({ chain: 'BTC', tx: bitcoreTx, index: i });
      commands.push({
        name: 'sign',
        digest: sighash,
        password,
        keyNo: index
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

  async signEth(params: { tx: string; index: number; password: string }) {
    const { tx, index, password } = params;
    
    const sighash = CWC.Transactions.getSighash({
      chain: 'ETH',
      tx
    });
    
    const response = await this.sendCommand({
      name: 'sign',
      digest: sighash,
      password,
      keyNo: index
    });
    const signature = response.signature.ether;
    
    const signedTx = CWC.Transactions.applySignature({
      chain: 'ETH',
      tx,
      signature
    });

    return signedTx;
  }

  /**
   *
   * @param req
   * @returns
   */
  async getData(req: Array<{ type: DataType; index: number }>) {
    return this.sendCommand({
      name: 'get_data_struct_v2',
      spec: req
    });
  }

  async getPublicKey(params: { index: number }) {
    const { index } = params;

    return (await this.getData(
      [{ type: 'publicKey', index }]
    ) as any).publicKey[index].value;
  }

  async getAddress(params: {
    chain: 'BTC' | 'ETH';
    index: number;
  }) {
    switch (params.chain) {
      case 'ETH':
        return this.getAddressEth(params);
      case 'BTC':
      default:
        return this.getAddressBtc(params);
    }
  }

  async getAddressBtc(params: { index: number }) {
    const { index } = params;

    const data: any = await this.getData([{ type: 'compressedPublicKey', index }]);
    try {
      const pubKey = PublicKey.fromString(data.compressedPublicKey[index].value);
      const address = Address.fromPublicKey(pubKey, 'livenet', 'witnesspubkeyhash');
      return address.toString();
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  async getAddressEth(params: { index: number }) {
    const { index } = params;

    const data: any = await this.getData([{ type: 'publicKey', index }]);

    try {
      const address = CWC.ethers.computeAddress('0x' + data.publicKey[index].value);
      return address.toString();
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  async getVersion(params?: { index: number }) {
    const { index } = params || { index: 1 };
    const data: any = await this.getData([{ type: 'firmwareVersion', index }]);
    return data.firmwareVersion[index].value;
  }

  static isValidChain(value: string): value is 'BTC' | 'ETH' {
    return ['BTC', 'ETH'].includes(value);
  }
}

type CommandType = Record<string, any> & {
  name: CommandNameType;
  password?: string;
  keyNo?: number;
};
