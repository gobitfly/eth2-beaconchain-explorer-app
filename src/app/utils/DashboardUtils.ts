// Copyright (C) 2024 Bitfly GmbH
// 
// This file is part of Beaconchain Dashboard.
// 
// Beaconchain Dashboard is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// Beaconchain Dashboard is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with Beaconchain Dashboard.  If not, see <https://www.gnu.org/licenses/>.

import { Injectable } from "@angular/core";
import { StorageService } from "../services/storage.service";
import { ApiService } from "../services/api.service";
import { V2MyDashboards } from "../requests/v2-user";
import { dashboardID, V2AddValidatorToDashboard, V2AddValidatorToDashboardData, V2CreateDashboard, V2DeleteValidatorFromDashboard } from "../requests/v2-dashboard";
import { Toast } from "@capacitor/toast";
import { AlertService } from "../services/alert.service";
import { OAuthUtils } from "./OAuthUtils";
import { MerchantUtils } from "./MerchantUtils";
import { SearchResult } from "../requests/types/common";
import { searchType } from "../requests/v2-search";
import { UnitconvService } from "../services/unitconv.service";
import { APIError, APIUnauthorizedError } from "../requests/requests";

@Injectable({
	providedIn: 'root',
})
export class DashboardUtils {
	dashboardAwareListener: PullEventListener = new PullEventListener(() => {
		this.unit.loadCurrentChainNetwork()
	})
	searchResultHandler = new SeachResultHandler()

	constructor(
		private api: ApiService,
		private storage: StorageService,
		private alerts: AlertService,
		private oauth: OAuthUtils,
		private merchant: MerchantUtils,
		private unit: UnitconvService
	) {}

	initDashboard() {
		return initDashboard(this.api, this.storage, () => {
			this.dashboardAwareListener.notifyAll()
		})
	}

	async addValidator(item: SearchResult, groupID: number): Promise<boolean> {
		const loggedIn = await this.storage.isLoggedIn()
		const id = await this.storage.getDashboardID()

		if (loggedIn) {
			const result = await this.api.execute2(
				new V2AddValidatorToDashboard(id, {
					group_id: groupID,
					validators: this.searchResultHandler.getAddByIndex(item),
					deposit_address: this.searchResultHandler.getAddByDepositAddress(item),
					withdrawal_address: this.searchResultHandler.getAddByWithdrawalAddress(item),
					graffiti: undefined,
				} as V2AddValidatorToDashboardData)
			)
			return result && !result.error
		} else {
			const indexToAdd = this.searchResultHandler.getAddByIndex(item)
			if (!indexToAdd || indexToAdd.length === 0) {
				return false
			}

			if (isLocalDashboard(id)) {
				await this.storage.setDashboardID([...id, ...indexToAdd].slice(0, 20))
			} else {
				await this.storage.setDashboardID(indexToAdd)
			}
			return true
		}
	}

	async addValidators(index: number[], groupID: number, dashID: dashboardID = undefined): Promise<boolean> {
		if (index.length === 0) {
			return true
		}
		const loggedIn = await this.storage.isLoggedIn()
		let id = await this.storage.getDashboardID()
		if (dashID) {
			id = dashID
		}

		if (loggedIn) {
			const result = await this.api.execute2(
				new V2AddValidatorToDashboard(id, {
					group_id: groupID,
					validators: index,
					graffiti: undefined,
				} as V2AddValidatorToDashboardData)
			)
			return result && !result.error
		} else {
			index = index.slice(0, 20) // truncate as free tier is limited to 20 validators

			if (isLocalDashboard(id)) {
				await this.storage.setDashboardID([...id, ...index].slice(0, 20))
			} else {
				await this.storage.setDashboardID(index)
			}
			return true
		}
	}

	async deleteValidator(index: number[]) {
		const loggedIn = await this.storage.isLoggedIn()
		const id = await this.storage.getDashboardID()

		if (loggedIn) {
			const result = await this.api.execute2(new V2DeleteValidatorFromDashboard(id, index))
			return result && !result.error
		} else {
			if (isLocalDashboard(id)) {
				const newDashboard = id.filter((element) => !index.includes(element))
				if (newDashboard.length === 0) {
					await this.storage.setDashboardID(null)
					return true
				}
				await this.storage.setDashboardID(newDashboard)
			} else {
				console.log('how did we end up here?')
				return true
			}
			return true
		}
	}

	async getLocalValidatorCount() {
		const id = await this.storage.getDashboardID()
		if (isLocalDashboard(id)) {
			return id.length
		}
		return 0
	}

	// @returns whether the error was handled
	defaultDashboardErrorHandler(error: Error | null) {
		if (!error || !(error instanceof APIError)) {
			return
		}
		if (error instanceof APIUnauthorizedError) {
			this.alerts.confirmDialog('Login expired', 'Please log back in to your beaconcha.in account to access your dashboards.', 'LOGIN', async () => {
				const result = await this.oauth.login()
				if (result) {
					this.merchant.restartApp()
				} else {
					Toast.show({
						text: 'Login failed',
					})
				}
			})
			console.error('Unauthorized')
			return true
		}

		return false
	}
}

export function isLocalDashboard(id: dashboardID): id is number[] {
    return id && Array.isArray(id) && id.every((element) => typeof element === 'number')
}

class PullEventListener {
	private updateMap: Map<string, boolean> = new Map()

