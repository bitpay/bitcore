import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import CloseIcon from '@material-ui/icons/Close';
import green from '@material-ui/core/colors/green';
import IconButton from '@material-ui/core/IconButton';
import Snackbar from '@material-ui/core/Snackbar';
import SnackbarContent from '@material-ui/core/SnackbarContent';
import { Theme, withStyles, createStyles } from '@material-ui/core/styles';

const styles1 = (theme: Theme) =>
  createStyles({
    success: {
      backgroundColor: green[600]
    },
    icon: {
      fontSize: 20
    },
    iconVariant: {
      opacity: 0.9,
      marginRight: theme.spacing.unit
    },
    message: {
      display: 'flex',
      alignItems: 'center'
    }
  });

function MySnackbarContent(props: any) {
  const { classes, className, message, variant, onClose, ...other } = props;

  return (
    <SnackbarContent
      className={classNames(classes[variant], className)}
      aria-describedby="client-snackbar"
      message={
        <span id="client-snackbar" className={classes.message}>
          <CheckCircleIcon
            className={classNames(classes.icon, classes.iconVariant)}
          />
          {message}
        </span>
      }
      action={[
        <IconButton
          key="close"
          aria-label="Close"
          color="inherit"
          className={classes.close}
          onClick={onClose}
        >
          <CloseIcon className={classes.icon} />
        </IconButton>
      ]}
      {...other}
    />
  );
}

MySnackbarContent.propTypes = {
  classes: PropTypes.object.isRequired,
  className: PropTypes.string,
  message: PropTypes.node,
  onClose: PropTypes.func,
  variant: PropTypes.oneOf(['success']).isRequired
};

const MySnackbarContentWrapper = withStyles(styles1)(MySnackbarContent);

const styles2 = (theme: Theme) =>
  createStyles({
    margin: {
      margin: theme.spacing.unit
    }
  });

interface Props2 {
  message: string;
}

interface State {
  open: boolean;
}

class CustomizedSnackbars extends PureComponent<Props2, State> {
  state = {
    open: false
  };

  componentWillReceiveProps = (nextProps: Props2) => {
    if (nextProps.message) {
      this.setState({ open: true });
    }
  };

  handleClose = (_event: any, reason: string) => {
    if (reason === 'clickaway') {
      return;
    }

    this.setState({ open: false });
  };

  render() {
    const { message } = this.props;

    return (
      <div>
        <Snackbar
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left'
          }}
          open={this.state.open}
          autoHideDuration={6000}
          onClose={this.handleClose}
          ContentProps={{
            'aria-describedby': 'message-id'
          }}
        >
          <MySnackbarContentWrapper
            onClose={this.handleClose}
            variant="success"
            message={message}
          />
        </Snackbar>
      </div>
    );
  }
}

export const Notification = withStyles(styles2)(CustomizedSnackbars);
