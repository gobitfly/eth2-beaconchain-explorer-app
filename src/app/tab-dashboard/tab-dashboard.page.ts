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

import { Component, OnInit } from '@angular/core'
import { ApiService } from '../services/api.service'
import { DashboardError, DashboardNotFoundError, OverviewData2, OverviewProvider, SummaryChartOptions } from '../controllers/OverviewController'
import ClientUpdateUtils from '../utils/ClientUpdateUtils'
import { StorageService } from '../services/storage.service'
import { UnitconvService } from '../services/unitconv.service'
import { App, AppState } from '@capacitor/app'
import { MerchantUtils } from '../utils/MerchantUtils'
import { ModalController } from '@ionic/angular'
import { DashboardAndGroupSelectComponent } from '../modals/dashboard-and-group-select/dashboard-and-group-select.component'
import { dashboardID, Period } from '../requests/v2-dashboard'
import { AlertService } from '../services/alert.service'
import { Toast } from '@capacitor/toast'
import { DashboardUtils } from '../utils/DashboardUtils'

export const REAPPLY_KEY = 'reapply_notification2'

const DASHBOARD_UPDATE = 'dashboard_update'
const ASSOCIATED_CACHE_KEY = 'dashboard'

@Component({
	selector: 'app-tab1',
	templateUrl: 'tab-dashboard.page.html',
	styleUrls: ['tab-dashboard.page.scss'],
})
export class Tab1Page implements OnInit {
	readonly Period = Period

	lastRefreshTs = 0
	overallData: OverviewData2
	currentY = 0
	scrolling = false
	isLoggedIn = false
	dashboardID: dashboardID = null

	loading: boolean = true

	constructor(
		public api: ApiService,
		public updates: ClientUpdateUtils,
		private storage: StorageService,
		private unitConv: UnitconvService,
		public merchant: MerchantUtils,
		private modalCtrl: ModalController,
		private alert: AlertService,
		private overviewProvider: OverviewProvider,
		private dashboardUtils: DashboardUtils
	) {
		this.dashboardUtils.dashboardAwareListener.register(DASHBOARD_UPDATE)
		App.addListener('appStateChange', (state: AppState) => {
			if (state.isActive) {
				if (this.lastRefreshTs + 6 * 60 > this.getUnixSeconds()) return
				this.setup(false)
			} else {
				console.log('App has become inactive')
			}
		})
	}

	ngOnInit() {}

	ionViewWillEnter() {
		if (this.dashboardUtils.dashboardAwareListener.hasAndConsume(DASHBOARD_UPDATE)) {
			this.setup(false, true)
			return
		}

		if (this.lastRefreshTs + 6 * 60 > this.getUnixSeconds()) return
		this.setup()
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

	async openDashboardAndGroupSelect() {
		const modal = await this.modalCtrl.create({
			component: DashboardAndGroupSelectComponent,
			componentProps: {
				dashboardChangedCallback: () => {
					this.overallData = null
					this.setup(false)
				},
			},
		})
		modal.present()

		await modal.onWillDismiss()
	}

	async setup(checkUpdates: boolean = true, force: boolean = false, recursiveMax = false) {
		if (checkUpdates) {
			this.updates.checkAllUpdates()
		}
		this.isLoggedIn = await this.storage.isLoggedIn()
		this.dashboardID = await this.dashboardUtils.initDashboard()

		this.loading = true
		try {
			this.overallData = await this.overviewProvider.create(
				this.dashboardID,
				await this.storage.getDashboardTimeframe(),
				{
					aggregation: await this.storage.getDashboardSummaryAggregation(),
					startTime: null,
					force: false,
				} as SummaryChartOptions,
				ASSOCIATED_CACHE_KEY
			)
		} catch (e) {
			if (e instanceof DashboardNotFoundError) {
				if (recursiveMax) {
					Toast.show({
						text: 'Dashboard not found',
					})
					return
				}
				// if dashboard is not available any more (maybe user deleted it) reinit and try again
				this.dashboardID = await this.dashboardUtils.initDashboard()
				return this.setup(false, force, true)
			} else if (e instanceof DashboardError) {
				this.dashboardUtils.defaultDashboardErrorHandler(e)
			} else {
				console.error(e)
				Toast.show({
					text: 'Error loading dashboard',
				})
			}
		}
		this.loading = false

		console.log('overallData', this.overallData)
		this.lastRefreshTs = this.getUnixSeconds()
	}

	getUnixSeconds() {
		return new Date().getTime() / 1000
	}

	private lastRefreshedTs: number = 0
	async doRefresh(event) {
		if (this.lastRefreshedTs + 60 * 1000 > new Date().getTime()) {
			Toast.show({
				text: 'Nothing to update',
			})
			event.target.complete()
			return
		}
		this.lastRefreshedTs = new Date().getTime()

		const old = Object.assign({}, this.overallData)
		this.overviewProvider.clearRequestCache(this.overallData)
		this.overallData = null
		await this.setup(true, true).catch(() => {
			this.api.mayInvalidateOnFaultyConnectionState()
			this.overallData = old
			event.target.complete()
		})
		await this.unitConv.updatePriceData()
		event.target.complete()
	}
}
