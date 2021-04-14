import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SubscribePageRoutingModule } from './subscribe-routing.module';

import { SubscribePage } from './subscribe.page';
import { PipesModule } from '../../pipes/pipes.module'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SubscribePageRoutingModule,
    PipesModule
  ],
  declarations: [SubscribePage]
})
export class SubscribePageModule {}
