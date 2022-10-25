import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BlockDetailPage } from './block-detail.page';

const routes: Routes = [
  {
    path: '',
    component: BlockDetailPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BlockDetailPageRoutingModule {}
