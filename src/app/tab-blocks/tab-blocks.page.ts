import { Component, OnInit } from '@angular/core'
import { ModalController } from '@ionic/angular'
import { BlockDetailPage } from '../pages/block-detail/block-detail.page'
import { BlockResponse } from '../requests/requests'
import { AlertService } from '../services/alert.service'
import { ApiService } from '../services/api.service'
import { UnitconvService } from '../services/unitconv.service'
import { BlockUtils, Luck } from '../utils/BlockUtils'
import { ValidatorUtils } from '../utils/ValidatorUtils'

@Component({
	selector: 'app-tab-blocks',
	templateUrl: './tab-blocks.page.html',
	styleUrls: ['./tab-blocks.page.scss'],
})
export class TabBlocksPage implements OnInit {
	public classReference = UnitconvService

	fadeIn = 'invisible'

	static itemCount = 0

	items: BlockResponse[] = []

	loading = false

	initialized = false

	reachedMax = false

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
	}

	ngOnInit() {
		this.refresh()
	}

	loadData(event) {
		if (this.reachedMax) {
			event.target.disabled = true
		}
		setTimeout(async () => {
			await this.loadMore(false)

			event.target.complete()

			if (this.reachedMax) {
				event.target.disabled = true
			}
		}, 1500)
	}

	private async loadMore(initial: boolean) {
		if (this.reachedMax) {
			return
		}

		const blocks = await this.blockUtils.getMyBlocks(initial ? 0 : this.items.length)
		if (initial) {
			this.items = blocks
			this.luck = await this.blockUtils.getProposalLuck()
			this.valis = await this.validatorUtils.getAllValidatorsLocal()
			this.initialized = true
		} else {
			this.items = this.items.concat(blocks)
		}

		TabBlocksPage.itemCount = this.items.length
		if (blocks.length < this.blockUtils.getLimit(this.valis.length)) {
			this.reachedMax = true
		}
	}

	private async refresh() {
		this.reachedMax = false
		this.setLoading(true)
		await this.loadMore(true)
		this.setLoading(false)
		if (this.fadeIn == 'invisible') {
			this.fadeIn = 'fade-in'
			setTimeout(() => {
				this.fadeIn = null
			}, 1500)
		}
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

	async doRefresh(event) {
		setTimeout(async () => {
			await this.loadMore(true)
			event.target.complete()
		}, 1500)
	}

	itemHeightFn(item, index) {
		if (index == TabBlocksPage.itemCount - 1) return 210
		return 125
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
