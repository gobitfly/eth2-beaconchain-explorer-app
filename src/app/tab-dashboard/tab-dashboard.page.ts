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

import { Component } from '@angular/core';
import { ApiService } from '../services/api.service';
import { ValidatorUtils } from '../utils/ValidatorUtils';
import OverviewController, { OverviewData } from '../controllers/OverviewController';
import ClientUpdateUtils from '../utils/ClientUpdateUtils';
import { Plugins, AppState } from '@capacitor/core';
import { StorageService } from '../services/storage.service';
const { App } = Plugins;

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab-dashboard.page.html',
  styleUrls: ['tab-dashboard.page.scss']
})
export class Tab1Page {

  lastRefreshTs: number = 0
  overallData: OverviewData
  initialized = true
  currentY = 0
  scrolling = false

  constructor(
    private validatorUtils: ValidatorUtils,
    public api: ApiService,
    public updates: ClientUpdateUtils,
    private storage: StorageService
  ) {
    this.validatorUtils.registerListener(() => {
      this.refresh()
    })

    App.addListener('appStateChange', (state: AppState) => {
      if (state.isActive) {
        if (this.lastRefreshTs + 6 * 60 > this.getUnixSeconds()) return
        this.refresh()
      } else {
        console.log('App has become inactive');
      }
    });

  }

  onScroll($event) {
    this.currentY = $event.detail.currentY
  }

  onScrollStarted() {
    this.scrolling = true
    this.removeTooltips()
  }

  onScrollEnded() {
    this.scrolling = false
  }

  private async removeTooltips() {
    var inputs = Array.from(document.getElementsByTagName('tooltip') as HTMLCollectionOf<HTMLElement>)
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].style.display = 'none';
    }
  }

  async ionViewWillEnter() {
    if (this.lastRefreshTs + 6 * 60 > this.getUnixSeconds()) return

    this.refresh()
  }

  async refresh() {
    this.initialized = true
    if (!(await this.validatorUtils.hasLocalValdiators())) {
      this.initialized = false
      return
    }

    const validators = this.validatorUtils.getAllMyValidators().catch((error) => { return [] })
    const performances = this.validatorUtils.getAllMyPerformances().catch((error) => { return [] })
    const epoch = this.validatorUtils.getRemoteCurrentEpoch().catch((error) => { return null })
    const attestationPerformance = this.validatorUtils.getAllMyAttestationPerformances().catch((error) => { return null })
    const overviewController = new OverviewController(() => {
      if (this.lastRefreshTs + 30 > this.getUnixSeconds()) return
      this.api.invalidateCache()
      this.refresh()
    })
    this.updates.checkUpdates()
    this.overallData = overviewController.proccessDashboard(
      await validators,
      await performances,
      await epoch,
      await attestationPerformance,
      await this.storage.getStakingShare()
      )
    this.lastRefreshTs = this.getUnixSeconds()
  }

  getUnixSeconds() {
    return new Date().getTime() / 1000
  }

  async doRefresh(event) {
    await this.refresh().catch(() => {
      this.api.mayInvalidateOnFaultyConnectionState()
      event.target.complete();
    })
    event.target.complete();
  }

}
