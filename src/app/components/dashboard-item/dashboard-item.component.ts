import { CommonModule } from '@angular/common'
import { Component, computed, effect, EventEmitter, Input, Output, WritableSignal } from '@angular/core'
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

@Component({
	selector: 'app-dashboard-item',
	standalone: true,
	imports: [CommonModule, IonicModule],
	templateUrl: './dashboard-item.component.html',
	styleUrl: './dashboard-item.component.scss',
})
export class DashboardItemComponent {
	@Input() data: ValidatorDashboard
	@Input() defaultDashboard: WritableSignal<dashboardID>
	@Output() refresh = new EventEmitter<void>()
	triggerID: string

	selected: boolean

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
		protected merchant: MerchantUtils
	) {
		effect(() => {
			this.selected = this.defaultDashboard() === this.data.id
			this.triggerID = 'click-trigger-' + this.data.id
		})
	}

	setAsDefault() {
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

						const result = await this.api.execute2(new V2ChangeDashboardName(this.data.id, alertData.newName))
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

	async remove() {
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

						const result = await this.api.execute2(new V2DeleteDashboard(this.data.id))
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
}
