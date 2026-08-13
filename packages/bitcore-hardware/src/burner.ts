import { execHaloCmdPCSC } from '@arx-research/libhalo/api/desktop';
import CWC, { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { NFC } from 'nfc-pcsc';
import { Base } from './base.js';
import { DataType } from './types/burnerTypes.js';
import { BaseParams } from './types/paramTypes.js';

const { Address, PublicKey, crypto } = BitcoreLib;

/**
 * Connect listens on the NFC reader for a card.
 * Methods queue a command to run when the card is scanned.
 */
export default class Burner implements Base {
  nfc = new NFC();
  command = {};
  chain: string;
  response: object | string | number | undefined;

  constructor(chain: string) {
    this.chain = chain;
  }

  async awaitResponse() {
    return new Promise(async (resolve1) => {
      while (this.response === undefined) {
        await new Promise(resolve2 => setTimeout(resolve2, 10));
      }
      resolve1(this.response);
    });
  }

  connect() {
    this.nfc.on('reader', (reader) => {
      reader.autoProcessing = false;

      reader.on('card', async () => {
        try {
          this.response = await execHaloCmdPCSC(this.command, reader);
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

  /**
   * Standardize utxo for internal funcionality.
   * Accepts either a bitcore-node or a lib (bitcore-lib, bitcore-lib-cash, etc.) utxo.
   * Handles both lib style utxos: UnspentOutput properties and UnspentOutput.toObject properties.
   *
   * @param utxos either a bitcore-node or lib utxo
   * @returns utxo in the standard, internaly used format
   */
  standardizeUtxo(utxo: EveryUtxoType): UtxoType {
    return {
      satoshis: Number(utxo.satoshis ?? utxo.value ?? BitcoreLib.Unit.fromBTC(utxo.amount ?? 0).toSatoshis()),
      txId: utxo.txId ?? utxo.mintTxid ?? utxo.txid ?? '',
      outputIndex: Number(utxo.outputIndex ?? utxo.mintIndex ?? utxo.vout ?? 0),
      script: utxo.scriptPubKey ?? new BitcoreLib.Script(utxo.script).toHex(),
      address: utxo.address != undefined ? new BitcoreLib.Address(utxo.address).toString() : undefined
    };
  }

  getRelatedUtxos(params: {
    outputs: BitcoreLib.Transaction.Input[];
    utxos: UtxoType[];
  }): UtxoType[] {
    const { outputs, utxos } = params;
    const txids = outputs.map(output => output.toObject().prevTxId);
    return utxos.filter(utxo => txids.includes(utxo.txId));
  }

  async sign(params: {
    tx: TransactionType;
    utxos?: EveryUtxoType[];
    index: number;
    password: string;
  }) {
    const { tx, utxos, index, password } = params;
    const bitcoreTx = tx instanceof BitcoreLib.Transaction ? tx : new BitcoreLib.Transaction(tx);
    if (utxos) {
      const btcUtxos = utxos.map(utxo => this.standardizeUtxo(utxo));
      const applicableUtxos = this.getRelatedUtxos({
        outputs: bitcoreTx.inputs,
        utxos: btcUtxos
      });
      bitcoreTx.associateInputs(applicableUtxos.map(utxo => new BitcoreLib.Transaction.UnspentOutput(utxo)));
    }

    const digest = CWC.Transactions.getSighash({ chain: this.chain, tx: bitcoreTx, index: 0 });
    this.response = undefined;

    this.command = {
      name: 'sign',
      digest,
      password,
      keyNo: index
    };

    const response: any = await this.awaitResponse();

    const publicKey = new PublicKey('04161f62f9778a44bd3d07009b1f2e9df7ab1dc57e74665db7ed8baa95780452ab39f4975099f3ae36f7b6a874b46edd79d1d88573a325b9976fd8f120bed704aa');
    const signature = crypto.Signature.fromString(response.signature.der);
    signature.pubKey = publicKey;

    const verify = crypto.ECDSA.verify(Buffer.from(digest, 'hex'), signature, publicKey);
    if (!verify)
      throw new Error('Invalid signature');

    CWC.Transactions.applySignature({
      chain: this.chain,
      tx: bitcoreTx,
      signature,
      index: 0
    });

    return bitcoreTx.serialize();
  }

  async getPublicKey(params: BaseParams) {
    const { index } = params;
    this.response = undefined;
    this.command = {
      name: 'get_data_struct_v2',
      spec: [{ type: 'publicKey', index }]
    };

    return (await this.awaitResponse() as any).publicKey[index].value;
  }

  /**
   *
   * @param req
   * @returns
   */
  async getData(req: Array<{ type: DataType; index: number }>) {
    this.response = undefined;
    this.command = {
      name: 'get_data_struct_v2',
      spec: req
    };

    return this.awaitResponse();
  }

  async getAddress(params: BaseParams) {
    const { index } = params;
    this.response = undefined;
    this.command = {
      name: 'get_data_struct_v2',
      spec: [{ type: 'compressedPublicKey', index }]
    };

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

  async getVersion(params?: BaseParams) {
    const { index } = params || { index: 1 };
    const data: any = await this.getData([{ type: 'firmwareVersion', index }]);
    return data.firmwareVersion[index].value;
  }
}

/** Transaction data that can be converted into a Transaction via Transaction(tx) */
type TransactionType = BitcoreLib.Transaction | string | Buffer | object;

/**
 * Standard utxo type use for internal processing.
 * Property names are from bitcore-lib's UnspentOutput.
 * Note, UnspentOutput addresses and scripts are Address and Script classes respectively,
 * here they are both strings.
 */
export type UtxoType = {
  txId: string;
  outputIndex: number;
  satoshis: number;
  script: string;
  address?: string;
};

/** 
 * Utxo type for functions were the received utxo type is unknown.
 * Could either be in the format of UnspentOutput, UnspentOutput.toObject, or from bitcore-node.
 */
export type EveryUtxoType = Partial<UtxoType & {
  // bitcore-node specific properties
  mintTxid: string;
  mintIndex: number;
  mintHeight: number;
  value: number;
  // UnspentOutput.toObject specific properties
  txid: string;
  amount: number;
  vout: number;
  scriptPubKey: string;
  // UnspentOutput specific, allow for Script and Address objects
  script: string | BitcoreLib.Script;
  address: string | BitcoreLib.Address;
}>;
