import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import BottomNavigation from '@material-ui/core/BottomNavigation';
import BottomNavigationAction from '@material-ui/core/BottomNavigationAction';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import FilterListIcon from '@material-ui/icons/FilterList';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';

const styles = {
  root: {
    width: '100%',
    position: 'fixed' as 'fixed',
    bottom: 0,
    justifyContent: 'space-evenly',
    borderTop: '.5px solid rgba(0, 0, 0, 0.1)'
  }
};

interface Props {
  walletName: string;
  classes: any;
  value: number;
}
interface State {
  value: number;
}
class WalletActionNav extends React.Component<Props, State> {
  state = {
    value: this.props.value
  };

  handleChange = (_event: any, value: number) => {
    this.setState({ value });
  };

  recieveLink = (props: any) => (
    <Link
      to={`/wallet/${this.props.walletName}/receive`}
      {...props}
      data-next="true"
    />
  );
  activityLink = (props: any) => (
    <Link to={`/wallet/${this.props.walletName}`} {...props} data-next="true" />
  );
  sendLink = (props: any) => (
    <Link
      to={`/wallet/${this.props.walletName}/send`}
      {...props}
      data-next="true"
    />
  );

  render() {
    const { classes } = this.props;
    const { value } = this.state;

    return (
      <BottomNavigation
        value={value}
        onChange={this.handleChange}
        showLabels
        className={classes.root}
      >
        <BottomNavigationAction
          component={this.recieveLink}
          label="Receive"
          icon={<ArrowDownwardIcon />}
        />
        <BottomNavigationAction
          component={this.activityLink}
          label="Activity"
          icon={<FilterListIcon />}
        />
        <BottomNavigationAction
          component={this.sendLink}
          label="Send"
          icon={<ArrowUpwardIcon />}
        />
      </BottomNavigation>
    );
  }
}

const mapStateToProps = (state: Props) => {
  return {
    walletName: state.walletName
  };
};

export const WalletBottomNav = withStyles(styles)(
  connect(mapStateToProps)(WalletActionNav)
);
