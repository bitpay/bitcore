import React, { Component } from 'react';
import { Wallet, Storage } from 'bitcore-client';
import { RouteComponentProps } from 'react-router';
import {
  Icon,
  Segment,
  Button,
  Label,
  Accordion,
  Grid,
  Card,
  List,
  Input,
  Select,
  Divider
} from 'semantic-ui-react';

import './wallet.css';

const API_URL =
  process.env.CREATE_REACT_APP_API_URL || 'http://localhost:3000/api';

interface Props extends RouteComponentProps<{ name: string }> {}
interface State {
  walletName: string;
  wallet?: Wallet;
  password: string;
  balance: { confirmed: number; unconfirmed: number; balance: number };
  transactions: any[];
  addresses: string[];
  addressToAdd: string;
}

export class WalletContainer extends Component<Props, State> {
  state: State = {
    password: 'iamsatoshi',
    walletName: '',
    balance: {
      confirmed: 0,
      unconfirmed: 0,
      balance: 0
    },
    transactions: [],
    addresses: [],
    addressToAdd: ''
  };

  constructor(props: Props) {
    super(props);
    this.handleAddressChange = this.handleAddressChange.bind(this);
    this.handleAddAddressClick = this.handleAddAddressClick.bind(this);
  }

  async componentDidMount() {
    const name = this.props.match.params.name;
    this.setState({ walletName: name });
    const wallet = await this.loadWallet(name);
    this.setState({ wallet });
    if (wallet) {
      await this.fetchTransactions(wallet);
      await this.fetchAddresses(wallet);
      await this.updateBalance(wallet);
    }
  }

  async fetchTransactions(wallet: Wallet) {
    wallet.listTransactions({}).on('data', d => {
      const jsonTxs = d
        .toString()
        .trim()
        .split('\n');
      for (const jsonTx of jsonTxs) {
        if (jsonTx.startsWith('{') && jsonTx.endsWith('}')) {
          const parsed = JSON.parse(jsonTx);
          this.setState({ transactions: [...this.state.transactions, parsed] });
        }
      }
    });
  }

  async fetchAddresses(wallet: Wallet) {
    wallet.getAddresses().on('data', (d: Buffer) => {
      const jsonTxs = d
        .toString()
        .trim()
        .split(',\n');
      console.log(jsonTxs);
      for (const jsonTx of jsonTxs) {
        if (jsonTx.startsWith('{') && jsonTx.endsWith('}')) {
          console.log(jsonTx);
          const parsed = JSON.parse(jsonTx);
          this.setState({ addresses: [...this.state.addresses, parsed] });
        }
      }
    });
  }

  async updateBalance(wallet: Wallet) {
    const balance = await wallet.getBalance();
    this.setState({ balance });
  }

  async importAddresses(address: string) {
    const unlockedWallet = await this.state.wallet!.unlock(this.state.password);
    await unlockedWallet.importKeys({
      keys: [{ address: this.state.addressToAdd }]
    });
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

  handleAddressChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ addressToAdd: event.target.value });
  }
  async handleAddAddressClick() {
    this.setState({
      addresses: [...this.state.addresses, this.state.addressToAdd]
    });
    await this.importAddresses(this.state.addressToAdd);
  }
  render() {
    return (
      <div className="walletContainer">
        <Card>
          <Card.Content>
            <h1> {this.state.walletName} </h1>
            <Label>
              Balance:
              <Label.Detail>{this.state.balance.balance}</Label.Detail>
            </Label>
            {this.state.balance.unconfirmed ? (
              <Label>
                Unconfirmed:
                <Label.Detail>{this.state.balance.unconfirmed}</Label.Detail>
              </Label>
            ) : null}
          </Card.Content>
          <Card.Content>
            <h1> Transactions </h1>
            <div>
              {this.state.transactions.length ? (
                this.state.transactions.map(t => (
                  <div key={t.id}>
                    {t.id} {t.satoshis} Satoshis
                  </div>
                ))
              ) : (
                <i>No Transactions</i>
              )}
            </div>
          </Card.Content>
          <Card.Content>
            <h1> Addresses </h1>
            <div>
              {this.state.addresses.length ? (
                this.state.addresses
              ) : (
                <i>No Addresses</i>
              )}
            </div>
            <div>
              <Input
                type="text"
                placeholder="Address"
                action
                fluid
                onChange={this.handleAddressChange}
              >
                <input />
                <Button onClick={this.handleAddAddressClick}>
                  Add to Wallet
                </Button>
              </Input>
            </div>
          </Card.Content>
        </Card>
      </div>
    );
  }
}
