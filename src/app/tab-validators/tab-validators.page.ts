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

import { Component, computed, signal, ViewChild, WritableSignal } from '@angular/core'
import { Validator } from '../utils/ValidatorUtils'
import { IonSearchbar, ModalController, Platform } from '@ionic/angular'
import { ValidatordetailPage } from '../pages/validatordetail/validatordetail.page'
import { ApiService, capitalize } from '../services/api.service'
import { AlertController } from '@ionic/angular'
import { StorageService } from '../services/storage.service'
import { AlertService } from '../services/alert.service'
import { SubscribePage } from '../pages/subscribe/subscribe.page'
import { MerchantUtils } from '../utils/MerchantUtils'

import { Keyboard } from '@capacitor/keyboard'

import ThemeUtils from '../utils/ThemeUtils'

import { UnitconvService } from '../services/unitconv.service'
import { InfiniteScrollDataSource, loadMoreType } from '../utils/InfiniteScrollDataSource'
import { trigger, style, animate, transition } from '@angular/animations'
import { DashboardAndGroupSelectComponent } from '../modals/dashboard-and-group-select/dashboard-and-group-select.component'
import {
	dashboardID,
	V2AddDashboardGroup,
	V2AddValidatorToDashboard,
	V2AddValidatorToDashboardData,
	V2DashboardOverview,
	V2DeleteDashboardGroup,
	V2DeleteValidatorFromDashboard,
	V2GetValidatorFromDashboard,
	V2UpdateDashboardGroup,
} from '../requests/v2-dashboard'
import { VDBManageValidatorsTableRow, VDBOverviewData, VDBOverviewGroup } from '../requests/types/validator_dashboard'
import { Toast } from '@capacitor/toast'
import { Haptics } from '@capacitor/haptics'
import { searchType, V2SearchValidators } from '../requests/search'
import { SearchResult } from '../requests/types/common'

const PAGE_SIZE = 20
@Component({
	selector: 'app-tab2',
	templateUrl: 'tab-validators.page.html',
	styleUrls: ['tab-validators.page.scss'],
	animations: [trigger('fadeIn', [transition(':enter', [style({ opacity: 0 }), animate('300ms 100ms', style({ opacity: 1 }))])])],
})
export class Tab2Page {
	dataSource: InfiniteScrollDataSource<VDBManageValidatorsTableRow>

	public classReference = UnitconvService

	searchResultMode = false
	searchResult: SearchResult[] = null

	loading = false

	reachedMaxValidators = false

	isLoggedIn = false

	initialized = false

	@ViewChild('searchbarRef', { static: true }) searchbarRef: IonSearchbar

	dashboardData: WritableSignal<VDBOverviewData> = signal(null)

	private dashboardID: dashboardID

	selectedGroup: number

	validatorLoader: ValidatorLoader = null

	selectMode: boolean = false
	selected = new Map<number, boolean>()

	searchResultHandler = new SeachResultHandler()

	loadMore = false

	constructor(
		public modalController: ModalController,
		public api: ApiService,
		private alertController: AlertController,
		private storage: StorageService,
		private alerts: AlertService,
		public merchant: MerchantUtils,
		private themeUtils: ThemeUtils,
		private platform: Platform,
		public unit: UnitconvService,
		private modalCtrl: ModalController
	) {
		this.initForDashboard()
	}

	async initForDashboard(force: boolean = false) {
		this.selectMode = false
		this.selected = new Map<number, boolean>()
		this.searchResult = null
		this.searchResultMode = false
		if (this.searchbarRef) {
			this.searchbarRef.value = ''
		}

		this.isLoggedIn = await this.storage.isLoggedIn()

		await this.merchant.getUserInfo(false)
		const id = await this.storage.getDashboardID()
		this.dashboardID = id

		const refreshGroupsResult = await this.refreshGroups(force)
		if (refreshGroupsResult.error) {
			Toast.show({
				text: 'Could not load groups',
			})
			return
		}

		if (!this.selectedGroup) {
			this.selectedGroup = this.groups()?.[0]?.id ?? 0
		}

		await this.refreshValidators(force)
	}

