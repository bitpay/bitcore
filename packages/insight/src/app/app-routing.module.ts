import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { environment } from '../environments/environment';
import {
  AvailableChainGuard,
  availableChainsMatcher
} from './guards/available-chain.guard';

/**
 * **Implementation note**
 * In Insight, the router is the source-of-truth for most state in the app. When
 * the app loads, the route is check to select the proper view and data to
 * display. (`AvailableChainGuard` checks to see if the Chain referenced by the
 * route is enabled by the connected `bitcore-node` instance.)
 *
 * When any link is clicked, the router should be updated, and all components
 * derive their state by watching the `ActivatedRoute`. It's important to encode
 * all important state into routing; we want end-users to always be able to
 * copy/paste the link to whatever they're seeing.
 *
 * **TODO**
 * TODO: address route: `CHAIN/address/:address`
 * TODO: search routes (and search API to `bitcore-node`):
 * `/CHAIN/search`: an empty-state search route (happens when the user taps the search icon)
 * `/CHAIN/search/:query`: a full listing of matches for `query` (addresses, transactions, blocks)
 *
 * In `bitcore-node`, a "first bits" search is quite easy, and already indexed:
 * `coins.find({address: {$gt: '1JasonD', $lt: '1JasonE'} })`. The same first
 * bits search is also easy for transaction hashes and block hashes.
 *
 * E.g. `/BCH/search/1JasonD` – should be a search listing showing at least 1
 * address: `1JasonDm4iqi3TJwgpHKSJYfewJBtKewxP` and at least 4 transactions:
 * `43bab209c68f3f7334e38a681b007127af5df0d169e998e9e0dd46cb7ab7f783` – mints to a matching address
 * `9871be1cfff51d1180ed3069326f83927503e785a015b8ecd4054a8300068b78` - spends from a matching address
 * `217cb4071f20a31599c4353becf39b72f15d5cb71851c00a12514be6568fbfbd` - mints to a matching address
 * `628a4a10458c0385e845850fc3fb0a4219baa743dad3b091ec7c9324615bab6d` - spends from a matching address
 */
const routes: Routes = [
  {
    path: '',
    redirectTo: `${environment.initialChain.code}`,
    pathMatch: 'full'
  },
  {
    matcher: availableChainsMatcher,
    canActivateChild: [AvailableChainGuard],
    children: [
      {
        path: '',
        loadChildren: './home/home.module#HomePageModule'
      },
      {
        path: 'blocks',
        loadChildren: './blocks/blocks.module#BlocksPageModule'
      },
      {
        path: 'block/:hash',
        loadChildren: './block/block.module#BlockPageModule'
      },
      {
        path: 'block/:hash/transactions',
        loadChildren:
          './block/block-transactions/block-transactions.module#BlockTransactionsPageModule'
      },
      {
        path: 'transactions',
        loadChildren:
          './transactions/transactions.module#TransactionsPageModule'
      },
      {
        path: 'transaction/:hash',
        loadChildren: './transaction/transaction.module#TransactionPageModule'
      },
      {
        path: 'transaction/:hash/outputs',
        loadChildren: './transaction/outputs/outputs.module#OutputsPageModule'
      },
      {
        path: 'transaction/:hash/output/:output',
        loadChildren: './transaction/output/output.module#OutputPageModule'
      },
      {
        path: 'transaction/:hash/inputs',
        loadChildren: './transaction/inputs/inputs.module#InputsPageModule'
      },
      {
        path: 'transaction/:hash/input/:input',
        loadChildren: './transaction/input/input.module#InputPageModule'
      }
    ]
  },
  {
    path: '**',
    loadChildren: './not-found/not-found.module#NotFoundPageModule'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      enableTracing: environment.debugRouting,
      preloadingStrategy: PreloadAllModules
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
