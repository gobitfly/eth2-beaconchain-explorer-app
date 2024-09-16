// Copyright (C) 2024 bitfly explorer GmbH
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

import { Response } from '../services/api.service'
import { APIRequest, Method } from './requests'

export interface V2AuthResponse {
	Session: string
}

export class MigrateV1AuthToV2 extends APIRequest<V2AuthResponse> {
	resource = 'mobile/equivalent-exchange'
	method = Method.POST
	requiresAuth = true // important for v2 still

	constructor(refreshToken: string, deviceID: string, deviceName: string) {
		super()
		this.postData = {
			refresh_token: refreshToken,
			client_id: deviceID,
			client_name: deviceName,
		}
	}

	parseBase(response: Response, hasDataStatus = true): V2AuthResponse[] | null {
		if (!this.wasSuccessful(response, hasDataStatus)) {
			return []
		}

		if (response && response.data) {
			return [response.data as V2AuthResponse]
		}
		return []
	}
}
