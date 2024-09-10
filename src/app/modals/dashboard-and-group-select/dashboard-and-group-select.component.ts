import { Component, computed, effect, Input, OnInit, signal, WritableSignal } from '@angular/core'
import { AlertController, IonicModule, ModalController } from '@ionic/angular'
import { UserDashboardsData } from 'src/app/requests/types/dashboard'
import { V2MyDashboards } from 'src/app/requests/v2-user'
import { ApiService, capitalize } from 'src/app/services/api.service'
import { DashboardItemComponent } from '../../components/dashboard-item/dashboard-item.component'
import { CommonModule } from '@angular/common'
import { dashboardID, V2CreateDashboard } from 'src/app/requests/v2-dashboard'
import { AlertService } from 'src/app/services/alert.service'
import { Toast } from '@capacitor/toast'
import { MerchantUtils } from 'src/app/utils/MerchantUtils'
import { StorageService } from 'src/app/services/storage.service'
import { DashboardUtils } from 'src/app/utils/DashboardUtils'
import { OAuthUtils } from 'src/app/utils/OAuthUtils'
import { SubscribePage } from 'src/app/pages/subscribe/subscribe.page'
import { FullPageLoadingComponent } from "../../components/full-page-loading/full-page-loading.component";

const DASHBOARD_INFO_DISMISS_KEY = 'dashboard_info_dismissed'
@Component({
	selector: 'app-dashboard-and-group-select',
	standalone: true,
	imports: [CommonModule, IonicModule, DashboardItemComponent, FullPageLoadingComponent],
	templateUrl: './dashboard-and-group-select.component.html',
	styleUrl: './dashboard-and-group-select.component.scss',
})
export class DashboardAndGroupSelectComponent implements OnInit {
	@Input() dashboardChangedCallback: () => void

	name: string

	dashboards: WritableSignal<UserDashboardsData> = signal(null)
	defaultDashboard: WritableSignal<dashboardID> = signal(null)

	dashboardIDWhenEntered: dashboardID = null

	isLoggedIn = true
	infoDismissed = true

	constructor(
		private modalCtrl: ModalController,
		private api: ApiService,
		private alertController: AlertController,
		private alert: AlertService,
		protected merchant: MerchantUtils,
		private storage: StorageService,
		private dashboardUtils: DashboardUtils,
		private oauth: OAuthUtils
	) {
		this.storage.getDashboardID().then((id) => {
			this.defaultDashboard.set(id)
			this.dashboardIDWhenEntered = id
		})
		effect(() => {
			if (this.defaultDashboard()) {
				this.storage.setDashboardID(this.defaultDashboard())
				this.dashboardUtils.dashboardAwareListener.notifyAll()
			}
		})
	}

	async ngOnInit() {
		this.infoDismissed = await this.storage.getBooleanSetting(DASHBOARD_INFO_DISMISS_KEY, false)
		this.init()
	}

	maxAllowedDashboards = computed(() => {
		if (!this.merchant.userInfo()) return 1
		return this.merchant.userInfo().premium_perks.validator_dashboards
	})

	async init(allowCached = true) {
		this.isLoggedIn = await this.storage.isLoggedIn()
		if (!this.isLoggedIn) {
			this.dashboards.set({
				validator_dashboards: [
					{
						id: null,
						name: 'Default',
						is_archived: false,
						validator_count: await this.dashboardUtils.getLocalValidatorCount(),
						group_count: 1,
					},
				],
			} as UserDashboardsData)
			return
		}

		const result = await this.api.set(new V2MyDashboards().withAllowedCacheResponse(allowCached), this.dashboards)
		if (result.error) {
			console.warn('dashboards can not be loaded', result.error)
			Toast.show({
				text: 'Error loading dashboards',
			})
			return
		}

		this.merchant.getUserInfo(false)
	}

	async addDashboard(network: string) {
		if (!this.isLoggedIn) {
			Toast.show({
				text: 'Please log in to manage dashboards',
			})
			return
		}

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
								text: 'Error creating dashboard, please try again later',
							})
						} else {
							Toast.show({
								text: 'Dashboard created',
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

	async signIn() {
		const success = await this.oauth.login()
		if (success) {
			this.init()
		}
	}

	async sellUp() {
		const modal = await this.modalCtrl.create({
			component: SubscribePage,
			cssClass: 'my-custom-class',
		})
		return await modal.present()
	}

	dismissInfo() {
		this.storage.setBooleanSetting(DASHBOARD_INFO_DISMISS_KEY, true)
		this.infoDismissed = true
	}
}
