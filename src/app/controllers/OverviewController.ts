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

import { EpochResponse, ValidatorResponse } from '../requests/requests';
import { sumBigInt, findHighest, findLowest } from '../utils/MathUtils'
import Unit, { convertEthUnits } from '../utils/EthereumUnits'
import BigNumber from "bignumber.js";
import { Validator } from '../utils/ValidatorUtils';
import { formatDate } from '@angular/common';
import { getValidatorQueryString, ValidatorState } from '../utils/ValidatorUtils';
import { ApiService } from '../services/api.service';

export type OverviewData = {
    overallBalance: BigNumber
    validatorCount: number
    requiredValidatorsForOKState: number
    exitedValidatorsCount: number
    activeValidatorCount: number
    performance1d: BigNumber
    performance31d: BigNumber
    performance7d: BigNumber
    performance365d: BigNumber
    slashedCount: number
    awaitingActivationCount: number
    activationeligibilityCount: number
    bestRank: number,
    worstRank: number
    attrEffectiveness: number

    dashboardState: DashboardStatus
    lazyLoadChart: boolean
    lazyChartValidators: string
    foreignValidator: boolean
    foreignValidatorItem?: Validator
    apr: number
    effectiveBalance: BigNumber
    currentEpoch: EpochResponse
    rocketpool: Rocketpool
}

export type Rocketpool = {
    minRpl: BigNumber
    maxRpl: BigNumber
    currentRpl: BigNumber
    totalClaims: BigNumber
    fee: number
    status: string
    depositType: string
}

export type DashboardStatus = {
    icon: string,
    title: string,
    description: string,
    extendedDescription: string,
    extendedDescriptionPre: string
    iconCss: string,
}

export type Description = {
    extendedDescription: string,
    extendedDescriptionPre: string
}

export default class OverviewController {

    constructor(private refreshCallback: () => void = null, private userMaxValidators = 280) {}

    proccessDashboard(
        validators: Validator[],
        currentEpoch: EpochResponse,
    ) {
        return this.process(validators, currentEpoch, false)
    }

    proccessDetail(
        validators: Validator[],
        currentEpoch: EpochResponse,
    ) {
        return this.process(validators, currentEpoch, true)
    }

