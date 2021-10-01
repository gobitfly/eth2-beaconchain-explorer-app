
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
import { DEBUG_SETTING_OVERRIDE_PACKAGE } from '../utils/Constants'

import { SplashScreen } from '@capacitor/splash-screen';

const FIRST_PURCHASE_RETRY = "first_purchase_retry"

export const PRODUCT_STANDARD = 'standard';
const MAX_PRODUCT = 'whale';

@Injectable({
  providedIn: "root",
})
export class MerchantUtils {

  PACKAGES: Package[] = [
    {
      name: "Free",
      price: "$0.00",
      maxValidators: 100,
      maxTestnetValidators: 100,
      maxBeaconNodes: 1,
      deviceMonitoringHours: 3,
      deviceMonitorAlerts: false,
      noAds: false,
      widgets: false,
      customTheme: false,
      supportUs: false,
      purchaseKey: null
    },
    {
      name: "Plankton",
      price: "$1.99",
      maxValidators: 100,
      maxTestnetValidators: 100,
      maxBeaconNodes: 1,
      deviceMonitoringHours: 30 * 24,
      deviceMonitorAlerts: true,
      noAds: true,
      widgets: false,
      customTheme: false,
      supportUs: true,
      purchaseKey: "plankton"
    },
    {
      name: "Goldfish",
      price: "$4.99",
      maxValidators: 100,
      maxTestnetValidators: 100,
      maxBeaconNodes: 2,
      deviceMonitoringHours: 30 * 24,
      deviceMonitorAlerts: true,
      noAds: true,
      widgets: true,
      customTheme: true,
      supportUs: true,
      purchaseKey: "goldfish"
    },
    {
      name: "Whale",
      price: "$19.99",
      maxValidators: 280,
      maxTestnetValidators: 280,
      maxBeaconNodes: 10,
      deviceMonitoringHours: 30 * 24,
      deviceMonitorAlerts: true,
      noAds: true,
      widgets: true,
      customTheme: true,
      supportUs: true,
      purchaseKey: "whale"
    }
  ]

  products: IAPProducts[] = [];
  currentPlan = PRODUCT_STANDARD; // use getCurrentPlanConfirmed instead

  constructor(
    private store: InAppPurchase2,
    private alertService: AlertService,
    private api: ApiService,
    private platform: Platform,
    private storage: StorageService
  ) {
    if (!this.platform.is("ios") && !this.platform.is("android")) {
      console.log("merchant is not supported on this platform")
      return
    }

    try {
      this.initProducts()
      this.initCustomValidator()
      this.setupListeners()
    } catch (e) {
      console.warn("MerchantUtils can not be initialized", e)
    }
  }

  private initCustomValidator() {
    this.store.validator = async (product: IAPProduct, callback) => {

      if (this.restorePurchase && product.id != "in.beaconcha.mobile") {
        this.restorePurchase = false
        await this.confirmPurchaseOnRemote(product)
      }
      callback(true)
    };
  }

  restartApp() {
    SplashScreen.show()
    window.location.reload()
  }

  async refreshToken() {
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
    for (var i = 0; i < this.PACKAGES.length; i++){
      if (this.PACKAGES[i].purchaseKey) {
        this.store.register({
          id: this.PACKAGES[i].purchaseKey,
          type: this.store.PAID_SUBSCRIPTION,
        });
      }
    }

    this.store.refresh();
  }

  private updatePrice(id, price) {
    for (var i = 0; i < this.PACKAGES.length; i++) {
      if(this.PACKAGES[i].purchaseKey == id) this.PACKAGES[i].price = price
    }
  }

  private restorePurchase = false

