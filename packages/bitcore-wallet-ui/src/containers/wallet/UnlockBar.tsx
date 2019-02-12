import React from 'react';
import Button from '@material-ui/core/Button';
import { createStyles, withStyles } from '@material-ui/core/styles';
import Dialog from '@material-ui/core/Dialog';
import TextField from '@material-ui/core/TextField';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControl from '@material-ui/core/FormControl';
import { Typography } from '@material-ui/core';
import { connect } from 'react-redux';
import { ActionCreators, store } from '../../index';
import { AppState } from '../../contexts/state';

const styles = () =>
  createStyles({
    root: {
      position: 'fixed',
      bottom: 0,
      width: '100%',
      textAlign: 'center',
      backgroundColor: '#002855',
      height: 50,
      alignItems: 'center'
    },
    container: {
      display: 'flex',
      flexWrap: 'wrap'
    },
    formControl: {
      margin: 'auto',
      minWidth: 250
    },
    title: {
      color: 'white',
      marginTop: 8
    },
    hidden: {
      display: 'none'
    }
  });

interface Props {
  classes: any;
  password: string;
  wallet: AppState['wallet'];
}

class DialogSelect extends React.Component<Props> {
  state = {
    open: false
  };

  handleClickOpen = () => {
    this.setState({ open: true });
  };

  handlePasswordChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    store.dispatch(ActionCreators.setPassword(event.target.value));
  }

  async handleLockToggle() {
    if (this.props.wallet) {
      let wallet = this.props.wallet;
      if (this.props.wallet.unlocked) {
        const locked = await wallet.lock();
        store.dispatch(ActionCreators.setWallet(locked));
      } else {
        let password = this.props.password;
        const unlocked = await wallet.unlock(password);
        store.dispatch(ActionCreators.setWallet(unlocked));
      }
    }
  }

  handleClose = () => {
    this.handleLockToggle();
    this.setState({ open: false });
  };

  render() {
    const { classes, password } = this.props;

    return (
      <div className={classes.root}>
        <Button className={classes.title} onClick={this.handleClickOpen}>
          <Typography variant="title" className={classes.title}>
            Unlock
          </Typography>
        </Button>
        <Dialog
          disableBackdropClick
          disableEscapeKeyDown
          open={this.state.open}
          onClose={this.handleClose}
        >
          <DialogTitle>Enter your password</DialogTitle>
          <DialogContent>
            <form className={classes.container}>
              <FormControl className={classes.formControl}>
                <TextField
                  type="password"
                  id="password"
                  label="Password"
                  className={classes.textField}
                  value={password}
                  onChange={e => this.handlePasswordChange(e)}
                  margin="normal"
                />
              </FormControl>
            </form>
          </DialogContent>
          <DialogActions>
            <Button onClick={this.handleClose} color="primary">
              Cancel
            </Button>
            <Button onClick={this.handleClose} color="primary">
              Unlock
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    );
  }
}

const mapStateToProps = (state: Props) => {
  return {
    password: state.password,
    wallet: state.wallet
  };
};

export default withStyles(styles)(connect(mapStateToProps)(DialogSelect));
