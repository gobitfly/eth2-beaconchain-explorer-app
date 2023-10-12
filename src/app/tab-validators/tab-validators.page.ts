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

import { Component } from '@angular/core'
import { ValidatorUtils, Validator, ValidatorState } from '../utils/ValidatorUtils'
import { ModalController, Platform } from '@ionic/angular'
import { ValidatordetailPage } from '../pages/validatordetail/validatordetail.page'
import { ApiService } from '../services/api.service'
import { AlertController } from '@ionic/angular'
import { ValidatorResponse } from '../requests/requests'
import { StorageService } from '../services/storage.service'
import { AlertService } from '../services/alert.service'
import { SyncService } from '../services/sync.service'
import BigNumber from 'bignumber.js'
import { SubscribePage } from '../pages/subscribe/subscribe.page'
import { MerchantUtils } from '../utils/MerchantUtils'

import { Keyboard } from '@capacitor/keyboard'

import { Toast } from '@capacitor/toast'
import ThemeUtils from '../utils/ThemeUtils'

import { Haptics } from '@capacitor/haptics'
import { UnitconvService } from '../services/unitconv.service'
import { InfiniteScrollDataSource } from '../utils/InfiniteScrollDataSource'
import { trigger, style, animate, transition } from '@angular/animations'
@Component({
	selector: 'app-tab2',
	templateUrl: 'tab-validators.page.html',
	styleUrls: ['tab-validators.page.scss'],
	animations: [
		trigger('fadeIn', [
			transition(':enter', [style({ opacity: 0 }),animate('300ms 100ms', style({ opacity: 1 }))]),
		]),
	],
})
export class Tab2Page {
	dataSource: InfiniteScrollDataSource<Validator>

	public classReference = UnitconvService

	searchResultMode = false
	loading = false

	reachedMaxValidators = false

	isLoggedIn = false

	initialized = false

	currentPackageMaxValidators = 100

	selectMode = false

	selected = new Map<number, boolean>()

	constructor(
		private validatorUtils: ValidatorUtils,
		public modalController: ModalController,
		public api: ApiService,
		private alertController: AlertController,
		private storage: StorageService,
		private alerts: AlertService,
		private sync: SyncService,
		private merchant: MerchantUtils,
		private themeUtils: ThemeUtils,
		private platform: Platform,
		public unit: UnitconvService
	) {
		this.validatorUtils.registerListener(() => {
			this.refresh()
		})
		this.merchant.getCurrentPlanMaxValidator().then((result) => {
			this.currentPackageMaxValidators = result
		})

		this.dataSource = new InfiniteScrollDataSource<Validator>(InfiniteScrollDataSource.ALL_ITEMS_AT_ONCE, this.getDefaultDataRetriever())
	}

	ngOnInit() {
		this.refresh()
	}

