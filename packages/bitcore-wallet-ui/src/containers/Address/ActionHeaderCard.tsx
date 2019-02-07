import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { Paper } from '@material-ui/core';
import { Wallet } from 'bitcore-client';
import { WalletHeader } from '../wallet/WalletHeader';
import InputBase from '@material-ui/core/InputBase';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';

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
    backgroundColor: 'white',
    height: 220,
    textAlign: 'center',
    padding: 40,
    paddingLeft: 20,
    marginTop: 70,
    width: '100%',
    zIndex: -99
  } as any,
  heading: {
    color: '#002855',
    textAlign: 'left'
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
    padding: 10,
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
};

interface Props {
  wallet: Wallet;
  classes: any;
}

function AddressBar(props: Props) {
  const { classes, wallet } = props;

  return (
    <div className={classes.root}>
      <WalletHeader wallet={wallet} />
      <Paper className={classes.paper}>
        <Typography variant="h4" className={classes.heading}>
          {true ? 'Recieve' : 'Send'}
        </Typography>
        <Paper className={classes.searchBar}>
          <InputBase className={classes.input} placeholder="Enter address" />
          <Divider className={classes.divider} />
          <IconButton className={classes.iconButton} aria-label="addresses">
            Derive
          </IconButton>
        </Paper>
        <Button variant="outlined" color="primary" className={classes.button}>
          Add
        </Button>
      </Paper>
    </div>
  );
}

AddressBar.propTypes = {
  classes: PropTypes.object.isRequired
};

const AddressNavBar = withStyles(styles)(AddressBar);

export { AddressNavBar };
