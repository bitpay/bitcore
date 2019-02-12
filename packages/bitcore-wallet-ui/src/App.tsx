import React, { Component } from 'react';
import { Router, Switch, Route } from 'react-router';
import './App.css';
import 'semantic-ui-css/semantic.min.css';
import * as history from 'history';
import { WalletsPage } from './containers/wallets/Wallets';
import { SingleWalletPage } from './containers/wallet/Wallet';
import { RecievePage } from './containers/Address/RecievePage';
import { AddressNavBar } from './containers/send/ActionHeaderCard';
const createdHistory = history.createBrowserHistory();

class App extends Component {
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
