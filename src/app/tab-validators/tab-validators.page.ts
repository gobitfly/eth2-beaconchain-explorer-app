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

import { Component, computed, OnInit, signal, ViewChild, WritableSignal } from '@angular/core'
import { Validator }  from '../utils/ValidatorUtils'
import { AlertController, IonSearchbar, ModalController, Platform } from '@ionic/angular'
import { ApiService, capitalize } from '../services/api.service'
import { StorageService } from '../services/storage.service'
import { AlertService } from '../services/alert.service'
import { SubscribePage } from '../pages/subscribe/subscribe.page'
import { MerchantUtils } from '../utils/MerchantUtils'

import { Keyboard } from '@capacitor/keyboard'

import { UnitconvService } from '../services/unitconv.service'
import { InfiniteScrollDataSource, loadMoreType } from '../utils/InfiniteScrollDataSource'
import { DashboardAndGroupSelectComponent } from '../modals/dashboard-and-group-select/dashboard-and-group-select.component'
import {
	dashboardID,
	V2AddDashboardGroup,
	V2DashboardOverview,
	V2DeleteDashboardGroup,
	V2GetValidatorFromDashboard,
	V2UpdateDashboardGroup,
} from '../requests/v2-dashboard'
import { VDBManageValidatorsTableRow, VDBOverviewData, VDBOverviewGroup } from '../requests/types/validator_dashboard'
import { Toast } from '@capacitor/toast'
import { Haptics } from '@capacitor/haptics'
import { searchType, V2SearchValidators } from '../requests/v2-search'
import { SearchResult } from '../requests/types/common'
import { DashboardUtils, isLocalDashboard } from '../utils/DashboardUtils'
import ThemeUtils from '../utils/ThemeUtils'
import { APIError, APIForbiddenError, APINotFoundError, ApiResult, APIUnauthorizedError } from '../requests/requests'
import { AppComponent } from '../app.component'

const PAGE_SIZE = 25
const DASHBOARD_UPDATE = "validators_tab"
const ASSOCIATED_CACHE_KEY = 'validators'
@Component({
	selector: 'app-tab2',
	templateUrl: 'tab-validators.page.html',
	styleUrls: ['tab-validators.page.scss'],
})
export class Tab2Page implements OnInit {
	public classReference = UnitconvService
	@ViewChild('searchbarRef', { static: true }) searchbarRef: IonSearchbar
	dataSource: InfiniteScrollDataSource<VDBManageValidatorsTableRow>

	initialLoading = true
	reachedMaxValidators = false
	isLoggedIn = false
	initialized = false // when first data has been loaded and displayed
	loadMore = false // infinite scroll load more text at bottom

	dashboardID: WritableSignal<dashboardID> = signal(null)
	private dashboardData: WritableSignal<VDBOverviewData> = signal(null)
	validatorLoader: ValidatorLoader = null

	searchResultMode = false
	searchResult: SearchResult[] = null

	selectedGroup: number

	selectMode: boolean = false
	selected = new Map<number, boolean>()

	private validatorSetAltered = false

	private sort: string

	online: boolean = true

	constructor(
		public modalController: ModalController,
		public api: ApiService,
		private storage: StorageService,
		private alerts: AlertService,
		public merchant: MerchantUtils,
		public unit: UnitconvService,
		private modalCtrl: ModalController,
		protected dashboardUtils: DashboardUtils,
		private themeUtils: ThemeUtils,
		private platform: Platform,
		private alertController: AlertController
	) {
		this.dashboardUtils.dashboardAwareListener.register(DASHBOARD_UPDATE)

		// Back key on android should cancel select mode
		this.platform.backButton.subscribe(() => {
			console.info("BACKPRESS SELECTMODE", this.selectMode)
			if (this.selectMode) {
				this.cancelSelect(true)
				// give a bit time for backpress to fully propagate and then disable the backpress prevention
				setTimeout(() => {
					AppComponent.PREVENT_BACK_PRESS = false
				}, 500)
			} 
		})
	}

	ngOnInit() {
		this.setup()
	}

	async ionViewWillEnter() {
		if (this.dashboardUtils.dashboardAwareListener.hasAndConsume(DASHBOARD_UPDATE)) {
			await this.clearRequestCache()
			await this.setup()
		}
	}

	/**
	 * Call when you need to clear the API request cache for all calls this view made.
	 * Note: when making calls in this view, always use the ASSOCIATED_CACHE_KEY
	 * @returns promise void
	 */
	clearRequestCache() {
		return this.api.clearAllAssociatedCacheKeys(ASSOCIATED_CACHE_KEY)
	}

