import { CommonModule } from '@angular/common'
import { Component, computed, effect, EventEmitter, Input, Output, WritableSignal } from '@angular/core'
import { Toast } from '@capacitor/toast'
import { AlertController, IonicModule } from '@ionic/angular'
import { ValidatorDashboard } from 'src/app/requests/types/dashboard'
import { dashboardID, V2ChangeDashboardName, V2DeleteDashboard } from 'src/app/requests/v2-dashboard'
import { AlertService } from 'src/app/services/alert.service'
import { ApiService } from 'src/app/services/api.service'
import { StorageService } from 'src/app/services/storage.service'

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
		return 'HOL'
		//return capitalize(this.data.network) // todo
	})

	networkColor = computed(() => {
		return 'holesky'
		//return this.data.network
	})

	constructor(private alertController: AlertController, private api: ApiService, private alert: AlertService, private storage: StorageService) {
		effect(() => {
			this.selected = this.defaultDashboard() === this.data.id
			this.triggerID = 'click-trigger-' + this.data.id
		})
	}

	setAsDefault() {
		console.log('set as default', this.data.id)
		this.defaultDashboard.set(this.data.id)
	}

	async rename() {
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

	remove() {
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