	private async refresh() {
		this.reachedMaxValidators = false
		this.storage.isLoggedIn().then((result) => (this.isLoggedIn = result))

		if (!this.searchResultMode) {
			this.dataSource.setLoadFrom(this.getDefaultDataRetriever())
		}
		this.dataSource.reset()
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
			// Reasoning: Don't show loading indicator if it takes less than 400ms (already cached locally but storage is slow-ish so we adjust for that)
			setTimeout(() => {
				if (!this.dataSource || !this.dataSource.hasItems()) {
					this.loading = true
				}
			}, 200)
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

	async removeAllDialog() {
		this.showDialog('Remove all', 'Do you want to remove {AMOUNT} validators from your dashboard?', () => {
			this.confirmRemoveAll()
		})
	}

	async addAllDialog() {
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
		this.validatorUtils.deleteAll()
		this.dataSource.reset()
	}

	async confirmAddAll() {
		const responses: ValidatorResponse[] = []
		this.dataSource.getItems().forEach(async (item) => {
			responses.push(item.data)
		})

		this.validatorUtils.convertToValidatorModelsAndSaveLocal(false, responses)
		this.dataSource.reset()
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

		if (isETH1Address) await this.searchETH1(searchString)
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
				.searchValidatorsViaETH1(target)
				.catch(async (error) => {
					if (error && error.message && error.message.indexOf('only a maximum of') > 0) {
						console.log('SET reachedMaxValidators to true')
						this.reachedMaxValidators = true
						return this.validatorUtils.searchValidatorsViaETH1(target, this.currentPackageMaxValidators - 1)
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

	ionViewDidLeave() {
		this.validatorUtils.notifyListenersIfDeletedWithoutNotifying()
		this.sync.mightSyncUpAndSyncDelete()
	}

	async upgrade() {
		const modal = await this.modalController.create({
			component: SubscribePage,
			cssClass: 'my-custom-class',
			componentProps: {
				tab: 'whale',
			},
		})
		return await modal.present()
	}

	private clickBlocked = false
	blockClick(forTime) {
		this.clickBlocked = true
		setTimeout(() => {
			this.clickBlocked = false
		}, forTime)
	}

	selectValidator(item: Validator) {
		this.selectMode = !this.selectMode
		if (!this.selectMode) {
			this.cancelSelect()
		} else {
			this.blockClick(250)
			const color = getComputedStyle(document.body).getPropertyValue('--ion-color-primary')
			this.themeUtils.setStatusBarColor(color)
			Haptics.selectionStart()

			if (item) {
				this.selected.set(item.index, true)
				Haptics.selectionChanged()
			}
		}
	}

	clickValidator(item: Validator) {
		if (this.clickBlocked) return
		if (this.selectMode) {
			if (this.selected.get(item.index)) {
				this.selected.delete(item.index)
			} else {
				this.selected.set(item.index, true)
			}
			Haptics.selectionChanged()
		} else {
			this.presentModal(item)
		}
	}

	cancelSelect() {
		this.selectMode = false
		this.selected = new Map<number, boolean>()
		this.themeUtils.revertStatusBarColor()
		Haptics.selectionEnd()
	}

	getValidatorsByIndex(indexMap): Validator[] {
		const result = []
		indexMap.forEach((value, key) => {
			const temp = this.dataSource.getItems().find((item) => {
				return item.index == key
			})
			if (temp) {
				result.push(temp)
			}
		})
		return result
	}

	/**
	 * Returns the current stake share for the provided validator set. Returns the stake share if all share the same or null otherwise.
	 * @param subArray
	 */
	getCurrentShare(subArray: Validator[]): number {
		if (subArray.length <= 0) return null
		const lastShare = subArray[0].share
		for (let i = 1; i < subArray.length; i++) {
			if (lastShare != subArray[i].share) return null
		}
		return lastShare
	}

	getCurrentELShare(subArray: Validator[]): number {
		if (subArray.length <= 0) return null
		const lastShare = subArray[0].execshare
		for (let i = 1; i < subArray.length; i++) {
			if (lastShare != subArray[i].execshare) return null
		}
		return lastShare
	}

	async setRPLShares() {
		if (this.selected.size <= 0) {
			Toast.show({
				text: 'Select the validators you want to apply this setting to.',
			})
			return
		}

		const validatorSubArray = this.getValidatorsByIndex(this.selected).filter((item) => {
			return item.rocketpool != null
		})

		if (validatorSubArray.length <= 0) {
			console.log('You did not select any Rocketpool validator.')
			Toast.show({
				text: 'You did not select any Rocketpool validator.',
			})
			return
		}

		const onlyOneNodeAddress = validatorSubArray.reduce((prev, cur) => {
			return prev && prev.rocketpool.node_address == cur.rocketpool.node_address ? cur : null
		})
		if (!onlyOneNodeAddress) {
			console.log('You selected validators belonging to multiple node addresses. Currently only one at a time can be edited.')
			Toast.show({
				text: 'You selected validators belonging to multiple node addresses. Currently only one at a time can be edited.',
			})
			return
		}

		const minShareStake = 0
		const maxStakeShare = new BigNumber(onlyOneNodeAddress.rocketpool.node_rpl_stake).dividedBy(new BigNumber(1e18)).decimalPlaces(2)

		const currentShares = await this.validatorUtils.getRocketpoolCollateralShare(onlyOneNodeAddress.rocketpool.node_address)
		let current = null
		if (currentShares) {
			current = new BigNumber(currentShares).multipliedBy(new BigNumber(maxStakeShare)).decimalPlaces(4)
		}

		console.log('change RPL', onlyOneNodeAddress, current, maxStakeShare)

		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: 'Define RPL share',
			message:
				'If you own partial amounts of the collateral of the selected Rocketpool node address (' +
				onlyOneNodeAddress.rocketpool.node_address.substring(0, 8) +
				'), specify the amount of RPL for a custom dashboard.',
			inputs: [
				{
					name: 'share',
					type: 'number',
					placeholder: minShareStake + ' - ' + maxStakeShare + ' RPL',
					value: current,
				},
			],
			buttons: [
				{
					text: 'Remove',
					handler: async () => {
						this.validatorUtils.saveRocketpoolCollateralShare(onlyOneNodeAddress.rocketpool.node_address, null)
						this.cancelSelect()
						this.validatorUtils.notifyListeners()
					},
				},
				{
					text: 'Save',
					handler: async (alertData) => {
						const shares = alertData.share
						if (shares < minShareStake) {
							Toast.show({
								text: 'Share must be at least ' + minShareStake + ' RPL or more.',
							})
							return
						}

						if (shares > maxStakeShare.toNumber()) {
							Toast.show({
								text: 'Share amount is higher than your RPL collateral.',
							})
							return
						}

						const share = new BigNumber(alertData.share).div(new BigNumber(maxStakeShare))
						this.validatorUtils.saveRocketpoolCollateralShare(onlyOneNodeAddress.rocketpool.node_address, share.toNumber())

						this.cancelSelect()
						this.validatorUtils.notifyListeners()
					},
				},
			],
		})

		await alert.present()
	}

	async setShares() {
		if (this.selected.size <= 0) {
			Toast.show({
				text: 'Select the validators you want to apply this setting to.',
			})
			return
		}

		const validatorSubArray = this.getValidatorsByIndex(this.selected)
		console.log('selected', this.selected, validatorSubArray)

		let sum = new BigNumber('0')
		for (const val of validatorSubArray) {
			let temp = new BigNumber(val.data.effectivebalance)
			if (val.rocketpool) {
				temp = temp.dividedBy(2)
			}
			sum = sum.plus(temp)
		}

		const minShareStake = 0
		const maxStakeShare = sum.dividedBy(1e9).decimalPlaces(0).toNumber()

		const current = new BigNumber(this.getCurrentShare(validatorSubArray)).multipliedBy(new BigNumber(maxStakeShare)).decimalPlaces(4)

		const currentEL = new BigNumber(this.getCurrentELShare(validatorSubArray)).multipliedBy(new BigNumber(maxStakeShare)).decimalPlaces(4)

		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: 'Define stake share',
			message:
				'If you own partial amounts of these validators, specify the amount of ether for a custom dashboard. First value defines your consensus share, second value your execution share.',
			inputs: [
				{
					name: 'share',
					type: 'number',
					placeholder: 'Consensus Share (' + minShareStake + ' - ' + maxStakeShare + ' ETH)',
					value: current,
				},
				{
					name: 'execshare',
					type: 'number',
					placeholder: 'Execution Share (' + minShareStake + ' - ' + maxStakeShare + ' ETH)',
					value: currentEL,
				},
			],
			buttons: [
				{
					text: 'Remove',
					handler: async () => {
						for (let i = 0; i < validatorSubArray.length; i++) {
							validatorSubArray[i].share = null
							validatorSubArray[i].execshare = null
						}
						this.validatorUtils.saveValidatorsLocal(validatorSubArray)
						this.cancelSelect()
						this.validatorUtils.notifyListeners()
					},
				},
				{
					text: 'Save',
					handler: async (alertData) => {
						const shares = alertData.share
						const sharesEL = alertData.execshare
						if ((shares && shares < minShareStake) || (sharesEL && sharesEL < minShareStake)) {
							Toast.show({
								text: 'Share must be at least ' + minShareStake + ' ETH or more',
							})
							return
						}

						if ((shares && shares > maxStakeShare) || (sharesEL && shares > maxStakeShare)) {
							Toast.show({
								text: 'Share amount is higher than all of your added validators.',
							})
							return
						}

						const share = new BigNumber(alertData.share).div(new BigNumber(maxStakeShare))
						const shareEL = new BigNumber(alertData.execshare).div(new BigNumber(maxStakeShare))

						for (let i = 0; i < validatorSubArray.length; i++) {
							if (shares && !share.isNaN()) {
								validatorSubArray[i].share = share.toNumber()
							}
							if (shareEL && !shareEL.isNaN()) {
								validatorSubArray[i].execshare = shareEL.toNumber()
							}
						}

						this.validatorUtils.saveValidatorsLocal(validatorSubArray)

						this.cancelSelect()
						this.validatorUtils.notifyListeners()
					},
				},
			],
		})

		await alert.present()
	}

	switchCurrencyPipe() {
		if (this.unit.pref == 'ETHER') {
			if (UnitconvService.currencyPipe == null) return
			this.unit.pref = UnitconvService.currencyPipe
		} else {
			UnitconvService.currencyPipe = this.unit.pref
			this.unit.pref = 'ETHER'
		}
	}
}