	async openDashboardAndGroupSelect() {
		const modal = await this.modalCtrl.create({
			component: DashboardAndGroupSelectComponent,
			componentProps: {
				dashboardChangedCallback: async () => {
					const loading = await this.alerts.presentLoading('Loading...')
					loading.present()
					await this.initForDashboard()
					loading.dismiss()
				},
			},
		})
		modal.present()

		await modal.onWillDismiss()
	}

	private refreshGroups(force: boolean = false) {
		if (!this.isLoggedIn) {
			return
		}
		return this.api.set(new V2DashboardOverview(this.dashboardID).withAllowedCacheResponse(!force), this.dashboardData)
	}

	private async refreshValidators(force: boolean = false) {
		this.reachedMaxValidators = false
		this.validatorLoader = new ValidatorLoader(this.api, this.dashboardID, this.selectedGroup, force)
		this.dataSource = new InfiniteScrollDataSource<VDBManageValidatorsTableRow>(PAGE_SIZE, this.getDefaultDataRetriever())

		await this.dataSource.reset()
	}

	private getDefaultDataRetriever(): loadMoreType<VDBManageValidatorsTableRow> {
		return async (cursor) => {
			// todo no account handling
			if (!this.isLoggedIn) {
				this.initialized = true
				return {
					data: [],
					next_cursor: null,
				}
			}
			const firstRun = !cursor && this.initialized
			if (firstRun) {
				this.loading = true
			}

			this.loadMore = !!cursor
			const result = await this.validatorLoader.getDefaultDataRetriever()(cursor)
			this.loadMore = false

			if (firstRun) {
				this.loading = false
				this.initialized = true
			}
			return result
		}
	}

	async searchEvent(event) {
		const searchString = event.target.value
		if (!searchString || searchString.length < 0) return
		if (this.platform.is('ios') || this.platform.is('android')) {
			Keyboard.hide()
		}

		this.searchResultMode = true
		const isETH1Address = searchString.startsWith('0x') && searchString.length == 42
		const isWithdrawalCredential = searchString.startsWith('0x') && searchString.length == 66
		const isPubkey = searchString.startsWith('0x') && searchString.length == 98

		const isAllHexadecimal = /^[0-9a-fA-F]+$/.test(searchString) && searchString.length % 2 == 0 && searchString.length > 10

		// a bit of optimization so search is faster than just scanning for all types
		let searchTypes: searchType[] = undefined
		if (isETH1Address) {
			searchTypes = [searchType.validatorsByWithdrawalAddress, searchType.validatorsByDepositAddress]
		} else if (isWithdrawalCredential) {
			searchTypes = [searchType.validatorsByWithdrawalCredential]
		} else if (isPubkey) {
			searchTypes = [searchType.validatorByPublicKey]
		} else if (isAllHexadecimal) {
			searchTypes = [
				searchType.validatorsByWithdrawalAddress,
				searchType.validatorsByDepositAddress,
				searchType.validatorsByWithdrawalCredential,
				searchType.validatorByPublicKey,
			]
		} else {
			searchTypes = [searchType.validatorByIndex, searchType.validatorsByDepositEnsName, searchType.validatorsByWithdrawalEns]
		}

		// todo network from dashboard
		const result = await this.api.execute2(new V2SearchValidators(searchString, ['holesky'], searchTypes))
		if (result.error) {
			Toast.show({
				text: 'Could not search for validators',
				duration: 'long',
			})
			return
		}

		this.searchResult = result.data
	}

	addSearchResult(item: SearchResult) {
		let addInfo = ''
		let title = 'Add validator'
		if (this.searchResultHandler.searchNumFieldIsIndex(item)) {
			addInfo = 'validator with index ' + item.num_value
		} else if (item.num_value > 1) {
			addInfo = item.num_value + ' validators'
			title = 'Add validators'
		} else {
			addInfo = item.num_value + ' validator'
		}

		const targetGroup = this.findGroupById(this.selectedGroup)
		if (!targetGroup) {
			Toast.show({
				text: 'Could not find target group',
				duration: 'long',
			})
			return
		}

		this.alerts.confirmDialog(title, 'Do you want to add ' + addInfo + ' to group "' + targetGroup.name + '"?', 'Add', () => {
			this.confirmAddSearchResult(item, targetGroup.id)
		})
	}

