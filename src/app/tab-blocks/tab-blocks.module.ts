import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

import { IonicModule } from '@ionic/angular'

import { TabBlocksPageRoutingModule } from './tab-blocks-routing.module'

import { TabBlocksPage } from './tab-blocks.page'
import { BlockComponentModule } from '../components/block/block.module'
import { AdComponentModule } from '../components/ad/ad.module'
import { PipesModule } from '../pipes/pipes.module'
import { ScrollingModule } from '@angular/cdk/scrolling'
import { FullPageLoadingComponent } from "../components/full-page-loading/full-page-loading.component";

@NgModule({
	imports: [
    CommonModule,
    ScrollingModule,
    FormsModule,
    IonicModule,
    TabBlocksPageRoutingModule,
    BlockComponentModule,
    AdComponentModule,
    PipesModule,
    FullPageLoadingComponent
],
	declarations: [TabBlocksPage],
})
export class TabBlocksPageModule {}
