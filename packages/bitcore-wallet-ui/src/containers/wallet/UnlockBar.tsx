import React from 'react';
import Button from '@material-ui/core/Button';
import { withStyles } from '@material-ui/core/styles';
import Dialog from '@material-ui/core/Dialog';
import TextField from '@material-ui/core/TextField';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import InputLabel from '@material-ui/core/InputLabel';
import Input from '@material-ui/core/Input';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import { Typography } from '@material-ui/core';

const styles = (theme: any) =>
  ({
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
      margin: theme.spacing.unit,
      minWidth: 500
    },
    title: {
      color: 'white',
      marginTop: 8
    }
  } as any);

interface Props {
  classes: any;
  onUnlock: (password: string) => void;
}
class DialogSelect extends React.Component<Props> {
  state = {
    open: false,
    password: ''
  };

  handleChange = (name: any) => (event: any) => {
    this.setState({ [name]: event.target.value });
  };

  handleClickOpen = () => {
    this.setState({ open: true });
  };

  handleClose = () => {
    console.log(this.state);
    this.props.onUnlock(this.state.password);
    this.setState({ open: false });
  };

  render() {
    const { classes } = this.props;

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
                value={this.state.password}
                onChange={this.handleChange('password')}
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

export default withStyles(styles)(DialogSelect);
