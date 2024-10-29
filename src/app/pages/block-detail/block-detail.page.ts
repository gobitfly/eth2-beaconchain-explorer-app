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
import { findChainNetworkById } from 'src/app/utils/NetworkData'
import { V1BlockResponse, V1BlocksOverview } from 'src/app/requests/requests'

@Component({
	selector: 'app-block-detail',
	templateUrl: './block-detail.page.html',
	styleUrls: ['./block-detail.page.scss'],
})
export class BlockDetailPage implements OnInit {
	currentY = 0
	scrolling = false

	@Input() block: VDBBlocksTableRow

	imgData: string = null
	timestamp = 0
	producerReward = new BigNumber(0)
	feeRecipient: string = null

	showGasUsedPercent = true
	nameResolved = ''

	// overview: WritableSignal<BlockOverview> = signal(null) // v2
	v1Overview: WritableSignal<V1BlockResponse> = signal(null)

	gasUsedPercent = computed(() => {
		return ((this.v1Overview().gasUsed * 100) / this.v1Overview().gasLimit).toFixed(1)
		//v2: return ((parseInt(this.overview().gas_usage) * 100) / this.overview().gas_limit.value).toFixed(1)
	})

	chainID = 0

	online: boolean = true
	initialLoading: boolean = true

	constructor(
		public unit: UnitconvService,
		private modalCtrl: ModalController,
		protected api: ApiService
	) {}

	async ngOnInit() {
		this.online = true
		this.chainID = await this.api.getCurrentDashboardChainID()
		this.getOverviewv1()
		this.imgData = this.getBlockies()
		this.timestamp = slotToSecondsTimestamp(this.chainID, this.block.slot) * 1000
		if (this.block.reward) {
			this.producerReward = new BigNumber(this.block.reward.el).plus(new BigNumber(this.block.reward.cl))
		}
		this.nameResolved = null

		this.feeRecipient = this.block.reward_recipient?.hash
		if (this.block.reward_recipient?.ens != null) {
			this.nameResolved = this.block.reward_recipient?.ens
		}
		if (this.block.reward_recipient?.hash?.toLocaleLowerCase() == ROCKETPOOL_SMOOTHING_POOL) {
			this.nameResolved = 'Went to Rocketpool Smoothing-Pool'
		} else if (this.block.reward_recipient?.hash?.toLocaleLowerCase() == ETHPOOL) {
			this.nameResolved = 'Distributed via ethpool.eth'
		}

		if (this.block.status == 'missed') {
			this.feeRecipient = 'This block was missed'
		} else if (this.block.status == 'orphaned') {
			this.feeRecipient = 'This block was orphaned'
		} else if (this.block.status == 'scheduled') {
			this.feeRecipient = 'This block is scheduled'
		}
	}

	getChainNetwork() {
		return findChainNetworkById(this.chainID)
	}

	// v2
	// async getOverview() {
	// 	if (!this.block.block) {
	// 		this.initialLoading = false
	// 		return
	// 	}
	// 	const result = await this.api.set(new V2BlockOverview(this.chainID, this.block.block), this.overview)
	// 	if (result.error) {
	// 		Toast.show({
	// 			text: 'Failed to fetch block overview',
	// 			duration: 'long',
	// 		})
	// 		this.online = false
	// 		console.error(result.error)
	// 	}
	// 	this.initialLoading = false
	// }

	async getOverviewv1() {
		if (!this.block.block) {
			this.initialLoading = false
			return
		}
		const result = await this.api.execute2(new V1BlocksOverview(this.block.block))
		console.log('v1 block result', result)
		if (result.error) {
			Toast.show({
				text: 'Failed to fetch block overview',
				duration: 'long',
			})
			this.online = false
			console.error(result.error)
		}
		this.v1Overview.set(result.data[0])
		this.initialLoading = false
	}

	closeModal() {
		this.modalCtrl.dismiss()
	}

	onScroll($event: { detail: { currentY: number } }) {
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
