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

import { Component, ViewChild } from '@angular/core'
import { ValidatorUtils, Validator, ValidatorState } from '../utils/ValidatorUtils'
import { IonSearchbar, ModalController, Platform } from '@ionic/angular'
import { ValidatordetailPage } from '../pages/validatordetail/validatordetail.page'
import { ApiService } from '../services/api.service'
import { AlertController } from '@ionic/angular'
import { ValidatorResponse } from '../requests/requests'
import { StorageService } from '../services/storage.service'
import { AlertService } from '../services/alert.service'
import { SyncService } from '../services/sync.service'
import { SubscribePage } from '../pages/subscribe/subscribe.page'
import { MerchantUtils } from '../utils/MerchantUtils'

import { Keyboard } from '@capacitor/keyboard'

import ThemeUtils from '../utils/ThemeUtils'

import { UnitconvService } from '../services/unitconv.service'
import { InfiniteScrollDataSource } from '../utils/InfiniteScrollDataSource'
import { trigger, style, animate, transition } from '@angular/animations'
import { DashboardAndGroupSelectComponent } from '../modals/dashboard-and-group-select/dashboard-and-group-select.component'
@Component({
	selector: 'app-tab2',
	templateUrl: 'tab-validators.page.html',
	styleUrls: ['tab-validators.page.scss'],
	animations: [trigger('fadeIn', [transition(':enter', [style({ opacity: 0 }), animate('300ms 100ms', style({ opacity: 1 }))])])],
})
export class Tab2Page {
	dataSource: InfiniteScrollDataSource<Validator>

	public classReference = UnitconvService

	searchResultMode = false
	loading = false

	reachedMaxValidators = false

	isLoggedIn = false

	initialized = false

	@ViewChild('searchbarRef', { static: true }) searchbarRef: IonSearchbar

	constructor(
		private validatorUtils: ValidatorUtils,
		public modalController: ModalController,
		public api: ApiService,
		private alertController: AlertController,
		private storage: StorageService,
		private alerts: AlertService,
		private sync: SyncService,
		public merchant: MerchantUtils,
		private themeUtils: ThemeUtils,
		private platform: Platform,
		public unit: UnitconvService,
		private modalCtrl: ModalController
	) {
		this.validatorUtils.registerListener(() => {
			if (this.searchResultMode && this.searchbarRef) {
				this.searchResultMode = false
				this.searchbarRef.value = null
			}
			this.refresh()
		})

		this.dataSource = new InfiniteScrollDataSource<Validator>(InfiniteScrollDataSource.ALL_ITEMS_AT_ONCE, this.getDefaultDataRetriever())
	}

	ngOnInit() {
		this.refresh()
	}

	async openDashboardAndGroupSelect() {
		const modal = await this.modalCtrl.create({
			component: DashboardAndGroupSelectComponent,
			componentProps: {
				dashboardChangedCallback: () => {
					// todo
				},
			},
		})
		modal.present()

		await modal.onWillDismiss()
	}

	private async refresh() {
		this.reachedMaxValidators = false
		this.storage.isLoggedIn().then((result) => (this.isLoggedIn = result))

		if (!this.searchResultMode) {
			this.dataSource.setLoadFrom(this.getDefaultDataRetriever())
		}
		await this.dataSource.reset()
	}

	async syncRemote() {
		const loading = await this.alerts.presentLoading('Syncing...')
		loading.present()
		this.sync.fullSync()
		setTimeout(() => {
			loading.dismiss()
		}, 2000)
	}

	private getDefaultDataRetriever() {
		return () => {
			return this.getValidatorData()
		}
	}

	private async getValidatorData() {
		this.searchResultMode = false

		if (!(await this.validatorUtils.hasLocalValdiators())) {
			this.initialized = true
			return []
		}

		this.setLoading(true)

		let temp = await this.validatorUtils.getAllMyValidators().catch((error) => {
			console.warn('error getAllMyValidators', error)
			return [] as Validator[]
		})

		temp = temp.sort((a, b) => {
			if (a.state == ValidatorState.SLASHED && b.state != ValidatorState.SLASHED) {
				return -1
			}
			if (b.state == ValidatorState.SLASHED && a.state != ValidatorState.SLASHED) {
				return 1
			}

			if (a.state == ValidatorState.OFFLINE && b.state == ValidatorState.OFFLINE) {
				return -1
			}
			if (b.state == ValidatorState.OFFLINE && a.state == ValidatorState.OFFLINE) {
				return 1
			}

			if (a.state == ValidatorState.WAITING && b.state == ValidatorState.WAITING) {
				return -1
			}
			if (b.state == ValidatorState.WAITING && a.state == ValidatorState.WAITING) {
				return 1
			}

			if (a.index > b.index) {
				return 1
			} else if (a.index == b.index) {
				return 0
			} else {
				return -1
			}
		})
		this.setLoading(false)
		return temp
	}

