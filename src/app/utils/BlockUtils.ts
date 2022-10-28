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

import { ApiService } from '../services/api.service';
import { StorageService } from '../services/storage.service';
import { Injectable } from '@angular/core';
import { EpochRequest, EpochResponse, RemoveMyValidatorsRequest, AttestationPerformanceResponse, ValidatorRequest, ValidatorResponse, ValidatorETH1Request, GetMyValidatorsRequest, MyValidatorResponse, DashboardRequest, DashboardResponse, RocketPoolResponse, RocketPoolNetworkStats, ExecutionResponse, BlockProducedByRequest, BlockResponse } from '../requests/requests';
import { AlertService } from '../services/alert.service';
import { CacheModule } from './CacheModule';
import { MerchantUtils } from './MerchantUtils';
import BigNumber from 'bignumber.js';
import { UnitconvService } from '../services/unitconv.service';
import { ValidatorUtils } from './ValidatorUtils';
import { time } from 'highcharts';

export const ROCKETPOOL_SMOOTHING_POOL = "0xd4e96ef8eee8678dbff4d535e033ed1a4f7605b7"
export const ETHPOOL = "0xb364e75b1189dcbbf7f0c856456c1ba8e4d6481b"

const FOURMONTH = 1000 * 60 * 60 * 24 * 120
const THREEMONTH = 1000 * 60 * 60 * 24 * 90
const TWOEMONTH = 1000 * 60 * 60 * 24 * 60
const SIXWEEKS = 1000 * 60 * 60 * 24 * 45
const MONTH = 1000 * 60 * 60 * 24 * 30
const WEEK = 1000 * 60 * 60 * 24 * 7
const FIVEDAYS = 1000 * 60 * 60 * 24 * 5

@Injectable({
    providedIn: 'root'
})
export class BlockUtils extends CacheModule {

    constructor(
        public api: ApiService,
        public validatorUtils: ValidatorUtils
    ) {
        super()
    }
    
    async getBlockRewardWithShare(block: BlockResponse) : Promise<BigNumber>{
        let proposer = block.posConsensus.proposerIndex
        let validator = await this.validatorUtils.getLocalValidatorByIndex(proposer)
        if(validator == null || validator.execshare == null) return new BigNumber(block.producerReward)
        return new BigNumber(block.producerReward).multipliedBy(validator.execshare)
    }

    async getBlocksBy(validatorIndex: number[], offset: number): Promise<BlockResponse[]> {
        let request = new BlockProducedByRequest(offset, 25, validatorIndex)
        let response = await this.api.execute(request)
        let result = request.parse(response)
        return result
    }

    async getMyBlocks(offset: number): Promise<BlockResponse[]> {
        let valis = await this.validatorUtils.getLocalValidatorIndexes()
        if (valis.length == 0) return []
        
        let request = new BlockProducedByRequest(offset, this.getLimit(valis.length), valis)
        let response = await this.api.execute(request)
        let result = request.parse(response)
        return result
    }

    private getLimit(validatorCount: number) : number {
        if (validatorCount <= 4) return 10
        else if (validatorCount <= 10) return 15
        else if (validatorCount <= 20) return 20
        else if (validatorCount <= 50) return 30
        else if (validatorCount <= 100) return 50
        else if (validatorCount <= 200) return 65
        else return 75
    }

    async getProposalLuck(blocks: BlockResponse[]): Promise<Luck> {
        if(blocks.length <= 0) return null
        let earliestBlock = blocks[blocks.length - 1]

        let valis = await this.validatorUtils.getAllValidatorsLocal()
        if(valis.length <= 0) return null
        let currentEpoch = await this.validatorUtils.getRemoteCurrentEpoch()
        
        // calculate blocks with 30d timeframe to see how many blocks we would get
        let blocksIn30d = this.calculateExpectedBlocksInTimeframe(
            MONTH,
            currentEpoch.validatorscount,
            valis.length
        )

       // var timeframe = this.getTimeframe(earliestBlock.timestamp * 1000, blocksIn30d)
        var timeframe = this.findTimeFrameNew(earliestBlock.timestamp * 1000, blocksIn30d)

        if (timeframe == -1) return null

        let blocksAfterTimeframe = this.getBlocksAfterTs(blocks, timeframe)
        if (blocksAfterTimeframe.length <= 0) return null

        let avgBlockInTimeframe = this.calculateExpectedBlocksInTimeframe(
            timeframe,
            currentEpoch.validatorscount,
            valis.length
        )

        return {
            luckPercentage: blocksAfterTimeframe.length / avgBlockInTimeframe,
            timeFrameName: this.getProposalLuckTimeframeName(timeframe),
            expectedBlocksPerMonth: blocksIn30d,
            userValidators: valis.length,
            proposedBlocksInTimeframe: blocksAfterTimeframe.length
        } as Luck
    }

    async getNextBlockEstimate(blocks: BlockResponse[]): Promise<number>{
        if(blocks.length <= 0) return null

        let valis = await this.validatorUtils.getAllValidatorsLocal()
        if(valis.length <= 0) return null
        let currentEpoch = await this.validatorUtils.getRemoteCurrentEpoch()
        
         let blocksIn30d = this.calculateExpectedBlocksInTimeframe(
            MONTH,
            currentEpoch.validatorscount,
            valis.length
         )
        
        let newBlockOnAvgDays = MONTH / blocksIn30d
        return (blocks[0].timestamp*1000) + newBlockOnAvgDays
    }

    private getProposalLuckTimeframeName(timeframe: number): string {
        switch (timeframe) {
            case FOURMONTH: return "4 months"
            case THREEMONTH: return "3 months"
            case TWOEMONTH: return "2 months"
            case SIXWEEKS: return "6 weeks"
            case MONTH: return "month"
            case WEEK: return "week"
            case FIVEDAYS: return "5 days"
        }
        return "month"
    }

    private calculateExpectedBlocksInTimeframe(ts: number, validatorTotalCount: number, userValidatorCount: number): number {
        let slotsInTimeframe = (ts / 1000 / 12)
        return (slotsInTimeframe  / validatorTotalCount) * userValidatorCount
    }

    private getBlocksAfterTs(blocks: BlockResponse[], after: number): BlockResponse[] {
        let result = []
        let curMilies = Date.now()
        for (const block of blocks) {
            if (block.timestamp * 1000 > curMilies - after) {
                result.push(block)
            }
        }
        return result
    }

    private findTimeFrameNew(earliestBlockTs: number, blocksPer30d: number) {
        let curMilies = Date.now()
        let diff = curMilies - earliestBlockTs

        if (diff < FIVEDAYS) {
            return FIVEDAYS
        } else if (diff < WEEK) {
            return WEEK
        } else if (diff < MONTH) {
            return MONTH
        } else if (diff < SIXWEEKS && blocksPer30d <= 2.2) {
            return SIXWEEKS
        } else if (diff < TWOEMONTH && blocksPer30d <= 1.6) {
            return TWOEMONTH
        } else if (diff < THREEMONTH && blocksPer30d <= 0.95) {
            return THREEMONTH
        } else if (diff < FOURMONTH && blocksPer30d <= 0.55) {
            return FOURMONTH
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