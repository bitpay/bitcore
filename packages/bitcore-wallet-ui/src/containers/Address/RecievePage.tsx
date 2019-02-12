import React from 'react';
import { RouteComponentProps } from 'react-router';
import { WalletBottomNav } from '../wallet/BottomNav';
import DialogSelect from '../wallet/UnlockBar';
import { AddressNavBar } from '../Address/ActionHeaderCard';
import { AddressListCard } from '../Address/AddressContainer';
import { AppState } from '../../contexts/state';
import { connect } from 'react-redux';

interface Props extends RouteComponentProps<{ name: string }> {
  wallet: AppState['wallet'];
}

export function RecieveContainer(props: Props) {
  const wallet = props.wallet!;
  const walletUnlocked = wallet && wallet.unlocked;
  if (!wallet) {
    // Add Error Boundary Component Here
    return <div>No Wallet Found</div>;
  }
  return (
    <div>
      <AddressNavBar />
      <AddressListCard />
      <WalletBottomNav />
      {/* {walletUnlocked ? <WalletBottomNav /> : <DialogSelect />} */}
    </div>
  );
}

const mapStateToProps = (state: Props) => {
  return {
    wallet: state.wallet
  };
};

export const RecievePage = connect(mapStateToProps)(RecieveContainer);
