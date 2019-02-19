import React from 'react';
import { RouteComponentProps } from 'react-router';
import { WalletBottomNav } from '../../components/footer/BottomNav';
import { AppState } from '../../contexts/state';
import { connect } from 'react-redux';
import { AddressNavBar } from '../../components/recieve/AddressNavBar';
import { AddressListCard } from '../../components/recieve/AddressContainer';

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
      <WalletBottomNav value={0} />
    </div>
  );
}

const mapStateToProps = (state: AppState) => {
  return {
    wallet: state.wallet
  };
};

export const RecievePage = connect(mapStateToProps)(RecieveContainer);
