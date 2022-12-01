import { NgModule } from '@angular/core'
import { Routes, RouterModule } from '@angular/router'

import { LogviewPage } from './logview.page'

const routes: Routes = [
	{
		path: '',
		component: LogviewPage,
	},
]

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class LogviewPageRoutingModule {}
