import React from 'react';
import { RouteComponentProps } from 'react-router';
import { WalletBottomNav } from '../wallet/BottomNav';
import { AddressNavBar } from '../Address/ActionHeaderCard';
import { AddressListCard } from '../Address/AddressContainer';
import { AppState } from '../../contexts/state';
import { connect } from 'react-redux';

interface Props extends RouteComponentProps<{ name: string }> {
  wallet: AppState['wallet'];
}

export function RecieveContainer(props: Props) {
  const wallet = props.wallet!;
  if (!wallet) {
    // Add Error Boundary Component Here
    return <div>No Wallet Found</div>;
  }
  return (
    <div>
      <AddressNavBar />
      <AddressListCard />
      <WalletBottomNav />
    </div>
  );
}

const mapStateToProps = (state: Props) => {
  return {
    wallet: state.wallet
  };
};

export const RecievePage = connect(mapStateToProps)(RecieveContainer);
