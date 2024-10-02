import { Component, computed, effect, Input, OnInit, signal, WritableSignal } from '@angular/core'
import { AlertController, IonicModule, ModalController } from '@ionic/angular'
import { UserDashboardsData, ValidatorDashboard } from 'src/app/requests/types/dashboard'
import { V2MyDashboards } from 'src/app/requests/v2-user'
import { ApiService, capitalize } from 'src/app/services/api.service'
import { DashboardItemComponent, LegacyAdd } from '../../components/dashboard-item/dashboard-item.component'
import { CommonModule } from '@angular/common'
import { dashboardID, V2CreateDashboard, V2DashboardOverview } from 'src/app/requests/v2-dashboard'
import { AlertService } from 'src/app/services/alert.service'
import { Toast } from '@capacitor/toast'
import { MerchantUtils } from 'src/app/utils/MerchantUtils'
import { StorageService } from 'src/app/services/storage.service'
import { DashboardUtils } from 'src/app/utils/DashboardUtils'
import { OAuthUtils } from 'src/app/utils/OAuthUtils'
import { SubscribePage } from 'src/app/pages/subscribe/subscribe.page'
import { FullPageLoadingComponent } from "../../components/full-page-loading/full-page-loading.component";
import { findChainNetworkById, findChainNetworkByName } from 'src/app/utils/NetworkData'
import { fromEvent, Subscription } from 'rxjs'
import { FullPageOfflineComponent } from "../../components/full-page-offline/full-page-offline.component";
import { OfflineComponentModule } from "../../components/offline/offline.module";
import { ValidatorUtils } from 'src/app/utils/ValidatorUtils'
import { getValidatorCount } from 'src/app/controllers/OverviewController'
import { APIUnauthorizedError } from 'src/app/requests/requests'

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

	legacyDashboard: ValidatorDashboard[] = []

	initLoading: boolean = true

	constructor(
		private modalCtrl: ModalController,
		private api: ApiService,
		private alertController: AlertController,
		private alert: AlertService,
		protected merchant: MerchantUtils,
		private storage: StorageService,
		private dashboardUtils: DashboardUtils,
		private oauth: OAuthUtils,
		private validatorUtils: ValidatorUtils
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

	async getLegacyDashboard() {
		const push = (dashboard: ValidatorDashboard) => {
			if (dashboard) this.legacyDashboard.push(dashboard)
		}

		this.legacyDashboard = []
		push(await this.getLegacyDashboardForNetwork('main'))
		push(await this.getLegacyDashboardForNetwork('gnosis'))
		push(await this.getLegacyDashboardForNetwork('holesky'))
		push(await this.getLegacyDashboardForNetwork('sepolia'))
	}

	async getLegacyDashboardForNetwork(network: string) {
		const localValidators = await this.validatorUtils.getMyLocalValidators(network)
		if (!localValidators || localValidators.length <= 0) {
			return
		}

		// special case for network key difference between v1 and v2
		if (network == 'main') {
			network = 'ethereum'
		}

		return {
			id: -1 - findChainNetworkByName(network).id,
			name: 'Legacy Dashboard',
			network: findChainNetworkByName(network).id,
			is_archived: false,
			validator_count: localValidators.length,
			group_count: 1,
		} as ValidatorDashboard
	}

	async setup() {
		this.online = true
		this.dashboardAddButtons = []
		this.api.networkConfig.supportedChainIds.forEach((chainID) => {
			this.dashboardAddButtons.push({
				network: chainID,
				text: `Add ${capitalize(findChainNetworkById(chainID).name)} Dashboard`,
			})
		})

		this.getLegacyDashboard()

		this.isLoggedIn = await this.storage.isLoggedIn()
		if (!this.isLoggedIn) {
			this.dashboards.set({
				validator_dashboards: [
					{
						id: null,
						name: 'Default',
						network: this.api.networkConfig.supportedChainIds[0], // todo: gnosis (having two supported chain ids in general)
						is_archived: false,
						validator_count: await this.dashboardUtils.getLocalValidatorCount(),
						group_count: 1,
					},
				],
			} as UserDashboardsData)
			this.initLoading = false
			return
		}

		const result = await this.api.set(new V2MyDashboards(), this.dashboards, ASSOCIATED_CACHE_KEY)
		if (result.error) {
			console.warn('dashboards can not be loaded', result.error)

			this.dashboardUtils.defaultDashboardErrorHandler(result.error)
			if (!(result.error instanceof APIUnauthorizedError)) {
				this.online = false
			}
			this.initLoading = false
			return
		}

		this.merchant.getUserInfo(false)
		this.initLoading = false
	}

	async addDashboard(network: number, onSuccessCallback: (id: dashboardID) => void = null) {
		if (!this.isLoggedIn) {
			this.alert.showInfo('Login required', 'You must be logged in to your beaconcha.in account to create or manage dashboards.')
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

		const networkName = findChainNetworkById(network).name

		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: 'New ' + capitalize(networkName) + ' Dashboard',
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
							if (onSuccessCallback) {
								loading.dismiss()
								onSuccessCallback(result.data.id)
								return
							}
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

	legacyAddToDashboard(legacyAddData: LegacyAdd) {
		if (!this.isLoggedIn) {
			this.alert.showInfo('Login required', 'You must be logged in to your beaconcha.in account to add validators to your dashboard.')
			return
		}

		const index = legacyAddData.indices

		const add = (id: dashboardID) => {
			this.alert.confirmDialog(
				'Migrate from Legacy Dashboard',
				`Do you want to add ${index.length} validator${index.length > 1 ? 's' : ''} from your legacy dashboard to your new dashboard "${this.defaultDashboardData()?.name}"?`,
				'OK',
				async () => {
					let loading = await this.alert.presentLoading('Loading...')
					loading.present()
					const result = await this.api.execute2(new V2DashboardOverview(id), ASSOCIATED_CACHE_KEY)
					if (result.error) {
						Toast.show({
							text: 'Can not add validators right now, please try again later',
						})
						loading.dismiss()
						return
					}
					loading.dismiss()

					const validatorCount = getValidatorCount(result.data)

					if (validatorCount + index.length > this.merchant.getCurrentPlanMaxValidator()) {
						Toast.show({
							text: 'You dashboard is full or does not fit all legacy validators',
						})
						loading.dismiss()
						return
					}

					const allGroups = result.data.groups.map((g) => {
						return {
							name: 'group',
							label: g.name + ' (' + g.count + ')',
							value: g.id,
							type: 'radio',
							disabled: g.count + index.length >= this.merchant.getCurrentPlanMaxValidator(),
						}
					})

					this.alert.showSelect('Add to Group', allGroups, async (groupID: number) => {
						loading = await this.alert.presentLoading('Migrating...')
						loading.present()
						const ok = await this.dashboardUtils.addValidators(index, groupID, this.defaultDashboard())
						if (!ok) {
							Toast.show({
								text: 'Can not add validators right now, please try again later',
							})
							loading.dismiss()
							return
						}

						await this.doRefresh()
						this.dashboardUtils.dashboardAwareListener.notifyAll()
						loading.dismiss()
						this.dashboardChangedCallback()
						Toast.show({
							text: 'Validators added to group',
						})
					})
				}
			)
		}

		const allDashboardOptions = () => {
			const result = this.dashboards().validator_dashboards.map((d) => {
				return {
					name: 'dashboard',
					label: d.name,
					value: d.id,
					type: 'radio',
					checked: d.id == this.defaultDashboard(),
				}
			})

			result.push({
				name: 'dashboard',
				label: 'Create new dashboard',
				value: -1,
				type: 'radio',
				checked: false,
			})
			return result
		}

		this.alert.showSelectWithCancel('Select Dashboard', allDashboardOptions(), async (selectedDashboardID: dashboardID) => {
			const checkNetwork = (id: dashboardID) => {
				const formatNetwork = (network: string) => {
					if (network == 'main') return 'Ethereum'
					return capitalize(network)
				}

				const targetNetwork = findChainNetworkById(this.defaultDashboardData().network).legacyKey
				if (legacyAddData.network != targetNetwork) {
					const originName = formatNetwork(legacyAddData.network)
					const targetName = formatNetwork(targetNetwork)

					this.alert.confirmDialog(
						'Network mismatch',
						`This legacy dashboard is from the network "${originName}" but your target dashboard is from the network "${targetName}".<br/><br/> Do you want to add them anyway?`,
						'OK (NOT RECOMMENDED)',
						() => {
							add(id)
						},
						'error-btn'
					)
				} else {
					add(id)
				}
			}

			if (selectedDashboardID == -1) {
				await this.addDashboard(this.dashboardAddButtons[0].network, (id: dashboardID) => {
					checkNetwork(id)
				})
			} else {
				checkNetwork(selectedDashboardID)
			}
		})
	}

	defaultDashboardData = computed(() => {
		return this.dashboards()?.validator_dashboards?.find((d) => d.id == this.defaultDashboard())
	})

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
