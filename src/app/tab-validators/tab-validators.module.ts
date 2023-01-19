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

import { IonicModule } from '@ionic/angular'
import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Tab2Page } from './tab-validators.page'
import { ValidatorComponentModule } from '../components/validator/validator.module'
import { OfflineComponentModule } from '../components/offline/offline.module'
import { Tab2PageRoutingModule } from './tab-validators-routing.module'
import { MessageComponentModule } from '../components/message/message.module'
import { AdComponentModule } from '../components/ad/ad.module'

@NgModule({
	imports: [
		IonicModule,
		CommonModule,
		FormsModule,
		ValidatorComponentModule,
		OfflineComponentModule,
		Tab2PageRoutingModule,
		MessageComponentModule,
		AdComponentModule,
	],
	declarations: [Tab2Page],
})
export class Tab2PageModule {}
