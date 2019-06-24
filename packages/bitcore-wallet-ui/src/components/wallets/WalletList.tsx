import React, { Component } from 'react';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import { Wallet } from 'bitcore-client';
import { Link } from 'react-router-dom';
import { Icon } from 'semantic-ui-react';
import { ActionCreators, store } from '../../index';
import { AppState } from '../../types/state';

interface Props {
  wallet: Wallet;
}

const icons: { [chain: string]: string } = {
  BTC: 'bitcoin',
  ETH: 'ethereum'
};

export class WalletList extends Component<Props> {
  handleSetWallet = async (wallet: AppState['wallet']) => {
    const name = wallet!.name;
    store.dispatch(ActionCreators.setWalletName(name));
    wallet = await this.loadWallet(name);
    await wallet!.register({ baseUrl: 'http://localhost:3000/api' });
    store.dispatch(ActionCreators.setWallet(wallet));
    store.dispatch(ActionCreators.setUnlocked(false));
  };

  loadWallet = async (name: string) => {
    let wallet: Wallet | undefined;
    try {
      const exists = Wallet.exists({ name });
      if (!exists) {
      } else {
        wallet = await Wallet.loadWallet({ name });
      }
    } catch (err) {
      console.log(err);
    }
    return wallet;
  };

  render() {
    const { wallet } = this.props;
    return (
      <Link to={`/wallet/${wallet.name}`}>
        <ListItem onClick={() => this.handleSetWallet(wallet)}>
          <ListItemIcon>
            <Icon name={icons[wallet.chain] as any} />
          </ListItemIcon>
          <ListItemText
            primary={wallet.name}
            secondary={`${wallet.chain} ${wallet.network}`}
          />
        </ListItem>
      </Link>
    );
  }
}
