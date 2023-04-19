/*
 *  // Copyright (C) 2020 - 2021 Bitfly GmbH
 *  // Manuel Caspari (manuel@bitfly.at)
 *  //
 *  // This file is part of Beaconchain Dashboard.
 *  //
 *  // Beaconchain Dashboard is free software: you can redistribute it and/or modify
 *  // it under the terms of the GNU General Public License as published by
 *  // the Free Software Foundation, either version 3 of the License, or
 *  // (at your option) any later version.
 *  //
 *  // Beaconchain Dashboard is distributed in the hope that it will be useful,
 *  // but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  // MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  // GNU General Public License for more details.
 *  //
 *  // You should have received a copy of the GNU General Public License
 *  // along with Beaconchain Dashboard.  If not, see <http://www.gnu.org/licenses/>.
 */

import { ApiService } from '../services/api.service'
import { Injectable } from '@angular/core'
import { BlockProducedByRequest, BlockResponse } from '../requests/requests'
import { CacheModule } from './CacheModule'
import BigNumber from 'bignumber.js'
import { ValidatorUtils } from './ValidatorUtils'

export const ROCKETPOOL_SMOOTHING_POOL = '0xd4e96ef8eee8678dbff4d535e033ed1a4f7605b7'
export const ETHPOOL = '0xb364e75b1189dcbbf7f0c856456c1ba8e4d6481b'

const YEAR = 1000 * 60 * 60 * 24 * 365
const SIXMONTH = 1000 * 60 * 60 * 24 * 180
const FIVEMONTH = 1000 * 60 * 60 * 24 * 150
const FOURMONTH = 1000 * 60 * 60 * 24 * 120
const THREEMONTH = 1000 * 60 * 60 * 24 * 90
const TWOEMONTH = 1000 * 60 * 60 * 24 * 60
const SIXWEEKS = 1000 * 60 * 60 * 24 * 45
const MONTH = 1000 * 60 * 60 * 24 * 30
const WEEK = 1000 * 60 * 60 * 24 * 7
const FIVEDAYS = 1000 * 60 * 60 * 24 * 5

@Injectable({
	providedIn: 'root',
})
export class BlockUtils extends CacheModule {
	constructor(public api: ApiService, public validatorUtils: ValidatorUtils) {
		super()
	}

	async getBlockRewardWithShare(block: BlockResponse): Promise<BigNumber> {
		const proposer = block.posConsensus.proposerIndex
		const validator = await this.validatorUtils.getLocalValidatorByIndex(proposer)
		if (validator == null || validator.execshare == null) return new BigNumber(block.producerReward)
		return new BigNumber(block.producerReward).multipliedBy(validator.execshare)
	}

	async getBlocksBy(validatorIndex: number[], offset: number): Promise<BlockResponse[]> {
		const request = new BlockProducedByRequest(offset, 25, ...validatorIndex)
		const response = await this.api.execute(request)
		const result = request.parse(response)
		return result
	}

	async getMyBlocks(offset: number): Promise<BlockResponse[]> {
		const valis = await this.validatorUtils.getLocalValidatorIndexes()
		if (valis.length == 0) return []

		const request = new BlockProducedByRequest(offset, this.getLimit(valis.length), valis)
		const response = await this.api.execute(request)
		const result = request.parse(response)
		return result
	}

	private getLimit(validatorCount: number): number {
		if (validatorCount <= 4) return 10
		else if (validatorCount <= 10) return 15
		else if (validatorCount <= 20) return 20
		else if (validatorCount <= 50) return 30
		else if (validatorCount <= 100) return 50
		else if (validatorCount <= 200) return 65
		else return 75
	}

	async getProposalLuck(blocks: BlockResponse[]): Promise<Luck> {
		if (blocks.length <= 0) return null
		const earliestBlock = blocks[blocks.length - 1]

		const valis = await this.validatorUtils.getAllValidatorsLocal()
		if (valis.length <= 0) return null
		const currentEpoch = await this.validatorUtils.getRemoteCurrentEpoch()

		// calculate blocks with 30d timeframe to see how many blocks we would get
		const blocksIn30d = this.calculateExpectedBlocksInTimeframe(MONTH, currentEpoch.validatorscount, valis.length)

		// var timeframe = this.getTimeframe(earliestBlock.timestamp * 1000, blocksIn30d)
		const timeframe = this.findTimeFrameNew(earliestBlock.timestamp * 1000, blocksIn30d)

		if (timeframe == -1) return null

		const blocksAfterTimeframe = this.getBlocksAfterTs(blocks, timeframe)
		if (blocksAfterTimeframe.length <= 0) return null

		const avgBlockInTimeframe = this.calculateExpectedBlocksInTimeframe(timeframe, currentEpoch.validatorscount, valis.length)

		return {
			luckPercentage: blocksAfterTimeframe.length / avgBlockInTimeframe,
			timeFrameName: this.getProposalLuckTimeframeName(timeframe),
			expectedBlocksPerMonth: blocksIn30d,
			userValidators: valis.length,
			proposedBlocksInTimeframe: blocksAfterTimeframe.length,
		} as Luck
	}

