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

import { APIRequest, Method, NoContent } from './requests'
import { NotificationSettings } from './types/notifications'

// TODO: wronng endpoint, use notifications/settings once done
export class V2SubscribedClients extends APIRequest<NotificationSettings> {
	resource = 'users/me/notifications/settings'
	method = Method.GET

	constructor(limit: number = 25) {
		super()
		this.resource += `?limit=${limit}`
	}
}

export class V2ChangeSubscribedClient extends APIRequest<NoContent> {
	resource = 'users/me/notifications/settings/clients/'
	method = Method.PUT
	expectedResponseStatus = 200

	constructor(clientID: number, enabled: boolean) {
		super()
		this.resource += `${clientID}`
		this.postData = { is_subscribed: enabled }
	}
}
