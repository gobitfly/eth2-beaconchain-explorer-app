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

import { EpochResponse, PerformanceResponse, ValidatorResponse, AttestationPerformanceResponse } from '../requests/requests';
import { sumBigInt, findHighest, findLowest } from '../utils/MathUtils'
import BigNumber from "bignumber.js";
import { Validator } from '../utils/ValidatorUtils';
import { formatDate } from '@angular/common';
import { getValidatorQueryString, ValidatorState } from '../utils/ValidatorUtils';

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

    proccessDashboard(
        validators: Validator[],
        performance: PerformanceResponse[],
        currentEpoch: EpochResponse,
        attestationPerformance: AttestationPerformanceResponse[]
    ) {
        return this.process(validators, performance, currentEpoch, attestationPerformance, false)
    }

    proccessDetail(
        validators: Validator[],
        performance: PerformanceResponse[],
        currentEpoch: EpochResponse,
        attestationPerformance: AttestationPerformanceResponse[]
    ) {
        return this.process(validators, performance, currentEpoch, attestationPerformance, true)
    }

    private process(
        validators: Validator[],
        performance: PerformanceResponse[],
        currentEpoch: EpochResponse,
        attestationPerformance: AttestationPerformanceResponse[],
        foreignValidator = false
    ): OverviewData {
        if (!validators || validators.length <= 0 || currentEpoch == null) return null

        const overallBalance = sumBigInt(validators, cur => cur.data.balance);
        const effectiveBalance = sumBigInt(validators, cur => cur.data.effectivebalance);
        const validatorCount = validators.length

        const performance1d = sumBigInt(performance, cur => cur.performance1d)
        const performance31d = sumBigInt(performance, cur => cur.performance31d)
        const performance7d = sumBigInt(performance, cur => cur.performance7d)
        const performance365d = sumBigInt(performance, cur => cur.performance365d)

        var attrEffectiveness = -1
        if (attestationPerformance) {
            attrEffectiveness = sumBigInt(attestationPerformance, cur => {
                return new BigNumber(1).dividedBy(cur.attestation_efficiency).multipliedBy(100)
            })
                .dividedBy(attestationPerformance.length)
                .decimalPlaces(1).toNumber();
        }

        const bestRank = findLowest(performance, cur => cur.rank7d)
        const worstRank = findHighest(performance, cur => cur.rank7d)

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
            lazyChartValidators: getValidatorQueryString(validators, 2000, 99),
            foreignValidator: foreignValidator,
            foreignValidatorItem: foreignValidator ? validators[0] : null,
            effectiveBalance: effectiveBalance,
            currentEpoch: currentEpoch,
            apr: this.getAPR(effectiveBalance, performance7d)
        } as OverviewData;
    }


    getAPR(effectiveBalance, performance) {
        return new BigNumber(performance * 52 * 100 / effectiveBalance).decimalPlaces(1).toNumber()
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
            return this.getSlashedState(activeValidatorCount, validatorCount, foreignValidator, slashedValidators[0].data, currentEpoch.epoch)
        }

        if (activeValidatorCount == requiredValidatorsForOKState && activeValidatorCount != 0) {
            return this.getOkState(activeValidatorCount, validatorCount, foreignValidator, activeValidators[0].data, currentEpoch.epoch)
        } else if (activeValidatorCount == requiredValidatorsForOKState && activeValidatorCount == 0) {
            return this.getExitedState(activeValidatorCount, validatorCount, foreignValidator)
        }

        const awaitingActivation = this.getWaitingForActivationValidators(validators)
        const activationeligibility = this.getEligableValidators(validators)

        if (awaitingActivation.length > 0) {
            return this.getAwaitingActivationState(
                activeValidatorCount,
                validatorCount,
                awaitingActivation[0].data,
                currentEpoch.epoch,
                foreignValidator
            )
        }

        if (activationeligibility.length > 0) {
            return this.getEligbableActivationState(
                activeValidatorCount,
                validatorCount,
                activationeligibility[0].data,
                currentEpoch.epoch,
                foreignValidator
            );
        }

        return this.getOfflineState(activeValidatorCount, validatorCount, foreignValidator);
    }

    private descriptionSwitch(myText, foreignText, foreignValidator) {
        return foreignValidator ? foreignText : myText
    }

    private getOkState(activeValidatorCount, validatorCount, foreignValidator, validatorResp: ValidatorResponse, currentEpoch): DashboardStatus {
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

    private getExitingDescription(validatorResp: ValidatorResponse, currentEpoch): Description {
        if (!validatorResp.exitepoch) return { extendedDescriptionPre: null, extendedDescription: null }

        const exitDiff = validatorResp.exitepoch - currentEpoch
        const isExiting = exitDiff >= 0 && exitDiff < 6480 // ~ 1 month
        const exitingDate = isExiting ? this.getEpochDate(validatorResp.exitepoch, currentEpoch) : null

        return {
            extendedDescriptionPre: isExiting ? "Exiting on " : null,
            extendedDescription: exitingDate,
        }
    }

    private getSlashedState(activeValidatorCount, validatorCount, foreignValidator, validatorResp: ValidatorResponse, currentEpoch): DashboardStatus {
        const exitingDescription = this.getExitingDescription(validatorResp, currentEpoch)

        const pre = activeValidatorCount > 0 ? "Some" : "All"
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

    private getAwaitingActivationState(activeValidatorCount, validatorCount, awaitingActivation: ValidatorResponse, currentEpoch, foreignValidator): DashboardStatus {
        const pre = activeValidatorCount > 0 ? "Some" : "All"
        return {
            icon: "timer-outline",
            title: activeValidatorCount + " / " + validatorCount,
            description: this.descriptionSwitch(
                pre + " of your validators are waiting for activation",
                "This validator is waiting for activation",
                foreignValidator
            ),
            extendedDescriptionPre: "Estimated on ",
            extendedDescription: this.getEpochDate(awaitingActivation.activationepoch, currentEpoch),
            iconCss: "waiting"
        }
    }

    private getEligbableActivationState(activeValidatorCount, validatorCount, eligbleState: ValidatorResponse, currentEpoch, foreignValidator): DashboardStatus {
        const pre = activeValidatorCount > 0 ? "Some" : "All"
        return {
            icon: "timer-outline",
            title: activeValidatorCount + " / " + validatorCount,
            description: this.descriptionSwitch(
                pre + " of your validators deposits are being processed",
                "This validators deposit is being processed",
                foreignValidator
            ),
            extendedDescriptionPre: "Estimated on ",
            extendedDescription: this.getEpochDate(eligbleState.activationeligibilityepoch, currentEpoch),
            iconCss: "waiting"
        }
    }

    private getExitedState(activeValidatorCount, validatorCount, foreignValidator): DashboardStatus {
        const pre = activeValidatorCount > 0 ? "Some" : "All"
        return {
            icon: this.descriptionSwitch("ribbon-outline", "home-outline", foreignValidator),
            title: activeValidatorCount + " / " + validatorCount,
            description: this.descriptionSwitch(
                pre + " of your validators have exited",
                "This validator has exited",
                foreignValidator
            ),
            extendedDescriptionPre: null,
            extendedDescription: this.descriptionSwitch("Thank you for your service", null, foreignValidator),
            iconCss: "ok"
        }
    }

    private getOfflineState(activeValidatorCount, validatorCount, foreignValidator): DashboardStatus {
        const pre = activeValidatorCount > 0 ? "Some" : "All"
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

    private getEpochDate(activationEpoch, currentEpoch) {
        const diff = activationEpoch - currentEpoch
        if (diff < 0) return null

        var date = new Date();
        date.setSeconds(diff * 6.4 * 60);


        var timeString = formatDate(date, "medium", "en-US")
        return timeString
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