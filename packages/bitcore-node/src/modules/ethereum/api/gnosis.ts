import { Readable } from 'stream';
import { AbiItem } from 'web3-utils';
import { Transaction } from 'web3/eth/types';
import { Config } from '../../../services/config';
import { StreamWalletTransactionsParams } from '../../../types/namespaces/ChainStateProvider';
import { MultisigAbi } from '../abi/multisig';
import { EthTransactionStorage } from '../models/transaction';
import { ETH, EventLog } from './csp';
import { Erc20RelatedFilterTransform } from './erc20Transform';
import { EthMultisigRelatedFilterTransform } from './ethMultisigTransform';
import { PopulateReceiptTransform } from './populateReceiptTransform';
import { EthListTransactionsStream } from './transform';

interface MULTISIGInstantiation
  extends EventLog<{
    [key: string]: string;
  }> {}

interface MULTISIGTxInfo
  extends EventLog<{
    [key: string]: string;
  }> {}

export class GnosisApi {
  public gnosisFactories = {
    testnet: '0x2C992817e0152A65937527B774c7A99a84603045',
    mainnet: '0x6e95C8E8557AbC08b46F3c347bA06F8dC012763f'
  };

  async multisigFor(network: string, address: string) {
    const { web3 } = await ETH.getWeb3(network);
    const contract = new web3.eth.Contract(MultisigAbi as AbiItem[], address);
    return contract;
  }

  async getMultisigContractInstantiationInfo(network: string, sender: string): Promise<Partial<Transaction>[]> {
    const networkConfig = Config.chainConfig({ chain: 'ETH', network });
    const { gnosisFactory = this.gnosisFactories[network] } = networkConfig;
    const contract = await this.multisigFor(network, gnosisFactory);
    const contractInfo = await contract.getPastEvents('ContractInstantiation', {
      fromBlock: 0,
      toBlock: 'latest'
    });
    return this.convertMultisigContractInstantiationInfo(
      contractInfo.filter(info => info.returnValues.sender === sender)
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

  async getMultisigTxpsInfo(network: string, multisigContractAddress: string): Promise<Partial<Transaction>[]> {
    const contract = await this.multisigFor(network, multisigContractAddress);
    const [confirmationInfo, revocationInfo, executionInfo, executionFailure] = await Promise.all([
      contract.getPastEvents('Confirmation', {
        fromBlock: 0,
        toBlock: 'latest'
      }),
      contract.getPastEvents('Revocation', {
        fromBlock: 0,
        toBlock: 'latest'
      }),
      contract.getPastEvents('Execution', {
        fromBlock: 0,
        toBlock: 'latest'
      }),
      contract.getPastEvents('ExecutionFailure', {
        fromBlock: 0,
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

  async getMultisigEthInfo(network: string, multisigContractAddress: string) {
    const contract: any = await this.multisigFor(network, multisigContractAddress);
    const owners = await contract.methods.getOwners().call();
    const required = await contract.methods.required().call();
    return {
      owners,
      required
    };
  }

  async streamGnosisWalletTransactions(params: StreamWalletTransactionsParams) {
    const { network, res, args } = params;
    const { web3 } = await ETH.getWeb3(network);
    const query = {
      ...ETH.getWalletTransactionQuery(params),
      $or: [{ to: args.multisigContractAddress }, { 'internal.action.to': args.multisigContractAddress.toLowerCase() }]
    };
    delete query.wallets;
    delete query['wallets.0'];

    let transactionStream = new Readable({ objectMode: true });
    const ethTransactionTransform = new EthListTransactionsStream([args.multisigContractAddress]);
    const populateReceipt = new PopulateReceiptTransform();

    transactionStream = EthTransactionStorage.collection
      .find(query)
      .sort({ blockTimeNormalized: 1 })
      .addCursorFlag('noCursorTimeout', true);

    if (args.tokenAddress) {
      const erc20Transform = new Erc20RelatedFilterTransform(web3, args.tokenAddress);
      transactionStream = transactionStream.pipe(erc20Transform);
    }

    if (args.multisigContractAddress) {
      const ethMultisigTransform = new EthMultisigRelatedFilterTransform(web3, args.multisigContractAddress);
      transactionStream = transactionStream.pipe(ethMultisigTransform);
    }

    transactionStream
      .pipe(populateReceipt)
      .pipe(ethTransactionTransform)
      .pipe(res);
  }
}

export const Gnosis = new GnosisApi();
