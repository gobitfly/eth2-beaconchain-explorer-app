import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MachinesPageRoutingModule } from './machines-routing.module';
import { MachinesPage } from './machines.page';
import { MachineChartComponentModule } from 'src/app/components/machinechart/machinechart.module';
import { PipesModule } from 'src/app/pipes/pipes.module';
import { TextAdComponentModule } from 'src/app/components/text-ad/text-ad.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MachinesPageRoutingModule,
    MachineChartComponentModule,
    PipesModule,
    TextAdComponentModule
  ],
  declarations: [MachinesPage]
})
export class MachinesPageModule {}
