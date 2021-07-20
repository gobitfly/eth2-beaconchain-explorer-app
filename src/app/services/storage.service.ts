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

import { Injectable } from '@angular/core';
import { Plugins } from "@capacitor/core";
import * as StorageTypes from "../models/StorageTypes";
import { findConfigForKey } from '../utils/NetworkData';
import { CacheModule } from '../utils/CacheModule'
import BigNumber from 'bignumber.js';
import { Platform } from '@ionic/angular';

const { Storage } = Plugins;
const { StorageMirror } = Plugins;

const AUTH_USER = "auth_user";
const PREFERENCES = "network_preferences";

export const SETTING_NOTIFY = "setting_notify"
export const SETTING_NOTIFY_SLASHED = "setting_notify_slashed"
export const SETTING_NOTIFY_DECREASED = "setting_notify_decreased"
export const SETTING_NOTIFY_PROPOSAL_SUBMITTED = "setting_notify_proposalsubmitted"
export const SETTING_NOTIFY_PROPOSAL_MISSED = "setting_notify_proposalsmissed"
export const SETTING_NOTIFY_ATTESTATION_MISSED = "setting_notify_attestationsmissed"
export const SETTING_NOTIFY_CLIENTUPDATE = "setting_notify_clientupdate"
export const SETTING_NOTIFY_MACHINE_OFFLINE = "setting_notify_machineoffline"
export const SETTING_NOTIFY_HDD_WARN = "setting_notify_hddwarn"
export const SETTING_NOTIFY_CPU_WARN = "setting_notify_cpuwarn"
export const SETTING_NOTIFY_MEMORY_WARN = "setting_notify_memorywarn"

export const CPU_THRESHOLD = "cpu_usage_threshold"
export const HDD_THRESHOLD = "hdd_usage_threshold"
export const RAM_THRESHOLD = "ram_usage_threshold"

export const DEBUG_SETTING_OVERRIDE_PACKAGE = "debug_setting_override_package"

@Injectable({
  providedIn: 'root'
})
export class StorageService extends CacheModule {

  constructor(private platform: Platform) {
    super()
    this.reflectiOSStorage()
  }

  // --- upper level helper ---


  async getAuthUser(): Promise<StorageTypes.AuthUser> {
    return this.getObject(AUTH_USER);
  }

  async setAuthUser(value: StorageTypes.AuthUser) {
    return this.setObject(AUTH_USER, value);
  }

  async isLoggedIn(): Promise<boolean> {
    const user = await this.getAuthUser();
    if (!user || !user.accessToken) return false
    return true
  }

  async removeAuthUser() {
    return this.remove(AUTH_USER)
  }

  async getNetworkPreferences(): Promise<StorageTypes.ApiNetwork> {
    const result = await this.getObject(PREFERENCES);
    if (!result) {
      return findConfigForKey("main")
    }
    return result
  }

  async setNetworkPreferences(value: StorageTypes.ApiNetwork) {
    return this.setObject(PREFERENCES, value);
  }

  async getValidatorLimit(): Promise<number> {
    const premium = await this.getPremiumPackage()
    if (!premium) return 100;

    return premium.numValidators
  }

  getPremiumPackage(): Promise<PremiumObject> {
    return this.getObject("PREMIUM")
  }

  async getNotificationTogglePreferences(network: string): Promise<NotificationToggles> {
    const notificationtoggles = await this.loadPreferencesToggles(network)
    this.putCache(network + "toggle_preferences", notificationtoggles)
    return notificationtoggles
  }

  async loadPreferencesToggles(network: string): Promise<NotificationToggles> {
    const notifySlashed = await this.getBooleanSetting(network + SETTING_NOTIFY_SLASHED)
    const notifyDecreased = await this.getBooleanSetting(network + SETTING_NOTIFY_DECREASED)
    const notifyClientUpdate = await this.getBooleanSetting(network + SETTING_NOTIFY_CLIENTUPDATE)
    const notifyProposalsSubmitted = await this.getBooleanSetting(network + SETTING_NOTIFY_PROPOSAL_SUBMITTED)
    const notifyProposalsMissed = await this.getBooleanSetting(network + SETTING_NOTIFY_PROPOSAL_MISSED)
    const notifyAttestationsMissed = await this.getBooleanSetting(network + SETTING_NOTIFY_ATTESTATION_MISSED)
    const notifyMachineOffline = await this.getBooleanSetting(SETTING_NOTIFY_MACHINE_OFFLINE, false)
    const notifyMachineHddWarn = await this.getBooleanSetting(SETTING_NOTIFY_HDD_WARN, false)
    const notifyMachineCpuWarn = await this.getBooleanSetting(SETTING_NOTIFY_CPU_WARN, false)
    const notifyMachineMemoryLoad = await this.getBooleanSetting(SETTING_NOTIFY_MEMORY_WARN, false)

    const notifyLocal = await this.getBooleanSetting(network + SETTING_NOTIFY, null)
    return {
      notify: notifyLocal,
      notifySlashed: notifySlashed,
      notifyDecreased: notifyDecreased,
      notifyClientUpdate: notifyClientUpdate,
      notifyProposalsSubmitted: notifyProposalsSubmitted,
      notifyProposalsMissed: notifyProposalsMissed,
      notifyAttestationsMissed: notifyAttestationsMissed,
      notifyMachineOffline: notifyMachineOffline,
      notifyMachineHddWarn: notifyMachineHddWarn,
      notifyMachineCpuWarn: notifyMachineCpuWarn,
      notifyMachineMemoryLoad: notifyMachineMemoryLoad
    }
  }

