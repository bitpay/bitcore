import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { environment } from '../environments/environment';
import {
  AvailableChainGuard,
  availableChainsMatcher
} from './guards/available-chain.guard';

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
