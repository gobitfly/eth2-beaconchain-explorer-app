import { Component, Input } from '@angular/core'
import * as blockies from 'ethereum-blockies'
import { UnitconvService } from 'src/app/services/unitconv.service'
import { ETHPOOL, ROCKETPOOL_SMOOTHING_POOL } from 'src/app/utils/BlockUtils'
import BigNumber from 'bignumber.js'
import { VDBBlocksTableRow } from 'src/app/requests/types/validator_dashboard'
import { slotToSecondsTimestamp } from 'src/app/utils/TimeUtils'

@Component({
	selector: 'app-block',
	templateUrl: './block.component.html',
	styleUrls: ['./block.component.scss'],
	standalone: false,
})
export class BlockComponent {
	@Input() block: VDBBlocksTableRow
	@Input() first: boolean
	@Input() last: boolean
	@Input() chainID: number

	imgData: string = null
	timestamp = 0
	producerReward = new BigNumber(0)
	feeRecipient: string = null
	resolvedName: string = null
	resolvedClass = ''

	constructor(public unit: UnitconvService) {}

	ngOnChanges() {
		this.imgData = this.getBlockies()
		this.timestamp = slotToSecondsTimestamp(this.chainID, this.block.slot) * 1000
		if (this.block.reward) {
			this.producerReward = new BigNumber(this.block.reward.el).plus(new BigNumber(this.block.reward.cl))
		}
		this.resolvedName = null

		this.feeRecipient = this.block.reward_recipient?.hash
		if (this.block.reward_recipient?.ens != null) {
			this.resolvedName = this.block.reward_recipient.ens
		}
		if (this.block.reward_recipient?.hash?.toLocaleLowerCase() == ROCKETPOOL_SMOOTHING_POOL) {
			this.resolvedName = 'Smoothing Pool'
			this.resolvedClass = 'smoothing'
		} else if (this.block.reward_recipient?.hash?.toLocaleLowerCase() == ETHPOOL) {
			this.resolvedName = 'ethpool.eth'
			this.resolvedClass = 'ethpool'
		}
	}

	setInput(block: VDBBlocksTableRow) {
		this.block = block
		this.ngOnChanges()
	}

	private getBlockies() {
		// TODO: figure out why the first blockie image is always black
		blockies.create({ seed: this.block.slot.toString() }).toDataURL()
		const dataurl = blockies.create({ seed: this.block.slot.toString(), size: 8, scale: 7 }).toDataURL()
		return dataurl
	}
}
