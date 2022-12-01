import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { LogviewPageRoutingModule } from './logview-routing.module';

import { LogviewPage } from './logview.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LogviewPageRoutingModule
  ],
  declarations: [LogviewPage]
})
export class LogviewPageModule {}
