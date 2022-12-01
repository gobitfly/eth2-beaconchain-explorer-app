import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MachinesPage } from './machines.page';

const routes: Routes = [
  {
    path: '',
    component: MachinesPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MachinesPageRoutingModule {}
