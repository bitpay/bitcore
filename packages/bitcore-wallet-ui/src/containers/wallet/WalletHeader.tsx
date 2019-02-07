import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import ClearIcon from '@material-ui/icons/Clear';
import LockIcon from '@material-ui/icons/Lock';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import { Link } from 'react-router-dom';
import { Wallet } from 'bitcore-client';

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
    justifyContent: 'space-between'
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
  wallet: Wallet;
  classes: any;
}

function WalletNavTop(props: Props) {
  const { classes, wallet } = props;

  return (
    <div className={classes.root}>
      <AppBar position="static" className={classes.background}>
        <Toolbar className={classes.toolbar}>
          <Link to={'/'} className={classes.link}>
            <ClearIcon />
          </Link>
          <Typography variant="title" color="inherit">
            {wallet.name}
          </Typography>
          {wallet.unlocked ? <LockOpenIcon /> : <LockIcon />}
        </Toolbar>
      </AppBar>
    </div>
  );
}

WalletNavTop.propTypes = {
  classes: PropTypes.object.isRequired
};

const WalletHeader = withStyles(styles)(WalletNavTop);

export { WalletHeader };
