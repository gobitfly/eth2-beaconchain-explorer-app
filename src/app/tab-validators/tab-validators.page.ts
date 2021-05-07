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
import { ValidatorUtils, Validator } from '../utils/ValidatorUtils';
import { ModalController } from '@ionic/angular';
import { ValidatordetailPage } from '../pages/validatordetail/validatordetail.page';
import { ApiService } from '../services/api.service';
import { AlertController } from '@ionic/angular';
import { Plugins } from '@capacitor/core';
import { ValidatorResponse, AttestationPerformanceResponse } from '../requests/requests';
import { StorageService } from '../services/storage.service';
import { AlertService } from '../services/alert.service';
import { SyncService } from '../services/sync.service';
import BigNumber from 'bignumber.js';
import { SubscribePage } from '../pages/subscribe/subscribe.page';
import { MerchantUtils } from '../utils/MerchantUtils';

const { Keyboard } = Plugins;

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab-validators.page.html',
  styleUrls: ['tab-validators.page.scss']
})
export class Tab2Page {

  fadeIn = "invisible"

  static itemCount = 0

  items: Validator[] = [];

  details: any

  searchResultMode = false
  loading = false

  reachedMaxValidators = false

  isLoggedIn = false

  initialized = false

  currentPackageMaxValidators: number = 100

  constructor(
    private validatorUtils: ValidatorUtils,
    public modalController: ModalController,
    public api: ApiService,
    private alertController: AlertController,
    private storage: StorageService,
    private alerts: AlertService,
    private sync: SyncService,
    private merchant: MerchantUtils
  ) {
    this.validatorUtils.registerListener(() => {
      this.refresh()
    })
    this.merchant.getCurrentPlanMaxValidator().then((result) => {
      this.currentPackageMaxValidators = result
    });
  }

  ngOnInit() {
    this.refresh()
  }

  private async refresh() {
    this.reachedMaxValidators = false
    this.storage.isLoggedIn().then((result) => this.isLoggedIn = result)
    if (!this.searchResultMode) this.refreshMyValidators()

    if (this.fadeIn == "invisible") {
      this.fadeIn = "fade-in"
      setTimeout(() => {
        this.fadeIn = null
      }, 1500)
    }
  }

  async syncRemote() {
    const loading = await this.alerts.presentLoading("Syncing...")
    loading.present();
    this.sync.fullSync()
    setTimeout(() => { loading.dismiss() }, 2000)
  }

  private async refreshMyValidators() {
    this.searchResultMode = false

    if (!await this.validatorUtils.hasLocalValdiators()) {
      this.items = new Array<Validator>();
      Tab2Page.itemCount = this.items.length
      this.initialized = true
      return
    }

    this.setLoading(true)

    const temp = await this.validatorUtils.getAllMyValidators().catch((error) => {
      return []
    })

    const attrEffectiveness = await this.validatorUtils.getAllMyAttestationPerformances()
    for (let vali of temp) {
      vali.searchAttrEffectiveness = this.findAttributionEffectiveness(attrEffectiveness, vali.index)
    }

    this.items = temp
    this.setLoading(false)
    Tab2Page.itemCount = this.items.length
  }

  private setLoading(loading: boolean) {
    console.log("set loading", loading)
    if (loading) {
      // Reasoning: Don't show loading indicator if it takes less than 400ms (already cached locally but storage is slow-ish so we adjust for that)
      setTimeout(() => {
        if (!this.items || this.items.length <= 0) {
          this.loading = true
        }
      }, 200)
    } else {
      if (this.loading) {
        setTimeout(() => {
          this.initialized = true
          this.loading = false
        }, 350)
      } else {
        this.initialized = true
        this.loading = false
      }
    }
  }

  private findAttributionEffectiveness(list: AttestationPerformanceResponse[], index: number): number {
    for (let attr of list) {
      if (attr.validatorindex == index) {
        return new BigNumber(1).dividedBy(attr.attestation_efficiency).multipliedBy(100).decimalPlaces(1).toNumber()
      }
    }
    return -1
  }