	async confirmAddSearchResult(item: SearchResult, groupID: number) {
		const loading = await this.alerts.presentLoading('Adding validators...')
		loading.present()

		const result = await this.api.execute2(
			new V2AddValidatorToDashboard(this.dashboardID, {
				group_id: groupID,
				validators: this.searchResultHandler.getAddByIndex(item),
				deposit_address: this.searchResultHandler.getAddByDepositAddress(item),
				withdrawal_address: this.searchResultHandler.getAddByWithdrawalAddress(item),
				graffiti: undefined,
			} as V2AddValidatorToDashboardData)
		)
		if (result.error) {
			Toast.show({
				text: 'Could not add validator to dashboard',
				duration: 'long',
			})
		}
		await this.initForDashboard(true)

		loading.dismiss()
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
			this.blockClick(330)
			const color = getComputedStyle(document.body).getPropertyValue('--ion-color-primary')
			this.themeUtils.setStatusBarColor(color)
			Haptics.selectionStart()

			if (item) {
				this.selected.set(item.index, true)
				Haptics.selectionChanged()
			}
		}
	}

	deleteSelected() {
		if (this.selected.size <= 0) {
			Toast.show({
				text: 'Select the validators you want to apply this setting to.',
			})
			return
		}

		this.alerts.confirmDialog(
			'Remove validators',
			'Do you want to remove the selected validators from your dashboard?',
			'Delete',
			() => {
				this.alerts.confirmDialogReverse(
					'Are you really sure?',
					'Please note that this action can <b>NOT</b> be undone.<br/><br/><strong>Delete: </strong>' + this.selected.size + ' validators',
					'Delete',
					() => this.deleteConfirm(Array.from(this.selected.keys())),
					'error-btn'
				)
			},
			'error-btn'
		)
	}

	async deleteConfirm(index: number[]) {
		const loading = await this.alerts.presentLoading('Removing validators...')
		loading.present()
		const result = await this.api.execute2(new V2DeleteValidatorFromDashboard(this.dashboardID, index))
		if (result.error) {
			Toast.show({
				text: 'Could not remove validator from dashboard',
				duration: 'long',
			})
		} else {
			await this.initForDashboard(true)
			loading.dismiss()
			Toast.show({
				text: 'Validators removed from dashboard',
				duration: 'short',
			})
		}
	}

	moveSelected() {}

	cancelSearch() {
		if (this.searchResultMode) {
			this.searchResultMode = false
			this.refreshValidators()
		}
	}

	async doRefresh(event) {
		await this.refreshValidators().catch(() => {
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
		if (this.clickBlocked) return
		if (this.selectMode) {
			if (this.selected.get(item.index)) {
				this.selected.delete(item.index)
			} else {
				this.selected.set(item.index, true)
			}
			Haptics.selectionChanged()
		} else {
			//this.presentModal(item)
		}
	}

	cancelSelect() {
		this.selectMode = false
		this.selected = new Map<number, boolean>()
		this.themeUtils.revertStatusBarColor()
		Haptics.selectionEnd()
	}

	// ------------ GROUPS ------------

	groups = computed(() => {
		return this.dashboardData()
			?.groups.sort((a, b) => a.id - b.id)
			.map((group) => {
				return {
					id: group.id,
					count: group.count,
					name: group.name == 'default' && group.id == 0 ? 'Default Group' : capitalize(group.name),
					realName: group.name,
				}
			})
	})

	selectGroup() {
		this.refreshValidators(false)
	}

	findGroupById(id: number) {
		return this.groups().find((group) => group.id == id)
	}

	async renameGroupDialog() {
		if (!this.notLoggedInGroupInfoDialog()) {
			return
		}
		const renameGroup = this.findGroupById(this.selectedGroup)

		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: 'Rename Group',
			inputs: [
				{
					name: 'newName',
					type: 'text',
					value: renameGroup.realName,
					placeholder: 'New group name',
				},
			],
			buttons: [
				{
					text: 'Cancel',
					role: 'cancel',
					cssClass: 'secondary',
					handler: () => {
						return
					},
				},
				{
					text: 'Rename',
					handler: async (alertData) => {
						if (alertData.newName.length < 1) {
							Toast.show({
								text: 'Please enter a name',
							})
							return false
						}

						const loading = await this.alerts.presentLoading('Applying changes...')
						loading.present()

						const result = await this.api.execute2(new V2UpdateDashboardGroup(this.dashboardID, renameGroup.id, alertData.newName))
						if (result.error) {
							Toast.show({
								text: 'Error creating group, please try again later',
							})
						} else {
							Toast.show({
								text: 'Group renamed',
							})
							const refreshGroupsResult = await this.refreshGroups(true)
							if (refreshGroupsResult.error) {
								Toast.show({
									text: 'Could not load groups',
								})
								loading.dismiss()
								return
							}
						}

						loading.dismiss()
					},
				},
			],
		})

		await alert.present()
	}

	removeGroupDialog() {
		if (!this.notLoggedInGroupInfoDialog()) {
			return
		}
		const deleteGroup = this.findGroupById(this.selectedGroup)

		if (deleteGroup.id == 0) {
			this.alerts.showInfo('Default group', 'You can not delete the default group.')
			return
		}

		let extraText = ''
		if (deleteGroup.count > 1) {
			extraText = '<br/><br/>All ' + deleteGroup.count + ' associated validators with that group will be removed from your dashboard.'
		} else if (deleteGroup.count == 1) {
			extraText = '<br/><br/>The associated validator with that group will be removed from your from your dashboard.'
		}
		this.alerts.confirmDialog(
			'Remove Group',
			'Do you want to remove this group: "' + deleteGroup.name + '"?' + extraText,
			'Delete',
			() => {
				this.confirmRemoveGroup(deleteGroup)
			},
			'error-btn'
		)
	}

	async confirmRemoveGroup(deleteGroup: VDBOverviewGroup) {
		const loading = await this.alerts.presentLoading('Deleting group...')
		loading.present()

		const result = await this.api.execute2(new V2DeleteDashboardGroup(this.dashboardID, deleteGroup.id))
		if (result.error) {
			Toast.show({
				text: 'Error deleting group, please try again later',
			})
		} else {
			Toast.show({
				text: 'Group deleted',
			})

			const refreshGroupsResult = await this.refreshGroups(true)
			if (refreshGroupsResult.error) {
				Toast.show({
					text: 'Could not load groups',
				})
				loading.dismiss()
				return
			}
			this.selectedGroup = this.groups()?.[0]?.id ?? 0
			this.refreshValidators()
		}

		loading.dismiss()
	}

	notLoggedInGroupInfoDialog() {
		if (!this.isLoggedIn) {
			this.alerts.showInfo(
				'Log in',
				'Groups allow you to better manage your validators and get deep insight on how they perform against each other. You need a beaconcha.in account and a premium subscription to use groups.'
			)
			return false
		}
		return true
	}

	async addGroupDialog() {
		if (!this.notLoggedInGroupInfoDialog()) {
			return
		}
		if (this.merchant.userInfo()?.premium_perks?.validator_groups_per_dashboard == 1) {
			this.alerts.showInfo('Upgrade', 'Groups are a premium feature. Please upgrade to Guppy or higher to use this feature.')
			return
		}

		if (this.groups().length >= this.merchant.highestPackageGroupsPerDashboardAllowed()) {
			this.alerts.showInfo(
				'Maximum group reached',
				'You reached the highest possible number of groups we currently support. <br/><br/>If you feel like you need more, let us know!'
			)
			return
		}

		if (this.groups().length >= this.merchant.userInfo()?.premium_perks?.validator_groups_per_dashboard ?? 0) {
			this.alerts.showInfo(
				'Upgrade to premium',
				'You have reached the maximum number of groups allowed for your plan. <br/><br/>You can create more groups by upgrading to a premium plan.'
			)
			return
		}

		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: 'New Group',
			inputs: [
				{
					name: 'newName',
					type: 'text',
					placeholder: 'Group name',
				},
			],
			buttons: [
				{
					text: 'Cancel',
					role: 'cancel',
					cssClass: 'secondary',
					handler: () => {
						return
					},
				},
				{
					text: 'Create',
					handler: async (alertData) => {
						if (alertData.newName.length < 1) {
							Toast.show({
								text: 'Please enter a name',
							})
							return false
						}

						const loading = await this.alerts.presentLoading('Creating group...')
						loading.present()

						const result = await this.api.execute2(new V2AddDashboardGroup(this.dashboardID, alertData.newName))
						if (result.error) {
							Toast.show({
								text: 'Error creating group, please try again later',
							})
						} else {
							Toast.show({
								text: 'Group created',
							})
							const refreshGroupsResult = await this.refreshGroups(true)
							if (refreshGroupsResult.error) {
								Toast.show({
									text: 'Could not load groups',
								})
								loading.dismiss()
								return
							}
							this.selectedGroup = result.data[0].id
							this.refreshValidators(true)
						}

						loading.dismiss()
					},
				},
			],
		})

		await alert.present()
	}
}

