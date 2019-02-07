import React, { Component } from 'react';
import { ParseApiStream, Wallet, Storage } from 'bitcore-client';
import { RouteComponentProps } from 'react-router';
import { Link } from 'react-router-dom';
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
  Divider,
  Header
} from 'semantic-ui-react';

import io from 'socket.io-client';
import { any } from 'prop-types';
import Snackbar from '@material-ui/core/Snackbar';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import PropTypes from 'prop-types';
import { WalletBar } from './AppBar';
import { TransactionListCard } from './WalletContainer';
import { WalletBottomNav } from './BottomNav';
import DialogSelect from './UnlockBar';

const API_URL =
  process.env.CREATE_REACT_APP_API_URL || 'http://localhost:3000/api';

const socket = io.connect(
  'http://localhost:3000',
  {
    transports: ['websocket']
  }
);

interface Props extends RouteComponentProps<{ name: string }> {}
interface State {
  walletName: string;
  wallet?: Wallet;
  password: string;
  balance: { confirmed: number; unconfirmed: number; balance: number };
  transactions: any[];
  addresses: string[];
  addressToAdd: string;
  message: string;
  open: boolean;
}

export class WalletContainer extends Component<Props, State> {
  state: State = {
    password: '',
    walletName: '',
    balance: {
      confirmed: 0,
      unconfirmed: 0,
      balance: 0
    },
    transactions: [],
    addresses: [],
    addressToAdd: '',
    message: '',
    open: false
  };

  constructor(props: Props) {
    super(props);
    this.handleAddressChange = this.handleAddressChange.bind(this);
    this.handleAddAddressClick = this.handleAddAddressClick.bind(this);
    this.handleDeriveAddressClick = this.handleDeriveAddressClick.bind(this);
    this.handlePasswordChange = this.handlePasswordChange.bind(this);
    this.handleLockToggle = this.handleLockToggle.bind(this);
    this.updateWalletInfo = this.updateWalletInfo.bind(this);
    this.updateBalance = this.updateBalance.bind(this);
  }

  async componentDidMount() {
    socket.on('connect', () => {
      console.log('Connected to socket');
      socket.emit('room', '/BTC/regtest/inv');
    });
    const name = this.props.match.params.name;
    this.setState({ walletName: name });
    const wallet = await this.loadWallet(name);
    await wallet!.register({ baseUrl: 'http://localhost:3000/api' });
    this.setState({ wallet });
    if (wallet) {
      console.log('Using bitcore-node at ', wallet.baseUrl);
      await this.handleGetTx(wallet);
      await this.handleGetBlock(wallet);
      await this.updateWalletInfo(wallet);
      await this.fetchAddresses(wallet);
    }
  }
  async updateWalletInfo(wallet: Wallet) {
    await this.fetchTransactions(wallet);
    await this.updateBalance(wallet);
  }

  handleGetTx(wallet: Wallet) {
    socket.on('tx', async (sanitizedTx: any) => {
      let message = `Recieved ${sanitizedTx.value /
        100000000} BTC at ${new Date(
        sanitizedTx.blockTimeNormalized
      ).toLocaleString()}`;
      this.setState({
        message,
        open: true
      });
      this.updateWalletInfo(wallet);
    });
  }

  handleGetBlock(wallet: Wallet) {
    socket.on('block', (block: any) => {
      let message = `Recieved Block Reward ${block.reward /
        100000000} BTC on ${new Date(block.time).toDateString()}`;
      this.setState({
        message,
        open: true
      });
      this.updateWalletInfo(wallet);
    });
  }

  async fetchTransactions(wallet: Wallet) {
    wallet
      .listTransactions({})
      .pipe(new ParseApiStream())
      .on('data', (d: any) => {
        let prevTx = this.state.transactions;
        const foundIndex = prevTx.findIndex(t => t.id === d.id);
        if (foundIndex > -1) {
          prevTx[foundIndex] = d;
        } else {
          prevTx.push(d);
          // prevTx = [d, ...prevTx.slice(0, 4)];
        }
        this.setState({ transactions: prevTx });
      });
  }

  handleClose = (reason: any) => {
    if (reason === 'clickaway') {
      return;
    }
    this.setState({ open: false });
  };

  async fetchAddresses(wallet: Wallet) {
    wallet
      .getAddresses()
      .pipe(new ParseApiStream())
      .on('data', (d: any) => {
        let addresses = [];
        if (Array.isArray(d)) {
          addresses = d;
        } else {
          addresses = [d];
        }
        this.setState({
          addresses: [...this.state.addresses, ...addresses.map(a => a.address)]
        });
      });
  }

  async updateBalance(wallet: Wallet) {
    const balance = await wallet.getBalance();
    this.setState({ balance });
  }

