import { Component, computed, effect, Input, OnInit, signal, WritableSignal } from '@angular/core'
import { AlertController, IonicModule, ModalController } from '@ionic/angular'
import { UserDashboardsData, ValidatorDashboard } from '@requests/types/dashboard'
import { V2MyDashboards } from '@requests/v2-user'
import { ApiService, capitalize } from '@services/api.service'
import { DashboardItemComponent, LegacyAdd } from '@components/dashboard-item/dashboard-item.component'
import { CommonModule } from '@angular/common'
import { dashboardID, V2CreateDashboard, V2DashboardOverview } from '@requests/v2-dashboard'
import { AlertService, DASHBOARD_SELECTOR } from '@services/alert.service'
import { Toast } from '@capacitor/toast'
import { MerchantUtils } from '@utils/MerchantUtils'
import { StorageService } from '@services/storage.service'
import { DashboardUtils } from '@utils/DashboardUtils'
import { OAuthUtils } from '@utils/OAuthUtils'
import { SubscribePage } from '@pages/subscribe/subscribe.page'
import { FullPageLoadingComponent } from '@components/full-page-loading/full-page-loading.component'
import { CHAIN_NETWORKS, findChainNetworkById, findChainNetworkByName } from '@utils/NetworkData'
import { fromEvent, Subscription } from 'rxjs'
import { FullPageOfflineComponent } from '@components/full-page-offline/full-page-offline.component'
import { OfflineComponentModule } from '@components/offline/offline.module'
import { ValidatorUtils } from '@utils/ValidatorUtils'
import { getValidatorCount } from '@controllers/OverviewController'
import { APIUnauthorizedError } from '@requests/requests'
import { SHOW_TESTNETS_CONFIG } from 'src/app/tabs/tab-preferences/tab-preferences.page'
import { UserInfo } from '@requests/types/user'

const DASHBOARD_INFO_DISMISS_KEY = 'dashboard_info_dismissed'
const ASSOCIATED_CACHE_KEY = 'manage_dashboards'