	ionViewWillLeave() {
		this.cancelSelect()
		if (this.validatorSetAltered) {
			this.validatorSetAltered = false
			this.dashboardUtils.dashboardAwareListener.notifyAll()
		}
	}

	async setup() {
		this.online = true
		this.selectMode = false
		AppComponent.PREVENT_BACK_PRESS = false
		this.selected = new Map<number, boolean>()
		this.searchResult = null
		this.searchResultMode = false
		if (this.searchbarRef) {
			this.searchbarRef.value = ''
		}

		this.sort = await this.getDefaultSort()
		this.isLoggedIn = await this.storage.isLoggedIn()

		await this.merchant.getUserInfo(false)
		this.dashboardID.set(await this.dashboardUtils.initDashboard())
		if (!this.dashboardID) {
			this.initialized = true
			this.initialLoading = false
			return
		}
		console.log('dashboard id', this.dashboardID)

		const updateGroupsResult = await this.updateGroups()
		if (updateGroupsResult && updateGroupsResult.error) {
			Toast.show({
				text: 'Could not load groups',
			})
			this.initialLoading = false
			return
		}

		if (!this.selectedGroup) {
			this.selectedGroup = this.groups()?.[0]?.id ?? 0
		}

		await this.updateValidators()
	}

	async getDefaultSort() {
		return (await this.storage.getItem('validators_sort')) || 'index:asc'
	}

	async setDefaultSort(sort: string) {
		await this.storage.setItem('validators_sort', sort)
	}

	selectSort() {
		this.alerts.showSelect(
			'Sort by',
			[
				{
					name: 'sort',
					label: 'Index Ascending',
					value: 'index:asc',
					type: 'radio',
					checked: this.sort == 'index:asc',
				},
				{
					name: 'sort',
					label: 'Index Descending',
					value: 'index:desc',
					type: 'radio',
					checked: this.sort == 'index:desc',
				},
				{
					name: 'sort',
					label: 'Online State (Offline first)',
					value: 'status:asc',
					type: 'radio',
					checked: this.sort == 'status:asc',
				},
				{
					name: 'sort',
					label: 'Online State (Online first)',
					value: 'status:desc',
					type: 'radio',
					checked: this.sort == 'status:desc',
				},
				{
					name: 'sort',
					label: 'Balance Ascending',
					value: 'balance:asc',
					type: 'radio',
					checked: this.sort == 'balance:asc',
				},
				{
					name: 'sort',
					label: 'Balance Descending',
					value: 'balance:desc',
					type: 'radio',
					checked: this.sort == 'balance:desc',
				},
			],
			async (data) => {
				if (data) {
					if (data != this.sort) {
						await this.clearRequestCache()
						this.sort = data as string
						this.setDefaultSort(data as string)
						this.updateValidators()
					}
				}
			}
		)
	}

	async openDashboardAndGroupSelect() {
		const modal = await this.modalCtrl.create({
			component: DashboardAndGroupSelectComponent,
			componentProps: {
				dashboardChangedCallback: async () => {
					const loading = await this.alerts.presentLoading('Loading...')
					loading.present()
					if (this.dashboardID() == await this.storage.getDashboardID()) {
						this.clearRequestCache()
					}
					await this.setup()
					loading.dismiss()
				},
			},
		})
		modal.present()

		await modal.onWillDismiss()
	}

	private async updateGroups(recursiveMax: boolean = false): Promise<ApiResult<VDBOverviewData[]> | null> {
		if (!this.isLoggedIn) {
			return null
		}
		if (!this.dashboardID()) {
			return null
		}
		const result = await this.api.set(new V2DashboardOverview(this.dashboardID()), this.dashboardData, ASSOCIATED_CACHE_KEY)
		if (result.error) {
			if (result.error instanceof APINotFoundError) {
				if (recursiveMax) {
					Toast.show({
						text: 'Dashboard not found',
					})
					return
				}
				// if dashboard is not available any more (maybe user deleted it) reinit and try again
				this.dashboardID.set(await this.dashboardUtils.initDashboard())
				return this.updateGroups(true)
			} else if (result.error instanceof APIError) {
				if (this.dashboardUtils.defaultDashboardErrorHandler(result.error)) {
					result.error = null
				} else {
					this.online = false
				}
			} else {
				this.online = false
			}
		}
		return result
	}

	private async updateValidators() {
		this.initialLoading = true
		this.reachedMaxValidators = false
		this.validatorLoader = new ValidatorLoader(this.api, this.dashboardID(), this.selectedGroup, this.sort, (result) => {
			this.online = result
		})
		this.dataSource = new InfiniteScrollDataSource<VDBManageValidatorsTableRow>(PAGE_SIZE, this.getDefaultDataRetriever())

		await this.dataSource.reset()
	}

