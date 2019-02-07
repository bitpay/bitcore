import { RouteComponentProps } from 'react-router';
import { WalletBottomNav } from '../wallet/BottomNav';
import DialogSelect from '../wallet/UnlockBar';
import React from 'react';
import { useState } from 'react';
import { Wallet } from 'bitcore-client';
import { WalletContainer } from './Wallet';
import { WalletBar } from './BalanceCard';
import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import FormControl from '@material-ui/core/FormControl';

import io from 'socket.io-client';
import { withStyles } from '@material-ui/core/styles';

const API_URL =
  process.env.CREATE_REACT_APP_API_URL || 'http://localhost:3000/api';

const socket = io.connect('http://localhost:3000', {
  transports: ['websocket']
});

interface Props extends RouteComponentProps<{ name: string }> {
  classes: any;
}

interface State {
  walletName: string;
  wallet?: Wallet;
  password: string;
  balance: { confirmed: number; unconfirmed: number; balance: number };
  transactions: any[];
  addresses: string[];
  addressToAdd: string;
  message: string;
  sendTo: string;
  amountToSend: string;
  open: boolean;
}

const styles = (theme: any) => ({
  root: {
    marginTop: '15em',
    background: 'rgba(0,0,0,.07)',
    padding: 0
  },
  root2: {
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: '#1A3A8B',
    color: 'white',
    marginTop: '.8em',
    marginBottom: '5em'
  },
  button: {
    height: 50
  },
  padding: {
    padding: 20,
    margin: 'auto',
    maxWidth: 600,
    marginBottom: 80
  },
  flex: { flex: 100 },
  listRoot: {
    flexGrow: 1,
    maxWidth: 600
  },
  demo: {
    backgroundColor: theme.palette.background.paper
  }
});
export class SendCard extends React.Component<Props, State> {
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
    open: false,
    sendTo: '',
    amountToSend: ''
  };

  constructor(props: Props) {
    super(props);
    this.updateWalletInfo = this.updateWalletInfo.bind(this);
    this.updateBalance = this.updateBalance.bind(this);
    this.handlePasswordSubmit = this.handlePasswordSubmit.bind(this);
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
      await this.updateWalletInfo(wallet);
    }
  }
  async updateWalletInfo(wallet: Wallet) {
    await this.updateBalance(wallet);
  }

  async updateBalance(wallet: Wallet) {
    const balance = await wallet.getBalance();
    this.setState({ balance });
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

  async handlePasswordSubmit(password: string) {
    await this.setState({ password });
    await this.handleLockToggle();
  }

  public render() {
    const wallet = this.state.wallet;
    const walletUnlocked = wallet && wallet.unlocked;
    const { classes } = this.props;
    if (!wallet) {
      return <div className="walletContainer">No Wallet Found</div>;
    }
    return (
      <div className="walletContainer">
        <WalletBar wallet={wallet} balance={this.state.balance.balance} />
        <div className={classes.padding}>
          <div className={classes.root}>
            <div className={classes.flex}>
              <Paper className={classes.padding}>
                <div>
                  <FormControl fullWidth className={classes.margin}>
                    <TextField
                      className={classes.flex}
                      id="address"
                      label="Address"
                      value={this.state.sendTo}
                      onChange={e => this.setState({ sendTo: e.target.value })}
                      margin="normal"
                    />
                    <TextField
                      className={classes.flex}
                      id="value"
                      label="Amount"
                      value={this.state.amountToSend}
                      onChange={e =>
                        this.setState({ amountToSend: e.target.value })
                      }
                      margin="normal"
                    />

                    <Button
                      variant="contained"
                      color="primary"
                      className={classes.button}
                    >
                      Send
                    </Button>
                  </FormControl>
                </div>
                <div />
              </Paper>
            </div>
          </div>
        </div>

        {walletUnlocked ? (
          <WalletBottomNav walletName={this.state.walletName} />
        ) : (
          <DialogSelect onUnlock={this.handlePasswordSubmit} />
        )}
      </div>
    );
  }
}
export const SendContainer = withStyles(styles)(SendCard);
