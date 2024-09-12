import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

import { IonicModule } from '@ionic/angular'

import { BlockDetailPageRoutingModule } from './block-detail-routing.module'

import { BlockDetailPage } from './block-detail.page'
import { PipesModule } from 'src/app/pipes/pipes.module'
import { FullPageLoadingComponent } from "../../components/full-page-loading/full-page-loading.component";
import { FullPageOfflineComponent } from "../../components/full-page-offline/full-page-offline.component";

@NgModule({
	imports: [CommonModule, FormsModule, IonicModule, BlockDetailPageRoutingModule, PipesModule, FullPageLoadingComponent, FullPageOfflineComponent],
	declarations: [BlockDetailPage],
})
export class BlockDetailPageModule {}
