import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

import { IonicModule } from '@ionic/angular'

import { MachinesPageRoutingModule } from './machines-routing.module'
import { MachinesPage } from './machines.page'
import { MachineChartComponentModule } from 'src/app/components/machinechart/machinechart.module'
import { PipesModule } from 'src/app/pipes/pipes.module'
import { AdComponentModule } from 'src/app/components/ad/ad.module'
import { FullPageLoadingComponent } from '../components/full-page-loading/full-page-loading.component'
import { FullPageOfflineComponent } from '../components/full-page-offline/full-page-offline.component'

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		IonicModule,
		MachinesPageRoutingModule,
		MachineChartComponentModule,
		PipesModule,
		AdComponentModule,
		FullPageLoadingComponent,
		FullPageOfflineComponent,
	],
	declarations: [MachinesPage],
})
export class MachinesPageModule {}
