import { Component, computed, OnInit, signal, ViewChild, WritableSignal } from '@angular/core'
import { ModalController } from '@ionic/angular'
import { BlockDetailPage } from '../pages/block-detail/block-detail.page'
import { BlockResponse } from '../requests/requests'
import { AlertService } from '../services/alert.service'
import { ApiService } from '../services/api.service'
import { UnitconvService } from '../services/unitconv.service'
import { ValidatorUtils } from '../utils/ValidatorUtils'
import { InfiniteScrollDataSource, loadMoreType } from '../utils/InfiniteScrollDataSource'
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling'
import { trigger, style, animate, transition } from '@angular/animations'
import { VDBBlocksTableRow, VDBGroupSummaryData } from '../requests/types/validator_dashboard'
import { StorageService } from '../services/storage.service'
import { dashboardID, Period, V2DashboardSummaryGroupTable } from '../requests/v2-dashboard'
import { Toast } from '@capacitor/toast'
import { V2DashboardBlocks } from '../requests/v2-blocks'
import { DashboardAndGroupSelectComponent } from '../modals/dashboard-and-group-select/dashboard-and-group-select.component'

const PAGE_SIZE = 20
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

	expectedNextBlockTs = computed(() => {
		if (!this.summaryGroup()) {
			return 0
		}
		return Date.parse(this.summaryGroup().luck.proposal.expected)
	})

	constructor(
		public api: ApiService,
		public unit: UnitconvService,
		public modalController: ModalController,
		private validatorUtils: ValidatorUtils,
		private alertService: AlertService,
		private storage: StorageService,
		private modalCtrl: ModalController,
		private alerts: AlertService
	) {
		this.validatorUtils.registerListener(() => {
			this.refresh()
		})
	}

	async ngOnInit() {
		this.initialized = false
		await this.init()
		await this.refresh()
	}

	private async init() {
		this.dashboardID = await this.storage.getDashboardID()
		this.isLoggedIn = await this.storage.isLoggedIn()
		
		await this.loadSummaryGroup()
		this.dataSource = new InfiniteScrollDataSource<VDBBlocksTableRow>(PAGE_SIZE, this.getDefaultDataRetriever())
	}

	private async loadSummaryGroup() {
		const result = await this.api.set(new V2DashboardSummaryGroupTable(this.dashboardID, 0, Period.AllTime, null), this.summaryGroup)
		if (result.error) {
			Toast.show({
				text: 'Could not load summary group',
				duration: 'long',
			})
			return
		}
	}

	private getDefaultDataRetriever(): loadMoreType<VDBBlocksTableRow> {
		return async (cursor) => {
			// todo no account handling
			if (!this.isLoggedIn) {
				this.initialized = true
				return {
					data: [],
					next_cursor: null,
				}
			}

			this.loadMore = !!cursor
			const result = await this.api.execute2(new V2DashboardBlocks(this.dashboardID, cursor, PAGE_SIZE))
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

	private async refresh() {
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
				`With current network conditions, your validators are expected to produce a block every <strong>${this.relativeTs(
					this.summaryGroup().luck.proposal.average
				)}</strong> (on average).`
			)
		}
	}

	relativeTs(diff: number) {
		const seconds = Math.floor(diff / 1000)
		const minutes = Math.floor(seconds / 60)
		const hours = Math.floor(minutes / 60)
		const days = Math.floor(hours / 24)
		const months = Math.floor(days / 30)

		if (months > 0) {
			return months > 1 ? `${months} months` : 'month'
		} else if (days > 0) {
			return days > 1 ? `${days} days` : 'day'
		} else if (hours > 0) {
			return hours > 1 ? `${hours} hours` : 'hour'
		} else if (minutes > 0) {
			return minutes > 1 ? `${minutes} minutes` : 'minute'
		} else {
			return seconds > 1 ? `${seconds} seconds` : 'second'
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
