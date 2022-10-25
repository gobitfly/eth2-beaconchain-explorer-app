import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TabBlocksPage } from './tab-blocks.page';

const routes: Routes = [
  {
    path: '',
    component: TabBlocksPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabBlocksPageRoutingModule {}
