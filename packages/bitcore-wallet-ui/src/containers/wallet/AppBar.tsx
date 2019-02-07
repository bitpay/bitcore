import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import ClearIcon from '@material-ui/icons/Clear';
import LockIcon from '@material-ui/icons/Lock';
import { Paper } from '@material-ui/core';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import { Link } from 'react-router-dom';

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

function WalletNavBar(props: any) {
  const { classes } = props;

  return (
    <div className={classes.root}>
      <AppBar position="static" className={classes.background}>
        <Toolbar className={classes.toolbar}>
          <Link to={'/'} className={classes.link}>
            <ClearIcon />
          </Link>
          <Typography variant="title" color="inherit">
            JustinRegTestWallet
          </Typography>
          {true ? <LockOpenIcon /> : <LockIcon />}
        </Toolbar>
      </AppBar>
      <Paper className={classes.paper}>
        <Typography variant="h2" className={classes.heading}>
          1,293.2
        </Typography>
        <Typography variant="subheading" className={classes.chain}>
          BTC
        </Typography>
      </Paper>
    </div>
  );
}

WalletNavBar.propTypes = {
  classes: PropTypes.object.isRequired
};

const WalletBar = withStyles(styles)(WalletNavBar);

export { WalletBar };
