import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MachineDetailPageRoutingModule } from './machine-detail-routing.module';

import { MachineDetailPage } from './machine-detail.page';
import { TooltipModule } from 'ng2-tooltip-directive';
import { PipesModule } from '../../pipes/pipes.module'
import { MachineChartComponentModule } from 'src/app/components/machinechart/machinechart.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MachineDetailPageRoutingModule,
    TooltipModule,
    PipesModule,
    MachineChartComponentModule
  ],
  declarations: [MachineDetailPage]
})
export class MachineDetailPageModule {}
