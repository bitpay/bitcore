import { Readable } from 'stream';
import { Transaction } from 'web3-eth';
import { AbiItem } from 'web3-utils';
import { ChainStateProvider } from '../../';
import { Config } from '../../../../services/config';
import { IEVMNetworkConfig } from '../../../../types/Config';
import { StreamWalletTransactionsParams } from '../../../../types/namespaces/ChainStateProvider';
import { MultisigAbi } from '../abi/multisig';
import { MultisigRelatedFilterTransform } from '../api/multisigTransform';
import { PopulateEffectsTransform } from '../api/populateEffectsTransform';
import { PopulateReceiptTransform } from '../api/populateReceiptTransform';
import { EVMListTransactionsStream } from '../api/transform';
import { EVMBlockStorage } from '../models/block';
import { EVMTransactionStorage } from '../models/transaction';
import { EventLog } from '../types';
import { BaseEVMStateProvider } from './csp';

type MULTISIGInstantiation = EventLog<{
  [key: string]: string;
}>

type MULTISIGTxInfo = EventLog<{
  [key: string]: string;
}>

function getCSP(chain: string, network: string) {
  return ChainStateProvider.get({ chain, network }) as BaseEVMStateProvider;
}

export class GnosisApi {
  public gnosisFactories = {
    'ETH': {
      testnet: '0x2C992817e0152A65937527B774c7A99a84603045',
      mainnet: '0x6e95C8E8557AbC08b46F3c347bA06F8dC012763f'
    },
    'MATIC': {
      mainnet: '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2'
    }
  };

  private MULTISIG_TX_PROPOSAL_EXPIRE_TIME = 48 * 3600 * 1000;

  async multisigFor(chain: string, network: string, address: string) {
    const { web3 } = await getCSP(chain, network).getWeb3(network);
    const contract = new web3.eth.Contract(MultisigAbi as AbiItem[], address);
    return contract;
  }

  async getMultisigContractInstantiationInfo(
    chain: string,
    network: string,
    sender: string,
    txId: string
  ): Promise<Partial<Transaction>[]> {
    const { web3 } = await getCSP(chain, network).getWeb3(network);
    const networkConfig: IEVMNetworkConfig = Config.chainConfig({ chain: 'ETH', network });
    const { gnosisFactory = this.gnosisFactories[chain][network] } = networkConfig;
    const query = { chain, network, txid: txId };
    const found = await EVMTransactionStorage.collection.findOne(query);
    const blockHeight = found && found.blockHeight ? found.blockHeight : null;
    if (!blockHeight || blockHeight < 0) return Promise.resolve([]);
    const contract = await this.multisigFor(chain, network, gnosisFactory);
    const contractInfo = await contract.getPastEvents('ContractInstantiation', {
      fromBlock: web3.utils.toHex(blockHeight),
      toBlock: web3.utils.toHex(blockHeight)
    });
    return this.convertMultisigContractInstantiationInfo(
      contractInfo.filter(info => info.returnValues.sender.toLowerCase() === sender.toLowerCase())
    );
  }

  convertMultisigContractInstantiationInfo(contractInstantiationInfo: Array<MULTISIGInstantiation>) {
    return contractInstantiationInfo.map(this.convertContractInstantiationInfo);
  }

  convertContractInstantiationInfo(transfer: MULTISIGInstantiation) {
    const { blockHash, blockNumber, transactionHash, returnValues, transactionIndex } = transfer;
    return {
      blockHash,
      blockNumber,
      transactionHash,
      transactionIndex,
      hash: transactionHash,
      sender: returnValues['sender'],
      instantiation: returnValues['instantiation']
    } as Partial<Transaction>;
  }