    private process(
        validators: Validator[],
        currentEpoch: EpochResponse,
        foreignValidator = false,
    ): OverviewData {
        if (!validators || validators.length <= 0 || currentEpoch == null) return null

        const effectiveBalance = sumBigInt(validators, cur => cur.data.effectivebalance);
        const effectiveBalanceActive = sumBigInt(validators, cur => {
            return cur.data.activationepoch <= currentEpoch.epoch ? cur.data.effectivebalance : new BigNumber(0)
        });


        const overallBalance = this.sumBigIntBalanceRpl(validators, cur => new BigNumber(cur.data.balance))
        
        const validatorCount = validators.length

        const performance1d = this.sumBigIntPerformanceRpl(validators, cur => new BigNumber(cur.data.performance1d).multipliedBy(new BigNumber(cur.share === null ? 1 : cur.share)));
        const performance31d = this.sumBigIntPerformanceRpl(validators, cur => new BigNumber(cur.data.performance31d).multipliedBy(new BigNumber(cur.share === null ? 1 : cur.share)))
        const performance7d = this.sumBigIntPerformanceRpl(validators, cur => new BigNumber(cur.data.performance7d).multipliedBy(new BigNumber(cur.share === null ? 1 : cur.share)));
        const performance365d = this.sumBigIntPerformanceRpl(validators, cur => new BigNumber(cur.data.performance365d).multipliedBy(new BigNumber(cur.share === null ? 1 : cur.share)))

        const aprPerformance7d = sumBigInt(validators, cur => cur.data.performance7d);

        var attrEffectiveness = -1
        attrEffectiveness = sumBigInt(validators, cur => cur.attrEffectiveness ? new BigNumber(cur.attrEffectiveness.toString()): new BigNumber(0))
            .dividedBy(validators.length)
            .decimalPlaces(1).toNumber();
        

        const bestRank = findLowest(validators, cur => cur.data.rank7d)
        const worstRank = findHighest(validators, cur => cur.data.rank7d)
        const rocketpoolValiCount = sumBigInt(validators, cur => cur.rocketpool ? new BigNumber(1) : new BigNumber(0))
        const feeSum = sumBigInt(validators, cur => cur.rocketpool ? new BigNumber(cur.rocketpool.minipool_node_fee).multipliedBy("100") : new BigNumber("0"))
        var feeAvg = 0
        if (feeSum.decimalPlaces(3).toNumber() != 0) {
            feeAvg = feeSum.dividedBy(rocketpoolValiCount).decimalPlaces(1).toNumber()
        }

        return {
            overallBalance: overallBalance,
            validatorCount: validatorCount,
            bestRank: bestRank,
            worstRank: worstRank,

            attrEffectiveness: attrEffectiveness,
            performance1d: performance1d,
            performance31d: performance31d,
            performance7d: performance7d,
            performance365d: performance365d,
            dashboardState: this.getDashboardState(validators, currentEpoch, foreignValidator),
            lazyLoadChart: true,
            lazyChartValidators: getValidatorQueryString(validators, 2000, this.userMaxValidators - 1), 
            foreignValidator: foreignValidator,
            foreignValidatorItem: foreignValidator ? validators[0] : null,
            effectiveBalance: effectiveBalance,
            currentEpoch: currentEpoch,
            apr: this.getAPR(effectiveBalanceActive, aprPerformance7d),
            rocketpool: {
                minRpl: this.sumRocketpoolBigIntPerNodeAddress(true, validators, cur => cur.rocketpool.node_min_rpl_stake),
                maxRpl: this.sumRocketpoolBigIntPerNodeAddress(true, validators, cur => cur.rocketpool.node_max_rpl_stake),
                currentRpl: this.sumRocketpoolBigIntPerNodeAddress(true, validators, cur => cur.rocketpool.node_rpl_stake),
                totalClaims: this.sumRocketpoolBigIntPerNodeAddress(true, validators, cur => cur.rocketpool.rpl_cumulative_rewards),
                fee: feeAvg,
                status: foreignValidator && validators[0].rocketpool ? validators[0].rocketpool.minipool_status : null,
                depositType: foreignValidator && validators[0].rocketpool ? validators[0].rocketpool.minipool_deposit_type : null,
            }
        } as OverviewData;
    }

    sumBigIntBalanceRpl<T>(validators: Validator[], field: (cur: Validator) => BigNumber): BigNumber {
       
        return sumBigInt(validators, cur => {
            if (!cur.rocketpool) return field(cur).multipliedBy(new BigNumber(cur.share === null ? 1 : cur.share))
            if (!cur.rocketpool.node_address) return field(cur).multipliedBy(new BigNumber(cur.share === null ? 1 : cur.share))
          
            const rewards = new BigNumber(field(cur).toString()).minus(cur.data.effectivebalance)
            const nodeOperatorRewards = new BigNumber(rewards).multipliedBy(new BigNumber("1").plus(new BigNumber(cur.rocketpool.minipool_node_fee.toString()))).dividedBy("2")
            const wholeBalance = new BigNumber("16000000000").plus(nodeOperatorRewards)
            return wholeBalance.multipliedBy(new BigNumber(cur.share === null ? 1 : cur.share))
        })
    }


    sumBigIntPerformanceRpl<T>(validators: Validator[], field: (cur: Validator) => BigNumber): BigNumber {
       
        return sumBigInt(validators, cur => {
            if (!cur.rocketpool) return field(cur)
            if (!cur.rocketpool.node_address) return field(cur)
          
            return new BigNumber(field(cur).toString()).multipliedBy(new BigNumber("1").plus(new BigNumber(cur.rocketpool.minipool_node_fee.toString()))).dividedBy("2")
        })
    }

    sumRocketpoolBigIntPerNodeAddress<T>(applyShare: boolean, validators: Validator[], field: (cur: Validator) => string): BigNumber {
        const nodesAdded = new Set()
        return sumBigInt(validators, cur => {
            if (!cur.rocketpool) return new BigNumber(0)
            if (!cur.rocketpool.node_address) return new BigNumber(0)
            if (nodesAdded.has(cur.rocketpool.node_address)) return new BigNumber(0)
            nodesAdded.add(cur.rocketpool.node_address)
            const temp = new BigNumber(field(cur).toString())
            if (applyShare) {
                return temp.multipliedBy(cur.rplshare == null ? 1 : cur.rplshare)
            }
            return temp
        })
    }

