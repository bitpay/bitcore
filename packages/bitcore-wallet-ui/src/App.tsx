import React, { Component } from 'react';
import { Router, Switch, Route } from 'react-router';
import './App.css';
import 'semantic-ui-css/semantic.min.css';
import * as history from 'history';
import { WalletsContainers } from './containers/wallets/wallets';
import {
  AppStateWithSocket,
  WalletContainer,
  LiveUpdatingWalletContainer
} from './containers/wallet/wallet';
import { RecievePage } from './containers/Address/RecievePage';
import {
  SendContainer,
  LiveUpdatingSendContainer
} from './containers/wallet/SendContainer';
import { Socket, SocketContext } from './contexts/io';
const createdHistory = history.createBrowserHistory();

class App extends Component {
  render() {
    return (
      <SocketContext.Provider value={Socket}>
        <Router history={createdHistory}>
          <Switch>
            <Route
              exact
              path="/wallet/:name"
              component={LiveUpdatingWalletContainer}
            />
            <Route
              path="/wallet/:name/send"
              component={LiveUpdatingSendContainer}
            />
            <Route path="/wallet/:name/receive" component={RecievePage} />
            <Route exact path="/" component={WalletsContainers} />
          </Switch>
        </Router>
      </SocketContext.Provider>
    );
  }
}

export default App;
