import { AppStateContext } from './wallet';
import { RouteComponentProps } from 'react-router';
import { WalletBottomNav } from '../wallet/BottomNav';
import DialogSelect from '../wallet/UnlockBar';
import React from 'react';
import { useState } from 'react';
import { Wallet } from 'bitcore-client';
import { WalletContainer, AppState } from './wallet';
import { WalletBar } from './BalanceCard';
import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import FormControl from '@material-ui/core/FormControl';
import { withStyles } from '@material-ui/core/styles';
import { SocketContext } from '../../contexts/io';

interface Props extends RouteComponentProps<{ name: string }> {
  classes: any;
  socket: ReturnType<typeof io>;
  appState: AppState;
}

interface State {
  sendTo: string;
  amountToSend: string;
  rawTx: string;
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

export function LiveUpdatingSendContainer(props: Props) {
  return (
    <SocketContext.Consumer>
      {socket => (
        <WalletContainer socket={socket} {...props}>
          <AppStateContext.Consumer>
            {state => (
              <SendContainer socket={socket} appState={state} {...props} />
            )}
          </AppStateContext.Consumer>
        </WalletContainer>
      )}
    </SocketContext.Consumer>
  );
}
export class SendCard extends React.Component<Props, State> {
  state: State = {
    sendTo: '',
    amountToSend: '',
    rawTx: ''
  };

  constructor(props: Props) {
    super(props);
    this.handleSendClick = this.handleSendClick.bind(this);
  }

  async componentDidMount() {
    this.props.socket.on('connect', () => {
      console.log('Connected to socket');
      this.props.socket.emit('room', '/BTC/regtest/inv');
    });
  }

  async handleSendClick() {
    const tx = await this.props.appState.wallet!.newTx({
      recipients: [
        { address: this.state.sendTo, amount: Number(this.state.amountToSend) }
      ]
    });

    console.log(tx);
    const signed = await this.props.appState.wallet!.signTx({ tx });
    this.setState({ rawTx: signed });
  }

  public render() {
    const wallet = this.props.appState.wallet;
    const walletUnlocked = wallet && wallet.unlocked;
    const { classes } = this.props;
    return (
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
                    onClick={() => this.handleSendClick()}
                  >
                    Send
                  </Button>
                </FormControl>

                <FormControl fullWidth className={classes.margin}>
                  <TextField
                    className={classes.flex}
                    multiline
                    value={this.state.rawTx}
                    disabled
                    margin="normal"
                  />
                </FormControl>
              </div>
              <div />
            </Paper>
          </div>
        </div>
      </div>
    );
  }
}
export const SendContainer = withStyles(styles)(SendCard);
