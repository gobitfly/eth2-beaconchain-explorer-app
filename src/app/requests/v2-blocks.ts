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
import { BlockOverview } from './types/block'
import { VDBBlocksTableRow } from './types/validator_dashboard'
import { dashboardID, setID } from './v2-dashboard'

export class V2DashboardBlocks extends APIRequest<VDBBlocksTableRow> {
	resource = 'validator-dashboards/{id}/blocks'
	method = Method.GET

	constructor(id: dashboardID, cursor: string, limit: number = 10, sort: string = 'block:desc') {
		super()
		this.resource = setID(this.resource, id)
		this.resource += '?limit=' + limit
		this.resource += '&sort=' + sort
		if (cursor !== undefined) {
			this.resource += '&cursor=' + cursor
		}
	}
}

export class V2BlockOverview extends APIRequest<BlockOverview> {
	resource = 'networks/{network}/blocks/{block}/overview'
	method = Method.GET

	constructor(network: string, block: number) {
		super()
		this.resource = this.resource.replace('{network}', network)
		this.resource = this.resource.replace('{block}', block.toString())
	}
}