    getAPR(effectiveBalance, performance) {
        return new BigNumber(performance.toString()).multipliedBy("5214").dividedBy(effectiveBalance).decimalPlaces(1).toNumber()
    }

    getDashboardState(validators: Validator[], currentEpoch: EpochResponse, foreignValidator): DashboardStatus {
        const validatorCount = validators.length
        const activeValidators = this.getActiveValidators(validators)
        const activeValidatorCount = activeValidators.length

        const exitedValidators = this.getExitedValidators(validators)
        const exitedValidatorsCount = exitedValidators.length
        const requiredValidatorsForOKState = validatorCount - exitedValidatorsCount

        const slashedValidators = this.getSlashedValidators(validators)
        const slashedCount = slashedValidators.length

        if (slashedCount > 0) {
            return this.getSlashedState(activeValidatorCount,
                validatorCount,
                foreignValidator,
                slashedValidators[0].data,
                currentEpoch,
                slashedCount == validatorCount
            )
        }

        if (activeValidatorCount == requiredValidatorsForOKState && activeValidatorCount != 0) {
            return this.getOkState(
                activeValidatorCount,
                validatorCount,
                foreignValidator,
                activeValidators[0].data,
                currentEpoch
            )
        } else if (activeValidatorCount == requiredValidatorsForOKState && activeValidatorCount == 0) {
            return this.getExitedState(
                activeValidatorCount,
                validatorCount,
                foreignValidator
            )
        }

        const awaitingActivation = this.getWaitingForActivationValidators(validators)
        const activationeligibility = this.getEligableValidators(validators)

        if (awaitingActivation.length > 0) {
            return this.getAwaitingActivationState(
                activeValidatorCount,
                validatorCount,
                awaitingActivation[0].data,
                currentEpoch,
                foreignValidator,
                awaitingActivation.length == validatorCount
            )
        }

        if (activationeligibility.length > 0) {
            return this.getEligbableActivationState(
                activeValidatorCount,
                validatorCount,
                activationeligibility[0].data,
                currentEpoch,
                foreignValidator,
                activationeligibility.length == validatorCount
            );
        }

        return this.getOfflineState(
            activeValidatorCount,
            validatorCount,
            foreignValidator  
        );
    }

    private descriptionSwitch(myText, foreignText, foreignValidator) {
        return foreignValidator ? foreignText : myText
    }

    private getOkState(activeValidatorCount, validatorCount, foreignValidator, validatorResp: ValidatorResponse, currentEpoch: EpochResponse): DashboardStatus {
        const exitingDescription = this.getExitingDescription(validatorResp, currentEpoch)

        return {
            icon: "checkmark-circle-outline",
            title: activeValidatorCount + " / " + validatorCount,
            description: this.descriptionSwitch(
                "All validators are active",
                "This validator is active",
                foreignValidator
            ),
            extendedDescriptionPre: exitingDescription.extendedDescriptionPre,
            extendedDescription: exitingDescription.extendedDescription,
            iconCss: "ok"
        }
    }

    private getExitingDescription(validatorResp: ValidatorResponse, currentEpoch: EpochResponse): Description {
        if (!validatorResp.exitepoch) return { extendedDescriptionPre: null, extendedDescription: null }

        const exitDiff = validatorResp.exitepoch - currentEpoch.epoch
        const isExiting = exitDiff >= 0 && exitDiff < 6480 // ~ 1 month
        const exitingDate = isExiting ? this.getEpochDate(validatorResp.exitepoch, currentEpoch) : null

        return {
            extendedDescriptionPre: isExiting ? "Exiting on " : null,
            extendedDescription: exitingDate,
        }
    }

    private getSlashedState(activeValidatorCount, validatorCount, foreignValidator, validatorResp: ValidatorResponse, currentEpoch: EpochResponse, allAffected: boolean): DashboardStatus {
        const exitingDescription = this.getExitingDescription(validatorResp, currentEpoch)

        const pre = allAffected ? "All" : "Some"
        return {
            icon: "alert-circle-outline",
            title: activeValidatorCount + " / " + validatorCount,
            description: this.descriptionSwitch(
                pre + " of your validators were slashed",
                "This validator was slashed",
                foreignValidator
            ),
            extendedDescriptionPre: exitingDescription.extendedDescriptionPre,
            extendedDescription: exitingDescription.extendedDescription,
            iconCss: "err"
        }
    }

