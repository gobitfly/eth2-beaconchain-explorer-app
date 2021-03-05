
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
import { IAPProduct, IAPProducts, InAppPurchase2 } from '@ionic-native/in-app-purchase-2/ngx';
import { Platform } from '@ionic/angular';
import { PostMobileSubscription, SubscriptionData } from '../requests/requests';
import { AlertService, PURCHASEUTILS } from '../services/alert.service';
import { ApiService } from '../services/api.service';
import { StorageService } from '../services/storage.service';

const PRODUCT_STANDARD = 'standard';
const PRODUCT_WHALE = 'whale';
const PRODUCT_JELLYFISH = 'jellyfish';
const PRODUCT_SEAHORSE = 'seahorse';

@Injectable({
  providedIn: "root",
})
export class MerchantUtils {
  products: IAPProducts[] = [];
  currentPlan = PRODUCT_STANDARD; // use getCurrentPlanConfirmed instead

  constructor(
    private store: InAppPurchase2,
    private alertService: AlertService,
    private api: ApiService,
    private platform: Platform,
    private storage: StorageService
  ) {
    this.initProducts()
    this.initCustomValidator()
    this.setupListeners()
  }

  private initCustomValidator() {
    this.store.validator = async (product: IAPProduct, callback) => {
      console.log("purchase made, product info", product)

      const isIOS = this.platform.is("ios")
      const purchaseData = {
        currency: product.currency,
        id: product.id,
        priceMicros: product.priceMicros,
        valid: product.valid,
        transaction: {
          id: product.id,
          receipt: isIOS ? product.transaction.appStoreReceipt : product.transaction.purchaseToken,
          type: product.transaction.type
        }
      }

      const result = await this.registerPurchaseOnRemote(purchaseData)
      if (!result) {
        console.log("registering receipt at remote failed, scheduling retry")
        const loading = await this.alertService.presentLoading("This can take a minute")
        loading.present();
        await this.sleep(35000)
        const result = await this.registerPurchaseOnRemote(purchaseData)
        if (!result) {
          this.alertService.showError("Purchase Error", "We could not confirm your purchase. Please try again later or contact us if this problem persists.", PURCHASEUTILS + 3)
        }
        loading.dismiss();
      }

      await this.refreshToken()

      callback(result)
    };
  }

  private async refreshToken() {
    const refreshSuccess = await this.api.refreshToken() != null
    if (!refreshSuccess) {
      console.log("refreshing token after purchase failed, scheduling retry")
      const loading = await this.alertService.presentLoading("This can take a minute")
      loading.present();
      await this.sleep(35000)
      const refreshSuccess = await this.api.refreshToken() != null
      if (!refreshSuccess) {
        this.alertService.showError("Purchase Error", "We could not confirm your purchase. Please try again later or contact us if this problem persists.", PURCHASEUTILS + 2)
      }
      loading.dismiss();
    }
  }

  private async registerPurchaseOnRemote(data: SubscriptionData): Promise<boolean> {
    const request = new PostMobileSubscription(data)
    const response = await this.api.execute(request)
    const result = request.wasSuccessfull(response, false)

    if (!result) {
      console.log("registering purchase receipt failed", response)
    }

    return result
  }

  private initProducts() {
    this.store.register({
      id: PRODUCT_WHALE,
      type: this.store.PAID_SUBSCRIPTION,
    });

    this.store.register({
      id: PRODUCT_JELLYFISH,
      type: this.store.PAID_SUBSCRIPTION,
    });

    this.store.register({
      id: PRODUCT_SEAHORSE,
      type: this.store.PAID_SUBSCRIPTION,
    });

    this.store.refresh();
  }

  private setupListeners() {
    // General query to all products
    this.store
      .when("product")
      .approved((p: IAPProduct) => {
        // Handle the product deliverable
        this.currentPlan = p.id;

        //this.ref.detectChanges();

        return p.verify();
      })
      .verified((p: IAPProduct) => p.finish())
      .owned(p => {
        console.log(`you now own ${p.alias}`)
      });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async restore() {
    // Reasoning is, that subscriptions are linked with user accounts
    // in order to restore a purchase, log in to the same account. If already logged in,
    // try refreshing the token
    
    await this.refreshToken()
    //this.store.refresh();
  }

  purchase(product: string) {
    this.store.order(product).then(
      async (p) => {
        const loading = await this.alertService.presentLoading("");
        loading.present();
        setTimeout(() => {
          loading.dismiss();
        }, 1500);
      },
      (e) => {
        this.alertService.showError(
          "Purchase failed",
          `Failed to purchase: ${e}`,
          PURCHASEUTILS + 1
        );
        console.warn("purchase error", e);
        this.currentPlan = PRODUCT_STANDARD
      }
    );
  }

  async getCurrentPlanConfirmed(): Promise<string> {
    const authUser = await this.storage.getAuthUser()
    if (!authUser || !authUser.accessToken) return PRODUCT_STANDARD
    const jwtParts = authUser.accessToken.split(".")
    const claims: ClaimParts = JSON.parse(atob(jwtParts[1]))
    if (claims && claims.package) {
      return claims.package
    }
    return PRODUCT_STANDARD
  }
}

interface ClaimParts {
  userID: number
  appID: number
  deviceID: number
  package: string
  exp: number,
  iss: string
}
