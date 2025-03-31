// Copyright (C) 2021 bitfly explorer GmbH
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

import { ApiService } from '../services/api.service'
import { Injectable } from '@angular/core'
import { BitflyAdRequest, BitflyAdResponse } from '../requests/requests'
import { MerchantUtils } from './MerchantUtils'

export type AdLocation = 'dashboard' | 'validator' | 'machines' | 'blocks' | 'info'
export const BEACONCHAIN_AD_ACTION = ':open-premium-upgrade:'

export interface ZoneInfo {
	zones: number
	prefix: string
}

const defaultZone: ZoneInfo = {
	zones: 20,
	prefix: '',
}

const map: Map<AdLocation, ZoneInfo> = new Map([
	['dashboard', defaultZone],
	['validator', defaultZone],
	['machines', defaultZone],
	['blocks', defaultZone],
	[
		'info',
		{
			zones: 22,
			prefix: '',
		},
	],
])

const LOGTAG = '[AdUtils] '

@Injectable({
	providedIn: 'root',
})
export default class AdUtils {
	constructor(private api: ApiService, private merchantUtils: MerchantUtils) {}

	async get(location: AdLocation): Promise<BitflyAdResponse> {
		const adFree = await this.merchantUtils.hasAdFree()
		if (adFree) {
			console.info(LOGTAG + 'user is premium member, disabling ads')
			return null
		}

		const request = new BitflyAdRequest(map.get(location))
		const response = await this.api.execute(request).catch((err) => {
			console.warn('error adUtils get', err)
			return null
		})
		const result = request.parse(response)
		console.log('Bitfly ad response', result)

		if (result && result.length > 0 && result[0].height != '0') {
			return result[0]
		}

		return {
			html: "<img src='/assets/ads/beaconchain_sample_ad.gif' width='320' height='62' alt='' title='' border='0' />",
			width: '320',
			height: '62',
		}
	}
}
