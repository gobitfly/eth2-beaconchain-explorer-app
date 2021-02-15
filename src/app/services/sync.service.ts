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
import { ValidatorUtils } from '../utils/ValidatorUtils';
import { ApiService } from './api.service';
import { SETTING_NOTIFY, SETTING_NOTIFY_CLIENTUPDATE, StorageService } from './storage.service';
import { Mutex } from 'async-mutex';
import { SetMobileSettingsRequest } from '../requests/requests';
import ClientUpdateUtils, { ETH1_CLIENT_SAVED, ETH2_CLIENT_SAVED } from '../utils/ClientUpdateUtils';
import { ValidatorSyncUtils } from '../utils/ValidatorSyncUtils';

const NOTIFY_SYNCCHANGE = "notify_syncchange_"

interface SyncChanged {
  lastChanged: number,
  lastSynced: number,
  eventName: string,
  network: string
}

enum SyncActionEvent {
  NOTIFY_GLOBAL,
  NOTIFY_CLIENTUPDATE,
  ETH1_UPDATE,
  ETH2_UPDATE,
  NOTIFICATIONS
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {

  private syncLock = new Mutex()
  private lastNotifySync = 0

  constructor(
    private api: ApiService,
    private storage: StorageService,
    private validatorSyncUtils: ValidatorSyncUtils,
    private validatorUtils: ValidatorUtils,
    private updateUtils: ClientUpdateUtils,
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

    if (this.lastNotifySync + (2 * 60 * 1000) > Date.now()) {
      console.log("Syncing notify cancelled, last update was less than 2 minutes ago")
      return;
    }

    console.log("== Syncing notify ==")

    const unlock = await this.syncLock.acquire();

    const allNotifyKeys = await this.getAllSyncChangeKeys()
    for (const key of allNotifyKeys) {
      const cleanKey = key.replace(NOTIFY_SYNCCHANGE, "")
      const syncAction = this.getSyncAction(cleanKey)

      const sendToRemote = await this.syncSingle(
        cleanKey,
        syncAction
      )
      if (sendToRemote) this.lastNotifySync = Date.now()
    }

    unlock();

    console.log("== Syncing notify completed ==")
  }

  async syncAllSettingsForceStaleNotifications() {
    const loggedIn = await this.storage.isLoggedIn()
    if (!loggedIn) return false

    const allNotifyKeys = await this.getAllSyncChangeKeys()
    for (const key of allNotifyKeys) {
      const cleanKey = key.replace(NOTIFY_SYNCCHANGE, "")
      const syncAction = this.getSyncActionEvent(cleanKey)
      console.log("STALE CHECK " + cleanKey, syncAction)

      if (syncAction == SyncActionEvent.NOTIFICATIONS) {
        const temp = await this.getChanged(cleanKey)
        console.log("== STALING " + cleanKey + " ==", temp)
        this.setLastChanged(cleanKey, temp.eventName)
      }
    }

    this.syncAllSettings()
  }

  async developDeleteQueue() {
    if (!this.api.debug) return false

    const allNotifyKeys = await this.getAllSyncChangeKeys()
    for (const key of allNotifyKeys) {
      this.storage.remove(key)
    }
  }

  private getSyncAction(key: string): (syncChange: SyncChanged) => Promise<boolean> {
    const actionEvent = this.getSyncActionEvent(key)

    if (actionEvent == SyncActionEvent.NOTIFY_GLOBAL) {
      return async (_) => {
        const currentValue = await this.storage.getBooleanSetting(key)
        return this.updateRemoteGeneralNotifySettings(currentValue)
      }
    } else if (actionEvent == SyncActionEvent.NOTIFY_CLIENTUPDATE) {
     return this.getClientUpdateNotifySyncAction()
    } 
    else if (actionEvent == SyncActionEvent.ETH2_UPDATE) {
      return this.getClientUpdateSyncAction(ETH2_CLIENT_SAVED)
    } else if (actionEvent == SyncActionEvent.ETH1_UPDATE) {
      return this.getClientUpdateSyncAction(ETH1_CLIENT_SAVED)
    }

    return this.getNotifySubSyncAction(key, null)
  }

  async getClientUpdateFilter(clientKey): Promise<any> {
    const client = await this.updateUtils.getClient(clientKey)
    if (!client) {
      return new Error("No clients configured");
    }
    return client.toLocaleLowerCase()
  }

  getNotifySubSyncAction (key, filter: Promise<any> | null) {
    return async (syncChange) => {
      const currentValue = await this.storage.getBooleanSetting(key)

      var resolvedFilter = filter ? await filter : null
      if(resolvedFilter && resolvedFilter instanceof Error){
        console.log("Error resolving filter", resolvedFilter)
        // this case only fails if no eth clients are configured and we want to sync
        // client update notification settings. In this case, we drop the sync request
        // since there is nothing to sync (returning true)
        return true
      }
      
      return this.validatorUtils.postNotifySub(
        syncChange.eventName,
        resolvedFilter,
        currentValue,
        true,
        syncChange.network
      )
    }
  }

  getSyncActionEvent(key: string) {
    if (key.endsWith(SETTING_NOTIFY)) {
      return SyncActionEvent.NOTIFY_GLOBAL
    } else if (key.endsWith(SETTING_NOTIFY_CLIENTUPDATE)) {
      return SyncActionEvent.NOTIFY_CLIENTUPDATE
    } else if (key.endsWith(ETH2_CLIENT_SAVED)) {
      return SyncActionEvent.ETH2_UPDATE
    } else if (key.endsWith(ETH1_CLIENT_SAVED)) {
      return SyncActionEvent.ETH1_UPDATE
    }

    return SyncActionEvent.NOTIFICATIONS
  }

  private getClientUpdateNotifySyncAction() {
    const eth2Success = this.getNotifySubSyncAction(SETTING_NOTIFY_CLIENTUPDATE,
      this.getClientUpdateFilter(ETH2_CLIENT_SAVED)
    )

    const eth1Success = this.getNotifySubSyncAction(SETTING_NOTIFY_CLIENTUPDATE,
      this.getClientUpdateFilter(ETH1_CLIENT_SAVED)
    )

    return async (syncChange): Promise<boolean> => {
      return await eth1Success(syncChange) && await eth2Success(syncChange)
    }
  }

  private getClientUpdateSyncAction(key){
    return async (syncChange) => {
      const oldClient = await this.getDeleteOldClient(key)
      if (oldClient) {
        const deleted = this.validatorUtils.postNotifySub(
            syncChange.eventName,
            oldClient.toLocaleLowerCase(),
            false,
            true,
            syncChange.network
          )
        if (!deleted) return deleted
        this.setDeleteOldClient(key, null)
      }
      const filter = this.getClientUpdateFilter(key)
      return this.getNotifySubSyncAction(SETTING_NOTIFY_CLIENTUPDATE, filter)(syncChange)
    }
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

  private async syncSingle(key: string, syncAction: (syncChange: SyncChanged) => Promise<boolean>) {
    const syncChange = await this.getChanged(key)
    if (syncChange.eventName == "") {
      console.log("== Sync notify: (key) " + key + " has no event name, abort")
      return
    }

    if (syncChange.lastChanged > syncChange.lastSynced) {
      console.log("== Syncing notify: " + key + " changed, updating on remote... ==")
      const actionPromise = syncAction(syncChange)
      const success = await actionPromise
      if (success) {
        console.log("== Syncing notify: " + key + " synced successfully! ==")
        this.setLastSynced(key, syncChange.eventName)
      }
      return true
    }
    return false
  }

  async changeETH2Client(value: string) {
    const oldValue = await this.updateUtils.getETH2Client()
    const changed = await this.updateUtils.setETH2Client(value)
    if (changed) {
      this.setLastChanged(ETH2_CLIENT_SAVED, "eth_client_update")
      this.setDeleteOldClient(ETH2_CLIENT_SAVED, oldValue)
    }
  }

  async changeETH1Client(value: string) {
    const oldValue = await this.updateUtils.getETH1Client()
    const changed = await this.updateUtils.setETH1Client(value)
    if (changed) {
      this.setLastChanged(ETH1_CLIENT_SAVED, "eth_client_update")
      this.setDeleteOldClient(ETH1_CLIENT_SAVED, oldValue)
    }
  }

  private async getDeleteOldClient(key: string): Promise<string> {
    const temp = await this.storage.getItem("UNSYNCED_OLD" + key)
    if (temp && temp.length >= 1) return temp
    return null
  }

  private setDeleteOldClient(key: string, value: string) {
    this.storage.setItem("UNSYNCED_OLD" + key, value)
  }

  async changeGeneralNotify(value: boolean) {
    const net = (await this.api.networkConfig).net
    this.storage.setBooleanSetting(SETTING_NOTIFY, value)
    this.setLastChanged(SETTING_NOTIFY, SETTING_NOTIFY)
  }

  async changeNotifyEvent(key: string, event: string, value: boolean) {
    const net = (await this.api.networkConfig).net
    this.storage.setBooleanSetting(net + key, value)
    this.setLastChanged(net + key, event)
  }

  changeNotifyClientUpdate(key: string, value: boolean) {
    this.storage.setBooleanSetting(key, value)
    this.setLastChanged(key, "eth_client_update")
  }

  private async setLastSynced(key: string, event: string, value: number = Date.now()) {
    const current = await this.getChanged(key)
    this.setChanged(key, {
      lastChanged: current.lastChanged,
      lastSynced: value,
      eventName: event,
      network: await this.api.getApiBaseUrl()
    })
  }

  private async setLastChanged(key: string, event: string, value: number = Date.now()) {
    const net = (await this.api.networkConfig).net
    const current = await this.getChanged(key)
    this.setChanged(key, {
      lastChanged: value,
      lastSynced: current.lastSynced,
      eventName: event,
      network: await this.api.getApiBaseUrl()
    })
  }

  private async getAllSyncChangeKeys() {
    return await this.storage.findAllKeys(NOTIFY_SYNCCHANGE)
  }

  private setChanged(key: string, syncChanged: SyncChanged) {
    this.storage.setObject(NOTIFY_SYNCCHANGE + key, syncChanged)
  }

  private async getChanged(key: string): Promise<SyncChanged> {
    const net = (await this.api.networkConfig).net
    const temp: SyncChanged = await this.storage.getObject(NOTIFY_SYNCCHANGE + key)
    if (temp && temp.lastChanged) return temp
    return {
      lastChanged: 0,
      lastSynced: 0,
      eventName: "",
      network: await this.api.getApiBaseUrl()
    }
  }
}