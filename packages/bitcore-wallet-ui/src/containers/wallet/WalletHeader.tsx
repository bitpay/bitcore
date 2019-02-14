import React, { PureComponent } from 'react';
import { withStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import ClearIcon from '@material-ui/icons/Clear';
import LockIcon from '@material-ui/icons/Lock';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import { Link } from 'react-router-dom';
import { AppState } from '../../contexts/state';
import { connect } from 'react-redux';
import { UnlockBar } from './UnlockBar';

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
  wallet?: AppState['wallet'];
  classes: any;
}

interface State {
  open: boolean;
}

class WalletNavTop extends PureComponent<Props, State> {
  state = {
    open: false
  };

  renderContent = () => {
    if (this.state.open) {
      return <UnlockBar />;
    }
  };
  render() {
    const { classes, wallet } = this.props;

    return (
      <div className={classes.root}>
        <AppBar position="static" className={classes.background}>
          <Toolbar className={classes.toolbar}>
            <Link to={'/'} className={classes.link}>
              <ClearIcon />
            </Link>
            <Typography variant="title" color="inherit">
              {wallet ? wallet.name : 'Loading...'}
            </Typography>
            {wallet!.unlocked ? (
              <LockOpenIcon />
            ) : (
              <LockIcon onClick={() => this.setState({ open: true })} />
            )}
          </Toolbar>
        </AppBar>
        {this.renderContent()}
      </div>
    );
  }
}

const mapStateToProps = (state: AppState) => {
  return {
    wallet: state.wallet
  };
};

export const WalletHeader = withStyles(styles)(
  connect(mapStateToProps)(WalletNavTop)
);