class SeachResultHandler {
	formatSearchType(type: searchType) {
		switch (type) {
			case searchType.validatorByIndex:
				return 'Validator Index'
			case searchType.validatorsByDepositEnsName:
				return 'Deposit ENS'
			case searchType.validatorsByWithdrawalEns:
				return 'Withdrawal ENS'
			case searchType.validatorsByDepositAddress:
				return 'Deposit Address'
			case searchType.validatorsByWithdrawalAddress:
				return 'Withdrawal Address'
			case searchType.validatorsByWithdrawalCredential:
				return 'Withdrawal Credential'
			case searchType.validatorByPublicKey:
				return 'Public Key'
		}
	}

	searchNumFieldIsIndex(item: SearchResult) {
		return item.type == searchType.validatorByIndex || item.type == searchType.validatorByPublicKey
	}

	getAddByIndex(searchResult: SearchResult) {
		if (searchResult.type == searchType.validatorByIndex || searchResult.type == searchType.validatorByPublicKey) {
			return [searchResult.num_value.toString()]
		}
		return undefined
	}

	getAddByDepositAddress(searchResult: SearchResult) {
		if (searchResult.type == searchType.validatorsByDepositAddress || searchResult.type == searchType.validatorsByDepositEnsName) {
			return searchResult.hash_value
		}
		return undefined
	}

