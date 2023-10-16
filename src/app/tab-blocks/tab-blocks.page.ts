import { Component, OnInit, ViewChild } from '@angular/core'
import { ModalController } from '@ionic/angular'
import { BlockDetailPage } from '../pages/block-detail/block-detail.page'
import { BlockResponse } from '../requests/requests'
import { AlertService } from '../services/alert.service'
import { ApiService } from '../services/api.service'
import { UnitconvService } from '../services/unitconv.service'
import { BlockUtils, Luck } from '../utils/BlockUtils'
import { ValidatorUtils } from '../utils/ValidatorUtils'
import { InfiniteScrollDataSource, sleep } from '../utils/InfiniteScrollDataSource'
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling'
import { trigger, style, animate, transition } from '@angular/animations'
@Component({
	selector: 'app-tab-blocks',
	templateUrl: './tab-blocks.page.html',
	styleUrls: ['./tab-blocks.page.scss'],
	animations: [trigger('fadeIn', [transition(':enter', [style({ opacity: 0 }), animate('300ms 100ms', style({ opacity: 1 }))])])],
})
export class TabBlocksPage implements OnInit {
	public classReference = UnitconvService

	dataSource: InfiniteScrollDataSource<BlockResponse>
	@ViewChild(CdkVirtualScrollViewport) virtualScroll: CdkVirtualScrollViewport

	loading = false
	loadMore = false

	initialized = false

	luck: Luck = null

	valis = null

	constructor(
		public api: ApiService,
		public unit: UnitconvService,
		private blockUtils: BlockUtils,
		public modalController: ModalController,
		private validatorUtils: ValidatorUtils,
		private alertService: AlertService
	) {
		this.validatorUtils.registerListener(() => {
			this.refresh()
		})
		this.validatorUtils.getAllValidatorsLocal().then((validators) => {
			this.dataSource = new InfiniteScrollDataSource<BlockResponse>(this.blockUtils.getLimit(validators.length), async (offset: number) => {
				let sleepTime = 1000
				if (offset >= 50) {
					sleepTime = 3500 // 20 req per minute => wait at least 3 seconds. Buffer for dashboard and sync stuff
				} else if (offset >= 120) {
					sleepTime = 4500
				}
				if (offset > 0) this.loadMore = true
				await sleep(sleepTime) // handling rate limit of some sorts
				const result = await this.blockUtils.getMyBlocks(offset)
				this.loadMore = false
				return result
			})
		})
	}

	ngOnInit() {
		this.refresh()
	}

	private async init() {
		this.luck = await this.blockUtils.getProposalLuck()
		this.valis = await this.validatorUtils.getAllValidatorsLocal()
		this.virtualScroll.scrollToIndex(0)
		await this.dataSource.reset()
		this.initialized = true
	}

	private async refresh() {
		this.setLoading(true)
		await this.init()
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

	switchCurrencyPipe() {
		if (this.unit.pref == 'ETHER') {
			if (UnitconvService.currencyPipe == null) return
			this.unit.pref = UnitconvService.currencyPipe
		} else {
			UnitconvService.currencyPipe = this.unit.pref
			this.unit.pref = 'ETHER'
		}
	}

	luckHelp() {
		if (!this.luck) {
			this.alertService.showInfo(
				'Proposal Luck',
				`Compares the number of your actual proposed blocks to the expected average blocks per validator during the last month. 
        You'll see your luck percentage once you have proposed a block.`
			)
		} else {
			this.alertService.showInfo(
				'Proposal Luck',
				`Compares the number of your actual proposed blocks to the expected average blocks per validator during the last <strong>${
					this.luck.timeFrameName ? this.luck.timeFrameName : 'month'
				}</strong>. 
        <br/><br/>Your ${this.luck.userValidators == 1 ? `validator is` : `<strong>${this.luck.userValidators}</strong> validators are`}
				expected to produce <strong>${this.luck.expectedBlocksPerMonth.toFixed(2)}</strong> blocks per month on average with current network conditions.`
			)
		}
	}
}
