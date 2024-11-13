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
import {
	NotificationClientsTableRow,
	NotificationDashboardsTableRow,
	NotificationMachinesTableRow,
	NotificationNetworksTableRow,
	NotificationSettings,
	NotificationValidatorDashboardDetail,
} from './types/notifications'
import { dashboardID, setID } from './v2-dashboard'

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

export class V2NotificationDetails extends APIRequest<NotificationValidatorDashboardDetail> {
	resource = 'users/me/notifications/validator-dashboards/{id}/groups/{group_id}/epochs/{epoch}'
	method = Method.GET

	constructor(id: dashboardID, groupID: number, epoch: number) {
		super()
		this.resource = setID(this.resource, id)
		this.resource = this.resource.replace('{group_id}', groupID.toString())
		this.resource = this.resource.replace('{epoch}', epoch.toString())
	}
}

export class V2NotificationsDashboard extends APIRequest<NotificationDashboardsTableRow[]> {
	resource = 'users/me/notifications/dashboards'
	method = Method.GET

	constructor(cursor: string, limit: number = 25) {
		super()
		this.resource += '?limit=' + limit
		if (cursor !== undefined) {
			this.resource += '&cursor=' + cursor
		}
	}
}

export class V2NotificationsMachines extends APIRequest<NotificationMachinesTableRow[]> {
	resource = 'users/me/notifications/machines'
	method = Method.GET

	constructor(cursor: string, limit: number = 25) {
		super()
		this.resource += '?limit=' + limit
		if (cursor !== undefined) {
			this.resource += '&cursor=' + cursor
		}
	}
}

export class V2NotificationsClients extends APIRequest<NotificationClientsTableRow[]> {
	resource = 'users/me/notifications/clients'
	method = Method.GET

	constructor(cursor: string, limit: number = 25) {
		super()
		this.resource += '?limit=' + limit
		if (cursor !== undefined) {
			this.resource += '&cursor=' + cursor
		}
	}
}

export class V2NotificationsNetworks extends APIRequest<NotificationNetworksTableRow[]> {
	resource = 'users/me/notifications/networks'
	method = Method.GET

	constructor(cursor: string, limit: number = 25) {
		super()
		this.resource += '?limit=' + limit
		if (cursor !== undefined) {
			this.resource += '&cursor=' + cursor
		}
	}
}
