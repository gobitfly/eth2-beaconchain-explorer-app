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
import { findChainNetworkById } from 'src/app/utils/NetworkData'
import { fromEvent, Subscription } from 'rxjs'
import { FullPageOfflineComponent } from "../../components/full-page-offline/full-page-offline.component";
import { OfflineComponentModule } from "../../components/offline/offline.module";

const DASHBOARD_INFO_DISMISS_KEY = 'dashboard_info_dismissed'
const ASSOCIATED_CACHE_KEY = 'manage_dashboards'

interface DashboardAddButton {
	network: number
	text: string
}
@Component({
	selector: 'app-dashboard-and-group-select',
	standalone: true,
	imports: [CommonModule, IonicModule, DashboardItemComponent, FullPageLoadingComponent, FullPageOfflineComponent, OfflineComponentModule],
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

	dashboardAddButtons: DashboardAddButton[] = []

	private backbuttonSubscription: Subscription

	online: boolean = true

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
		const event = fromEvent(document, 'backbutton')
		this.backbuttonSubscription = event.subscribe(() => {
			this.modalCtrl.dismiss()
		})
	}

	async ngOnInit() {
		this.infoDismissed = await this.storage.getBooleanSetting(DASHBOARD_INFO_DISMISS_KEY, false)
		this.setup()
	}

	maxAllowedDashboards = computed(() => {
		if (!this.merchant.userInfo()) return 1
		return this.merchant.userInfo().premium_perks.validator_dashboards
	})

	async setup() {
		this.online = true
		this.dashboardAddButtons = []
		this.api.networkConfig.supportedChainIds.forEach((chainID) => {
			this.dashboardAddButtons.push({
				network: chainID,
				text: `Add ${capitalize(findChainNetworkById(chainID).name)} Dashboard`,
			})
		})

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

		const result = await this.api.set(new V2MyDashboards(), this.dashboards, ASSOCIATED_CACHE_KEY)
		if (result.error) {
			console.warn('dashboards can not be loaded', result.error)
			Toast.show({
				text: 'Error loading dashboards',
			})
			this.online = false
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
							this.doRefresh()
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

	/**
	 * Call when you need to clear the API request cache for all calls this view made.
	 * Note: when making calls in this view, always use the ASSOCIATED_CACHE_KEY
	 * @returns promise void
	 */
	clearRequestCache() {
		return this.api.clearAllAssociatedCacheKeys(ASSOCIATED_CACHE_KEY)
	}

	async doRefresh() {
		await this.clearRequestCache()
		return this.setup()
	}

	async signIn() {
		const success = await this.oauth.login()
		if (success) {
			this.setup()
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

	ngOnDestroy() {
		this.backbuttonSubscription.unsubscribe()
	}
}
