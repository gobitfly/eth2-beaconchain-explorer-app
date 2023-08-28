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
import { BlockProducedByRequest, BlockResponse, DashboardRequest } from '../requests/requests'
import { CacheModule } from './CacheModule'
import BigNumber from 'bignumber.js'
import { ValidatorUtils } from './ValidatorUtils'

export const ROCKETPOOL_SMOOTHING_POOL = '0xd4e96ef8eee8678dbff4d535e033ed1a4f7605b7'
export const ETHPOOL = '0xb364e75b1189dcbbf7f0c856456c1ba8e4d6481b'

const MONTH = 60 * 60 * 24 * 30

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
		const valis = await this.validatorUtils.getAllValidatorsLocal()
		if (valis.length == 0) return []

		const request = new BlockProducedByRequest(offset, this.getLimit(valis.length), ...valis.map((vali) => vali.index))
		const response = await this.api.execute(request)
		const result = request.parse(response)
		return result
	}

	public getLimit(validatorCount: number): number {
		if (validatorCount <= 4) return 10
		else if (validatorCount <= 10) return 15
		else if (validatorCount <= 20) return 20
		else if (validatorCount <= 50) return 30
		else if (validatorCount <= 100) return 50
		else if (validatorCount <= 200) return 65
		else return 75
	}

	async getProposalLuck(): Promise<Luck> {
		const valis = await this.validatorUtils.getAllValidatorsLocal()
		if (valis.length == 0) return null

		const request = new DashboardRequest(...valis.map((vali) => vali.index))
		const response = await this.api.execute(request)
		const result = request.parse(response)[0]
		const proposalLuckStats = result.proposal_luck_stats
		return {
			luckPercentage: proposalLuckStats.proposal_luck,
			timeFrameName: proposalLuckStats.time_frame_name,
			userValidators: valis.length,
			expectedBlocksPerMonth: MONTH / (proposalLuckStats.average_proposal_interval * 12),
			nextBlockEstimate: proposalLuckStats.next_proposal_estimate_ts * 1000,
		} as Luck
	}
}

export interface Luck {
	luckPercentage: number
	timeFrameName: string
	userValidators: number
	expectedBlocksPerMonth: number
	nextBlockEstimate: number
}
