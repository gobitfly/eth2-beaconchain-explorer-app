import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DevPage } from './dev.page';

const routes: Routes = [
  {
    path: '',
    component: DevPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DevPageRoutingModule {}
