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
import { ApiService } from './api.service';
import { SETTING_NOTIFY, StorageService } from './storage.service';
import { Mutex } from 'async-mutex';
import { BundleSub, NotificationBundleSubsRequest, NotificationGetRequest, SetMobileSettingsRequest } from '../requests/requests';
import ClientUpdateUtils, { ETH1_CLIENT_SAVED, ETH2_CLIENT_SAVED, OTHER_CLIENT_SAVED } from '../utils/ClientUpdateUtils';
import { ValidatorSyncUtils } from '../utils/ValidatorSyncUtils';
import { NotificationBase } from '../tab-preferences/notification-base';

const NOTIFY_SYNCCHANGE = "notify_syncchange_"

const MAX_SERVER_BUNDLE_SIZE = 100

interface SyncChanged {
  lastChanged: number,
  lastSynced: number,
  eventName: string,
  network: string,
  eventFilter?: string,
  eventThreshold?: number
}

enum SyncActionEvent {
  NOTIFY_GLOBAL,
  CLIENT_UPDATE_GENERAL,
  NOTIFICATIONS
}

interface BundleSubWithAction extends BundleSub{
  onComplete: (boolean) => void
}

interface BundleSubContainer {
  bundle: BundleSubWithAction,
  network: string,
  enabled: boolean
}

