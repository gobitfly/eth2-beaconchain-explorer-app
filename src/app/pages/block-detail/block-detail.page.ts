import { Component, OnInit, Input, WritableSignal, signal, computed } from '@angular/core'
import { ETHPOOL, ROCKETPOOL_SMOOTHING_POOL } from 'src/app/utils/BlockUtils'
import * as blockies from 'ethereum-blockies'
import BigNumber from 'bignumber.js'
import { UnitconvService } from 'src/app/services/unitconv.service'
import { ModalController } from '@ionic/angular'
import { Browser } from '@capacitor/browser'
import { ApiService } from 'src/app/services/api.service'
import { VDBBlocksTableRow } from 'src/app/requests/types/validator_dashboard'
import { slotToSecondsTimestamp } from 'src/app/utils/TimeUtils'
import { BlockOverview } from 'src/app/requests/types/block'
import { V2BlockOverview } from 'src/app/requests/v2-blocks'
import { Toast } from '@capacitor/toast'

@Component({
	selector: 'app-block-detail',
	templateUrl: './block-detail.page.html',
	styleUrls: ['./block-detail.page.scss'],
})
export class BlockDetailPage implements OnInit {
	currentY = 0
	scrolling = false

	@Input() block: VDBBlocksTableRow

	imgData = null
	timestamp = 0
	producerReward = new BigNumber(0)
	feeRecipient = ''

	showGasUsedPercent = true
	nameResolved = ''

	overview: WritableSignal<BlockOverview> = signal(null)

	gasUsedPercent = computed(() => {
		return ((parseInt(this.overview().gas_usage) * 100) / this.overview().gas_limit.value).toFixed(1)
	})

	constructor(public unit: UnitconvService, private modalCtrl: ModalController, private api: ApiService) {}

	ngOnInit() {
		this.getOverview()
		this.imgData = this.getBlockies()
		this.timestamp = slotToSecondsTimestamp(this.api, this.block.slot) * 1000
		this.producerReward = new BigNumber(this.block.reward.el).plus(new BigNumber(this.block.reward.cl))
		this.nameResolved = null

		this.feeRecipient = this.block.reward_recipient.hash
		if (this.block.reward_recipient.ens != null) {
			this.nameResolved = this.block.reward_recipient.ens
		}
		if (this.feeRecipient.toLocaleLowerCase() == ROCKETPOOL_SMOOTHING_POOL) {
			this.nameResolved = 'Went to Rocketpool Smoothing-Pool'
		} else if (this.feeRecipient.toLocaleLowerCase() == ETHPOOL) {
			this.nameResolved = 'Distributed via ethpool.eth'
		}
	}

	async getOverview() {
		// todo network
		const result = await this.api.set(new V2BlockOverview('holesky', this.block.block), this.overview)
		if (result.error) {
			Toast.show({
				text: 'Failed to fetch block overview',
				duration: 'long',
			})
			console.error(result.error)
		}
	}

	closeModal() {
		this.modalCtrl.dismiss()
	}

	onScroll($event) {
		this.currentY = $event.detail.currentY
	}

	onScrollStarted() {
		this.scrolling = true
	}

	onScrollEnded() {
		this.scrolling = false
	}

	private getBlockies() {
		// TODO: figure out why the first blockie image is always black
		blockies.create({ seed: this.block.slot.toString() }).toDataURL()
		const dataurl = blockies.create({ seed: this.block.slot.toString(), size: 8, scale: 7 }).toDataURL()
		return dataurl
	}

	switchGasPercent() {
		this.showGasUsedPercent = !this.showGasUsedPercent
	}

	async openBlock() {
		// todo new url
		await Browser.open({
			url: this.api.getBaseUrl() + '/block/' + this.block.slot,
			toolbarColor: '#2f2e42',
		})
	}

	async openFeeRecipient() {
		// todo new url
		await Browser.open({
			url: this.api.getBaseUrl() + '/address/' + this.feeRecipient,
			toolbarColor: '#2f2e42',
		})
	}
}
