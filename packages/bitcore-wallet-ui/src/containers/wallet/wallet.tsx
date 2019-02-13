import React, { Component } from 'react';
import { ParseApiStream, Wallet, Storage } from 'bitcore-client';
import { RouteComponentProps } from 'react-router';
import Snackbar from '@material-ui/core/Snackbar';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import { WalletBar } from './BalanceCard';
import { TransactionListCard } from './TransactionContainer';
import { WalletBottomNav } from './BottomNav';
import { socket } from '../../contexts/io';
import { ActionCreators, store } from '../../index';
import { connect } from 'react-redux';

interface Props extends RouteComponentProps<{ name: string }> {
  walletName: string;
  wallet?: Wallet;
  password: string;
  balance: { confirmed: number; unconfirmed: number; balance: string };
  transactions: any[];
  addresses: string[];
  addressToAdd: string;
  message: string;
}

export interface State {
  open: boolean;
}

class WalletContainer extends Component<Props, State> {
  state = { open: false };

  constructor(props: Props) {
    super(props);
    this.updateWalletInfo = this.updateWalletInfo.bind(this);
    this.updateBalance = this.updateBalance.bind(this);
  }

  async componentDidMount() {
    const name = this.props.match.params.name;
    store.dispatch(ActionCreators.setWalletName(name));
    const wallet = await this.loadWallet(name);
    await wallet!.register({ baseUrl: 'http://localhost:3000/api' });
    if (!this.props.wallet!.unlocked) {
      await store.dispatch(ActionCreators.setWallet(wallet!));
    }
    if (this.props.wallet) {
      console.log('Using bitcore-node at ', this.props.wallet.baseUrl);
      await this.handleGetTx(this.props.wallet);
      await this.handleGetBlock(this.props.wallet);
      await this.updateWalletInfo(this.props.wallet);
      await this.fetchAddresses(this.props.wallet);
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
      store.dispatch(ActionCreators.setMessage(message));
      this.setState({
        open: true
      });
      this.updateWalletInfo(wallet);
    });
  }

  handleGetBlock(wallet: Wallet) {
    socket.on('block', (block: any) => {
      let message = `New Block on ${new Date(block.time).toDateString()}`;
      store.dispatch(ActionCreators.setMessage(message));
      this.setState({
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
        let prevTx = this.props.transactions.map(e => e);
        const foundIndex = prevTx.findIndex(t => t.id === d.id);
        if (foundIndex > -1) {
          prevTx[foundIndex] = d;
        } else {
          // Recent 10 Transactions limit
          prevTx = [...prevTx.slice(0, 9), d];
        }
        store.dispatch(ActionCreators.setTransactions(prevTx));
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
        store.dispatch(
          ActionCreators.setAddress([
            ...this.props.addresses,
            ...addresses.map(a => a.address)
          ])
        );
      });
  }

  async updateBalance(wallet: Wallet) {
    const balance = await wallet.getBalance();
    await store.dispatch(ActionCreators.setBalance(balance));
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
    const { wallet } = this.props;
    const unlockedWallet = wallet && wallet.unlocked!;
    return (
      <div>
        <WalletBar />
        <TransactionListCard />
        <WalletBottomNav />
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
          message={<span id="message-id">{this.props.message}</span>}
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
    );
  }
}

const mapStateToProps = (state: Props) => {
  return {
    walletName: state.walletName,
    wallet: state.wallet,
    password: state.password,
    balance: state.balance,
    transactions: state.transactions,
    addresses: state.addresses,
    addressToAdd: state.addressToAdd,
    message: state.message
  };
};

export const SingleWalletPage = connect(mapStateToProps)(WalletContainer);
