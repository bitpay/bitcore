import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { Paper } from '@material-ui/core';
import { Wallet } from 'bitcore-client';
import { WalletHeader } from '../header/WalletHeader';
import { connect } from 'react-redux';

const styles = {
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
  } as any,
  toolbar: {
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%'
  },
  paper: {
    backgroundColor: '#1A3A8B',
    height: 220,
    textAlign: 'center',
    padding: 40,
    marginTop: 50,
    position: 'absolute',
    width: '100%',
    top: 0,
    zIndex: -99
  } as any,
  heading: {
    color: 'white'
  } as any,
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
  }
};

interface Props {
  wallet?: Wallet;
  balance: any;
  classes: any;
}

function WalletNavBar(props: Props) {
  const { classes, wallet, balance } = props;

  return (
    <div className={classes.root}>
      <WalletHeader />
      <Paper className={classes.paper}>
        <Typography variant="h2" className={classes.heading}>
          {wallet && wallet.chain === 'BTC'
            ? Math.floor((Number(balance) / 1e8) * 100) / 100
            : Math.floor((Number(balance) / 1e18) * 100) / 100}
        </Typography>
        <Typography variant="subheading" className={classes.chain}>
          {wallet ? wallet.chain : 'unknown chain'}
        </Typography>
      </Paper>
    </div>
  );
}

WalletNavBar.propTypes = {
  classes: PropTypes.object.isRequired
};

const mapStateToProps = (state: Props) => {
  return {
    wallet: state.wallet,
    balance: state.balance.confirmed
  };
};

export const WalletBar = withStyles(styles)(
  connect(mapStateToProps)(WalletNavBar)
);
