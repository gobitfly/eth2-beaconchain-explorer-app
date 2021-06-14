import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DevPageRoutingModule } from './dev-routing.module';

import { DevPage } from './dev.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DevPageRoutingModule
  ],
  declarations: [DevPage]
})
export class DevPageModule {}
