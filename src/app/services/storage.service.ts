/*
 *  // Copyright (C) 2020 - 2024 bitfly explorer GmbH
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

import { Injectable, isDevMode } from '@angular/core'
import { Plugins } from '@capacitor/core'
import * as StorageTypes from '../models/StorageTypes'
import { MAP, findConfigForKey } from '../utils/NetworkData'
import { CacheModule } from '../utils/CacheModule'
import BigNumber from 'bignumber.js'
import { Platform } from '@ionic/angular'

import { Preferences } from '@capacitor/preferences'
import { LogviewPage } from '../pages/logview/logview.page'
import { Device } from '@capacitor/device'
import { Aggregation, dashboardID, Period } from '../requests/v2-dashboard'
const { StorageMirror } = Plugins

const AUTH_USER = 'auth_user'
const AUTH_USER_V2 = 'auth_user_v2'
const PREFERENCES = 'network_preferences'

export const SETTING_NOTIFY = 'setting_notify'
export const CPU_THRESHOLD = 'cpu_usage_threshold'
export const HDD_THRESHOLD = 'hdd_usage_threshold'
export const RAM_THRESHOLD = 'ram_usage_threshold'
export const DEBUG_SETTING_OVERRIDE_PACKAGE = 'debug_setting_override_package'

@Injectable({
	providedIn: 'root',
})
export class StorageService extends CacheModule {
	constructor(private platform: Platform) {
		super()
		this.reflectiOSStorage()
	}

	storeInHardCache(): boolean {
		return false
	}

	// --- upper level helper ---

	async getDeviceID() {
		return (await Device.getId()).identifier
	}

	// todo support v2
	async backupAuthUser() {
		return this.setObject(AUTH_USER + '_backup', await this.getAuthUser())
	}

	// todo support v2
	async restoreAuthUser() {
		return this.setAuthUser((await this.getObject(AUTH_USER + '_backup')) as StorageTypes.AuthUser)
	}

	/**@deprecated */
	async getAuthUser(): Promise<StorageTypes.AuthUser> {
		return this.getObject(AUTH_USER) as Promise<StorageTypes.AuthUser>
	}

	/**@deprecated */
	async setAuthUser(value: StorageTypes.AuthUser) {
		return this.setObject(AUTH_USER, value)
	}

	async getAuthUserv2(): Promise<StorageTypes.AuthUserv2> {
		return this.getObject(AUTH_USER_V2) as Promise<StorageTypes.AuthUserv2>
	}

	async setAuthUserv2(value: StorageTypes.AuthUserv2) {
		return this.setObject(AUTH_USER_V2, value)
	}

	async isV2() {
		return this.getBooleanSetting('use_v2_api', false)
	}

	setV2(value: boolean) {
		return this.setBooleanSetting('use_v2_api', value)
	}

	async getDeviceName(): Promise<string> {
		return (await Device.getInfo()).model
	}

	async isLoggedIn(): Promise<boolean> {
		const user = await this.getAuthUser()
		if (!user || !user.accessToken) {
			const userv2 = await this.getAuthUserv2()
			if (!userv2 || !userv2.Session) return false
			return true
		}
		return true
	}

	// todo also support v2
	async removeAuthUser() {
		return this.remove(AUTH_USER)
	}

	public async isDebugMode() {
		const devMode = isDevMode()
		if (devMode) return true
		const permanentDevMode = (await this.getObject('dev_mode')) as DevModeEnabled
		return permanentDevMode && permanentDevMode.enabled
	}

	async getNetworkPreferences(): Promise<StorageTypes.ApiNetwork> {
		const result = await this.getObject(PREFERENCES)
		if (!result) {
			return findConfigForKey('main')
		}
		return result as Promise<StorageTypes.ApiNetwork>
	}

	async setNetworkPreferences(value: StorageTypes.ApiNetwork) {
		return await this.setObject(PREFERENCES, value)
	}

	async loadPreferencesToggles(network: string): Promise<boolean> {
		const notifyLocal = await this.getBooleanSetting(network + SETTING_NOTIFY, null)
		return notifyLocal
	}

	setBooleanSetting(key, value) {
		return this.setSetting(key, value)
	}

	getBooleanSetting(key: string, defaultV = true): Promise<boolean> {
		return this.getSetting(key, defaultV) as Promise<boolean>
	}

	async isHttpAllowed() {
		return this.getBooleanSetting('allow_http', false)
	}

	setHttpAllowed(value: boolean) {
		return this.setBooleanSetting('allow_http', value)
	}

	setSetting(key, value) {
		return this.setObject(key, { value: value } as ValueWrapper)
	}

	getSetting(key: string, defaultV: unknown = 0) {
		return this.getObject(key).then((result) => {
			if (result) return (result as ValueWrapper).value
			return defaultV
		})
	}

	async getStakingShare(): Promise<BigNumber> {
		const value = await this.getItem('staking_share')
		if (!value) return null
		return new BigNumber(value)
	}

	async setLastEpochRequestTime(time: number) {
		await this.setObject('last_epoch_time', { ts: time } as EpochRequestTime)
	}

	async getLastEpochRequestTime() {
		const result = (await this.getObject('last_epoch_time')) as EpochRequestTime
		if (!result || !result.ts) return Date.now()
		return result.ts
	}

	async migrateToCapacitor3() {
		if (!this.platform.is('ios')) return
		const alreadyMigrated = await this.getBooleanSetting('migrated_to_cap3', false)
		if (!alreadyMigrated) {
			console.log('migrating to capacitor 3 storage...')
			await Preferences.migrate()
			this.setBooleanSetting('migrated_to_cap3', true)
		}
	}

	async openLogSession(modalCtr, offset: number) {
		let lastLogSession = parseInt(window.localStorage.getItem('last_log_session'))
		if (isNaN(lastLogSession)) lastLogSession = 0

		const modal = await modalCtr.create({
			component: LogviewPage,
			cssClass: 'my-custom-class',
			componentProps: {
				logs: JSON.parse(window.localStorage.getItem('log_session_' + ((lastLogSession + (3 - offset)) % 3))),
			},
		})
		return await modal.present()
	}

	async isNotifyClientUpdatesEnabled(): Promise<boolean> {
		return (await this.getBooleanSetting('eth_client_update', true)) && (await this.getBooleanSetting(SETTING_NOTIFY, true))
	}

	// --- Low level ---

	async setObject(key: string, value: unknown, cache = true) {
		if (cache) this.putCache(key, value)
		await this.setItem(key, JSON.stringify(value, replacer), false)
	}

	async getObject(key: string): Promise<unknown | null> {
		const cached = await this.getCache(key)
		if (cached != null) return cached

		const value = await this.getItem(key)
		if (value == null) return null
		return JSON.parse(value, reviver)
	}

	async setItem(key: string, value: string, cache = true) {
		if (cache) this.putCache(key, value)
		try {
			await Preferences.set({
				key: key,
				value: value,
			})
		} catch (e) {
			console.error('Error while writing to local storage (might be full):', e)
		}
		this.reflectiOSStorage()
	}

	// sigh
	private reflectiOSStorage() {
		try {
			if (!this.platform.is('ios')) return
			const reflectKeys = ['CapacitorStorage.prefered_unit', 'CapacitorStorage.network_preferences', 'CapacitorStorage.auth_user']
			for (let i = 0; i < MAP.length; i++) {
				if (MAP[i].key.indexOf('invalid') > -1) continue
				if (MAP[i].key.indexOf('local') > -1) continue
				reflectKeys.push('CapacitorStorage.validators_' + MAP[i].key)
			}

			StorageMirror.reflect({
				keys: reflectKeys,
			})
		} catch (e) {
			console.warn('StorageMirror exception', e)
		}
	}

	async getItem(key: string): Promise<string | null> {
		const cached = (await this.getCache(key)) as string
		if (cached != null) return cached

		const { value } = await Preferences.get({ key: key })
		return value
	}

	async findAllKeys(startingWith: string) {
		const keys = await Preferences.keys()
		const result: string[] = []
		keys.keys.forEach((value) => {
			if (value.startsWith(startingWith)) result.push(value)
		})
		return result
	}

	async remove(key: string) {
		this.invalidateCache(key)
		await Preferences.remove({ key: key })
		this.reflectiOSStorage()
	}

	async clear() {
		this.invalidateAllCache()
		await Preferences.clear()
		this.reflectiOSStorage()
	}

	async getDashboardID(): Promise<dashboardID> {
		const data = (await this.getObject('dashboard_id')) as DashboardSetting
		if (!data) return null
		return data.id as dashboardID
	}

	async setDashboardID(id: dashboardID): Promise<void> {
		await this.setObject('dashboard_id', {
			id: id,
		} as DashboardSetting)
	}

	async getDashboardTimeframe(): Promise<Period> {
		const data = (await this.getObject('dashboard_timeframe')) as Period
		if (!data) return Period.AllTime
		return data
	}

	async getDashboardSummaryAggregation(): Promise<Aggregation> {
		const data = (await this.getObject('dashboard_summary_aggregation')) as Aggregation
		if (!data) return Aggregation.Hourly
		return data
	}

	async setDashboardSummaryAggregation(aggregation: Aggregation): Promise<void> {
		await this.setObject('dashboard_summary_aggregation', aggregation)
	}

	async setDashboardTimeframe(timeframe: Period): Promise<void> {
		await this.setObject('dashboard_timeframe', timeframe)
	}
}

interface DashboardSetting {
	id: dashboardID
}

export function replacer(key, value) {
	const originalObject = this[key]
	if (originalObject instanceof Map) {
		return {
			dataType: 'Map',
			value: Array.from(originalObject.entries()),
		}
	} else {
		return value
	}
}

function reviver(key, value) {
	if (typeof value === 'object' && value !== null) {
		if (value.dataType === 'Map') {
			return new Map(value.value)
		}
	}
	return value
}

interface EpochRequestTime {
	ts: number
}

interface ValueWrapper {
	value: unknown
}

export interface StoredTimestamp {
	timestamp: number
}

export interface StoredShare {
	share: number
}

export interface DevModeEnabled {
	enabled: boolean
}