	async getNextBlockEstimate(blocks: BlockResponse[]): Promise<number> {
		if (blocks.length <= 0) return null

		const valis = await this.validatorUtils.getAllValidatorsLocal()
		if (valis.length <= 0) return null
		const currentEpoch = await this.validatorUtils.getRemoteCurrentEpoch()

		const blocksIn30d = this.calculateExpectedBlocksInTimeframe(MONTH, currentEpoch.validatorscount, valis.length)

		const newBlockOnAvgDays = MONTH / blocksIn30d
		return blocks[0].timestamp * 1000 + newBlockOnAvgDays
	}

	private getProposalLuckTimeframeName(timeframe: number): string {
		switch (timeframe) {
			case FIVEMONTH:
				return '5 months'
			case FOURMONTH:
				return '4 months'
			case THREEMONTH:
				return '3 months'
			case TWOEMONTH:
				return '2 months'
			case SIXWEEKS:
				return '6 weeks'
			case MONTH:
				return 'month'
			case WEEK:
				return 'week'
			case FIVEDAYS:
				return '5 days'
			case SIXMONTH:
				return '6 months'
			case YEAR:
				return '1 year'
		}
		return 'month'
	}

	private calculateExpectedBlocksInTimeframe(ts: number, validatorTotalCount: number, userValidatorCount: number): number {
		const slotsInTimeframe = ts / 1000 / 12
		return (slotsInTimeframe / validatorTotalCount) * userValidatorCount
	}

	private getBlocksAfterTs(blocks: BlockResponse[], after: number): BlockResponse[] {
		const result = []
		const curMilies = Date.now()
		for (const block of blocks) {
			if (block.timestamp * 1000 > curMilies - after) {
				result.push(block)
			}
		}
		return result
	}

	private findTimeFrameNew(earliestBlockTs: number, blocksPer30d: number) {
		const curMilies = Date.now()
		const diff = curMilies - earliestBlockTs
		const targetBlocks = 8 // target blocks per month

		if (diff < FIVEDAYS) {
			return FIVEDAYS
		} else if (diff < WEEK) {
			return WEEK
		} else if (diff < MONTH) {
			return MONTH
		} else if (diff > YEAR && blocksPer30d <= targetBlocks / 12) {
			return YEAR
		} else if (diff > SIXMONTH && blocksPer30d <= targetBlocks / 6) {
			return SIXMONTH
		} else if (diff > FIVEMONTH && blocksPer30d <= targetBlocks / 5) {
			return FIVEMONTH
		} else if (diff > FOURMONTH && blocksPer30d <= targetBlocks / 4) {
			return FOURMONTH
		} else if (diff > THREEMONTH && blocksPer30d <= targetBlocks / 3) {
			return THREEMONTH
		} else if (diff > TWOEMONTH && blocksPer30d <= targetBlocks / 2) {
			return TWOEMONTH
		} else if (diff > SIXWEEKS && blocksPer30d <= targetBlocks / 1.5) {
			return SIXWEEKS
		}

		return MONTH
	}

	/*private getTimeframe(earliestBlockTs: number, blocksPer30d: number) : number {
        let curMilies = Date.now()
        let diff = curMilies - earliestBlockTs
        // extend the timeframe if less than 2.2 blocks are found per month. Target at least 2.2 - 3.2 blocks per month
        if (blocksPer30d <= 2.2) {
            if (diff > FOURMONTH && blocksPer30d <= 0.55) {
                return FOURMONTH
            } else if (diff > THREEMONTH && blocksPer30d <= 0.95) {
                return THREEMONTH
            } else if (diff > TWOEMONTH && blocksPer30d <= 1.6) {
                return TWOEMONTH
            } else if (diff > SIXWEEKS) {
                return SIXWEEKS
            }
        }
        if (diff > MONTH) return MONTH
        else if (diff > WEEK) return WEEK
        else if (diff > FIVEDAYS) return FIVEDAYS
        return -1
    }*/
}

export interface Luck {
	luckPercentage: number
	timeFrameName: string
	userValidators: number
	expectedBlocksPerMonth: number
	proposedBlocksInTimeframe: number
}
