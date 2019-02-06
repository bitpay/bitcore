import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';

const styles = {
  root: {
    flexGrow: 1,
    position: 'fixed' as 'fixed',
    top: 0,
    width: '100%',
    zIndex: -1
  },
  background: {
    height: 180,
    backgroundColor: '#1A3A8B'
  },
  toolbar: {
    alignItems: 'center',
    justifyContent: 'center'
  }
};

function SimpleAppBar(props: any) {
  const { classes } = props;

  return (
    <div className={classes.root}>
      <AppBar position="static" className={classes.background}>
        <Toolbar className={classes.toolbar}>
          <Typography variant="h6" color="inherit">
            <img
              src="https://www.bitpay.com/cdn/en_US/bitpay-mark-std.svg"
              alt="Pay with BitPay"
              width="75px"
            />
          </Typography>
        </Toolbar>
      </AppBar>
    </div>
  );
}

SimpleAppBar.propTypes = {
  classes: PropTypes.object.isRequired
};

const NavBar = withStyles(styles)(SimpleAppBar);

export { NavBar };