    private getAwaitingActivationState(activeValidatorCount, validatorCount, awaitingActivation: ValidatorResponse, currentEpoch: EpochResponse, foreignValidator, allAffected: boolean): DashboardStatus {
        const pre = allAffected ? "All" : "Some"
        const estEta = this.getEpochDate(awaitingActivation.activationeligibilityepoch, currentEpoch)
        return {
            icon: "timer-outline",
            title: activeValidatorCount + " / " + validatorCount,
            description: this.descriptionSwitch(
                pre + " of your validators are waiting for activation",
                "This validator is waiting for activation",
                foreignValidator
            ),
            extendedDescriptionPre: estEta ? "Estimated on " : null,
            extendedDescription: estEta ? estEta : null,
            iconCss: "waiting"
        }
    }

    private getEligbableActivationState(activeValidatorCount, validatorCount, eligbleState: ValidatorResponse, currentEpoch: EpochResponse, foreignValidator, allAffected: boolean): DashboardStatus {
        const pre = allAffected ? "All" : "Some"
        const estEta =  this.getEpochDate(eligbleState.activationeligibilityepoch, currentEpoch)
        return {
            icon: "timer-outline",
            title: activeValidatorCount + " / " + validatorCount,
            description: this.descriptionSwitch(
                pre + " of your validators deposits are being processed",
                "This validators deposit is being processed",
                foreignValidator
            ),
            extendedDescriptionPre: estEta ? "Estimated on " : null,
            extendedDescription: estEta ? estEta : null,
            iconCss: "waiting"
        }
    }

    private getExitedState(activeValidatorCount, validatorCount, foreignValidator): DashboardStatus {
        return {
            icon: this.descriptionSwitch("ribbon-outline", "home-outline", foreignValidator),
            title: activeValidatorCount + " / " + validatorCount,
            description: this.descriptionSwitch(
                "All of your validators have exited",
                "This validator has exited",
                foreignValidator
            ),
            extendedDescriptionPre: null,
            extendedDescription: this.descriptionSwitch("Thank you for your service", null, foreignValidator),
            iconCss: "ok"
        }
    }

    private getOfflineState(activeValidatorCount, validatorCount, foreignValidator): DashboardStatus {
        const pre = activeValidatorCount == 0 ? "All" : "Some"
        return {
            icon: "alert-circle-outline",
            title: activeValidatorCount + " / " + validatorCount,
            description: this.descriptionSwitch(
                pre + " of your validators are offline",
                "This validator is offline",
                foreignValidator
            ),
            extendedDescriptionPre: null,
            extendedDescription: null,
            iconCss: "warn"
        }
    }

    private getEpochDate(activationEpoch, currentEpoch: EpochResponse) {
        try {
            const diff = activationEpoch - currentEpoch.epoch
            if (diff <= 0) {
                if (this.refreshCallback) this.refreshCallback()
                return null
            }

            var date = new Date(currentEpoch.lastCachedTimestamp);

            const inEpochOffset = (32 - currentEpoch.scheduledblocks) * 12 // block time 12s

            date.setSeconds(diff * 6.4 * 60 - inEpochOffset);

            var timeString = formatDate(date, "medium", "en-US")
            return timeString
        } catch (e) {
            console.warn("could not get activation time", e)
            return null
        }
    }

    private getActiveValidators(validators: Validator[]) {
        return validators.filter(item => {
            return item.state == ValidatorState.ACTIVE
        })
    }

    private getSlashedValidators(validators: Validator[]) {
        return validators.filter(item => {
            return item.state == ValidatorState.SLASHED;
        })
    }

    private getExitedValidators(validators: Validator[]) {
        return validators.filter(item => {
            return item.state == ValidatorState.EXITED
        })
    }

    private getWaitingForActivationValidators(validators: Validator[]) {
        return validators.filter(item => {
            return item.state == ValidatorState.WAITING
        })
    }

    private getEligableValidators(validators: Validator[]) {
        return validators.filter(item => {
            return item.state == ValidatorState.ELIGABLE
        })
    }

}