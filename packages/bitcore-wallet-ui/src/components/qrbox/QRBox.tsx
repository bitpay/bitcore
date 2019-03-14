import React from 'react';
import PropTypes from 'prop-types';
import { WithStyles, withStyles, createStyles } from '@material-ui/core/styles';
import SwipeableViews from 'react-swipeable-views';
import AppBar from '@material-ui/core/AppBar';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';

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

const styles = () =>
  createStyles({
    root: {
      maxWidth: 600,
      margin: 'auto',
      width: '100%',
      padding: 20,
      textAlign: 'center',
      marginBottom: 56
    },
    paper: {
      marginTop: 20,
      background: 'white',
      padding: 0,
      width: '100%'
    },
    appBar: {
      borderRadius: '10px 10px 0 0',
      borderBottom: '.5px solid lightgrey',
      boxShadow: 'none'
    },
    flex: {
      flex: 100
    }
  });

export interface Props extends WithStyles<typeof styles> {
  classes: any;
  theme: any;
  sentTxid: string;
}

interface State {
  value: number;
}

class FullWidthTabs extends React.Component<Props, State> {
  state = {
    value: 1
  };

  handleChange = (_event: any, value: number) => {
    this.setState({ value });
  };

  handleChangeIndex = (index: number) => {
    this.setState({ value: index });
  };

  render() {
    const { classes, theme, sentTxid } = this.props;

    return (
      <div className={classes.root}>
        <Paper className={classes.paper}>
          <AppBar position="static" color="inherit" className={classes.appBar}>
            <Tabs
              value={this.state.value}
              onChange={this.handleChange}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              <Tab label="SegWit" />
              <Tab label="Bech32" />
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
                <div>
                  <div>
                    <div id="address_text">Sent Txid:</div>
                  </div>
                  <div id="address_address" />
                </div>
                <TextField
                  className={classes.flex}
                  multiline
                  value={sentTxid}
                  disabled
                  margin="normal"
                />
                <img id="address_qr" />
              </div>
            </TabContainer>
            <TabContainer dir={theme.direction}>
              <div id="address_div">
                <div>
                  <div>
                    <div id="address_text">Sent Txid:</div>
                  </div>
                  <div id="address_address" />
                </div>
                <TextField
                  className={classes.flex}
                  multiline
                  value={sentTxid}
                  disabled
                  margin="normal"
                />
                <img id="address_qr" />
              </div>
            </TabContainer>
            <TabContainer dir={theme.direction}>
              <div id="address_div">
                <div>
                  <div>
                    <div id="address_text">Sent Txid:</div>
                  </div>
                  <div id="address_address" />
                </div>
                <TextField
                  className={classes.flex}
                  multiline
                  value={sentTxid}
                  disabled
                  margin="normal"
                />
                <img id="address_qr" />
              </div>
            </TabContainer>
          </SwipeableViews>
        </Paper>
      </div>
    );
  }
}

export const QRBox = withStyles(styles, { withTheme: true })(FullWidthTabs);
