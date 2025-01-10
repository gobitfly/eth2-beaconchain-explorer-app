import { CommonModule } from '@angular/common'
import { Component, computed, effect, EventEmitter, Input, OnChanges, Output, WritableSignal } from '@angular/core'
import { Toast } from '@capacitor/toast'
import { AlertController, IonicModule } from '@ionic/angular'
import { ValidatorDashboard } from 'src/app/requests/types/dashboard'
import { dashboardID, V2ChangeDashboardName, V2DeleteDashboard } from 'src/app/requests/v2-dashboard'
import { AlertService } from 'src/app/services/alert.service'
import { ApiService } from 'src/app/services/api.service'
import { StorageService } from 'src/app/services/storage.service'
import { DashboardUtils } from 'src/app/utils/DashboardUtils'
import { MerchantUtils } from 'src/app/utils/MerchantUtils'
import { findChainNetworkById } from 'src/app/utils/NetworkData'
import { ValidatorUtils } from 'src/app/utils/ValidatorUtils'
import { Clipboard } from '@capacitor/clipboard'
import { changeNetwork } from 'src/app/tabs/tab-preferences/tab-preferences.page'
import { UnitconvService } from '@services/unitconv.service'
import ThemeUtils from '@utils/ThemeUtils'

@Component({
	selector: 'app-dashboard-item',
	standalone: true,
	imports: [CommonModule, IonicModule],
	templateUrl: './dashboard-item.component.html',
	styleUrl: './dashboard-item.component.scss',
})
export class DashboardItemComponent implements OnChanges {
	@Input() data: ValidatorDashboard
	@Input() defaultDashboard: WritableSignal<dashboardID>
	@Input() legacyDashboard: boolean = false

	@Output() refresh = new EventEmitter<void>()
	@Output() legacyAdd = new EventEmitter<LegacyAdd>()
	triggerID: string

	selected: boolean

	nameTruncated = computed(() => {
		return this.data.name.length > 21 ? this.data.name.substring(0, 21) + '...' : this.data.name
	})

	networkName = computed(() => {
		const network = findChainNetworkById(this.data.network)
		return network.name.toUpperCase().substring(0, 3)
	})

	networkColor = computed(() => {
		const network = findChainNetworkById(this.data.network)
		return network.name
		//return this.data.network
	})

	reachedMaxGroupClassStyle = computed(() => {
		return this.data.group_count >= this.merchant.getCurrentPlanMaxGroups() ? 'maxed' : ''
	})

	reachedMaxValidatorClassStyle = computed(() => {
		return this.data.validator_count >= this.merchant.getCurrentPlanMaxValidator() ? 'maxed' : ''
	})

	constructor(
		private alertController: AlertController,
		private api: ApiService,
		private alert: AlertService,
		private dashboardUtils: DashboardUtils,
		private storage: StorageService,
		protected merchant: MerchantUtils,
		private validatorUtils: ValidatorUtils,
		private unit: UnitconvService,
		private theme: ThemeUtils
	) {
		effect(() => {
			this.selected = this.defaultDashboard() === this.data.id && this.data.network === this.api.networkConfig.supportedChainIds
		})
	}

	ngOnChanges() {
		this.triggerID = 'click-trigger-' + this.data.id
	}

	async setAsDefault() {
		if (this.legacyDashboard) {
			const alert = await this.alertController.create({
				cssClass: 'my-custom-class',
				header: 'Legacy Dashboard',
				message: `Legacy dashboards were created using an older version of this app 
				and can not be viewed nor set as default.<br/><br/> You can migrate your dashboard to the new version
					or get a list of all validators of that dashboard.`,
				buttons: [
					{
						text: 'Show',
						handler: () => {
							this.legacyCopyToClipboard()
						},
					},
					{
						text: 'Migrate',
						handler: () => {
							this.legacyAddToCurrent()
						},
					},
					{
						text: 'Cancel',
						role: 'cancel',
						cssClass: 'secondary',
						handler: () => {
							return
						},
					},
				],
			})
			await alert.present()
			return
		}
		if (this.data.network !== this.api.networkConfig.supportedChainIds) {
			const loading = await this.alert.presentLoading('Loading...')
			loading.present()
			await changeNetwork(
				findChainNetworkById(this.data.network).legacyKey,
				this.storage,
				this.api,
				this.unit,
				this.theme,
				this.alert,
				this.merchant,
				true,
				this.dashboardUtils
			)
			loading.dismiss()
		}
		this.defaultDashboard.set(this.data.id)
	}

