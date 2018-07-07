import Config from '../../../config';
import { WalletAddressModel } from '../../../models/walletAddress';
import { CSP } from '../../../types/namespaces/ChainStateProvider';
import { InternalStateProvider } from '../internal/internal';
import { ObjectID } from 'mongodb';

const Web3 = require('web3-eth');

export class ETHStateProvider extends InternalStateProvider
  implements CSP.IChainStateService {
  config: any;

  constructor(public chain: string = 'ETH') {
    super(chain);
    this.config = Config.chains[this.chain];
  }

  getRPC(network: string) {
    const networkConfig = this.config[network];
    const provider = networkConfig.provider;
    const portString = provider.port ? `:${provider.port}` : '';
    const connUrl = `${provider.protocool}://${provider.host}${portString}`;
    let ProviderType;
    switch (provider.protocool) {
      case 'wss':
        ProviderType = Web3.providers.WebsocketProvider;
        break;
      default:
        ProviderType = Web3.providers.HttpProvider;
        break;
    }
    return new Web3(new ProviderType(connUrl));
  }

  async getBalanceForAddress(
    params: CSP.GetBalanceForAddressParams
  ): Promise<{ balance: number }[]> {
    const { network, address } = params;
    const balance = Number(await this.getRPC(network).getBalance(address));
    return [{ balance }];
  }

  async getBlock(params: CSP.GetBlockParams) {
    const { network, blockId } = params;
    return this.getRPC(network).getBlock(blockId);
  }

  async streamTransaction(params: CSP.StreamTransactionParams) {
    const { network, txId, stream } = params;
    const transaction = await this.getRPC(network).getTransaction(txId);
    const transactions = transaction !== null ? [transaction] : [];
    stream.send(JSON.stringify(transactions));
  }

  async getWalletAddresses(walletId: ObjectID) {
    let query = { wallet: walletId };
    return WalletAddressModel.collection.find(query).toArray();
  }

  async getWalletBalance(params: CSP.GetWalletBalanceParams) {
    const { network } = params;
    if (params.wallet._id === undefined) {
      throw new Error(
        'Wallet balance can only be retrieved for wallets with the _id property'
      );
    }
    let addresses = await this.getWalletAddresses(params.wallet._id);
    let addressBalancePromises = addresses.map(({ address }) =>
      this.getBalanceForAddress({ chain: this.chain, network, address })
    );
    let addressBalances = await Promise.all<{ balance: number }[]>(
      addressBalancePromises
    );
    let balance = addressBalances.reduce(
      (prev, cur) => Number(prev) + Number(cur[0].balance),
      0
    );
    return [{ balance }];
  }
}
