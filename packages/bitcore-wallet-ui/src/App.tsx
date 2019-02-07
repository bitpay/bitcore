import React, { Component } from 'react';
import { Router, Switch, Route } from 'react-router';
import './App.css';
import 'semantic-ui-css/semantic.min.css';
import * as history from 'history';
import { WalletsContainers } from './containers/wallets/Wallets';
import { WalletContainer } from './containers/wallet/Wallet';
import { RecievePage } from './containers/Address/RecievePage';
import { SendContainer } from "./containers/wallet/SendContainer";
const createdHistory = history.createBrowserHistory();

class App extends Component {
  render() {
    return (
      <Router history={createdHistory}>
        <Switch>
          <Route exact path="/wallet/:name" component={WalletContainer} />
          <Route path="/wallet/:name/send" component={SendContainer} />
          <Route path="/wallet/:name/receive" component={RecievePage} />
          <Route exact path="/" component={WalletsContainers} />
        </Switch>
      </Router>
    );
  }
}

export default App;
