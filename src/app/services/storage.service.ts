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
import { SETTING_NOTIFY_CLIENTUPDATE, SETTING_NOTIFY, SETTING_NOTIFY_DECREASED, SETTING_NOTIFY_SLASHED, SETTING_NOTIFY_PROPOSAL_SUBMITTED, SETTING_NOTIFY_PROPOSAL_MISSED, SETTING_NOTIFY_ATTESTATION_MISSED, SETTING_NOTIFY_MACHINE_OFFLINE, SETTING_NOTIFY_CPU_WARN, SETTING_NOTIFY_HDD_WARN, SETTING_NOTIFY_MEMORY_WARN, EVENT_MONITORING_MACHINE_OFFLINE, EVENT_VALIDATOR_GOT_SLASHED, EVENT_VALIDATOR_ATTESTATION_MISSED, EVENT_MONITORING_HDD_ALMOSTFULL, EVENT_MONITORING_CPU_LOAD, EVENT_MONITORING_MEMORY_USAGE, EVENT_ETH_CLIENT_UPDATE, ETH1_CLIENT_SAVED, ETH2_CLIENT_SAVED} from '../utils/Constants'


import { Storage } from '@capacitor/storage';
const { StorageMirror } = Plugins;

const AUTH_USER = "auth_user";
const PREFERENCES = "network_preferences";

@Injectable({
  providedIn: 'root'
})
export class StorageService extends CacheModule {

  constructor(private platform: Platform) {
    super()
    this.reflectiOSStorage()
  }

  // --- upper level helper ---

  async backupAuthUser() {
    return this.setObject(AUTH_USER + "_backup", await this.getAuthUser());
  }

  async restoreAuthUser() {
    return this.setAuthUser(await this.getObject(AUTH_USER + "_backup"))
  }

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
    console.log('getting network preferences', result)
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

  async getNotificationTogglePreferences( network: string, validators: string[], machines: string[]): Promise<NotificationToggles> {
    const notificationtoggles = await this.loadPreferencesToggles(network, validators, machines)

    this.putCache(network + "toggle_preferences", notificationtoggles)
    console.log('getting notification toggle preferences: ', notificationtoggles)
    return notificationtoggles
  }
  
  
  
  async loadPreferencesToggles(network: string, validators: string[], machines: string[]): Promise<NotificationToggles> {
    const notify = await this.getBooleanSetting(network + ":" + SETTING_NOTIFY ) 
    const hasValidators = validators.length && notify ? true : false
    let notifySlashed = hasValidators
    let notifyProposalsSubmitted = hasValidators
    let notifyProposalsMissed = hasValidators
    let notifyAttestationsMissed = hasValidators

    for (let i = 0; i < validators.length; i++) {
      if (notifySlashed) {
        notifySlashed = await this.getBooleanSetting(network + ":" + EVENT_VALIDATOR_GOT_SLASHED + ":" + validators[i], false)
      }
      if (notifyProposalsSubmitted) {
        notifyProposalsSubmitted = await this.getBooleanSetting(network + ":" + EVENT_VALIDATOR_GOT_SLASHED + ":" + validators[i], false)
      }
      if (notifyProposalsMissed) {
        notifyProposalsMissed = await this.getBooleanSetting(network + ":" + EVENT_VALIDATOR_GOT_SLASHED + ":" + validators[i], false)
      }
      if (notifyAttestationsMissed) {
        notifyProposalsMissed = await this.getBooleanSetting(network + ":" + EVENT_VALIDATOR_ATTESTATION_MISSED + ":" + validators[i], false)
      }
    }

    const hasMachines = machines.length && notify ? true : false

    let notifyMachineOffline = hasMachines
    let notifyMachineHddWarn = hasMachines
    let notifyMachineCpuWarn = hasMachines
    let notifyMachineMemoryLoad = hasMachines

    for (let i = 0; i < machines.length; i++) {
      if (notifyMachineOffline) {
        notifyMachineOffline = await this.getBooleanSetting(network + ":" + EVENT_MONITORING_MACHINE_OFFLINE + ":" + machines[i], false)
      }
      if (notifyMachineHddWarn) {
        notifyMachineHddWarn = await this.getBooleanSetting(network + ":" + EVENT_MONITORING_HDD_ALMOSTFULL + ":" + machines[i], false)

      }
      if (notifyMachineCpuWarn) {
        notifyMachineCpuWarn = await this.getBooleanSetting(network + ":" + EVENT_MONITORING_CPU_LOAD + ":" + machines[i], false)

      }
      if (notifyMachineMemoryLoad) {
        notifyMachineMemoryLoad = await this.getBooleanSetting(network + ":" + EVENT_MONITORING_MEMORY_USAGE + ":" + machines[i], false)
      }
    }

    let notifyClientUpdate = false
    const eth1Cliet = await this.getItem(ETH1_CLIENT_SAVED)
    const eth2Client = this.getItem(ETH2_CLIENT_SAVED)

    const eth1 = await this.getBooleanSetting(EVENT_ETH_CLIENT_UPDATE + ":" + eth1Cliet, false)
    const eth2 = await this.getBooleanSetting(EVENT_ETH_CLIENT_UPDATE + ":" + eth2Client, false)

    if(eth1 && eth2 && notify) {
      notifyClientUpdate = true
    }

    console.log('getting setting machine offline: ', network + ":" + EVENT_MONITORING_MACHINE_OFFLINE , notifyMachineOffline)

    return {
      notify: notify,
      notifySlashed: notifySlashed,
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

  async migrateToCapacitor3() {
    if (!this.platform.is("ios")) return;
    let alreadyMigrated = await this.getBooleanSetting("migrated_to_cap3", false)
    if (!alreadyMigrated) {
      console.log("migrating to capacitor 3 storage...")
      let result = await Storage.migrate()
      this.setBooleanSetting("migrated_to_cap3", true)
    }
  }

  // --- Low level ---

  async setObject(key: string, value: any) {
    this.putCache(key, value)
    await this.setItem(key, JSON.stringify(value, replacer), false);
  }

  async getObject(key: string): Promise<any | null> {
    const cached = await this.getCache(key)
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
      StorageMirror.reflect({
        keys: [
          "CapacitorStorage.prefered_unit",
          "CapacitorStorage.network_preferences",
          "CapacitorStorage.validators_main",
          "CapacitorStorage.validators_pyrmont",
          "CapacitorStorage.validators_prater",
          "CapacitorStorage.validators_staging",
          "CapacitorStorage.auth_user"
        ]
      })
    } catch (e) {
      console.warn("StorageMirror exception", e)
    }
  }

  async getItem(key: string): Promise<string | null> {
    const cached = await this.getCache(key)
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
  notifyClientUpdate: boolean;
  notifyProposalsSubmitted: boolean;
  notifyProposalsMissed: boolean;
  notifyAttestationsMissed: boolean;
  notifyMachineOffline: boolean;
  notifyMachineHddWarn: boolean;
  notifyMachineCpuWarn: boolean;
  notifyMachineMemoryLoad: boolean;
}