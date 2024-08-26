import { Component, computed, effect, Input, signal, WritableSignal } from '@angular/core'
import { AlertController, IonicModule, ModalController } from '@ionic/angular'
import { UserDashboardsData } from 'src/app/requests/types/dashboard'
import { V2MyDashboards } from 'src/app/requests/v2-user'
import { ApiService, capitalize } from 'src/app/services/api.service'
import { DashboardItemComponent } from "../../components/dashboard-item/dashboard-item.component";
import { CommonModule } from '@angular/common'
import { dashboardID, V2CreateDashboard } from 'src/app/requests/v2-dashboard'
import { AlertService } from 'src/app/services/alert.service'
import { Toast } from '@capacitor/toast'
import { MerchantUtils } from 'src/app/utils/MerchantUtils'
import { StorageService } from 'src/app/services/storage.service'

@Component({
	selector: 'app-dashboard-and-group-select',
	standalone: true,
	imports: [CommonModule, IonicModule, DashboardItemComponent],
	templateUrl: './dashboard-and-group-select.component.html',
	styleUrl: './dashboard-and-group-select.component.scss',
})
export class DashboardAndGroupSelectComponent {

@Input() dashboardChangedCallback: () => void
  
	name: string

	dashboards: WritableSignal<UserDashboardsData> = signal(null)
	defaultDashboard: WritableSignal<dashboardID> = signal(null)

	dashboardIDWhenEntered: dashboardID = null

	constructor(
		private modalCtrl: ModalController,
		private api: ApiService,
		private alertController: AlertController,
		private alert: AlertService,
		private merchant: MerchantUtils,
		private storage: StorageService
	) {
		this.storage.getDashboardID().then((id) => {
			this.defaultDashboard.set(id)
			this.dashboardIDWhenEntered = id
		})
		effect(() => {
			if (this.defaultDashboard()) {
				this.storage.setDashboardID(this.defaultDashboard())
			}
		})

		this.init()
	}

	maxAllowedDashboards = computed(() => {
		if (!this.merchant.userInfo()) return 1
		return this.merchant.userInfo().premium_perks.validator_dashboards
	})

	async init(allowCached = true) {
		await this.api.set(new V2MyDashboards().withAllowedCacheResponse(allowCached), this.dashboards, (err) => {
			console.warn('dashboards can not be loaded', err)
			// todo
		})

		this.merchant.getUserInfo(false)
	}

	async addDashboard(network: string) {
		if (this.dashboards().validator_dashboards.length >= this.merchant.highestPackageDashboardsAllowed()) {
			this.alert.showInfo(
				'Maximum dashboards reached',
				'You reached the highest possible number of dashboards we currently support. <br/><br/>If you feel like you need more, let us know!'
			)
			return
		}

		if (this.dashboards().validator_dashboards.length >= this.maxAllowedDashboards()) {
			this.alert.showInfo(
				'Upgrade to premium',
				'You have reached the maximum number of dashboards allowed for your plan. <br/><br/>You can create more dashboards by upgrading to a premium plan.'
			)
			return
		}

		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: 'New ' + capitalize(network) + ' Dashboard',
			inputs: [
				{
					name: 'newName',
					type: 'text',
					placeholder: 'Dashboard name',
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

						const loading = await this.alert.presentLoading('Applying changes...')
						loading.present()

						const result = await this.api.execute2(new V2CreateDashboard(alertData.newName, network))
						if (result.error) {
							Toast.show({
								text: 'Error renaming dashboard, please try again later',
							})
						} else {
							Toast.show({
								text: 'Dashboard renamed',
							})
							await this.init(false)
						}

						loading.dismiss()
					},
				},
			],
		})

		await alert.present()
	}

	cancel() {
		if (this.defaultDashboard() != this.dashboardIDWhenEntered) {
			if (this.dashboardChangedCallback) {
				this.dashboardChangedCallback()
			}
		}
		return this.modalCtrl.dismiss(null, 'cancel')
	}

}
