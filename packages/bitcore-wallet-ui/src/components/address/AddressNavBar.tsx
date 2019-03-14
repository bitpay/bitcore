import React, { Component } from 'react';
import { withStyles, createStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { Paper } from '@material-ui/core';
import InputBase from '@material-ui/core/InputBase';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import { AppState } from '../../types/state';
import { ActionCreators, store } from '../../index';
import { connect } from 'react-redux';
import { WalletHeader } from '../header/WalletHeader';

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
    height: 220,
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
    marginLeft: 8,
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
  }
});

interface Props {
  wallet: AppState['wallet'];
  classes: any;
  addresses: AppState['addresses'];
  addressToAdd: AppState['addressToAdd'];
  unlocked: boolean;
}

class AddressBar extends Component<Props> {
  async importAddresses(address: string) {
    let wallet = this.props.wallet;
    if (wallet) {
      if (wallet && wallet.unlocked) {
        await wallet.importKeys({
          keys: [{ address }]
        });
      }
    }
  }

  async handleAddAddressClick() {
    store.dispatch(ActionCreators.setAddress(this.props.addressToAdd));
    await this.importAddresses(this.props.addressToAdd);
  }

  handleAddressChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    store.dispatch(ActionCreators.setAddressToAdd(event.target.value));
  }

  async handleDeriveAddressClick() {
    const wallet = this.props.wallet!;
    const newAddresses = await wallet.nextAddressPair( wallet.chain !== 'ETH');
    newAddresses.map(e => store.dispatch(ActionCreators.setAddress(e)));
  }

  render() {
    const { classes, addressToAdd, unlocked } = this.props;
    return (
      <div className={classes.root}>
        <WalletHeader />
        <Paper className={classes.paper}>
          <Typography variant="h4" className={classes.heading}>
            Recieve
          </Typography>
          <Paper className={classes.searchBar}>
            <InputBase
              className={classes.input}
              placeholder="Enter address"
              value={addressToAdd}
              onChange={e => this.handleAddressChange(e)}
            />
            <Divider className={classes.divider} />
            <IconButton
              className={classes.iconButton}
              aria-label="addresses"
              onClick={() => this.handleDeriveAddressClick()}
            >
              <Typography variant="subheading" className={classes.iconButton}>
                Derive
              </Typography>
            </IconButton>
          </Paper>
          <Button
            variant="outlined"
            color="primary"
            disabled={!unlocked}
            className={classes.button}
            onClick={() => this.handleAddAddressClick()}
          >
            Add
          </Button>
        </Paper>
      </div>
    );
  }
}

const mapStateToProps = (state: Props) => {
  return {
    wallet: state.wallet,
    addresses: state.addresses,
    addressToAdd: state.addressToAdd,
    unlocked: state.unlocked
  };
};

export const AddressNavBar = withStyles(styles)(
  connect(mapStateToProps)(AddressBar)
);
