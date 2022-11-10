// Copyright (C) 2021 Bitfly GmbH
// 
// This file is part of Beaconchain Dashboard.
// 
// Beaconchain Dashboard is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// Beaconchain Dashboard is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with Beaconchain Dashboard.  If not, see <http://www.gnu.org/licenses/>.

import { ApiService } from "../services/api.service";
import { Injectable } from '@angular/core';
import { Platform } from "@ionic/angular";
import { CoinzillaAdRequest, CoinzillaAdResponse } from "../requests/requests";
import { MerchantUtils } from "./MerchantUtils";

export type AdLocation = "dashboard" | "validator" | "machines"
export const BEACONCHAIN_AD_ACTION = ":open-premium-upgrade:"

interface AdOSPair {
    ios: string
    android: string
}

const map: Map<AdLocation, AdOSPair> = new Map([
    ["dashboard", { // Zone 1
        ios: "10960b620f7c3a4a229",
        android: "84360b62011d142c980" 
    }],
    ["validator", { // Zone 2
        ios: "72760b620ff128e1661",
        android: "73660b6205cc579781" 
    }],
    ["machines", { // Zone 3
        ios: "75560b621078697f998",
        android: "2460b6207745035643" 
    }],
])

const LOGTAG = "[AdUtils] "
  
@Injectable({
    providedIn: 'root'
  })
export default class AdUtils {

    constructor(
        private api: ApiService,
        private platform: Platform,
        private merchantUtils: MerchantUtils
    ) { }

    private getToken(location: AdLocation) {
        const adPair = map.get(location)
        if (!adPair) {
            console.warn(LOGTAG + "invalid ad location")
            return null
        }
        const isIOS = this.platform.is("ios")
        return isIOS ? adPair.ios : adPair.android
    }

    async get(location: AdLocation): Promise<CoinzillaAdResponse> {
        const adFree = await this.merchantUtils.hasAdFree()
        if (adFree) {
            console.warn(LOGTAG + "user is premium member, disabling ads")
            return null
        }

        const token = this.getToken(location)
        if(!token) return null

        let request = new CoinzillaAdRequest(token)
        let response = await this.api.execute(request).catch((err) => { return null })
        let result = request.parse(response)

        if (result && result.length > 0) {
            return result[0]
        }

        // default ad
        return {
            title: "Upgrade to Beaconcha.in Premium",
            img: null,
            thumbnail: null,
            description_short: "No ads. Widgets & themes, custom notifications and more.",
            description: "Support us and help keep beaconcha.in up and running.",
            cta_button: "",
            website: "",
            name: "",
            url: BEACONCHAIN_AD_ACTION,
            impressionUrl: null,
          }
    }

}