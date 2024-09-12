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

import { APIRequest, Method, NoContent, SubscriptionData } from './requests'
import { Response } from '../services/api.service'
import { UserInfo } from './types/user'
import { UserDashboardsData } from './types/dashboard'

// export class V2GetDashboards extends APIRequest<V2GetDashboardResponse> {
// 	resource = 'users/me/dashboards'
// 	method = Method.GET
// 	requiresAuth = true
// }

export class V2Me extends APIRequest<UserInfo> {
	resource = 'users/me'
	method = Method.GET
}

export class V2MyDashboards extends APIRequest<UserDashboardsData> {
	resource = 'users/me/dashboards'
	method = Method.GET
}

export class V2RegisterPushNotificationToken extends APIRequest<NoContent> {
	resource = 'users/me/notifications/settings/paired-devices/{client_id}/token'
	method = Method.PUT
	
	parse(response: Response): NoContent[] {
		if (response && response.data) return response.data as NoContent[]
		return null
	}

	constructor(token: string, clientID: string) {
		super()
		this.resource = this.resource.replace('{client_id}', clientID)
		this.postData = { token: token }
	}
}

export class V2PurchaseValidation extends APIRequest<NoContent> {
	resource = 'mobile/purchase'
	method = Method.POST
	
	constructor(subscriptionData: SubscriptionData) {
		super()
		this.postData = subscriptionData
	}
}
