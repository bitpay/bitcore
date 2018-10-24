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
      enableTracing: !environment.production,
      preloadingStrategy: PreloadAllModules
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