interface NetworkBundle {
  bundles: BundleSubWithAction[],
  network: string,
  subscribe: boolean
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {

  private syncLock = new Mutex()
  private lastNotifySync = 0
  private bundleList: BundleSubContainer[] = []

  constructor(
    private api: ApiService,
    private storage: StorageService,
    private validatorSyncUtils: ValidatorSyncUtils,
    private updateUtils: ClientUpdateUtils,
    protected notificationBase: NotificationBase,
  ) { }

  public async mightSyncUpAndSyncDelete() {
    await this.validatorSyncUtils.mightSyncUpAndSyncDelete(
      () => { this.syncAllSettingsForceStaleNotifications() }
    )
  }

  public async fullSync() {
    await this.validatorSyncUtils.fullSync(
      () => { this.syncAllSettingsForceStaleNotifications() }
    )
  }

  public async syncDown() {
    await this.validatorSyncUtils.syncDown()
  }

  async syncAllSettings() {
    const loggedIn = await this.storage.isLoggedIn()
    if (!loggedIn) return false

    if (this.syncLock.isLocked()) return

    if (this.lastNotifySync + (15 * 1000) > Date.now()) {
      console.log("Syncing notify cancelled, last update was less than 15 seconds ago")
      return;
    }

    console.log("== Syncing notify ==")

    console.log("== Step 1: Loading notification preferences from beaconcha.in ==")
    await this.notificationBase.loadNotifyToggles()

    console.log("== Step 2: Sync changes ==")

    const unlock = await this.syncLock.acquire();
    this.bundleList = []

    const allNotifyKeys = await this.getAllSyncChangeKeys()
    for (const key of allNotifyKeys) {
      const cleanKey = key.replace(NOTIFY_SYNCCHANGE, "")
      const syncAction = this.getSyncAction(cleanKey)

      await this.syncSingle(
        cleanKey,
        syncAction
      )
    }

    await this.postNotifyBundles()

    unlock();

    if (allNotifyKeys.length > 0) { 
      this.api.clearSpecificCache(new NotificationGetRequest())
    } 

    this.deleteAllTemp()

    console.log("== Syncing notify completed ==")
  }

  /**
   * Stale all validator specific notifications so they can be reapplied according to the current settings.
   * This is needed when we add a new validators and want to apply the notification settings for them
   */
  async syncAllSettingsForceStaleNotifications() {
    const loggedIn = await this.storage.isLoggedIn()
    if (!loggedIn) return false

    const allNotifyKeys = await this.getAllSyncChangeKeys()
    for (const key of allNotifyKeys) {
      const cleanKey = key.replace(NOTIFY_SYNCCHANGE, "")
      if (cleanKey.indexOf("monitoring_") >= 0) continue
      if (cleanKey.indexOf("setting_notify_newround") >= 0) continue
      if (cleanKey.indexOf("setting_notify_clientupdate") >= 0) continue;
      if (cleanKey.indexOf("rocketpool_new_claimround") >= 0) continue
      if (cleanKey.indexOf("eth_client_update") >= 0) continue;
      if (cleanKey.indexOf("setting_notify_machineoffline") >= 0) continue;
      if (cleanKey.indexOf("setting_notify_hddwarn") >= 0) continue;
      if (cleanKey.indexOf("setting_notify_cpuwarn") >= 0) continue;
      if (cleanKey.indexOf("setting_notify_memorywarn") >= 0) continue;
      if (cleanKey.indexOf("setting_notify_rplcommission") >= 0) continue;
     
      const syncAction = this.getSyncActionEvent(cleanKey)
      if(syncAction != SyncActionEvent.NOTIFICATIONS) continue
      console.log("STALE CHECK " + cleanKey, syncAction)

      if (syncAction == SyncActionEvent.NOTIFICATIONS) {
        const temp = await this.getChanged(cleanKey)
        console.log("== STALING " + cleanKey + " ==", temp)
        await this.setLastChanged(cleanKey, temp.eventName, temp.eventFilter, temp.eventThreshold)
      }
    }

    this.syncAllSettings()
  }

  async deleteAllTemp() {
    const allNotifyKeys = await this.getAllSyncChangeKeys()
    for (const key of allNotifyKeys) {
      if (key.indexOf("temponly") >= 0) {
        this.storage.remove(key)
      }
    }
  }

  async developDeleteQueue() {
    const allNotifyKeys = await this.getAllSyncChangeKeys()
    for (const key of allNotifyKeys) {
      this.storage.remove(key)
    }
  }

  private getSyncAction(key: string): (syncChange: SyncChanged, onComplete: (boolean) => void) => Promise<boolean> {
    const actionEvent = this.getSyncActionEvent(key)

    if (actionEvent == SyncActionEvent.NOTIFY_GLOBAL) {
      return async (_, onComplete) => {
        const currentValue = await this.storage.getBooleanSetting(key)
        const result = await this.updateRemoteGeneralNotifySettings(currentValue)
        onComplete(result)
        return result
      }
    } else if (actionEvent == SyncActionEvent.CLIENT_UPDATE_GENERAL) {
      return this.getClientUpdateSyncAction()
    } 

    return this.getNotifySubSyncAction(key)
  }

  async getClientUpdateFilter(clientKey): Promise<any> {
    const client = await this.updateUtils.getClient(clientKey)
    if (!client) {
      return new Error("No clients configured");
    }
    return client.toLocaleLowerCase()
  }

  getGeneralFilter(item: SyncChanged): string {
    return item.eventFilter
  }

  getNotifySubSyncAction (key) {
    return async (syncChange: SyncChanged, superOnComplete: (boolean) => void) => { 
      var currentValue = await this.storage.getBooleanSetting(key)
      if (syncChange.eventFilter && syncChange.eventFilter.indexOf("sub_") >= 0) {
        currentValue = syncChange.eventFilter.indexOf("unsub_") < 0
      }

      var eventFilter = syncChange.eventFilter
      if (eventFilter) {
        eventFilter = eventFilter.replace("unsub_", "").replace("sub_", "")
      }
      this.queueForPost(currentValue, syncChange.network, {
        event_name: syncChange.eventName,
        event_filter: eventFilter,
        event_threshold: syncChange.eventThreshold,
        onComplete: superOnComplete
      })
      return true
    }
  }

  getSyncActionEvent(key: string) {
    if (key.endsWith(SETTING_NOTIFY)) {
      return SyncActionEvent.NOTIFY_GLOBAL
    } else if (key.endsWith(ETH2_CLIENT_SAVED)) {
      return SyncActionEvent.CLIENT_UPDATE_GENERAL
    } else if (key.endsWith(ETH1_CLIENT_SAVED)) {
      return SyncActionEvent.CLIENT_UPDATE_GENERAL
    }  else if (key.endsWith(OTHER_CLIENT_SAVED)) {
      return SyncActionEvent.CLIENT_UPDATE_GENERAL
    }

    return SyncActionEvent.NOTIFICATIONS
  }


  private getClientUpdateSyncAction(){
    return async (syncChange: SyncChanged, superOnComplete: (boolean) => void) => {
      return this.getNotifySubSyncAction(syncChange.eventName)(syncChange, superOnComplete)
    }
  }


  private queueForPost(enabled: boolean, network: string, bundle: BundleSubWithAction) {
    this.bundleList.push({
      bundle: bundle,
      enabled: enabled,
      network: network
    })
  }

  private getNetworkBundles(filterEnabled: boolean): NetworkBundle[] {
    // Prepare by filtering to networks
    var networkMap = new Map<string, BundleSubWithAction[]>()
    this.bundleList.forEach((it) => {
      if (it.enabled == filterEnabled) {
        var array: BundleSubWithAction[] = []
        if (networkMap.has(it.network)) {
          array = networkMap.get(it.network)
        }
              
        array.push(it.bundle)
        networkMap.set(it.network, array)
      }
    })

    // Adding all networks in an array for return
    var result: NetworkBundle[] = []
    networkMap.forEach((value, key) => {
      result.push({
        bundles: value,
        network: key,
        subscribe: filterEnabled
      })
    })
    return result
  }

  private getBundles(): NetworkBundle[] {
    return this.getNetworkBundles(true).concat(this.getNetworkBundles(false))
  }

  async postNotifyBundles() {
    let bundles = this.getBundles()
    for (var i = 0; i < bundles.length; i++) {
      let bundle = bundles[i]
      while (bundle.bundles.length) {
        let splice = bundle.bundles.splice(0,MAX_SERVER_BUNDLE_SIZE) 
        let success = await this.postNotifyBundle(bundle.subscribe, splice, bundle.network)
        if (success) this.lastNotifySync = Date.now()
        
        for (var j = 0; j < splice.length; j++){
          await splice[j].onComplete(success)
        }
      }
    }
  }

  private async postNotifyBundle(subscribe: boolean, data: BundleSub[], network: string): Promise<boolean> {
    const loggedIn = await this.storage.isLoggedIn()
    if (!loggedIn) return false

    const request = new NotificationBundleSubsRequest(subscribe, data);
    if (network) {
      request.endPoint = network
    }

    const response = await this.api.execute(request)
    const result = request.wasSuccessfull(response) 
    if (!result) {
      return false
    }

    return true
  }

  private async updateRemoteGeneralNotifySettings(value): Promise<boolean> {
    const req = new SetMobileSettingsRequest(value)
    const resp = await this.api.execute(req)
    const result = req.parse(resp)
    if (!result || (result.length >= 0 && result[0].notify_enabled != value)) {
      return false
    }
    return true
  }

  private async syncSingle(key: string, syncAction: (syncChange: SyncChanged, onComplete: (boolean) => void) => Promise<boolean>) {
    const syncChange = await this.getChanged(key)
    if (syncChange.eventName == "") {
      console.log("== Sync notify: (key) " + key + " has no event name, abort")
      return
    }

    if (syncChange.lastChanged > syncChange.lastSynced) {
      console.log("== Syncing notify: " + key + " changed, updating on remote... ==", syncChange.lastChanged, syncChange.lastSynced)
      const actionPromise = syncAction(syncChange, (success) => {
        if (success) {
          console.log("== Syncing notify: " + key + " synced successfully! ==")
          this.setLastSynced(key, syncChange.eventName)
        }
      })
      await actionPromise

      return true
    }
    return false
  }

  async changeOtherClient(value) {
    const oldValue = await this.updateUtils.getOtherClient()
    const changed = await this.updateUtils.setOtherClient(value)
    if (changed) {
      if (value && value != 'null') {
        this.setLastChanged(OTHER_CLIENT_SAVED, "eth_client_update", "sub_" + value.toLocaleLowerCase(), null)
      }
      if (oldValue) {
        this.setLastChanged("UN"+OTHER_CLIENT_SAVED, "eth_client_update", "unsub_" + oldValue.toLocaleLowerCase(), null)
      }
    }
  }

  async changeETH2Client(value: string) {
    const oldValue = await this.updateUtils.getETH2Client()
    const changed = await this.updateUtils.setETH2Client(value)
    if (changed) {
      if (value != "none") {
        this.setLastChanged(ETH2_CLIENT_SAVED, "eth_client_update", "sub_" + value.toLocaleLowerCase(), null)
      }
      
      if (oldValue) {
        this.setLastChanged("UN"+ETH2_CLIENT_SAVED, "eth_client_update", "unsub_" + oldValue.toLocaleLowerCase(), null)
      }
    }
  }

  async changeETH1Client(value: string) {
    const oldValue = await this.updateUtils.getETH1Client()
    const changed = await this.updateUtils.setETH1Client(value)
    if (changed) {
      if (value != "none") {
        this.setLastChanged(ETH1_CLIENT_SAVED, "eth_client_update", "sub_" + value.toLocaleLowerCase(), null)
      }
      if (oldValue) {
        this.setLastChanged("UN"+ETH1_CLIENT_SAVED, "eth_client_update", "unsub_" + oldValue.toLocaleLowerCase(), null)
      }
    }
  }


  async changeGeneralNotify(value: boolean, filter: string = null) {
    this.storage.setBooleanSetting(SETTING_NOTIFY, value)
    this.setLastChanged(SETTING_NOTIFY, SETTING_NOTIFY, filter, null)
   
  }

  async changeNotifyEvent(key: string, event: string, value: boolean, filter: string = null, threshold: number = null) {
    const net = (await this.api.networkConfig).net
    this.storage.setBooleanSetting(net + key, value)
    this.setLastChanged(net + key, event, filter, threshold)
  }

  async changeNotifyEventUser(key: string, event: string, value: boolean, filter: string = null, threshold: number = null) {
    this.storage.setBooleanSetting(key, value)
    this.setLastChanged( key, event, filter, threshold)
  }

  async reapplyNotifyEvent(event: string, filter: string = null): Promise<boolean> {
    const currentKey = await this.findSimilarChanged(event)
    if (currentKey == null) {
      console.log("ignoring reapplyNotifyEvent, no key with similar name found", event, event)
      return false
    }

    const current = await this.getChanged(currentKey)
    if (current.eventName == "") {
      console.log("ignoring reapplyNotifyEvent since no previous setting change has been found for event", event, event)
      return false
    }
    this.setLastChanged(event + filter, event, filter, current.eventThreshold)
    return true
  }

  async changeNotifyClientUpdate(key: string, value: boolean, filter: string = null) {
    this.storage.setBooleanSetting(key, value)
    var subOrUnsub = value ? "sub_" : "unsub_"
    var client = await this.updateUtils.getETH1Client()
    if (client && client != "none") {
      this.setLastChanged(ETH1_CLIENT_SAVED, "eth_client_update", subOrUnsub + client.toLocaleLowerCase(), null)
    }
    
    client = await this.updateUtils.getETH2Client()
    if (client && client != "none") {
      this.setLastChanged(ETH2_CLIENT_SAVED, "eth_client_update", subOrUnsub + client.toLocaleLowerCase(), null)
    }

    client = await this.updateUtils.getOtherClient()
    if (client && client != "null") {
      this.setLastChanged(OTHER_CLIENT_SAVED, "eth_client_update", subOrUnsub + client.toLocaleLowerCase(), null)
    }
  }

  private async setLastSynced(key: string, event: string, value: number = Date.now()) {
    const current = await this.getChanged(key)
    this.setChanged(key, {
      lastChanged: current.lastChanged,
      lastSynced: value,
      eventName: event,
      network: await this.api.getApiBaseUrl(),
      eventFilter: current.eventFilter,
      eventThreshold: current.eventThreshold
    })
  }

  private async setLastChanged(key: string, event: string, filter: string, threshold: number, value: number = Date.now()) {
    const current = await this.getChanged(key)
    this.setChanged(key, {
      lastChanged: value,
      lastSynced: current.lastSynced,
      eventName: event,
      network: await this.api.getApiBaseUrl(),
      eventFilter: filter,
      eventThreshold: threshold
    })
  }

  private async getAllSyncChangeKeys() {
    return await this.storage.findAllKeys(NOTIFY_SYNCCHANGE)
  }

  private setChanged(key: string, syncChanged: SyncChanged) {
    this.storage.setObject(NOTIFY_SYNCCHANGE + key, syncChanged)
  }

  private async getChanged(key: string): Promise<SyncChanged> {
    const temp: SyncChanged = await this.storage.getObject(NOTIFY_SYNCCHANGE + key)
    if (temp && temp.lastChanged) return temp
    return {
      lastChanged: 0,
      lastSynced: 0,
      eventName: "",
      network: await this.api.getApiBaseUrl(),
      eventFilter: null,
      eventThreshold: null
    }
  }

  // finds newest changed key with similar name
  private async findSimilarChanged(keySearch: string) {
    var erg: string = null
    var ergRetrieved: SyncChanged
    const allNotifyKeys = await this.getAllSyncChangeKeys()
    for (const key of allNotifyKeys) {
      const cleanKey = key.replace(NOTIFY_SYNCCHANGE, "")
      if (cleanKey.indexOf(keySearch) >= 0) {
        if (erg == null) {
          erg = cleanKey
          ergRetrieved = await this.getChanged(key)
        }
        else {
          const retrieved = await this.getChanged(key)
          if (retrieved.lastChanged > ergRetrieved.lastChanged) {
            erg = cleanKey
            ergRetrieved = await this.getChanged(key)
          }
        }
      }
    }
    return erg
  }
}