  async importAddresses(address: string) {
    let wallet = this.state.wallet;
    if (wallet) {
      if (wallet && wallet.unlocked) {
        await wallet.importKeys({
          keys: [{ address: this.state.addressToAdd }]
        });
      }
    }
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

  handlePasswordChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ password: event.target.value });
  }

  async handleLockToggle() {
    if (this.state.wallet) {
      console.log(this.state.wallet.unlocked);
      if (this.state.wallet.unlocked) {
        const locked = await this.state.wallet.lock();
        await this.setState({ wallet: locked });
      } else {
        console.log('unlocking wallet');
        const unlocked = await this.state.wallet.unlock(this.state.password);
        await this.setState({ wallet: unlocked });
      }
    }
  }

  async handleAddAddressClick() {
    this.setState({
      addresses: [...this.state.addresses, this.state.addressToAdd]
    });
    await this.importAddresses(this.state.addressToAdd);
    await this.updateWalletInfo(this.state.wallet!);
  }

  async handleDeriveAddressClick() {
    const address = await this.state.wallet!.deriveAddress(0);
    this.setState({ addressToAdd: address });
  }

  render() {
    const wallet = this.state.wallet;
    const walletUnlocked = wallet && wallet.unlocked;
    return (
      <div className="walletContainer">
        {wallet ? (
          <WalletBar wallet={wallet} balance={this.state.balance.balance} />
        ) : null}
        {wallet ? (
          <TransactionListCard
            transactions={this.state.transactions}
            wallet={wallet}
            API_URL={API_URL}
          />
        ) : null}
        {walletUnlocked ? <WalletBottomNav /> : <DialogSelect />}
        <Snackbar
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left'
          }}
          open={this.state.open}
          autoHideDuration={6000}
          onClose={this.handleClose}
          ContentProps={{
            'aria-describedby': 'message-id'
          }}
          message={<span id="message-id">{this.state.message}</span>}
          action={[
            <IconButton
              key="close"
              aria-label="Close"
              color="inherit"
              onClick={this.handleClose}
            >
              <CloseIcon />
            </IconButton>
          ]}
        />
      </div>
      /*
        <Card fluid>
          <Card.Content>
            <Link to={'/'}>
              <Icon name="angle left" size="large" />
            </Link>
            <Header as="h1" textAlign="center">
              {this.state.walletName}
              <Header.Subheader>
                {this.state.wallet
                  ? `${this.state.wallet.chain} ${this.state.wallet.network}`
                  : ''}
              </Header.Subheader>
            </Header>
            {this.state.balance.unconfirmed ? (
              <div>
                <Header as="h2" floated="left">
                  <Label>
                    Balance:
                    <Label.Detail>{this.state.balance.balance}</Label.Detail>
                  </Label>
                </Header>
                <Header as="h2" floated="right">
                  <Label>
                    Unconfirmed:
                    <Label.Detail>
                      {this.state.balance.unconfirmed}
                    </Label.Detail>
                  </Label>
                </Header>
              </div>
            ) : (
              <Header as="h2" textAlign="center">
                <Label>
                  Balance:
                  <Label.Detail>
                    {this.state.balance.balance / 1e8}
                  </Label.Detail>
                </Label>
              </Header>
            )}
          </Card.Content>
          <Card.Content>
            <h1> Transactions </h1>
            <div>
              {this.state.transactions.length ? (
                this.state.transactions.map(t => (
                  <div key={t.txid}>
                    <a
                      href={`${API_URL}/${this.state.wallet!.chain}/${
                        this.state.wallet!.network
                      }/tx/${t.txid}`}
                    >
                      {t.height > 0 ? `Block: ${t.height}` : 'Mempool:'}{' '}
                      {t.value / 1e8 || t.satoshis / 1e8} BTC
                    </a>
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
                this.state.addresses.map(a => <div key={a}>{a}</div>)
              ) : (
                <i>No Addresses</i>
              )}
            </div>
            <div>
              <Input
                type="text"
                placeholder="Address"
                value={this.state.addressToAdd}
                action
                fluid
                onChange={this.handleAddressChange}
              >
                <input data-lpignore="true" />
                <Button
                  disabled={!walletUnlocked}
                  primary
                  onClick={this.handleAddAddressClick}
                >
                  Add
                </Button>
                <Button onClick={this.handleDeriveAddressClick}>Derive</Button>
              </Input>
            </div>
          </Card.Content>
          <Card.Content>
            <h1> Send </h1>
            <div>
              <Input
                type="text"
                placeholder="Address"
                value={this.state.addressToAdd}
                action
                fluid
                onChange={this.handleAddressChange}
              >
                <input />
              </Input>
              <Input
                type="text"
                fluid
                action
                labelPosition="left"
                placeholder="Amount"
              >
                <Label>{wallet ? wallet.chain : null}</Label>
                <input />
                <Button primary>Send</Button>
              </Input>
            </div>
          </Card.Content>
          <Card.Content>
            <h1>Security</h1>
            <Input
              type="password"
              placeholder="Wallet Password"
              value={this.state.password}
              action
              fluid
              onChange={this.handlePasswordChange}
            >
              <input />
              <Button onClick={this.handleLockToggle}>
                <Icon name={walletUnlocked ? 'unlock' : 'lock'} />
              </Button>
            </Input>
          </Card.Content>
        </Card>
      </div> */
    );
  }
}
