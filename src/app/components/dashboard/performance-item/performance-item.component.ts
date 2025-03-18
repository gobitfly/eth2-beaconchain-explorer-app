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

import { Component, Input } from '@angular/core'
import { Performance } from '@controllers/OverviewController'
import { Currency, UnitconvService } from '@services/unitconv.service'

@Component({
	selector: 'app-performance-item',
	templateUrl: './performance-item.component.html',
	styleUrls: ['./performance-item.component.scss'],
	standalone: false,
})
export class PerformanceItemComponent {
	@Input() performanceData: Performance
	@Input() unit: UnitconvService
	@Input() targetCurrency: Currency
	@Input() currency: string
	@Input() todayTooltip: string
	@Input() last7DaysTooltip: string
	@Input() last30DaysTooltip: string
	@Input() totalTooltip: string
	@Input() aprTooltip: string
}
