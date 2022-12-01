/* 
 *  // Copyright (C) 2020 - 2021 Bitfly GmbH
 *  // Manuel Caspari (manuel@bitfly.at)
 *  // 
 *  // This file is part of Beaconchain Dashboard.
 *  // 
 *  // Beaconchain Dashboard is free software: you can redistribute it and/or modify
 *  // it under the terms of the GNU General Public License as published by
 *  // the Free Software Foundation, either version 3 of the License, or
 *  // (at your option) any later version.
 *  // 
 *  // Beaconchain Dashboard is distributed in the hope that it will be useful,
 *  // but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  // MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  // GNU General Public License for more details.
 *  // 
 *  // You should have received a copy of the GNU General Public License
 *  // along with Beaconchain Dashboard.  If not, see <http://www.gnu.org/licenses/>.
 */

import { NgModule, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DashboardComponent } from './dashboard.component';
import { PipesModule } from '../../pipes/pipes.module'
import { ClientupdateComponentModule } from '../../components/clientupdate/clientupdate.module';
import { MessageComponentModule } from '../../components/message/message.module';
import { TooltipModule } from 'ng2-tooltip-directive';
import { TextAdComponentModule } from '../text-ad/text-ad.module';


@NgModule({
  imports: [
    CommonModule, FormsModule, IonicModule, PipesModule,
    ClientupdateComponentModule, MessageComponentModule, TooltipModule, TextAdComponentModule],
  declarations: [DashboardComponent],
  exports: [DashboardComponent]
})
export class DashboardComponentModule {



}
