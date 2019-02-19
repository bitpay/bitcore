import React from 'react';
import { WalletBottomNav } from '../../components/footer/BottomNav';
import { AddressNavBar } from '../../components/recieve/AddressNavBar';
import { AddressListCard } from '../../components/recieve/AddressContainer';

export function RecieveContainer() {
  return (
    <div>
      <AddressNavBar />
      <AddressListCard />
      <WalletBottomNav value={0} />
    </div>
  );
}