	async rename() {
		if (!(await this.storage.isLoggedIn())) {
			Toast.show({
				text: 'Please log in to manage dashboards',
			})
			return
		}

		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: 'Rename my dashboard',
			inputs: [
				{
					name: 'newName',
					type: 'text',
					placeholder: 'New Name',
					value: this.data.name,
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
					text: 'Save',
					handler: async (alertData) => {
						const loading = await this.alert.presentLoading('Applying changes...')
						loading.present()

						const result = await this.api.executeOnChainID(new V2ChangeDashboardName(this.data.id, alertData.newName), null, this.data.network)
						if (result.error) {
							Toast.show({
								text: 'Error renaming dashboard, please try again later',
							})
						} else {
							this.data.name = alertData.newName
							Toast.show({
								text: 'Dashboard renamed',
							})
							this.refresh.emit()
						}

						loading.dismiss()
					},
				},
			],
		})

		await alert.present()
	}

	async legacyCopyToClipboard() {
		await Clipboard.write({
			string: (await this.validatorUtils.getMyLocalValidators(this.legacyGetNetwork())).sort().join(','),
		})
		Toast.show({
			text: 'All validator indices copied to clipboard',
			duration: 'long',
		})
	}

	legacyGetNetwork() {
		let networkName = findChainNetworkById(this.data.network).name
		if (networkName == 'ethereum') {
			networkName = 'main'
		}
		return networkName
	}

	async legacyAddToCurrent() {
		this.legacyAdd.emit({
			indices: await this.validatorUtils.getMyLocalValidators(this.legacyGetNetwork()),
			network: this.legacyGetNetwork(),
		} as LegacyAdd)
	}

	removeLegacy() {
		this.alert.confirmDialog(
			'Remove Legacy dashboard',
			'This will permanently remove the dashboard and all associated validators. If you have already migrated this old dashboard to the new one, you can safely delete it. <br/><br/>Are you sure you want to proceed?',
			'Remove',
			() => {
				this.alert.confirmDialogReverse(
					'Are you really sure?',
					'Please note that this action can <b>NOT</b> be undone.<br/><br/><strong>Delete: </strong>' + this.data.name,
					'Remove',
					async () => {
						const loading = await this.alert.presentLoading('Removing dashboard...')
						loading.present()

						await this.validatorUtils.deleteAll(this.legacyGetNetwork())

						loading.dismiss()
						this.refresh.emit()
					},
					'error-btn'
				)
			},
			'error-btn'
		)
	}

	async removev2() {
		if (!(await this.storage.isLoggedIn())) {
			Toast.show({
				text: 'Please log in to manage dashboards',
			})
			return
		}
		this.alert.confirmDialog(
			'Remove dashboard',
			'This will permanently remove the dashboard and all associated groups and validators. <br/><br/>Are you sure you want to continue?',
			'Remove',
			() => {
				this.alert.confirmDialogReverse(
					'Are you really sure?',
					'Please note that this action can <b>NOT</b> be undone.<br/><br/><strong>Delete: </strong>' + this.data.name,
					'Remove',
					async () => {
						const loading = await this.alert.presentLoading('Removing dashboard...')
						loading.present()

						const result = await this.api.executeOnChainID(new V2DeleteDashboard(this.data.id), null, this.data.network)
						if (result.error) {
							Toast.show({
								text: 'Error removing dashboard, please try again later',
							})
						} else {
							Toast.show({
								text: 'Dashboard removed',
							})
							this.data = null
							if (this.selected) {
								this.dashboardUtils.dashboardAwareListener.notifyAll()
							}
							this.refresh.emit()
						}

						loading.dismiss()
					},
					'error-btn'
				)
			},
			'error-btn'
		)
	}

	remove() {
		if (this.legacyDashboard) this.removeLegacy()
		else this.removev2()
	}
}

export interface LegacyAdd {
	indices: number[]
	network: string
}
