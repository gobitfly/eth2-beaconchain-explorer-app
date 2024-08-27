/*
 *  // Copyright (C) 2020 - 2024 bitfly explorer GmbH
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

import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

import { IonicModule } from '@ionic/angular'

import { DashboardComponent } from './dashboard.component'
import { PipesModule } from '../../pipes/pipes.module'
import { ClientupdateComponentModule } from '../../components/clientupdate/clientupdate.module'
import { MessageComponentModule } from '../../components/message/message.module'
import { TooltipModule } from 'ng2-tooltip-directive-major-angular-updates'
import { AdComponentModule } from '../ad/ad.module'
import { PerformanceItemComponentModule } from './performance-item/performance-item.module'
import { SuccessFailViewComponent } from './success-fail-view/success-fail-view.component'
import { GridCellLeftComponent } from './grid-cell-left/grid-cell-left.component'
import { GridCellRightComponent } from './grid-cell-right/grid-cell-right.component'
import { SummaryChartModule } from './summary-chart/summary-chart.module'
import { RewardChartModule } from './reward-chart/reward-chart.module'

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		IonicModule,
		PipesModule,
		ClientupdateComponentModule,
		MessageComponentModule,
		TooltipModule,
		AdComponentModule,
		PerformanceItemComponentModule,
		SummaryChartModule,
		SuccessFailViewComponent,
		GridCellLeftComponent,
		GridCellRightComponent,
		RewardChartModule,
	],
	declarations: [DashboardComponent],
	exports: [DashboardComponent],
})
export class DashboardComponentModule {}
