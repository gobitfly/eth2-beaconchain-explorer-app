import { Component, computed, OnInit, signal, ViewChild, WritableSignal } from '@angular/core'
import { ModalController } from '@ionic/angular'
import { BlockDetailPage } from '../pages/block-detail/block-detail.page'
import { APINotFoundError, ApiResult, APIUnauthorizedError } from '../requests/requests'
import { AlertService } from '../services/alert.service'
import { ApiService } from '../services/api.service'
import { UnitconvService } from '../services/unitconv.service'
import { InfiniteScrollDataSource, loadMoreType } from '../utils/InfiniteScrollDataSource'
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling'
import { VDBBlocksTableRow, VDBGroupSummaryData } from '../requests/types/validator_dashboard'
import { StorageService } from '../services/storage.service'
import { dashboardID, Period, V2DashboardSummaryGroupTable } from '../requests/v2-dashboard'
import { Toast } from '@capacitor/toast'
import { V2DashboardBlocks } from '../requests/v2-blocks'
import { DashboardAndGroupSelectComponent } from '../modals/dashboard-and-group-select/dashboard-and-group-select.component'
import { DashboardUtils } from '../utils/DashboardUtils'
import { relativeTs, toDateTime } from '../utils/TimeUtils'

const PAGE_SIZE = 25
const DASHBOARD_UPDATE = 'blocks_update'
const ASSOCIATED_CACHE_KEY = 'blocks'
@Component({
	selector: 'app-tab-blocks',
	templateUrl: './tab-blocks.page.html',
	styleUrls: ['./tab-blocks.page.scss'],
})
export class TabBlocksPage implements OnInit {
	public classReference = UnitconvService

	dataSource: InfiniteScrollDataSource<VDBBlocksTableRow>
	@ViewChild(CdkVirtualScrollViewport) virtualScroll: CdkVirtualScrollViewport

	initialLoading = true
	loadMore = false

	initialized = false

	isLoggedIn = false
	dashboardID: dashboardID

	summaryGroup: WritableSignal<VDBGroupSummaryData> = signal(null)

	chainID = 0

	online: boolean = true

	constructor(
		public api: ApiService,
		public unit: UnitconvService,
		public modalController: ModalController,
		private alertService: AlertService,
		private storage: StorageService,
		private modalCtrl: ModalController,
		private alerts: AlertService,
		private dashboardUtils: DashboardUtils
	) {
		this.dashboardUtils.dashboardAwareListener.register(DASHBOARD_UPDATE)
	}

	async ionViewWillEnter() {
		if (this.dashboardUtils.dashboardAwareListener.hasAndConsume(DASHBOARD_UPDATE)) {
			await this.clearRequestCache()
			await this.setup()
			await this.update()
			return
		}
	}

	async ngOnInit() {
		this.initialized = false
		await this.setup()
		await this.update()
	}

	/**
	 * Call when you need to clear the API request cache for all calls this view made.
	 * Note: when making calls in this view, always use the ASSOCIATED_CACHE_KEY
	 * @returns promise void
	 */
	clearRequestCache() {
		return this.api.clearAllAssociatedCacheKeys(ASSOCIATED_CACHE_KEY)
	}

	private async setup() {
		this.dashboardID = await this.dashboardUtils.initDashboard()
		this.isLoggedIn = await this.storage.isLoggedIn()
		this.chainID = await this.api.getCurrentDashboardChainID()

		if (!this.dashboardID) {
			this.initialized = true
			this.initialLoading = false
			return
		}

		await this.loadSummaryGroup()
		this.dataSource = new InfiniteScrollDataSource<VDBBlocksTableRow>(PAGE_SIZE, this.getDefaultDataRetriever())
	}

	private async loadSummaryGroup(recursiveMax = false): Promise<ApiResult<VDBGroupSummaryData>> {
		const result = await this.api.set(
			new V2DashboardSummaryGroupTable(this.dashboardID, 0, Period.AllTime, null),
			this.summaryGroup,
			ASSOCIATED_CACHE_KEY
		)
		if (result.error) {
			if (result.error instanceof APINotFoundError) {
				if (recursiveMax) {
					Toast.show({
						text: 'Dashboard not found',
					})
					return
				}
				this.storage.setDashboardID(null)
				// if dashboard is not available any more (maybe user deleted it) reinit and try again
				this.dashboardID = await this.dashboardUtils.initDashboard()
				return this.loadSummaryGroup(true)
			} else {
				this.dashboardUtils.defaultDashboardErrorHandler(result.error)
			}
		}
		return result
	}

	private getDefaultDataRetriever(): loadMoreType<VDBBlocksTableRow> {
		return async (cursor) => {
			this.loadMore = !!cursor
			const result = await this.api.execute2(new V2DashboardBlocks(this.dashboardID, cursor, PAGE_SIZE), ASSOCIATED_CACHE_KEY)
			if (result.error) {
				Toast.show({
					text: 'Could not load blocks',
					duration: 'long',
				})
				if (!(result.error instanceof APIUnauthorizedError)) {
					// todo change to just if timeout?
					this.online = false
				}

				console.error('Could not load blocks', result.error)
				return {
					data: undefined,
					next_cursor: null,
				}
			}
			this.loadMore = false

			return {
				data: result.data as VDBBlocksTableRow[],
				next_cursor: result.paging?.next_cursor,
			}
		}
	}

	expectedNextBlockTs = computed(() => {
		console.log('expectedNextBlockTs', this.summaryGroup())
		if (!this.summaryGroup()) {
			return new Date()
		}
		return toDateTime(this.summaryGroup()?.luck?.proposal?.expected_timestamp ?? 0)
	})

	private async update() {
		if (!this.dashboardID) {
			return
		}
		this.initialLoading = true
		this.online = true

		await this.dataSource.reset()
		this.virtualScroll.scrollToIndex(0)
		this.initialized = true

		this.initialLoading = false
	}

	async clickBlock(item: VDBBlocksTableRow) {
		const modal = await this.modalController.create({
			component: BlockDetailPage,
			cssClass: 'my-custom-class',
			componentProps: {
				block: item,
			},
		})
		return await modal.present()
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

		await this.clearRequestCache()
		this.update()
		if (event) event.target.complete()
	}

	luckHelp() {
		if (!this.summaryGroup()) {
			this.alertService.showInfo(
				'Proposal Luck',
				`Compares the number of your actual proposed blocks to the expected average blocks per validator during the last month.
		You'll see your luck percentage once you have proposed a block.`
			)
		} else {
			this.alertService.showInfo(
				'Proposal Luck',
				`With current network conditions, your validators are expected to produce a block every <strong>${relativeTs(
					this.summaryGroup().luck.proposal.average_interval_seconds
				)}</strong> (on average).`
			)
		}
	}

	async openDashboardAndGroupSelect() {
		const modal = await this.modalCtrl.create({
			component: DashboardAndGroupSelectComponent,
			componentProps: {
				dashboardChangedCallback: async () => {
					const loading = await this.alerts.presentLoading('Loading...')
					loading.present()
					await this.ngOnInit()
					loading.dismiss()
				},
			},
		})
		modal.present()

		await modal.onWillDismiss()
	}
}
