import React from 'react';
import { WalletBottomNav } from '../../components/footer/BottomNav';
import { AddressNavBar } from '../../components/address/AddressNavBar';
import { AddressListCard } from '../../containers/address/AddressContainer';

export function RecieveContainer() {
  return (
    <div>
      <AddressNavBar />
      <AddressListCard />
      <WalletBottomNav value={0} />
    </div>
  );
}