  private setupListeners() {
    // General query to all products
    this.store
      .when("product")
      .loaded((p: IAPProduct) => {
        console.log("product remote", p)
        this.updatePrice(p.id, p.price)
      })
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

  manageSubscriptions() {
    this.store.manageSubscriptions()
  }

  async restore() {
    this.restorePurchase = true
    this.store.refresh();
  }

  async purchase(product: string) {
    const loading = await this.alertService.presentLoading("");
    loading.present();
    this.store.order(product).then(
      async (product) => {
       this.restorePurchase = true
      
       setTimeout(() => {
         loading.dismiss();
       }, 1500);
      },
      (e) => {
        loading.dismiss();
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

  private async confirmPurchaseOnRemote(product) {
    if (product.id == "in.beaconcha.mobile") {
      this.alertService.showError("Purchase Error", "Invalid product, try again later or report this issue to us if persistent.", PURCHASEUTILS + 4)
      return;
    }

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
  
        const loading = await this.alertService.presentLoading("Confirming, this might take a couple seconds")
        loading.present();
    
        const result = await this.registerPurchaseOnRemote(purchaseData)
        if (!result) {
          console.log("registering receipt at remote failed, scheduling retry")
          
          await this.sleep(35000)
          const result = await this.registerPurchaseOnRemote(purchaseData)
          if (!result) {
            this.alertService.showError("Purchase Error", "We could not confirm your purchase. Please try again later or contact us if this problem persists.", PURCHASEUTILS + 3)
            loading.dismiss();
            return
          }
          loading.dismiss();
        }
  
        if (result) await this.refreshToken()
    
        loading.dismiss();
  
        if (result) {
          this.alertService.confirmDialog("Upgrade successfull", "App requires a restart. Do you want to restart it now?", "Restart App", () => {
            this.api.invalidateCache()
            this.restartApp()
          })
        } else {
          this.alertService.showError(
            "Purchase failed",
            `Failed to make purchase, please try again later.`,
            PURCHASEUTILS + 4
          );
        }
  }

  restartDialogLogin() {
    this.alertService.confirmDialog("Login successfull", "App requires a restart to unlock all your premium features. Do you want to restart it now?", "Restart App", () => {
      this.api.invalidateCache()
      this.restartApp()
    })
  }

  async getCurrentPlanConfirmed(): Promise<string> {
    if (this.api.debug) {
      const debugPackage = await this.storage.getSetting(DEBUG_SETTING_OVERRIDE_PACKAGE, "default")
      if (debugPackage != "default") {
        return debugPackage
      }
    }
    
    const authUser = await this.storage.getAuthUser()
    if (!authUser || !authUser.accessToken) return PRODUCT_STANDARD
    const jwtParts = authUser.accessToken.split(".")
    const claims: ClaimParts = JSON.parse(atob(jwtParts[1]))
    if (claims && claims.package) {
      return claims.package
    }
    return PRODUCT_STANDARD
  }

  findProduct(name: string): Package {
    for (var i = 0; i < this.PACKAGES.length; i++){
      const current = this.PACKAGES[i]
      if (current.purchaseKey == name) {
        return current
      }
    }
    return null
  }

  private async isNotFreeTier() {
    const currentPlan = await this.getCurrentPlanConfirmed()
    return currentPlan != PRODUCT_STANDARD && currentPlan != ""
  }

  async hasPremiumTheming() {
    const currentPlan = await this.getCurrentPlanConfirmed()
    return currentPlan != PRODUCT_STANDARD && currentPlan != "" && currentPlan != "plankton"
  }

  async hasCustomizeableNotifications() {
    return await this.isNotFreeTier()
  }

  async hasAdFree() {
    return await this.isNotFreeTier()
  }

  async hasMachineHistoryPremium() {
    return await this.isNotFreeTier()
  }

  async getCurrentPlanMaxValidator(): Promise<number> {
    const currentPlan = await this.getCurrentPlanConfirmed()
    const currentProduct = this.findProduct(currentPlan)
    if (currentProduct == null) return 100

    const notMainnet = await this.api.isNotMainnet()
    if (notMainnet) return currentProduct.maxTestnetValidators
    return currentProduct.maxValidators
  }

  async getHighestPackageValidator(): Promise<number> {
    const currentProduct = this.findProduct(MAX_PRODUCT)
    if (currentProduct == null) return 100

    const notMainnet = await this.api.isNotMainnet()
    if (notMainnet) return currentProduct.maxTestnetValidators
    return currentProduct.maxValidators
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

export interface Package {
  name: string,
  price: string,
  maxValidators: number,
  maxTestnetValidators: number,
  maxBeaconNodes: number,
  deviceMonitoringHours: number,
  deviceMonitorAlerts: boolean,
  noAds: boolean,
  widgets: boolean,
  customTheme: boolean,
  supportUs: boolean,
  purchaseKey: string
}