interface DashboardAddButton {
	network: number
	text: string
}
@Component({
	selector: 'app-dashboard-and-group-select',
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
			this.cancel()
		})
	}

	async ngOnInit() {
		this.infoDismissed = await this.storage.getBooleanSetting(DASHBOARD_INFO_DISMISS_KEY, false)
		this.setup()
	}

	maxAllowedDashboards = computed(() => {
		return this.calculateMaxAllowedDashboards(this.merchant.userInfo())
	})

	calculateMaxAllowedDashboards(userInfo: UserInfo) {
		if (!userInfo) return 1
		return userInfo.premium_perks.validator_dashboards
	}

	sortedValidatorDashboards = computed(() => {
		return (
			this.dashboards()?.validator_dashboards?.sort((a, b) => {
				return a.id - b.id
			}) || []
		)
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

	async initNetworks() {
		this.dashboardAddButtons = []

		CHAIN_NETWORKS.forEach((network) => {
			if (!network.testnet) {
				this.dashboardAddButtons.push({
					network: network.id,
					text: `Add on ${capitalize(network.name)}`,
				})
			}
		})

		if (await this.storage.getBooleanSetting(SHOW_TESTNETS_CONFIG, false)) {
			CHAIN_NETWORKS.forEach((network) => {
				if (network.testnet) {
					this.dashboardAddButtons.push({
						network: network.id,
						text: `Add on ${capitalize(network.name)} (Test)`,
					})
				}
			})
		}
	}

	async setup() {
		this.online = true
		await this.initNetworks()

		this.getLegacyDashboard()

		this.isLoggedIn = await this.storage.isLoggedIn()
		// @deprecated - remove in v2
		if (!this.isLoggedIn) {
			this.dashboards.set({
				validator_dashboards: [
					{
						id: null,
						name: 'Default',
						network: this.api.networkConfig.supportedChainIds,
						is_archived: false,
						validator_count: await this.dashboardUtils.getLocalValidatorCount(),
						group_count: 1,
					},
				],
			} as UserDashboardsData)
			this.initLoading = false
			return
		}

		const result = await this.api.getAllUserDashboards(ASSOCIATED_CACHE_KEY)
		console.log('all dashboards', result)
		if (result.error) {
			console.warn('dashboards can not be loaded', result.error)

			this.dashboardUtils.defaultDashboardErrorHandler(result.error)
			if (!(result.error instanceof APIUnauthorizedError)) {
				this.online = false
			}
			this.initLoading = false
			return
		} else {
			this.dashboards.set(result.data)
		}

		// Convenience: If user already has a testnet dashboard, allow them to create dashboards on testnets too
		if (this.hasTestnetDashboard(result.data.validator_dashboards)) {
			await this.storage.setBooleanSetting(SHOW_TESTNETS_CONFIG, true)
			this.initNetworks()
		}

		this.merchant.getUserInfo(false)
		this.initLoading = false
	}

	hasTestnetDashboard(data: ValidatorDashboard[]) {
		let has = false
		data.forEach((dashboard) => {
			CHAIN_NETWORKS.forEach((network) => {
				if (network.testnet) {
					if (dashboard.network == network.id && network.testnet) {
						has = true
					}
				}
			})
		})
		return has
	}

	async addDashboard(network: number, onSuccessCallback: (id: dashboardID) => void = null) {
		if (!this.isLoggedIn) {
			this.alert.showInfo('Login required', 'You must be logged in to your beaconcha.in account to create or manage dashboards.')
			return
		}

		const networkName = findChainNetworkById(network).name

		const networkPerks = await this.merchant.getUserInfoOnNetwork(network, false)
		if (networkPerks.error) {
			this.alert.showError('Error', 'Could not load network config, please try again later.', DASHBOARD_SELECTOR)
			return
		}

		const validatorCountOnNetwork = this.sortedValidatorDashboards().filter((d) => d.network == network).length
		if (validatorCountOnNetwork >= this.merchant.highestPackageDashboardsAllowed()) {
			this.alert.showInfo(
				'Maximum dashboards reached',
				'You reached the highest possible number of dashboards we currently support on that network. <br/><br/>If you feel like you need more, let us know!'
			)
			return
		}

		if (validatorCountOnNetwork >= this.calculateMaxAllowedDashboards(networkPerks.data)) {
			this.alert.showInfo(
				'Upgrade to premium',
				'You have reached the maximum number of dashboards allowed for your plan on that network. <br/><br/>You can create more dashboards by upgrading to a premium plan.'
			)
			return
		}

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

						const result = await this.api.executeOnChainID(new V2CreateDashboard(alertData.newName, network), null, network)
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

	async cancel() {
		const setDefault = (id: dashboardID) => {
			this.defaultDashboard.set(id)
			if (this.dashboardChangedCallback) {
				this.dashboardChangedCallback()
			}
		}

		// When the current default dashboard has been deleted, we must either pick another or create a new one
		if (this.isLoggedIn && this.sortedValidatorDashboards().find((item) => item.id == this.defaultDashboard()) == null) {
			// if there's at least one other, pick the first
			if (this.sortedValidatorDashboards().length >= 1) {
				setDefault(this.sortedValidatorDashboards()[0].id)
			} else {
				// else we must create one
				const result = await this.api.execute(new V2CreateDashboard('Default Dashboard', this.api.networkConfig.supportedChainIds))
				if (result.error) {
					Toast.show({
						text: 'Error creating dashboard, please try again later',
					})
				}
				this.api.clearSpecificCache(new V2MyDashboards())
				setDefault(result.data.id)
			}
		} else if (this.defaultDashboard() != this.dashboardIDWhenEntered) {
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
				`Do you want to add ${index.length} validator${index.length > 1 ? 's' : ''} from your legacy dashboard to your new dashboard "${this.dashboards()?.validator_dashboards?.find((d) => d.id == id)?.name}"?`,
				'OK',
				async () => {
					let loading = await this.alert.presentLoading('Loading...')
					loading.present()
					const result = await this.api.execute(new V2DashboardOverview(id), ASSOCIATED_CACHE_KEY)
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
						const ok = await this.dashboardUtils.addValidators(index, groupID, id)
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

				const targetNetwork = findChainNetworkById(
					this.dashboards()?.validator_dashboards?.find((d) => d.id == selectedDashboardID).network
				).legacyKey
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
