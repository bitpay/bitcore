import React, { Component } from 'react';
import { withStyles, createStyles } from '@material-ui/core/styles';
import { RouteComponentProps } from 'react-router';
import Typography from '@material-ui/core/Typography';
import { Paper } from '@material-ui/core';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import InputAdornment from '@material-ui/core/InputAdornment';
import FormControl from '@material-ui/core/FormControl';
import Button from '@material-ui/core/Button';
import { AppState } from '../../types/state';
import { connect } from 'react-redux';
import { QRBox } from '../../components/qrbox/QRBox';
import { WalletBottomNav } from '../../components/footer/BottomNav';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import OutlinedInput from '@material-ui/core/OutlinedInput';
import { WalletHeader } from '../../components/header/WalletHeader';
import { ParseApiStream, Wallet } from 'bitcore-client';
import { ActionCreators, store } from '../../index';

const styles = createStyles({
  root: {
    flexGrow: 1,
    position: 'absolute' as 'absolute',
    top: 0,
    width: '100%'
  },
  background: {
    backgroundColor: '#1A3A8B',
    position: 'fixed',
    top: 0,
    boxShadow: 'none',
    paddingTop: 20,
    zIndex: 99
  },
  toolbar: {
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%'
  },
  paper: {
    backgroundColor: 'white',
    height: 360,
    textAlign: 'center',
    padding: 30,
    marginTop: 70,
    width: '100%',
    zIndex: -99
  },
  heading: {
    color: '#002855',
    textAlign: 'left'
  },
  chain: {
    color: 'rgba(255, 255, 255, .64)',
    fontSize: 20
  },
  link: {
    color: 'white',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'none'
    }
  },
  input: {
    marignLeft: 8,
    flex: 1
  },
  iconButton: {
    color: '#002855'
  },
  divider: {
    width: 1,
    height: 28,
    margin: 4
  },
  button: {
    maxWidth: 200,
    width: '100%',
    marginTop: 20
  },
  amountInput: {
    width: '100%',
    maxWidth: 600,
    margin: 'auto',
    marginTop: 20,
    boxShadow: 'none'
  },
  inputWidth: {
    width: '100%',
    textAlign: 'left'
  }
});

interface Props extends RouteComponentProps<{ name: string }> {
  classes: any;
  wallet: AppState['wallet'];
  addresses: AppState['addresses'];
  unlocked: boolean;
}

interface State {
  sendTo: string;
  amountToSend: string;
  sentTxid: string;
  sendFrom: string;
}

class SendContainer extends Component<Props, State> {
  state: State = {
    sendTo: '',
    amountToSend: '',
    sentTxid: '',
    sendFrom: ''
  };

  componentDidMount = async () => {
    const name = this.props.match.params.name;
    store.dispatch(ActionCreators.setWalletName(name));
    const wallet = await this.loadWallet(name);
    await wallet!.register({ baseUrl: 'http://localhost:3000/api' });
    if (!this.props.wallet) {
      store.dispatch(ActionCreators.setWallet(wallet));
    }
    if (this.props.wallet) {
      await this.fetchAddresses(this.props.wallet);
    }
  };

  fetchAddresses = async (wallet: Wallet) => {
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
        addresses.map(a =>
          store.dispatch(ActionCreators.setAddress(a.address))
        );
      });
  };

  loadWallet = async (name: string) => {
    let wallet: AppState['wallet'] | undefined;
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

  handleSendClick = async () => {
    const { wallet } = this.props;
    const chain = wallet!.chain;
    const from = this.state.sendFrom;

    let recipientObj: any = {};

    switch (chain) {
      case 'BTC':
        recipientObj = {
          recipients: [
            {
              address: this.state.sendTo,
              amount: Number(this.state.amountToSend.trim()) * 1e8
            }
          ]
        };
        break;
      case 'ETH':
        recipientObj = {
          recipients: [
            {
              address: this.state.sendTo,
              amount: Number(this.state.amountToSend.trim()) * 1e18
            }
          ],
          from
        };
        break;
      default:
        return;
    }

    let tx = await wallet!.newTx(recipientObj);
    const serializedTx = await wallet!.signTx({ tx, ...recipientObj });
    const txResult = await wallet!.broadcast({
      tx: serializedTx
    });
    this.setState({ sentTxid: txResult.txid.transactionHash || txResult.txid });
  };

  render() {
    const { classes, wallet, unlocked, addresses } = this.props;
    return (
      <div className={classes.root}>
        <WalletHeader />
        <Paper className={classes.paper}>
          <Typography variant="h4" className={classes.heading}>
            Send
          </Typography>
          <Paper className={classes.amountInput}>
            <FormControl variant="outlined" className={classes.inputWidth}>
              <InputLabel htmlFor="outlined-from-simple">From</InputLabel>
              {wallet && wallet.chain === 'ETH' ? (
                <Select
                  value={this.state.sendFrom}
                  onChange={e => this.setState({ sendFrom: e.target.value })}
                  input={
                    <OutlinedInput
                      labelWidth={40}
                      name="From"
                      id="outlined-from-simple"
                    />
                  }
                >
                  {addresses.map(e => (
                    <MenuItem key={e} value={e}>
                      {e}
                    </MenuItem>
                  ))}
                </Select>
              ) : (
                <OutlinedInput
                  value={wallet ? `${wallet!.name}` : ''}
                  labelWidth={40}
                  disabled={true}
                  name={wallet ? `From ${wallet!.name}` : 'From'}
                  id="outlined-from-simple"
                />
              )}
            </FormControl>
          </Paper>
          <Paper className={classes.amountInput}>
            <FormControl variant="outlined" className={classes.inputWidth}>
              <InputLabel htmlFor="outlined-to-simple">To</InputLabel>
              <OutlinedInput
                labelWidth={20}
                name="To"
                id="outlined-to-simple"
                className={classes.input}
                placeholder="Enter address"
                value={this.state.sendTo}
                onChange={e => this.setState({ sendTo: e.target.value })}
              />
            </FormControl>
          </Paper>
          <Paper className={classes.amountInput}>
            <FormControl className={classes.inputWidth}>
              <InputLabel htmlFor="adornment-amount">Amount</InputLabel>
              <Input
                id="adornment-amount"
                value={this.state.amountToSend}
                onChange={e => this.setState({ amountToSend: e.target.value })}
                startAdornment={
                  <InputAdornment position="start">
                    {wallet ? wallet!.chain : ''}
                  </InputAdornment>
                }
              />
            </FormControl>
          </Paper>
          <Button
            variant="outlined"
            color="primary"
            disabled={!unlocked}
            className={classes.button}
            onClick={() => this.handleSendClick()}
          >
            Send
          </Button>
        </Paper>
        <QRBox sentTxid={this.state.sentTxid} />
        <WalletBottomNav value={2} />
      </div>
    );
  }
}

const mapStateToProps = (state: AppState) => {
  return {
    wallet: state.wallet,
    addresses: state.addresses,
    unlocked: state.unlocked
  };
};

export const SendPage = withStyles(styles)(
  connect(mapStateToProps)(SendContainer)
);