	private getDefaultDataRetriever(): loadMoreType<VDBManageValidatorsTableRow> {
		return async (cursor) => {
			const firstRun = !cursor && !this.initialized
			if (firstRun) {
				this.initialLoading = true
			}

			this.loadMore = !!cursor
			const result = await this.validatorLoader.getDefaultDataRetriever()(cursor)
			this.loadMore = false

			if (this.initialLoading) {
				this.initialLoading = false
				this.initialized = true
			}
			return result
		}
	}

	async searchEvent(event: { target: { value: string } }, maxRecursive = false): Promise<void> {
		const searchString = event.target.value
		if (!searchString || searchString.length < 0) return
		if (this.platform.is('ios') || this.platform.is('android')) {
			Keyboard.hide()
		}

		this.searchResultMode = true
		this.searchResult = null
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

		const chainID = await this.api.getCurrentDashboardChainID()
		const result = await this.api.execute2(new V2SearchValidators(searchString, [chainID], searchTypes), ASSOCIATED_CACHE_KEY)
		if (result.error) {
			// If we get a cors forbidden error, try a get call and then retry
			if (result.error instanceof APIForbiddenError && !maxRecursive) {
				await this.api.getLatestState(true)
				return this.searchEvent(event, true)
			}

			this.searchResultMode = false
			this.online = false
			Toast.show({
				text: 'Could not search for validators',
				duration: 'long',
			})
			return
		}

		this.searchResult = result.data
	}

	async addSearchResult(item: SearchResult) {
		if (!this.merchant.canBulkAdd() && this.dashboardUtils.searchResultHandler.requiresPremium(item)) {
			this.premiumInfo()
			return
		}

		const dashboardValidatorCount = this.isLoggedIn
			? this.groups().reduce((acc, group) => acc + group.count, 0)
			: await this.dashboardUtils.getLocalValidatorCount()

		const resultValidatorCount = this.dashboardUtils.searchResultHandler.resultCount(item)
		if (resultValidatorCount + dashboardValidatorCount > this.merchant.getCurrentPlanMaxValidator()) {
			if (this.isLoggedIn && this.dashboardUtils.searchResultHandler.resultCount(item) > 1) {
				this.alerts.confirmDialog(
					'Maximum validators reached',
					'Some of your validators can not be added since it exceeds your current plans limit. <br/><br/>You can add more validators by upgrading to a higher plan.<br/><br/>Do you want to add the remaining validators?',
					'Add',
					() => {
						this.addSearchResultRemoteDialog(item)
					}
				)
				return
			} else {
				this.alerts.showInfo(
					'Can not add validators',
					'You reached the maximum number of validators for your plan. <br/><br/>You can add more validators by upgrading to a higher plan.'
				)
				return
			}
		}

		if (this.isLoggedIn) {
			this.addSearchResultRemoteDialog(item)
		} else {
			this.confirmAddSearchResult(item, 0)
		}
	}

