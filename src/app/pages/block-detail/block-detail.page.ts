import { Component, OnInit, Input } from '@angular/core'
import { BlockResponse } from 'src/app/requests/requests'
import { BlockUtils, ETHPOOL, ROCKETPOOL_SMOOTHING_POOL } from 'src/app/utils/BlockUtils'
import * as blockies from 'ethereum-blockies'
import BigNumber from 'bignumber.js'
import { UnitconvService } from 'src/app/services/unitconv.service'
import { ModalController } from '@ionic/angular'
import { Browser } from '@capacitor/browser'
import { ApiService } from 'src/app/services/api.service'

@Component({
	selector: 'app-block-detail',
	templateUrl: './block-detail.page.html',
	styleUrls: ['./block-detail.page.scss'],
})
export class BlockDetailPage implements OnInit {
	@Input() block: BlockResponse
	imgData = null
	timestamp = 0
	producerReward = new BigNumber(0)
	feeRecipient = ''
	baseFee = ''
	gasUsedPercent = ''
	burned = new BigNumber(0)

	currentY = 0

	scrolling = false

	showGasUsedPercent = true
	nameResolved = ''

	constructor(private blockUtils: BlockUtils, public unit: UnitconvService, private modalCtrl: ModalController, private api: ApiService) {}

	async ngOnInit() {
		this.imgData = this.getBlockies()
		this.timestamp = this.block.timestamp * 1000
		this.producerReward = await this.blockUtils.getBlockRewardWithShare(this.block)
		this.feeRecipient = this.block.feeRecipient
		if (this.block.relay) {
			this.feeRecipient = this.block.relay.producerFeeRecipient
		}
		this.baseFee = new BigNumber(this.block.baseFee).dividedBy(1e9).toFixed(1) + ' Gwei'
		this.gasUsedPercent = ((this.block.gasUsed * 100) / this.block.gasLimit).toFixed(1)
		this.burned = new BigNumber(this.block.gasUsed).multipliedBy(new BigNumber(this.block.baseFee))

		if (this.feeRecipient.toLocaleLowerCase() == ROCKETPOOL_SMOOTHING_POOL) {
			this.nameResolved = 'Went to Rocketpool Smoothing-Pool'
		} else if (this.feeRecipient.toLocaleLowerCase() == ETHPOOL) {
			this.nameResolved = 'Distributed via ethpool.eth'
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
		blockies.create({ seed: this.block.blockHash }).toDataURL()
		const dataurl = blockies.create({ seed: this.block.blockHash, size: 8, scale: 7 }).toDataURL()
		return dataurl
	}

	switchGasPercent() {
		this.showGasUsedPercent = !this.showGasUsedPercent
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

	async openBlock() {
		await Browser.open({
			url: this.api.getBaseUrl() + '/block/' + this.block.blockNumber,
			toolbarColor: '#2f2e42',
		})
	}

	async openFeeRecipient() {
		await Browser.open({
			url: this.api.getBaseUrl() + '/address/' + this.feeRecipient,
			toolbarColor: '#2f2e42',
		})
	}
}
