import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { MyImmerReducer } from './reducers';
import { createActionCreators, createReducerFunction } from 'immer-reducer';
import { AppState } from './types/state';

const initialState: AppState = {
  password: '',
  walletName: '',
  balance: {
    confirmed: 0,
    unconfirmed: 0,
    balance: 0
  },
  transactions: [],
  addresses: [],
  addressToAdd: '',
  wallet: undefined,
  wallets: [],
  unlocked: false
};

export const ActionCreators = createActionCreators(MyImmerReducer);
const reducerFunction = createReducerFunction(MyImmerReducer, initialState);

export const store = createStore(reducerFunction);

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