  async getMultisigTxpsInfo(chain: string, network: string, multisigContractAddress: string): Promise<Partial<Transaction>[]> {
    const contract = await this.multisigFor(chain, network, multisigContractAddress);
    const time = Math.floor(Date.now()) - this.MULTISIG_TX_PROPOSAL_EXPIRE_TIME;
    const [block] = await EVMBlockStorage.collection
      .find({
        chain,
        network,
        timeNormalized: { $gte: new Date(time) }
      })
      .limit(1)
      .toArray();

    const blockHeight = block!.height;
    const [confirmationInfo, revocationInfo, executionInfo, executionFailure] = await Promise.all([
      contract.getPastEvents('Confirmation', {
        fromBlock: blockHeight,
        toBlock: 'latest'
      }),
      contract.getPastEvents('Revocation', {
        fromBlock: blockHeight,
        toBlock: 'latest'
      }),
      contract.getPastEvents('Execution', {
        fromBlock: blockHeight,
        toBlock: 'latest'
      }),
      contract.getPastEvents('ExecutionFailure', {
        fromBlock: blockHeight,
        toBlock: 'latest'
      })
    ]);

    const executionTransactionIdArray = executionInfo.map(i => i.returnValues.transactionId);
    const contractTransactionsInfo = [...confirmationInfo, ...revocationInfo, ...executionFailure];
    const multisigTxpsInfo = contractTransactionsInfo.filter(
      i => !executionTransactionIdArray.includes(i.returnValues.transactionId)
    );
    return this.convertMultisigTxpsInfo(multisigTxpsInfo);
  }

  convertMultisigTxpsInfo(multisigTxpsInfo: Array<MULTISIGTxInfo>) {
    return multisigTxpsInfo.map(this.convertTxpsInfo);
  }

  convertTxpsInfo(transfer: MULTISIGTxInfo) {
    const { blockHash, blockNumber, transactionHash, returnValues, transactionIndex, event } = transfer;
    return {
      blockHash,
      blockNumber,
      transactionHash,
      transactionIndex,
      hash: transactionHash,
      sender: returnValues['sender'],
      transactionId: returnValues['transactionId'],
      event
    } as Partial<Transaction>;
  }

  async getMultisigInfo(chain: string, network: string, multisigContractAddress: string) {
    const contract: any = await this.multisigFor(chain, network, multisigContractAddress);
    const owners = await contract.methods.getOwners().call();
    const required = await contract.methods.required().call();
    return {
      owners,
      required
    };
  }

  async streamGnosisWalletTransactions(params: { multisigContractAddress: string } & StreamWalletTransactionsParams) {
    const { chain, network, multisigContractAddress, res, args } = params;
    const transactionQuery = getCSP(chain, network).getWalletTransactionQuery(params);
    delete transactionQuery.wallets;
    delete transactionQuery['wallets.0'];
    let query;
    if (args.tokenAddress) {
      query = {
        $or: [
          {
            ...transactionQuery,
            to: args.tokenAddress,
            'abiType.params.0.value': multisigContractAddress.toLowerCase()
          },
          {
            ...transactionQuery,
            'internal.action.to': args.tokenAddress.toLowerCase(),
            'internal.action.from': multisigContractAddress.toLowerCase()
          },
          {
            ...transactionQuery,
            'effects.contractAddress': args.tokenAddress,
            'effects.from': multisigContractAddress
          }
        ]
      };
    } else {
      query = {
        $or: [
          { ...transactionQuery, to: multisigContractAddress },
          { ...transactionQuery, 'internal.action.to': multisigContractAddress.toLowerCase() },
          { ...transactionQuery, 'effects.to': multisigContractAddress }
        ]
      };
    }

    let transactionStream = new Readable({ objectMode: true });
    const ethTransactionTransform = new EVMListTransactionsStream([multisigContractAddress, args.tokenAddress]);
    const EVM = getCSP(chain, network);
    const populateReceipt = new PopulateReceiptTransform(EVM);
    const populateEffects = new PopulateEffectsTransform(EVM);

    // Store cursor reference for cleanup
    const cursor = EVMTransactionStorage.collection
      .find(query)
      .sort({ blockTimeNormalized: 1 })
      .addCursorFlag('noCursorTimeout', true);

    // Add cleanup handlers when client disconnects
    let cursorClosed = false;
    const cleanupCursor = () => {
      if (!cursorClosed) {
        cursorClosed = true;
        try {
          cursor.close();
          cursor.destroy();
        } catch {
          // Cursor might already be closed, ignore
        }
      }
    };

    const { req } = params;
    req.on('close', cleanupCursor);
    res.on('close', cleanupCursor);

    transactionStream = cursor.pipe(populateEffects); // For old db entires

    if (multisigContractAddress) {
      const multisigTransform = new MultisigRelatedFilterTransform(multisigContractAddress, args.tokenAddress);
      transactionStream = transactionStream.pipe(multisigTransform);
    }

    transactionStream
      .pipe(populateReceipt)
      .pipe(ethTransactionTransform)
      .pipe(res);
  }
}

export const Gnosis = new GnosisApi();
