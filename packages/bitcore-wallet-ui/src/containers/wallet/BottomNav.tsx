import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import BottomNavigation from '@material-ui/core/BottomNavigation';
import BottomNavigationAction from '@material-ui/core/BottomNavigationAction';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import FilterListIcon from '@material-ui/icons/FilterList';
import { Link } from 'react-router-dom';

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
  classes: any;
}
interface State {
  value: number;
}
class WalletActionNav extends React.Component<Props, State> {
  state = {
    value: 1
  };

  handleChange = (_event: any, value: number) => {
    this.setState({ value });
  };

  recieveLink = (props: any) => (
    <Link to="/recieve" {...props} data-next="true" />
  );
  activityLink = (props: any) => (
    <Link to="/wallet/walletname" {...props} data-next="true" />
  );
  sendLink = (props: any) => <Link to="/send" {...props} data-next="true" />;

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
          label="Import"
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

const WalletBottomNav = withStyles(styles)(WalletActionNav);

export { WalletBottomNav };
