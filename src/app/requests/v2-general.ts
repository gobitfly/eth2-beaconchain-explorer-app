// Copyright (C) 2024 Bitfly GmbH
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
// along with Beaconchain Dashboard.  If not, see <https://www.gnu.org/licenses/>.

import { APIRequest, Method } from './requests'
import { MobileBundleData } from './types/mobile'
import { ProductSummary } from './types/user'

export class V2ProductSummary extends APIRequest<ProductSummary> {
	resource = '/product-summary'
	method = Method.GET
}

export class V2LatestAppBundle extends APIRequest<MobileBundleData> {
	resource = '/mobile/latest-bundle'
	method = Method.GET

	constructor(bundleVersion: number, nativeVersion: number, force: boolean = false) {
		super()
		this.resource += `?bundle_version=${bundleVersion}&native_version=${nativeVersion}&force=${force}`
	}
}
