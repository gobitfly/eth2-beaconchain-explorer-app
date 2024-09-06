import { Component, computed, OnInit, signal, ViewChild, WritableSignal } from '@angular/core'
import { ModalController } from '@ionic/angular'
import { BlockDetailPage } from '../pages/block-detail/block-detail.page'
import { BlockResponse } from '../requests/requests'
import { AlertService } from '../services/alert.service'
import { ApiService } from '../services/api.service'
import { UnitconvService } from '../services/unitconv.service'
import { InfiniteScrollDataSource, loadMoreType } from '../utils/InfiniteScrollDataSource'
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling'
import { trigger, style, animate, transition } from '@angular/animations'
import { VDBBlocksTableRow, VDBGroupSummaryData } from '../requests/types/validator_dashboard'
import { StorageService } from '../services/storage.service'
import { dashboardID, Period, V2DashboardSummaryGroupTable } from '../requests/v2-dashboard'
import { Toast } from '@capacitor/toast'
import { V2DashboardBlocks } from '../requests/v2-blocks'
import { DashboardAndGroupSelectComponent } from '../modals/dashboard-and-group-select/dashboard-and-group-select.component'
import { DashboardError, DashboardNotFoundError, getDashboardError } from '../controllers/OverviewController'
import { DashboardUtils } from '../utils/DashboardUtils'
import { relativeTs } from '../utils/TimeUtils'

const PAGE_SIZE = 20
const DASHBOARD_UPDATE = 'blocks_update'
const ASSOCIATED_CACHE_KEY = 'blocks'
@Component({
	selector: 'app-tab-blocks',
	templateUrl: './tab-blocks.page.html',
	styleUrls: ['./tab-blocks.page.scss'],
	animations: [trigger('fadeIn', [transition(':enter', [style({ opacity: 0 }), animate('300ms 100ms', style({ opacity: 1 }))])])],
})
export class TabBlocksPage implements OnInit {
	public classReference = UnitconvService

	dataSource: InfiniteScrollDataSource<VDBBlocksTableRow>
	@ViewChild(CdkVirtualScrollViewport) virtualScroll: CdkVirtualScrollViewport

	loading = false
	loadMore = false

	initialized = false

	isLoggedIn = false
	dashboardID: dashboardID

	summaryGroup: WritableSignal<VDBGroupSummaryData> = signal(null)

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

	clearRequestCache() {
		return this.api.clearAllAssociatedCacheKeys(ASSOCIATED_CACHE_KEY)
	}

	private async setup() {
		this.dashboardID = await this.dashboardUtils.initDashboard()
		this.isLoggedIn = await this.storage.isLoggedIn()

		if (!this.dashboardID) {
			this.initialized = true
			return
		}

		await this.loadSummaryGroup()
		this.dataSource = new InfiniteScrollDataSource<VDBBlocksTableRow>(PAGE_SIZE, this.getDefaultDataRetriever())
	}

	private async loadSummaryGroup(recursiveMax = false) {
		const result = await this.api.set(
			new V2DashboardSummaryGroupTable(this.dashboardID, 0, Period.AllTime, null),
			this.summaryGroup,
			ASSOCIATED_CACHE_KEY
		)
		const e = getDashboardError(result)
		if (e) {
			if (e instanceof DashboardNotFoundError) {
				if (recursiveMax) {
					Toast.show({
						text: 'Dashboard not found',
					})
					return
				}
				// if dashboard is not available any more (maybe user deleted it) reinit and try again
				this.dashboardID = await this.dashboardUtils.initDashboard()
				return this.loadSummaryGroup(true)
			} else if (e instanceof DashboardError) {
				this.dashboardUtils.defaultDashboardErrorHandler(e)
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
		if (!this.summaryGroup()) {
			return 0
		}
		return Date.parse(this.summaryGroup().luck.proposal.expected)
	})

	private async update() {
		if (!this.dashboardID) {
			return
		}
		this.setLoading(true)

		await this.dataSource.reset()
		this.virtualScroll.scrollToIndex(0)
		this.initialized = true

		this.setLoading(false)
	}

	private setLoading(loading: boolean) {
		this.loading = loading
	}

	async clickBlock(item: BlockResponse) {
		const modal = await this.modalController.create({
			component: BlockDetailPage,
			cssClass: 'my-custom-class',
			componentProps: {
				block: item,
			},
		})
		return await modal.present()
	}

	doRefresh(event) {
		setTimeout(async () => {
			await this.clearRequestCache()
			this.virtualScroll.scrollToIndex(0)
			await this.dataSource.reset()
			event.target.complete()
		}, 1500)
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
					this.summaryGroup().luck.proposal.average
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
