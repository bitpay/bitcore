import React, { Component } from 'react';
import { Router, Switch, Route } from 'react-router';
import './App.css';
import 'semantic-ui-css/semantic.min.css';
import * as history from 'history';
import { socket } from './contexts/io';
import { WalletsPage } from './containers/wallets/Wallets';
import { SingleWalletPage } from './containers/wallet/Wallet';
import { RecievePage } from './containers/Address/RecievePage';
import { AddressNavBar } from './containers/send/ActionHeaderCard';
import { ActionCreators, store } from './index';
const createdHistory = history.createBrowserHistory();

class App extends Component {
  async componentDidMount() {
    socket.on('connect', () => {
      console.log('Connected to socket');
      socket.emit('room', '/BTC/regtest/inv');
    });
  }

  handleGetTx = (() => {
    socket.on('tx', async (sanitizedTx: any) => {
      let message = `Recieved ${sanitizedTx.value /
        100000000} BTC at ${new Date(
        sanitizedTx.blockTimeNormalized
      ).toLocaleString()}`;
      store.dispatch(ActionCreators.setMessage(message));
    });
  })();

  handleGetBlock = (() => {
    socket.on('block', (block: any) => {
      let message = `New Block on ${new Date(block.time).toDateString()}`;
      store.dispatch(ActionCreators.setMessage(message));
    });
  })();

  async componentWillUnmount() {
    socket.removeAllListeners();
  }
  render() {
    return (
      <Router history={createdHistory}>
        <Switch>
          <Route exact path="/wallet/:name" component={SingleWalletPage} />
          <Route path="/wallet/:name/send" component={AddressNavBar} />
          <Route path="/wallet/:name/receive" component={RecievePage} />
          <Route exact path="/" component={WalletsPage} />
        </Switch>
      </Router>
    );
  }
}

export default App;