  async removeAllDialog() {
    this.showDialog("Remove all", "Do you want to remove {AMOUNT} validators from your dashboard?", () => {
      this.confirmRemoveAll()
    })
  }

  async addAllDialog() {
    this.showDialog("Add all", "Do you want to add {AMOUNT} validators to your dashboard?", () => {
      this.confirmAddAll()
    })
  }

  private async showDialog(title, text, action: () => void) {
    const size = this.items.length
    const alert = await this.alertController.create({
      header: title,
      message: text.replace("{AMOUNT}", size + ""),
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary'
        }, {
          text: 'Yes',
          handler: action
        }
      ]
    });

    await alert.present();
  }

  async confirmRemoveAll() {
    this.validatorUtils.deleteAll()
    this.refreshMyValidators()
  }

  async confirmAddAll() {
    const responses: ValidatorResponse[] = []
    this.items.forEach(async (item) => {
      responses.push(item.data)
    })

    this.validatorUtils.convertToValidatorModelsAndSaveLocal(false, responses)
    this.refreshMyValidators()
  }

  searchEvent(event) {
    this.searchFor(event.target.value)
  }

  async searchFor(searchString) {
    if (!searchString || searchString.length < 0) return
    Keyboard.hide();

    this.searchResultMode = true
    this.loading = true

    const isETH1Address = searchString.startsWith("0x") && searchString.length == 42

    if (isETH1Address) this.searchETH1(searchString).then(() => this.loading = false)
    else this.searchByPubKeyOrIndex(searchString).then(() => this.loading = false)
  }

  async searchByPubKeyOrIndex(target) {
    const temp = await this.validatorUtils.searchValidators(target).catch((error) => {
      console.warn("search error", error)
      return []
    })
    this.items = await this.applyAttestationEffectiveness(temp, target)
    Tab2Page.itemCount = this.items.length
  }

  async searchETH1(target) {
    const temp = await this.validatorUtils.searchValidatorsViaETH1(target).catch(async (error) => {
      if (error && error.message && error.message.indexOf("maximum of 100") > 0) {
        console.log("SET reachedMaxValidators to true")
        this.reachedMaxValidators = true

        return await this.validatorUtils.searchValidatorsViaETH1(target, this.currentPackageMaxValidators -1)
      }
      return []
    })
 
    this.items = temp// await this.applyAttestationEffectiveness(temp, target)
    Tab2Page.itemCount = this.items.length
  }

  async applyAttestationEffectiveness(list: Validator[], search: string): Promise<Validator[]> {
    const attrEffectiveness = await this.validatorUtils.getRemoteValidatorAttestationPerformance(search).catch((error) => {
      return []
    })
    if (!attrEffectiveness || attrEffectiveness.length <= 0) return list;

    for (let vali of list) {
      vali.searchAttrEffectiveness = this.findAttributionEffectiveness(attrEffectiveness, vali.index)
    }
    return list
  }

  cancelSearch() {
    if (this.searchResultMode) {
      this.searchResultMode = false
      this.refresh()
    }
  }

  async doRefresh(event) {
    await this.refresh().catch(() => {
      event.target.complete();
    })
    event.target.complete();
  }

  async presentModal(item: Validator) {
    const modal = await this.modalController.create({
      component: ValidatordetailPage,
      cssClass: 'my-custom-class',
      componentProps: {
        'item': item,
      }
    });
    return await modal.present();
  }

  ionViewDidLeave() {
    this.sync.mightSyncUpAndSyncDelete()
  }

  itemHeightFn(item, index) {
    if (index == Tab2Page.itemCount - 1) return 210;
    return 132;
  }

  async upgrade() {
    const modal = await this.modalController.create({
      component: SubscribePage,
      cssClass: 'my-custom-class',
    });
    return await modal.present();
  }

}

