import React from 'react';
import PropTypes from 'prop-types';
import {
  WithStyles,
  withStyles,
  createStyles,
  Theme
} from '@material-ui/core/styles';
import SwipeableViews from 'react-swipeable-views';
import AppBar from '@material-ui/core/AppBar';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import {
  setQRErrorCorrectionLevel,
  setAddressType,
  generate_address
} from '../../qrcode/Logic';

interface TabProps {
  children: any;
  dir: string;
}
function TabContainer({ children, dir }: TabProps) {
  return (
    <Typography component="div" dir={dir} style={{ padding: 8 * 3 }}>
      {children}
    </Typography>
  );
}

TabContainer.propTypes = {
  children: PropTypes.node.isRequired,
  dir: PropTypes.string.isRequired
};

const styles = (theme: Theme) =>
  createStyles({
    root: {
      backgroundColor: theme.palette.background.paper,
      maxWidth: 600,
      width: '100%',
      padding: 20
    }
  });

export interface Props extends WithStyles<typeof styles> {
  classes: any;
  theme: any;
}

interface State {
  value: number;
}

class FullWidthTabs extends React.Component<Props, State> {
  state = {
    value: 0
  };

  componentDidMount = () => {
    setQRErrorCorrectionLevel('H');
  };

  handleChange = (_event: any, value: number) => {
    this.setState({ value });
  };

  handleChangeIndex = (index: number) => {
    switch (index) {
      case 0:
        setAddressType('bech32');
      case 1:
        setAddressType('segwit');
      case 2:
        setAddressType('legacy');
      default:
        break;
    }
    this.setState({ value: index });
    generate_address();
  };

  render() {
    const { classes, theme } = this.props;

    return (
      <div className={classes.root}>
        <AppBar position="static" color="default">
          <Tabs
            value={this.state.value}
            onChange={this.handleChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab label="SegWit(bech32)" />
            <Tab label="SegWit" />
            <Tab label="Legacy" />
          </Tabs>
        </AppBar>
        <SwipeableViews
          axis={theme.direction === 'rtl' ? 'x-reverse' : 'x'}
          index={this.state.value}
          onChangeIndex={this.handleChangeIndex}
        >
          <TabContainer dir={theme.direction}>
            <div id="address_div">
              <img id="address_qr" />
            </div>
          </TabContainer>
          <TabContainer dir={theme.direction}>
            <div id="address_div">
              <img id="address_qr" />
            </div>
          </TabContainer>
          <TabContainer dir={theme.direction}>
            <div id="address_div">
              <img id="address_qr" />
            </div>
          </TabContainer>
        </SwipeableViews>
      </div>
    );
  }
}

export const QRBox = withStyles(styles, { withTheme: true })(FullWidthTabs);