	private setLoading(loading: boolean) {
		if (loading) {
			if (!this.dataSource || !this.dataSource.hasItems()) {
				this.loading = true
			}
		} else {
			if (this.loading) {
				setTimeout(() => {
					this.initialized = true
					this.loading = false
				}, 350)
			} else {
				this.initialized = true
				this.loading = false
			}
		}
	}

	removeAllDialog() {
		this.showDialog('Remove all', 'Do you want to remove {AMOUNT} validators from your dashboard?', () => {
			this.confirmRemoveAll()
		})
	}

	addAllDialog() {
		this.showDialog('Add all', 'Do you want to add {AMOUNT} validators to your dashboard?', () => {
			this.confirmAddAll()
		})
	}

	private async showDialog(title, text, action: () => void) {
		const size = this.dataSource.length()
		const alert = await this.alertController.create({
			header: title,
			message: text.replace('{AMOUNT}', size + ''),
			buttons: [
				{
					text: 'Cancel',
					role: 'cancel',
					cssClass: 'secondary',
				},
				{
					text: 'Yes',
					handler: action,
				},
			],
		})

		await alert.present()
	}

	async confirmRemoveAll() {
		await this.validatorUtils.deleteAll()
		await this.dataSource.reset()
	}

	async confirmAddAll() {
		const responses: ValidatorResponse[] = []
		this.dataSource.getItems().forEach((item) => {
			responses.push(item.data)
		})

		await this.validatorUtils.convertToValidatorModelsAndSaveLocal(false, responses)
		await this.dataSource.reset()
	}

	searchEvent(event) {
		this.searchFor(event.target.value)
	}

	async searchFor(searchString) {
		if (!searchString || searchString.length < 0) return
		if (this.platform.is('ios') || this.platform.is('android')) {
			Keyboard.hide()
		}

		this.searchResultMode = true
		this.loading = true
		const isETH1Address = searchString.startsWith('0x') && searchString.length == 42
		const isWithdrawalCredential = searchString.startsWith('0x') && searchString.length == 66

		if (isETH1Address || isWithdrawalCredential) await this.searchETH1(searchString)
		else await this.searchByPubKeyOrIndex(searchString)

		// this.loading = false would be preferable here but somehow the first time it is called the promises resolve instantly without waiting
		// but it works for any subsequent calls ¯\_(ツ)_/¯
		// workaround for now is to set it in searchETH1 and searchByPubKeyOrIndex
	}

	private async searchByPubKeyOrIndex(target) {
		this.dataSource.setLoadFrom(() => {
			return this.validatorUtils
				.searchValidators(target)
				.catch((error) => {
					console.warn('search error', error)
					return []
				})
				.then((result) => {
					this.loading = false
					return result
				})
		})
		return await this.dataSource.reset()
	}

	private async searchETH1(target) {
		this.dataSource.setLoadFrom(() => {
			return this.validatorUtils
				.searchValidatorsViaETHAddress(target)
				.catch(async (error) => {
					if (error && error.message && error.message.indexOf('only a maximum of') > 0) {
						console.log('SET reachedMaxValidators to true')
						this.reachedMaxValidators = true
						return this.validatorUtils.searchValidatorsViaETHAddress(target, this.merchant.getCurrentPlanMaxValidator())
					}
					return []
				})
				.then((result) => {
					this.loading = false
					return result
				})
		})
		return await this.dataSource.reset()
	}

	cancelSearch() {
		if (this.searchResultMode) {
			this.searchResultMode = false
			this.refresh()
		}
	}

	async doRefresh(event) {
		await this.refresh().catch(() => {
			this.api.mayInvalidateOnFaultyConnectionState()
			event.target.complete()
		})
		event.target.complete()
	}

	async presentModal(item: Validator) {
		const modal = await this.modalController.create({
			component: ValidatordetailPage,
			cssClass: 'my-custom-class',
			componentProps: {
				item: item,
			},
		})
		return await modal.present()
	}

	async upgrade() {
		const modal = await this.modalController.create({
			component: SubscribePage,
			cssClass: 'my-custom-class',
			componentProps: {
				tab: 'dolphin',
			},
		})
		return await modal.present()
	}

	clickValidator(item: Validator) {
		this.presentModal(item)
	}

	// getValidatorsByIndex(indexMap): Validator[] {
	// 	const result = []
	// 	indexMap.forEach((value, key) => {
	// 		const temp = this.dataSource.getItems().find((item) => {
	// 			return item.index == key
	// 		})
	// 		if (temp) {
	// 			result.push(temp)
	// 		}
	// 	})
	// 	return result
	// }
}
