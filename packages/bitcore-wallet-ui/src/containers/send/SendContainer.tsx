import React, { Component } from 'react';
import { WithStyles, withStyles, createStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { Paper } from '@material-ui/core';
import InputBase from '@material-ui/core/InputBase';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import InputAdornment from '@material-ui/core/InputAdornment';
import FormControl from '@material-ui/core/FormControl';
import Button from '@material-ui/core/Button';
import { AppState } from '../../contexts/state';
import { connect } from 'react-redux';
import { QRBox } from './QRBox';
import { WalletBottomNav } from '../wallet/BottomNav';
import { WalletHeader } from '../wallet/WalletHeader';

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
    height: 260,
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
  searchBar: {
    padding: '2px 4px',
    marginTop: 20,
    display: 'flex',
    alignItems: 'center',
    maxWidth: 600,
    width: '100%',
    boxShadow: 'none',
    backgroundColor: 'rgba(0, 0, 0, .087)',
    margin: 'auto'
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
    width: '100%'
  }
});

export interface Props extends WithStyles<typeof styles> {
  classes: any;
  wallet: AppState['wallet'];
}

interface State {
  sendTo: string;
  amountToSend: string;
  rawTx: string;
}

class AddressBar extends Component<Props, State> {
  state: State = {
    sendTo: '',
    amountToSend: '',
    rawTx: ''
  };

  handleSendClick = async () => {
    const tx = await this.props.wallet!.newTx({
      recipients: [
        { address: this.state.sendTo, amount: Number(this.state.amountToSend) }
      ]
    });

    await this.props.wallet!.signTx({ tx });
    const result = await this.props.wallet!.broadcast({tx})
    console.log(result);
    // this.setState({ rawTx: signedRawTx });
  }

  render() {
    const { classes, wallet } = this.props;
    return (
      <div className={classes.root}>
        <WalletHeader />
        <Paper className={classes.paper}>
          <Typography variant="h4" className={classes.heading}>
            Send
          </Typography>
          <Paper className={classes.searchBar}>
            <InputBase
              className={classes.input}
              placeholder="Enter address"
              value={this.state.sendTo}
              onChange={e => this.setState({ sendTo: e.target.value })}
            />
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
                    {wallet!.chain}
                  </InputAdornment>
                }
              />
            </FormControl>
          </Paper>
          <Button
            variant="outlined"
            color="primary"
            disabled={!wallet!.unlocked}
            className={classes.button}
            onClick={() => this.handleSendClick()}
          >
            Send
          </Button>
        </Paper>
        <QRBox rawTx={this.state.rawTx} />
        <WalletBottomNav value={2} />
      </div>
    );
  }
}

const mapStateToProps = (state: AppState) => {
  return {
    wallet: state.wallet
  };
};

export const AddressNavBar = withStyles(styles)(
  connect(mapStateToProps)(AddressBar)
);
