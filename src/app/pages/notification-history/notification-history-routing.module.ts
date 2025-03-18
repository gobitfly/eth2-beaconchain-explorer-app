import { NgModule } from '@angular/core'
import { Routes, RouterModule } from '@angular/router'
import { NoticationHistoryComponent } from './notification-history.component'

const routes: Routes = [
	{
		path: '',
		component: NoticationHistoryComponent,
	},
]

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class NotificationHistoryPageRoutingModule {}
