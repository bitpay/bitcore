import React, { Component } from 'react';
import { ParseApiStream, Wallet } from 'bitcore-client';
import { RouteComponentProps } from 'react-router';
import { WalletBottomNav } from '../../components/footer/BottomNav';
import { ActionCreators, store } from '../../index';
import { connect } from 'react-redux';
import { AppState } from '../../contexts/state';
import { socket } from '../../contexts/io';
import { WalletBar } from '../../components/activity/BalanceCard';
import { TransactionListCard } from '../../components/activity/TransactionContainer';

interface Props extends RouteComponentProps<{ name: string }> {
  walletName: string;
  wallet?: Wallet;
  transactions: AppState['transactions'];
  addresses: AppState['addresses'];
}

class WalletContainer extends Component<Props> {
  componentDidUpdate = (prevProps: any) => {
    const { wallet } = this.props;
    if (wallet && prevProps.wallet !== wallet) {
      this.updateWalletInfo(wallet);
      this.fetchAddresses(wallet);
      this.handleGetTx(wallet);
      this.handleGetBlock(wallet);
    }
  };

  handleGetTx = (wallet: Wallet) => {
    socket.on('tx', () => {
      this.updateWalletInfo(wallet);
    });
  };

  handleGetBlock = (wallet: Wallet) => {
    socket.on('block', () => {
      this.updateWalletInfo(wallet);
    });
  };

  updateWalletInfo = (wallet: Wallet) => {
    this.fetchTransactions(wallet);
    this.updateBalance(wallet);
  };

  updateBalance = async (wallet: Wallet) => {
    const balance = await wallet.getBalance();
    store.dispatch(ActionCreators.setBalance(balance));
  };

  fetchTransactions = async (wallet: Wallet) => {
    const loadedTransactions = this.props.transactions;
    await wallet
      .listTransactions({})
      .pipe(new ParseApiStream())
      .on('data', (d: any) => {
        const foundIndex = loadedTransactions.findIndex(t => t.id === d.id);
        if (foundIndex > -1) {
          loadedTransactions[foundIndex] = d;
        }
      })
      .on('finish', () => {
        store.dispatch(ActionCreators.setTransactions(loadedTransactions));
      });
  };

  fetchAddresses = async (wallet: Wallet) => {
    await wallet
      .getAddresses()
      .pipe(new ParseApiStream())
      .on('data', (d: any) => {
        let addresses = [];
        if (Array.isArray(d)) {
          addresses = d;
        } else {
          addresses = [d];
        }
        addresses.map(a =>
          store.dispatch(ActionCreators.setAddress(a.address))
        );
      });
  };

  render() {
    return (
      <div>
        <WalletBar />
        <TransactionListCard
          transactions={this.props.transactions.slice(0, 10)}
        />
        <WalletBottomNav value={1} />
      </div>
    );
  }
}

const mapStateToProps = (state: AppState) => {
  return {
    wallet: state.wallet,
    addresses: state.addresses,
    transactions: state.transactions
  };
};

export const SingleWalletPage = connect(mapStateToProps)(WalletContainer);
