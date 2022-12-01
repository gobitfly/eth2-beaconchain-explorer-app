import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MergeChecklistPage } from './merge-checklist.page';

const routes: Routes = [
  {
    path: '',
    component: MergeChecklistPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MergeChecklistPageRoutingModule {}
