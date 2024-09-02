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

import { Component } from '@angular/core'
import { ApiService } from '../services/api.service'
import { ValidatorUtils } from '../utils/ValidatorUtils'
import { OverviewData2, OverviewProvider, SummaryChartOptions } from '../controllers/OverviewController'
import ClientUpdateUtils from '../utils/ClientUpdateUtils'
import { StorageService } from '../services/storage.service'
import { UnitconvService } from '../services/unitconv.service'
import { App, AppState } from '@capacitor/app'
import { SyncService } from '../services/sync.service'
import { MerchantUtils } from '../utils/MerchantUtils'
import { ModalController } from '@ionic/angular'
import { DashboardAndGroupSelectComponent } from '../modals/dashboard-and-group-select/dashboard-and-group-select.component'
import { Period } from '../requests/v2-dashboard'
import { AlertService } from '../services/alert.service'
import { Toast } from '@capacitor/toast'

export const REAPPLY_KEY = 'reapply_notification2'

@Component({
	selector: 'app-tab1',
	templateUrl: 'tab-dashboard.page.html',
	styleUrls: ['tab-dashboard.page.scss'],
})
export class Tab1Page {
	readonly Period = Period

	lastRefreshTs = 0
	overallData: OverviewData2
	currentY = 0
	scrolling = false

	loading: HTMLIonLoadingElement

	constructor(
		private validatorUtils: ValidatorUtils,
		public api: ApiService,
		public updates: ClientUpdateUtils,
		private storage: StorageService,
		private unitConv: UnitconvService,
		private sync: SyncService,
		public merchant: MerchantUtils,
		private modalCtrl: ModalController,
		private alert: AlertService,
		private overviewProvider: OverviewProvider
	) {
		this.validatorUtils.registerListener(() => {
			this.refresh()
		})

		App.addListener('appStateChange', (state: AppState) => {
			if (state.isActive) {
				if (this.lastRefreshTs + 6 * 60 > this.getUnixSeconds()) return
				this.refresh()
			} else {
				console.log('App has become inactive')
			}
		})

		this.reApplyNotifications()
	}

	async changeTimeframe(period: Period) {
		if (!this.overallData) {
			return
		}
		this.storage.setDashboardTimeframe(period)

		const loading = await this.alert.presentLoading('Loading...')
		loading.present()
		const result = await this.overviewProvider.setTimeframe(this.overallData, period)
		if (result[0].error) {
			console.error('Error fetching summary table', result[0].error)
			Toast.show({
				text: 'Error fetching summary table',
			})
		}
		if (result[1].error) {
			console.error('Error fetching summary group', result[1].error)
			Toast.show({
				text: 'Error fetching summary group',
			})
		}
		loading.dismiss()
	}

	async reApplyNotifications() {
		const isLoggedIn = await this.storage.getAuthUser()
		if (!isLoggedIn) return

		const reapply = await this.storage.getBooleanSetting(REAPPLY_KEY, false)
		if (!reapply) {
			this.sync.syncAllSettingsForceStaleNotifications()
		}
		this.storage.setBooleanSetting(REAPPLY_KEY, true)
	}

	onScroll($event) {
		this.currentY = $event.detail.currentY
	}

	onScrollStarted() {
		this.scrolling = true
		this.removeTooltips()
	}

	onScrollEnded() {
		this.scrolling = false
	}

	private removeTooltips() {
		const inputs = Array.from(document.getElementsByTagName('tooltip') as HTMLCollectionOf<HTMLElement>)
		for (let i = 0; i < inputs.length; i++) {
			inputs[i].style.display = 'none'
		}
	}

	ionViewWillEnter() {
		if (this.lastRefreshTs + 6 * 60 > this.getUnixSeconds()) return

		this.refresh()
	}

	async openDashboardAndGroupSelect() {
		const modal = await this.modalCtrl.create({
			component: DashboardAndGroupSelectComponent,
			componentProps: {
				dashboardChangedCallback: () => {
					this.overallData = null
					this.refresh(false)
				},
			},
		})
		modal.present()

		await modal.onWillDismiss()
	}

	async refresh(checkUpdates: boolean = true) {
		if (!(await this.validatorUtils.hasLocalValdiators())) {
			return
		}
		if (checkUpdates) {
			this.updates.checkAllUpdates()
		}
		// const validators = await this.validatorUtils.getAllMyValidators().catch((error) => {
		// 	console.warn('error getAllMyValidators', error)
		// 	return []
		// })

		this.overallData = this.overviewProvider.create(await this.storage.getDashboardID(), await this.storage.getDashboardTimeframe(), {
			aggregation: await this.storage.getDashboardSummaryAggregation(),
			startTime: null,
			force: false,
		} as SummaryChartOptions)

		console.log('overallData', this.overallData)
		this.lastRefreshTs = this.getUnixSeconds()
	}

	getUnixSeconds() {
		return new Date().getTime() / 1000
	}

	async doRefresh(event) {
		const old = Object.assign({}, this.overallData)
		this.overallData = null
		await this.refresh().catch(() => {
			this.api.mayInvalidateOnFaultyConnectionState()
			this.overallData = old
			event.target.complete()
		})
		await this.unitConv.updatePriceData()
		event.target.complete()
	}
}