  setBooleanSetting(key, value) {
    this.setSetting(key, value)
  }

  getBooleanSetting(key: string, defaultV: boolean = true) {
    return this.getSetting(key, defaultV)
  }

  setSetting(key, value) {
    this.setObject(key, { value: value })
  }

  getSetting(key: string, defaultV: any = 0) {
    return this.getObject(key).then((result) => {
      if (result) return result.value
      return defaultV
    })
  }


  async isSubscribedTo(event): Promise<boolean> {
    const notify = await this.getBooleanSetting(SETTING_NOTIFY)
    return notify && await this.getBooleanSetting(event)
  }

  async getStakingShare(): Promise<BigNumber> {
    const value = await this.getItem("staking_share")
    if (!value) return null
    return new BigNumber(value)
  }

  async setStakingShare(value: BigNumber){
    await this.setItem("staking_share", value ? value.toString() : null)
  }


  async setLastEpochRequestTime(time: number) {
    await this.setObject("last_epoch_time", { ts: time })
  }
 
  async getLastEpochRequestTime() {
    const result = await this.getObject("last_epoch_time")
    if (!result || !result.ts) return Date.now()
    return result.ts
  }


  // --- Low level ---

  async setObject(key: string, value: any) {
    this.putCache(key, value)
    await this.setItem(key, JSON.stringify(value, replacer), false);
  }

  async getObject(key: string): Promise<any | null> {
    const cached = this.getCache(key)
    if (cached != null) return cached

    const value = await this.getItem(key);
    if (value == null) return null;
    return JSON.parse(value, reviver);
  }

  async setItem(key: string, value: string, cache: boolean = true) {
    if (cache) this.putCache(key, value)
    await Storage.set({
      key: key,
      value: value,
    });
    this.reflectiOSStorage()
  }

  // sigh
  private reflectiOSStorage() {
    try {
      if (!this.platform.is("ios")) return;
      // TODO: Theres's a new prefix in capacitor 3
      StorageMirror.reflect({
        keys: [
          "_cap_prefered_unit",
          "_cap_network_preferences",
          "_cap_validators_main",
          "_cap_validators_pyrmont",
          "_cap_validators_prater",
          "_cap_validators_staging",
          "_cap_auth_user"
        ]
      })
    } catch (e) {
      console.warn("StorageMirror exception", e)
    }
  }

  async getItem(key: string): Promise<string | null> {
    const cached = this.getCache(key)
    if (cached != null) return cached

    const { value } = await Storage.get({ key: key });
    return value;
  }

  async findAllKeys(startingWith: string) {
    const keys = await Storage.keys()
    const result: string[] = []
    keys.keys.forEach((value) => {
      if (value.startsWith(startingWith)) result.push(value)
    })
    return result
  }

  async remove(key: string) {
    this.invalidateCache(key)
    await Storage.remove({ key: key });
    this.reflectiOSStorage()
  }

  async keys() {
    const { keys } = await Storage.keys();
    return keys;
  }

  async clear() {
    this.invalidateAllCache()
    await Storage.clear();
    this.reflectiOSStorage()
  }

}

function replacer(key, value) {
  const originalObject = this[key];
  if (originalObject instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(originalObject.entries()),
    };
  } else {
    return value;
  }
}

function reviver(key, value) {
  if (typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
  }
  return value;
}

interface PremiumObject {
  key: string
  description: string,
  price: number,
  numValidators: number
};

interface NotificationToggles {
  notify: boolean;
  notifySlashed: boolean;
  notifyDecreased: boolean;
  notifyClientUpdate: boolean;
  notifyProposalsSubmitted: boolean;
  notifyProposalsMissed: boolean;
  notifyAttestationsMissed: boolean;
  notifyMachineOffline: boolean;
  notifyMachineHddWarn: boolean;
  notifyMachineCpuWarn: boolean;
  notifyMachineMemoryLoad: boolean;
}