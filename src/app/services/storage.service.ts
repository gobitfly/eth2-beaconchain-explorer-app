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

import { Injectable, isDevMode, OnInit } from '@angular/core'
import * as StorageTypes from '../models/StorageTypes'
import { findConfigForKey } from '../utils/NetworkData'
import { CacheModule } from '../utils/CacheModule'
import { ModalController, Platform } from '@ionic/angular'

import { Preferences } from '@capacitor/preferences'
import { LogviewPage } from '../pages/logview/logview.page'
import { Device } from '@capacitor/device'
import { Aggregation, dashboardID, Period } from '../requests/v2-dashboard'
import { StorageMirror } from 'storage-mirror'

const AUTH_USER = 'auth_user'
const AUTH_USER_V2 = 'auth_user_v2'
const PREFERENCES = 'network_preferences'
const WIDGET_PREFERENCES = 'widget_network_preferences' 
const DASHBOARD_ID = 'dashboard_id'

export const SETTING_NOTIFY = 'setting_notify'
export const CPU_THRESHOLD = 'cpu_usage_threshold'
export const HDD_THRESHOLD = 'hdd_usage_threshold'
export const RAM_THRESHOLD = 'ram_usage_threshold'
export const DEBUG_SETTING_OVERRIDE_PACKAGE = 'debug_setting_override_package'

@Injectable({
	providedIn: 'root',
})
export class StorageService extends CacheModule implements OnInit {
	constructor(private platform: Platform) {
		super()
	}

	ngOnInit() {
		this.reflectiOSStorage()
	}

	storeInHardCache(): boolean {
		return false
	}

	// --- upper level helper ---

	async getDeviceID() {
		return (await Device.getId()).identifier
	}

	async backupAuthUser() {
		return this.setObject(AUTH_USER_V2 + '_backup', await this.getAuthUserv2())
	}

	async restoreAuthUser() {
		return this.setAuthUserv2((await this.getObject(AUTH_USER_V2 + '_backup')) as StorageTypes.AuthUserv2)
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
		if (await this.isV2()) {
			const user = await this.getAuthUserv2()
			if (!user || !user.Session) return false
			return true
		} else {
			const user = await this.getAuthUser()
			if (!user || !user.accessToken) return false
			return true
		}
	}

	async removeAuthUser() {
		this.remove(AUTH_USER_V2)
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

	/**
	 * Since v2 this is inferred at runtime so we write back the actual config for widget
	 * @param network  
	 */
	async setWidgetNetworkConfig(network: StorageTypes.ApiNetwork) {
		await this.setObject(WIDGET_PREFERENCES, network)
	}

	async loadPreferencesToggles(network: string): Promise<boolean> {
		const notifyLocal = await this.getBooleanSetting(network + SETTING_NOTIFY, null)
		return notifyLocal
	}

	setBooleanSetting(key: string, value: boolean) {
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

	setSetting(key: string, value: unknown) {
		return this.setObject(key, { value: value } as ValueWrapper)
	}

	getSetting(key: string, defaultV: unknown = 0) {
		return this.getObject(key).then((result) => {
			if (result) return (result as ValueWrapper).value
			return defaultV
		})
	}

	// async getStakingShare(): Promise<BigNumber> {
	// 	const value = await this.getItem('staking_share')
	// 	if (!value) return null
	// 	return new BigNumber(value)
	// }

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

	async openLogSession(modalCtr: ModalController, offset: number) {
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

	// iOS widget can't access app storage, so we need to reflect certain keys
	// to a common shared space that the widget can access
	private reflectiOSStorage() {
		try {
			if (!this.platform.is('ios')) return
			const reflectKeys = [
				'CapacitorStorage.prefered_unit',
				'CapacitorStorage.' + WIDGET_PREFERENCES,
				'CapacitorStorage.' + AUTH_USER_V2,
				'CapacitorStorage.' + DASHBOARD_ID,
			]

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
		const data = (await this.getObject(DASHBOARD_ID)) as DashboardSetting
		if (!data) return null
		return data.id as dashboardID
	}

	async setDashboardID(id: dashboardID): Promise<void> {
		await this.setObject(DASHBOARD_ID, {
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

export function replacer(key: string, value: unknown) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reviver(_: string, value: any) {
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
