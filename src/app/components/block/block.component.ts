import { Component, Input, OnInit } from '@angular/core'
import { BlockResponse } from 'src/app/requests/requests'
import * as blockies from 'ethereum-blockies'
import { UnitconvService } from 'src/app/services/unitconv.service'
import { BlockUtils, ETHPOOL, ROCKETPOOL_SMOOTHING_POOL } from 'src/app/utils/BlockUtils'
import BigNumber from 'bignumber.js'
import { ValidatorUtils } from 'src/app/utils/ValidatorUtils'

@Component({
	selector: 'app-block',
	templateUrl: './block.component.html',
	styleUrls: ['./block.component.scss'],
})
export class BlockComponent implements OnInit {
	@Input() block: BlockResponse

	fadeIn = 'fade-in'
	imgData = null
	timestamp = 0
	producerReward = new BigNumber(0)
	feeRecipient = ''
	resolvedName = null
	resolvedClass = ''

	constructor(public unit: UnitconvService, public blockUtils: BlockUtils, private validatorUtils: ValidatorUtils) {
		this.validatorUtils.registerListener(() => {
			this.ngOnChanges()
		})
	}

	async ngOnChanges() {
		this.imgData = this.getBlockies()
		this.timestamp = this.block.timestamp * 1000
		this.producerReward = await await this.blockUtils.getBlockRewardWithShare(this.block)

		this.feeRecipient = this.block.feeRecipient
		if (this.block.relay) {
			this.feeRecipient = this.block.relay.producerFeeRecipient
		}
		if (this.feeRecipient.toLocaleLowerCase() == ROCKETPOOL_SMOOTHING_POOL) {
			this.resolvedName = 'Smoothing Pool'
			this.resolvedClass = 'smoothing'
		} else if (this.feeRecipient.toLocaleLowerCase() == ETHPOOL) {
			this.resolvedName = 'ethpool.eth'
			this.resolvedClass = 'ethpool'
		}
	}

	async setInput(block: BlockResponse) {
		this.block = block
		this.ngOnChanges()
	}

	ngOnInit() {
		setTimeout(() => {
			this.fadeIn = null
		}, 500)
	}

	private getBlockies() {
		// TODO: figure out why the first blockie image is always black
		blockies.create({ seed: this.block.blockHash }).toDataURL()
		const dataurl = blockies.create({ seed: this.block.blockHash, size: 8, scale: 7 }).toDataURL()
		return dataurl
	}
}
