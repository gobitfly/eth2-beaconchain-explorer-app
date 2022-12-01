import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

import { IonicModule } from '@ionic/angular'

import { BlockDetailPageRoutingModule } from './block-detail-routing.module'

import { BlockDetailPage } from './block-detail.page'
import { PipesModule } from 'src/app/pipes/pipes.module'

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		IonicModule,
		BlockDetailPageRoutingModule,
		PipesModule,
	],
	declarations: [BlockDetailPage],
})
export class BlockDetailPageModule {}
