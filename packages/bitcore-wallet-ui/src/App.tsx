import React, { Component } from 'react';
import { Router, Switch, Route } from 'react-router';
import './App.css';
import 'semantic-ui-css/semantic.min.css';
import * as history from 'history';
import { socket } from './sockets/io';
import { WalletsPage } from './views/wallets/WalletsView';
import { SingleWalletPage } from './views/activity/WalletView';
import { RecieveContainer } from './views/recieve/RecieveView';
import { Notification } from './components/notification/Notification';
import { SendPage } from './views/send/SendView';
import { ErrorBoundary } from './components/404/ErrorBoundary';
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
    socket.on('coin', async (sanitizedCoin: any) => {
      if (sanitizedCoin.mintIndex === 0) {
        let message = `Sent ${sanitizedCoin.value /
          1e8} BTC at ${new Date().toDateString()}`;
        this.setState({ message });
      }
    });
  };

  handleGetBlock = () => {
    socket.on('block', (block: any) => {
      let message = `Confirmed on ${new Date(block.time).toDateString()}`;
      this.setState({ message });
    });
  };

  async componentWillUnmount() {
    socket.removeAllListeners();
  }

  render() {
    return (
      <ErrorBoundary>
        <div>
          <Notification message={this.state.message} />
          <Router history={createdHistory}>
            <Switch>
              <Route exact path="/wallet/:name" component={SingleWalletPage} />
              <Route path="/wallet/:name/send" component={SendPage} />
              <Route
                path="/wallet/:name/receive"
                component={RecieveContainer}
              />
              <Route exact path="/" component={WalletsPage} />
            </Switch>
          </Router>
        </div>
      </ErrorBoundary>
    );
  }
}

export default App;
