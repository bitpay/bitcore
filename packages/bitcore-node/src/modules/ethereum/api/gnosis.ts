import { Readable } from 'stream';
import { AbiItem } from 'web3-utils';
import { Transaction } from 'web3/eth/types';
import { Config } from '../../../services/config';
import { StreamWalletTransactionsParams } from '../../../types/namespaces/ChainStateProvider';
import { MultisigAbi } from '../abi/multisig';
import { EthBlockStorage } from '../models/block';
import { EthTransactionStorage } from '../models/transaction';
import { ETH, EventLog } from './csp';
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

  private ETH_MULTISIG_TX_PROPOSAL_EXPIRE_TIME = 48 * 3600 * 1000;

  async multisigFor(network: string, address: string) {
    const { web3 } = await ETH.getWeb3(network);
    const contract = new web3.eth.Contract(MultisigAbi as AbiItem[], address);
    return contract;
  }

  async getMultisigContractInstantiationInfo(
    network: string,
    sender: string,
    txId: string
  ): Promise<Partial<Transaction>[]> {
    const networkConfig = Config.chainConfig({ chain: 'ETH', network });
    const { gnosisFactory = this.gnosisFactories[network] } = networkConfig;
    let query = { chain: 'ETH', network, txid: txId };
    let found = await EthTransactionStorage.collection.findOne(query);
    const blockHeight = found && found.blockHeight ? found.blockHeight : null;
    const contract = await this.multisigFor(network, gnosisFactory);
    const contractInfo = await contract.getPastEvents('ContractInstantiation', {
      fromBlock: blockHeight || 0,
      toBlock: blockHeight || 'latest'
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
    const time = Math.floor(Date.now()) - this.ETH_MULTISIG_TX_PROPOSAL_EXPIRE_TIME;
    const [block] = await EthBlockStorage.collection
      .find({
        chain: 'ETH',
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

  async getMultisigEthInfo(network: string, multisigContractAddress: string) {
    const contract: any = await this.multisigFor(network, multisigContractAddress);
    const owners = await contract.methods.getOwners().call();
    const required = await contract.methods.required().call();
    return {
      owners,
      required
    };
  }

  async streamGnosisWalletTransactions(params: { multisigContractAddress: string } & StreamWalletTransactionsParams) {
    const { multisigContractAddress, network, res, args } = params;
    const { web3 } = await ETH.getWeb3(network);
    const transactionQuery = ETH.getWalletTransactionQuery(params);
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
          }
        ]
      };
    } else {
      query = {
        $or: [
          { ...transactionQuery, to: multisigContractAddress },
          { ...transactionQuery, 'internal.action.to': multisigContractAddress.toLowerCase() }
        ]
      };
    }

    let transactionStream = new Readable({ objectMode: true });
    const ethTransactionTransform = new EthListTransactionsStream([multisigContractAddress, args.tokenAddress]);
    const populateReceipt = new PopulateReceiptTransform();

    transactionStream = EthTransactionStorage.collection
      .find(query)
      .sort({ blockTimeNormalized: 1 })
      .addCursorFlag('noCursorTimeout', true);

    if (multisigContractAddress) {
      const ethMultisigTransform = new EthMultisigRelatedFilterTransform(
        web3,
        multisigContractAddress,
        args.tokenAddress
      );
      transactionStream = transactionStream.pipe(ethMultisigTransform);
    }

    transactionStream
      .pipe(populateReceipt)
      .pipe(ethTransactionTransform)
      .pipe(res);
  }
}

export const Gnosis = new GnosisApi();
