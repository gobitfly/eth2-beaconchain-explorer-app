import { NgModule } from '@angular/core'
import { Routes, RouterModule } from '@angular/router'

import { MachineDetailPage } from './machine-detail.page'

const routes: Routes = [
	{
		path: '',
		component: MachineDetailPage,
	},
]

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class MachineDetailPageRoutingModule {}
