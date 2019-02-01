import React, { Component } from 'react';
import { Wallet, Storage } from 'bitcore-client';
import { RouteComponentProps } from 'react-router';

interface Props extends RouteComponentProps<{ name: string }> {}
interface State {
  walletName: string;
}

const API_URL =
  process.env.CREATE_REACT_APP_API_URL || 'http://localhost:3000/api';

export class WalletContainer extends Component<Props, State> {
  async componentDidMount() {
    const name = this.props.match.params.name;
    this.setState({ walletName: name });
    const wallet = await this.loadWallet(name);
    wallet!.listTransactions({}).on('data', (d) => {
      console.log(d.toString());
    });
    console.log(wallet);
  }

  async loadWallet(name: string) {
    let wallet: Wallet | undefined;
    try {
      const exists = Wallet.exists({ name });
      if (!exists) {
        console.log('Wallet needs to be created');
      } else {
        console.log('Wallet exists');
        wallet = await Wallet.loadWallet({ name });
      }
    } catch (err) {
      console.log(err);
    }
    return wallet;
  }

  render() {
    return <div />;
  }
}
