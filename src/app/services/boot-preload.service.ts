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

import { Injectable } from '@angular/core'
import ClientUpdateUtils from '../utils/ClientUpdateUtils'
import { ApiService } from './api.service'
import { StorageService } from './storage.service'
import { V2DashboardOverview, V2DashboardSummaryGroupTable, V2DashboardSummaryTable } from '../requests/v2-dashboard'


@Injectable({
	providedIn: 'root',
})
export class BootPreloadService {
	constructor(
		private clientUpdateUtils: ClientUpdateUtils,
		private storage: StorageService
	) {}

	preload(api: ApiService) {
		try {
			// This might seem weird but if there is no dashboard ID yet,
			// stuff like validator search (post) won't work since we have no CSRF token yet.
			// By getting latest state, we also get the csrf token.
			api.getLatestState(true)

			this.preloadDashboard(api)

			this.clientUpdateUtils.checkAllUpdates()
		} catch (e) {
			console.warn('can not preload', e)
		}
	}

	async preloadDashboard(api: ApiService) {
		const id = await this.storage.getDashboardID()
		if (id) {
			const timeFrame = await this.storage.getDashboardTimeframe()

			// preload the 3 calls needed for display
			api.execute2(new V2DashboardOverview(id), 'dashboard')
			api.execute2(new V2DashboardSummaryTable(id, timeFrame, null), 'dashboard')
			api.execute2(new V2DashboardSummaryGroupTable(id, 0, timeFrame, null), 'dashboard')
		}
	}
}
