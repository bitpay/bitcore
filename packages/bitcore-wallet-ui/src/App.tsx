import React, { Component } from 'react';
import { Router, Switch, Route } from 'react-router';
import './App.css';
import 'semantic-ui-css/semantic.min.css';
import * as history from 'history';
import { socket } from './contexts/io';
import { WalletsPage } from './containers/wallets/Wallets';
import { SingleWalletPage } from './containers/activity/Wallet';
import { RecievePage } from './containers/recieve/RecievePage';
import { Notification } from './components/notification/Notification';
import { SendPage } from './containers/send/SendContainer';
const createdHistory = history.createBrowserHistory();

class App extends Component {
  state = {
    message: ''
  };

  componentDidMount = () => {
    socket.on('connect', () => {
      console.log(`Connected to socket BTC regtest`);
      socket.emit('room', `/BTC/regtest/inv`);
    });
    this.handleGetTx();
    this.handleGetBlock();
  };

  handleGetTx = () => {
    socket.on('tx', async (sanitizedTx: any) => {
      let message = `Recieved ${sanitizedTx.value /
        100000000} BTC at ${new Date(
        sanitizedTx.blockTimeNormalized
      ).toLocaleString()}`;
      this.setState({ message });
    });
  };

  handleGetBlock = () => {
    socket.on('block', (block: any) => {
      let message = `New Block on ${new Date(block.time).toDateString()}`;
      this.setState({ message });
    });
  };

  async componentWillUnmount() {
    socket.removeAllListeners();
  }

  render() {
    return (
      <div>
        <Notification message={this.state.message} />
        <Router history={createdHistory}>
          <Switch>
            <Route exact path="/wallet/:name" component={SingleWalletPage} />
            <Route path="/wallet/:name/send" component={SendPage} />
            <Route path="/wallet/:name/receive" component={RecievePage} />
            <Route exact path="/" component={WalletsPage} />
          </Switch>
        </Router>
      </div>
    );
  }
}

export default App;
