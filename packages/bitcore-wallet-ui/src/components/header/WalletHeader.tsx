import React, { PureComponent } from 'react';
import { WithStyles, withStyles, createStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import ClearIcon from '@material-ui/icons/Clear';
import LockIcon from '@material-ui/icons/Lock';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import Avatar from '@material-ui/core/Avatar';
import { Link } from 'react-router-dom';
import { AppState } from '../../types/state';
import { connect } from 'react-redux';
import { UnlockBar } from '../unlock/UnlockBar';

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
  },
  navStyle: {
    position: 'fixed',
    bottom: 50,
    right: 0,
    padding: '2px',
    zIndex: 999,
    margin: 10
  },
  avatar: {
    width: 60,
    height: 60,
    color: '#fff',
    boxShadow:
      '0px 1px 3px 0px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 2px 1px -1px rgba(0,0,0,0.12)',
    backgroundColor: 'rgb(0, 122, 255)',
    cursor: 'pointer'
  },
  avatarIcon: {
    height: 35,
    width: 35
  }
});

interface Props extends WithStyles<typeof styles> {
  wallet?: AppState['wallet'];
  classes: any;
  unlocked: boolean;
}

interface State {
  open: boolean;
}

class WalletNavTop extends PureComponent<Props, State> {
  state = {
    open: false
  };

  render() {
    const { classes, wallet, unlocked } = this.props;

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
            {wallet && unlocked ? (
              <LockOpenIcon />
            ) : (
              <LockIcon onClick={() => this.setState({ open: true })} />
            )}
          </Toolbar>
        </AppBar>
        <div className={classes.navStyle}>
          <Avatar style={styles.avatar}>
            {wallet && unlocked ? (
              <LockOpenIcon style={styles.avatarIcon} />
            ) : (
              <LockIcon
                style={styles.avatarIcon}
                onClick={() => this.setState({ open: true })}
              />
            )}
          </Avatar>
        </div>
        {this.state.open && <UnlockBar />}
      </div>
    );
  }
}

const mapStateToProps = (state: AppState) => {
  return {
    wallet: state.wallet,
    unlocked: state.unlocked
  };
};

export const WalletHeader = withStyles(styles)(
  connect(mapStateToProps)(WalletNavTop)
);