	private push: () => void
	constructor(push: () => void = null) { 
		this.push = push 
	}

	notifyAll() {
		this.updateMap.forEach((_, key) => {
			this.updateMap.set(key, true)
		})
		if(this.push) this.push()
	}

	register(key: string) {
		this.updateMap.set(key, false)
	}

	hasAndConsume(key: string): boolean {
		const result = this.updateMap.get(key)
		if (result) {
			this.updateMap.set(key, false)
		}
		return result
	}
}

export async function mergeLocalDashboardToRemote(
    api: ApiService,
    storage: StorageService
) {
    const localDashboard = await storage.getDashboardID()
    if (!isLocalDashboard(localDashboard)) {
        await initDashboard(api, storage)
        return
    }

    // store local dashboard to inactive slot just in case something goes wrong
    await storage.setObject('local_dashboard_backup', localDashboard)
    console.log('merge do merge', localDashboard)
    
    storage.setDashboardID(null) // clear local dashboard
    const remoteDashboard = await initDashboard(api, storage)

    const result = await api.execute2(new V2AddValidatorToDashboard(remoteDashboard, {
        group_id: 0, 
        validators: localDashboard
    }))
    if (result.error) {
        Toast.show({
            text: 'Error merging dashboards',
        })
        return
    }
    await storage.setObject('local_dashboard_backup', null) // done
}

// Call after login or when dashboard id is null
// will check if the user has dashboards and select the first one
// or else create a dashboard and select it
export async function initDashboard(api: ApiService, storage: StorageService, dashboardChangedListener: () => void = null) {
		const dashID = await storage.getDashboardID()
		const isLoggedIn = await storage.isLoggedIn()

		// check if user has dashboards
		if (!dashID && isLoggedIn) {
			const result = await api.execute2(new V2MyDashboards())
			if (result.error) {
				console.warn('dashboards can not be loaded', result.error)
				Toast.show({
					text: 'Error loading dashboards',
				})
				return
			}

			let targetDashboard: dashboardID = null
			// if user has a dashboard, pick the first one
			if (result.data && result.data[0] && result.data[0].validator_dashboards && result.data[0].validator_dashboards.length > 0) {
				targetDashboard = result.data[0].validator_dashboards[0].id
				// todo improve and pick the one on current network first - if user has multiple dashboards
				console.log('found a user dashboard, picking first one')
			} else {
				console.log('user has no dashboards, creating default dashboard')
				// create a new dashboard
				const chainID = await this.api.getCurrentDashboardChainID()
				const createResult = await api.execute2(new V2CreateDashboard('Default Dashboard', chainID)) 
				if (createResult.error) {
					Toast.show({
						text: 'Error renaming dashboard, please try again later',
					})
				} else {
					targetDashboard = createResult.data[0].id
				}
			}

            await storage.setDashboardID(targetDashboard)
            if(dashboardChangedListener) { dashboardChangedListener() }
			return targetDashboard
		}
		return dashID
}
    
class SeachResultHandler {
	formatSearchType(type: searchType) {
		switch (type) {
			case searchType.validatorByIndex:
				return 'Validator Index'
			case searchType.validatorsByDepositEnsName:
				return 'Deposit ENS'
			case searchType.validatorsByWithdrawalEns:
				return 'Withdrawal ENS'
			case searchType.validatorsByDepositAddress:
				return 'Deposit Address'
			case searchType.validatorsByWithdrawalAddress:
				return 'Withdrawal Address'
			case searchType.validatorsByWithdrawalCredential:
				return 'Withdrawal Credential'
			case searchType.validatorByPublicKey:
				return 'Public Key'
		}
	}

	searchNumFieldIsIndex(item: SearchResult) {
		return item.type == searchType.validatorByIndex || item.type == searchType.validatorByPublicKey
	}

	getAddByIndex(searchResult: SearchResult) {
		if (searchResult.type == searchType.validatorByIndex || searchResult.type == searchType.validatorByPublicKey) {
			return [searchResult.num_value]
		}
		return undefined
	}

	getAddByDepositAddress(searchResult: SearchResult) {
		if (searchResult.type == searchType.validatorsByDepositAddress || searchResult.type == searchType.validatorsByDepositEnsName) {
			return searchResult.hash_value
		}
		return undefined
	}

	getAddByWithdrawalAddress(searchResult: SearchResult) {
		if (
			searchResult.type == searchType.validatorsByWithdrawalAddress ||
			searchResult.type == searchType.validatorsByWithdrawalEns ||
			searchResult.type == searchType.validatorsByWithdrawalCredential
		) {
			return searchResult.hash_value
		}
		return undefined
	}

	getAddByWithdrawalCredential(searchResult: SearchResult) {
		if (searchResult.type == searchType.validatorsByWithdrawalCredential) {
			return searchResult.hash_value
		}
		return undefined
	}

	requiresPremium(searchResult: SearchResult) {
		return (
			searchResult.type == searchType.validatorsByDepositEnsName ||
			searchResult.type == searchType.validatorsByDepositAddress ||
			searchResult.type == searchType.validatorsByWithdrawalAddress ||
			searchResult.type == searchType.validatorsByWithdrawalCredential
		)
	}

    resultCount(searchResult: SearchResult) {
        if (searchResult.type == searchType.validatorByIndex || searchResult.type == searchType.validatorByPublicKey) {
            return 1
        }
        return searchResult.num_value
    }
}
