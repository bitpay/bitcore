import React, {lazy, Suspense} from 'react';
import {Navigate, Route, Routes} from 'react-router-dom';
import Home from './pages';
import {ChainDetails} from './pages/chain';
const Blocks = lazy(() => import('./pages/blocks'));
const Block = lazy(() => import('./pages/block'));
const TransactionHash = lazy(() => import('./pages/transaction'));
const Address = lazy(() => import('./pages/address'));
const Search = lazy(() => import('./pages/search'));

function Routing() {
  return (
    <Suspense>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/:currency/:network/chain' element={<ChainDetails />} />
        <Route path='/:currency/:network/blocks' element={<Blocks />} />
        <Route path='/:currency/:network/block/:block' element={<Block />} />
        <Route path='/:currency/:network/tx/:tx' element={<TransactionHash />} />
        <Route path='/:currency/:network/address/:address' element={<Address />} />
        <Route path='/search' element={<Search />} />
        {/* 404 redirect to home page */}
        <Route path='*' element={<Navigate to='/' />} />
      </Routes>
    </Suspense>
  );
}

export default Routing;