	getAddByWithdrawalAddress(searchResult: SearchResult) {
		if (
			searchResult.type == searchType.validatorsByWithdrawalAddress ||
			searchResult.type == searchType.validatorsByWithdrawalEns ||
			searchResult.type == searchType.validatorsByWithdrawalCredential
		) {
			return searchResult.hash_value
		}
		return undefined
	}

	getAddByWithdrawalCredential(searchResult: SearchResult) {
		if (searchResult.type == searchType.validatorsByWithdrawalCredential) {
			return searchResult.hash_value
		}
		return undefined
	}
}

class ValidatorLoader {
	constructor(private api: ApiService, private dashboard: dashboardID, private groupID: number, private force: boolean = false) {}

	public getDefaultDataRetriever(): loadMoreType<VDBManageValidatorsTableRow> {
		return async (cursor) => {
			const result = await this.api.execute2(
				new V2GetValidatorFromDashboard(this.dashboard, this.groupID, cursor, PAGE_SIZE).withAllowedCacheResponse(!this.force)
			)
			if (result.error) {
				Toast.show({
					text: 'Could not load validators',
					duration: 'long',
				})
				return {
					data: undefined,
					next_cursor: null,
				}
			}
			return {
				data: result.data as VDBManageValidatorsTableRow[],
				next_cursor: result.paging?.next_cursor,
			}
		}
	}
}