	addSearchResultRemoteDialog(item: SearchResult) {
		let addInfo = ''
		let title = 'Add validator'
		if (this.dashboardUtils.searchResultHandler.searchNumFieldIsIndex(item)) {
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

		const ok = await this.dashboardUtils.addValidator(item, groupID)
		if (!ok) {
			Toast.show({
				text: 'Could not add validator to dashboard',
				duration: 'long',
			})
		}
		this.validatorSetAltered = true
		await this.clearRequestCache()
		await this.setup()

		loading.dismiss()
	}

	private clickBlocked = false
	blockClick(forTime: number) {
		this.clickBlocked = true
		setTimeout(() => {
			this.clickBlocked = false
		}, forTime)
	}

	selectValidator(item: Validator) {
		this.selectMode = !this.selectMode
		AppComponent.PREVENT_BACK_PRESS = this.selectMode
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
				text: 'Select the validators you want to delete first.',
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

		const ok = await this.dashboardUtils.deleteValidator(index)
		if (!ok) {
			Toast.show({
				text: 'Could not remove validator from dashboard',
				duration: 'long',
			})
			return
		}

		this.validatorSetAltered = true
		await this.clearRequestCache()
		await this.setup()
		loading.dismiss()
		Toast.show({
			text: 'Validators removed from dashboard',
			duration: 'short',
		})
	}

	moveSelected() {}

	cancelSearch() {
		if (this.searchResultMode) {
			this.searchResultMode = false
			this.updateValidators()
		}
	}

	private lastRefreshedTs: number = 0
	async doRefresh(event: { target: { complete: () => void } }) {
		if (this.lastRefreshedTs + 15 * 1000 > new Date().getTime()) {
			Toast.show({
				text: 'Nothing to update',
			})
			if (event) event.target.complete()
			return
		}
		this.lastRefreshedTs = new Date().getTime()

		this.initialLoading = true
		await this.clearRequestCache()
		await this.updateValidators().catch(() => {
			if (event) event.target.complete()
		})
		this.initialLoading = false
		if (event) event.target.complete()
	}

	async upgrade() {
		const modal = await this.modalController.create({
			component: SubscribePage,
			cssClass: 'my-custom-class',
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
		}
	}

	cancelSelect(preventPreventBackPress = false) {
		// cancelSelect is called when backpress is pressed,
		// so it can lead to a scenario where prevent backpress  is changed here to false
		// while the backpress hasn't fully propagated yet.
		// hence preventPreventBackPress = true in this scenario
		if (!preventPreventBackPress) {
			AppComponent.PREVENT_BACK_PRESS = false
		}
		
		this.selectMode = false
		this.selected = new Map<number, boolean>()
		this.themeUtils.revertStatusBarColor()
		Haptics.selectionEnd()
	}

	// ------------ GROUPS ------------

	groups = computed(() => {
		return (
			this.dashboardData()
				?.groups.sort((a, b) => a.id - b.id)
				.map((group) => {
					return {
						id: group.id,
						count: group.count,
						name: group.name == 'default' && group.id == 0 ? 'Default Group' : capitalize(group.name),
						realName: group.name,
					}
				}) || [
				{
					id: null,
					count: isLocalDashboard(this.dashboardID()) ? (this.dashboardID() as number[]).length : 0,
					name: 'Default',
					realName: 'default',
				},
			]
		)
	})

	selectGroup() {
		this.updateValidators()
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

						const result = await this.api.execute2(new V2UpdateDashboardGroup(this.dashboardID(), renameGroup.id, alertData.newName))
						if (result.error) {
							Toast.show({
								text: 'Error creating group, please try again later',
							})
						} else {
							Toast.show({
								text: 'Group renamed',
							})
							await this.clearRequestCache()
							const updateGroupsResult = await this.updateGroups()
							if (updateGroupsResult.error) {
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

		const result = await this.api.execute2(new V2DeleteDashboardGroup(this.dashboardID(), deleteGroup.id))
		if (result.error) {
			Toast.show({
				text: 'Error deleting group, please try again later',
			})
		} else {
			Toast.show({
				text: 'Group deleted',
			})

			this.validatorSetAltered = true
			await this.clearRequestCache()
			const updateGroupsResult = await this.updateGroups()
			if (updateGroupsResult.error) {
				Toast.show({
					text: 'Could not load groups',
				})
				loading.dismiss()
				return
			}
			this.selectedGroup = this.groups()?.[0]?.id ?? 0
			this.updateValidators()
		}

		loading.dismiss()
	}

	notLoggedInGroupInfoDialog() {
		if (!this.isLoggedIn) {
			this.alerts.showInfo(
				'Log in',
				'Groups allow you to better manage your validators and get deep insight on how they perform against each other.<br/><br/> You need a beaconcha.in account and a premium subscription to use groups.'
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

						const result = await this.api.execute2(new V2AddDashboardGroup(this.dashboardID(), alertData.newName))
						if (result.error) {
							Toast.show({
								text: 'Error creating group, please try again later',
							})
						} else {
							Toast.show({
								text: 'Group created',
							})
							await this.clearRequestCache()
							const updateGroupsResult = await this.updateGroups()
							if (updateGroupsResult.error) {
								Toast.show({
									text: 'Could not load groups',
								})
								loading.dismiss()
								return
							}
							this.selectedGroup = result.data[0].id

							this.updateValidators()
						}

						loading.dismiss()
					},
				},
			],
		})

		await alert.present()
	}

	premiumInfo() {
		this.alerts.showInfo(
			'Upgrade',
			'Adding multiple validators at once via ENS, deposit address or withdrawal address/credential requires a premium subscription.'
		)
	}
}


class ValidatorLoader {
	constructor(private api: ApiService, private dashboard: dashboardID, private groupID: number, private sort: string, private offlineCallback: (online: boolean) => void) {}

	public getDefaultDataRetriever(): loadMoreType<VDBManageValidatorsTableRow> {
		return async (cursor) => {
			if (!this.dashboard) {
				return {
					data: undefined,
					next_cursor: null,
				}
			}
			const result = await this.api.execute2(
				new V2GetValidatorFromDashboard(this.dashboard, this.groupID, cursor, PAGE_SIZE, this.sort), ASSOCIATED_CACHE_KEY
			)
			if (result.error) {
				Toast.show({
					text: 'Could not load validators',
					duration: 'long',
				})
				if (!(result.error instanceof APIUnauthorizedError)) { // todo change to just if timeout?
					this.offlineCallback(false)
				}
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
