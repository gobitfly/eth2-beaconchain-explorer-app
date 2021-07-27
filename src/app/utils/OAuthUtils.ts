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

import { ApiService } from "../services/api.service";
import { registerWebPlugin } from "@capacitor/core";
//import { OAuth2Client } from "@byteowls/capacitor-oauth2";
import { Plugins } from "@capacitor/core";
import { Injectable } from '@angular/core';
import { StorageService } from '../services/storage.service';
import FirebaseUtils from './FirebaseUtils';
import { ValidatorUtils } from './ValidatorUtils';
import { LoadingController } from '@ionic/angular';
import { SyncService } from '../services/sync.service';
import { MerchantUtils } from "./MerchantUtils";

import { Toast } from '@capacitor/toast';
import { Device } from '@capacitor/device';

@Injectable({
  providedIn: 'root'
})
export class OAuthUtils {

  constructor(
    private api: ApiService,
    private storage: StorageService,
    private firebaseUtils: FirebaseUtils,
    private validatorUtils: ValidatorUtils,
    private loadingController: LoadingController,
    private sync: SyncService,
    private merchantUtils: MerchantUtils
  ) {
    //registerWebPlugin(OAuth2Client);
  }

  async login(statusCallback: ((finished: boolean) => void) = null) {
    return Plugins.OAuth2Client.authenticate(await this.getOAuthOptions())
      .then(async (response: any) => {

        const loadingScreen = await this.presentLoading()
        loadingScreen.present();

        const accessToken = response["access_token"];
        const refreshToken = response["refresh_token"];

        // inconsistent on ios, just assume a 10min lifetime for first token and then just refresh it
        // and kick off real expiration times
        const expiresIn = Date.now() + (10 * 60 * 1000)

        console.log("successfull", accessToken, refreshToken, expiresIn)
        await this.storage.setAuthUser({
          accessToken: accessToken,
          refreshToken: refreshToken,
          expiresIn: expiresIn
        })

        await this.validatorUtils.clearDeletedSet()
        await this.firebaseUtils.pushLastTokenUpstream(true)
        await this.sync.fullSync()

        let isPremium = await this.merchantUtils.hasMachineHistoryPremium()

        loadingScreen.dismiss()
        if (isPremium) {
          this.merchantUtils.restartDialogLogin()
        } else {
          Toast.show({
            text: "Welcome!"
          })
        }

        return true
      })
      .catch((reason: any) => {
        if (statusCallback) statusCallback(true)
        console.error("OAuth rejected", reason);
        Toast.show({
          text: "Could not log in, please try again later."
        })
        return false
      });
  }

  private async presentLoading() {
    return await this.loadingController.create({
      cssClass: 'my-custom-class',
      spinner: 'bubbles',
      duration: 8000
    });
  }

  public hashCode(string: string): string {
    var hash = 0;
    for (var i = 0; i < string.length; i++) {
        var character = string.charCodeAt(i);
        hash = ((hash << 5) - hash) + character;
        hash = hash & hash;
    }
    return hash.toString(16);
  }

  private async getOAuthOptions() {
    const api = this.api
    const endpointUrl = await api.getResourceUrl("user/token")

    const info = await Device.getId().catch(() => { return { uuid: "iduno" }})
    let clientID = this.hashCode(info.uuid)
    while (clientID.length <= 5) {
      clientID += "0"
    }

    const responseType = "code"
    const callback = "beaconchainmobile://callback"

    return {
      authorizationBaseUrl: await api.getBaseUrl() + "/user/authorize",
      accessTokenEndpoint: endpointUrl,
      web: {
        appId: clientID,
        responseType: responseType,
        redirectUrl: callback,
        windowOptions: "height=600,left=0,top=0",
      },
      android: {
        appId: clientID,
        responseType: responseType,
        redirectUrl: callback,
        handleResultOnNewIntent: true,
        handleResultOnActivityResult: true
      },
      ios: {
        appId: clientID,
        responseType: responseType,
        redirectUrl: callback,
      },
    };
  }
}

