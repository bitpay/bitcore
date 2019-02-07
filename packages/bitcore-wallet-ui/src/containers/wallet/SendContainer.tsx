import { RouteComponentProps } from "react-router";
import React from 'react';
import { Wallet } from 'bitcore-client';
import { WalletContainer } from './wallet';
import { WalletBar } from './AppBar';
interface Props extends RouteComponentProps<{ name: string }> {}
interface State {
  sendTo: string;
  amountToSend: string;
}
export class SendContainer extends WalletContainer {
  constructor(props: Props) {
    super(props);
  }

  public render() {
    const wallet = this.state.wallet;
    const walletUnlocked = wallet && wallet.unlocked;
    if (!wallet) {
      return <div className="walletContainer">No Wallet Found</div>;
    }
    return (
      <div className="walletContainer">
        <WalletBar wallet={wallet} balance={this.state.balance.balance} />
        <Paper>

              <TextField
                id="address"
                label="Password"
                value={this.state.sendTo}
                onChange={this.handleChange('password')}
                margin="normal"
              />

        </Paper>
      </div>
    );
  }
}
