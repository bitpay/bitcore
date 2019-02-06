import React, { Component } from 'react';
import { Router, Switch, Route } from 'react-router';
import './App.css';
import 'semantic-ui-css/semantic.min.css';
import * as history from 'history';
import { WalletsContainers } from './containers/wallets/wallets';
import { WalletContainer } from './containers/wallet/wallet';
const createdHistory = history.createBrowserHistory();

class App extends Component {
  render() {
    return (
      <Router history={createdHistory}>
        <Switch>
          <Route path="/wallet/:name" component={WalletContainer} />
          <Route exact path="/" component={WalletsContainers} />
        </Switch>
      </Router>
    );
  }
}

export default App;
