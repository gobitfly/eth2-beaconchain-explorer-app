import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TabBlocksPageRoutingModule } from './tab-blocks-routing.module';

import { TabBlocksPage } from './tab-blocks.page';
import { BlockComponentModule } from '../components/block/block.module';
import { TextAdComponentModule } from '../components/text-ad/text-ad.module';
import { PipesModule } from '../pipes/pipes.module';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TabBlocksPageRoutingModule,
    BlockComponentModule,
    TextAdComponentModule,
    PipesModule
  ],
  declarations: [TabBlocksPage]
})
export class TabBlocksPageModule {}
