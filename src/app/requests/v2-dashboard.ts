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

import { encodeDashboardID } from '../utils/DashboardHelper'
import { APIRequest, Method, NoContent } from './requests'
import { ChartData } from './types/common'
import {
	VDBGroupSummaryData,
	VDBManageValidatorsTableRow,
	VDBOverviewData,
	VDBPostCreateGroupData,
	VDBPostReturnData,
	VDBPostValidatorsData,
	VDBRocketPoolTableRow,
	VDBSummaryTableRow,
} from './types/validator_dashboard'

export type dashboardID = string | number | number[]
export enum Period {
	AllTime = 'all_time',
	Last24h = 'last_24h',
	Last7d = 'last_7d',
	Last30d = 'last_30d',
}

export enum EfficiencyType {
	All = 'all',
	Attestation = 'attestation',
	Sync = 'sync',
	Proposal = 'proposal',
}

export enum Aggregation {
	Epoch = 'epoch',
	Hourly = 'hourly',
	Daily = 'daily',
	Weekly = 'weekly',
}

export class V2DashboardOverview extends APIRequest<VDBOverviewData> {
	resource = 'validator-dashboards/{id}'
	method = Method.GET
	updatesLastRefreshState = true

	constructor(id: dashboardID) {
		super()
		this.resource = setID(this.resource, id)
	}

	ignoreFails = false
}

export class V2DashboardSummaryTable extends APIRequest<VDBSummaryTableRow> {
	resource = 'validator-dashboards/{id}/summary'
	method = Method.GET
	updatesLastRefreshState = true

	sortResultFn = function (a: VDBSummaryTableRow, b: VDBSummaryTableRow) {
		// sort by group_id asc
		if (a.group_id < b.group_id) return -1
		if (a.group_id > b.group_id) return 1
		return 0
	}

	constructor(id: dashboardID, period: Period, limit?: number) {
		super()
		this.resource = setID(this.resource, id) + '?period=' + period
		if (limit) this.resource += '&limit=' + limit
	}

	ignoreFails = false
}

export class V2DashboardSummaryGroupTable extends APIRequest<VDBGroupSummaryData> {
	resource = 'validator-dashboards/{id}/groups/{group_id}/summary'
	method = Method.GET

	constructor(id: dashboardID, groupID: number, period: Period, limit?: number) {
		super()
		this.resource = setID(this.resource, id).replace('{group_id}', groupID + '') + '?period=' + period
		if (limit) this.resource += '&limit=' + limit
	}

	ignoreFails = false
}

export class V2DashboardSummaryChart extends APIRequest<ChartData<number, number>> {
	resource = 'validator-dashboards/{id}/summary-chart'
	method = Method.GET

	static SUMMARY_CHART_GROUP_TOTAL = -1
	static SUMMARY_CHART_GROUP_NETWORK_AVERAGE = -2

	constructor(
		id: dashboardID,
		efficiencyType: EfficiencyType,
		aggregation: Aggregation,
		afterTs: number,
		beforeTs: number = Math.floor(Date.now() / 1000),
		groupIds: number[] = [-1, -2]
	) {
		super()
		this.resource = setID(this.resource, id)
		this.resource = this.resource + '?group_ids=' + groupIds.join(',')
		this.resource = this.resource + '&after_ts=' + Math.floor(afterTs)
		;(this.resource = this.resource + '&before_ts=' + Math.floor(beforeTs)), (this.resource = this.resource + '&efficiency_type=' + efficiencyType)
		this.resource = this.resource + '&aggregation=' + aggregation
	}
}

export class V2DashboardRewardChart extends APIRequest<ChartData<number, string>> {
	resource = 'validator-dashboards/{id}/rewards-chart'
	method = Method.GET

	constructor(id: dashboardID) {
		super()
		this.resource = setID(this.resource, id)
	}
}

// Validator management
export interface V2AddValidatorToDashboardData {
	group_id: number // starts at 0
	validators?: string[] | number[]
	deposit_address?: string
	withdrawal_address?: string
	graffiti?: string
}

export class V2AddValidatorToDashboard extends APIRequest<VDBPostValidatorsData> {
	resource = 'validator-dashboards/{id}/validators'
	method = Method.POST
	expectedResponseStatus: number = 201 // created

	constructor(id: dashboardID, data: V2AddValidatorToDashboardData) {
		super()
		this.resource = setID(this.resource, id)
		this.postData = data
	}
}

export class V2GetValidatorFromDashboard extends APIRequest<VDBManageValidatorsTableRow> {
	resource = 'validator-dashboards/{id}/validators'
	method = Method.GET

	constructor(id: dashboardID, groupID: number = undefined, cursor: string = undefined, limit: number = 10, sort: string = 'index:asc') {
		super()
		this.resource = setID(this.resource, id)
		if (groupID !== undefined) {
			this.resource += '?group_id=' + groupID
		}
		if (sort !== undefined) {
			this.resource += '&sort=' + sort
		}
		if (limit !== undefined) {
			this.resource += '&limit=' + limit
		}
		if (cursor !== undefined) {
			this.resource += '&cursor=' + cursor
		}
	}
}

export class V2DeleteValidatorFromDashboard extends APIRequest<NoContent> {
	resource = 'validator-dashboards/{id}/bulk-deletions'
	method = Method.DELETE
	expectedResponseStatus: number = 204 // no content

	constructor(id: dashboardID, validators: number[]) {
		super()
		this.resource = setID(this.resource, id)
		this.postData = {
			validators: validators,
		}
	}
}

// -- Dashboard management

export class V2CreateDashboard extends APIRequest<VDBPostReturnData> {
	resource = 'validator-dashboards'
	method = Method.POST
	expectedResponseStatus: number = 201 // created

	/**
	 * @param name for the dashboard
	 * @param network Can be string or network id
	 */
	constructor(name: string, network: string | number) {
		super()
		this.postData = {
			name: name,
			network: network,
		}
	}
}

export class V2DeleteDashboard extends APIRequest<NoContent> {
	resource = 'validator-dashboards/{id}'
	method = Method.DELETE
	expectedResponseStatus: number = 204 // no content

	constructor(id: dashboardID) {
		super()
		this.resource = setID(this.resource, id)
	}
}

export class V2ChangeDashboardName extends APIRequest<VDBPostReturnData> {
	resource = 'validator-dashboards/{id}/name'
	method = Method.PUT

	constructor(id: dashboardID, name: string) {
		super()
		this.resource = setID(this.resource, id)
		this.postData = { name: name }
	}
}

// -- Group management

export class V2AddDashboardGroup extends APIRequest<VDBPostCreateGroupData> {
	resource = 'validator-dashboards/{id}/groups'
	method = Method.POST
	expectedResponseStatus: number = 201 // created

	constructor(id: dashboardID, name: string) {
		super()
		this.resource = setID(this.resource, id)
		this.postData = { name: name }
	}
}

export class V2DeleteDashboardGroup extends APIRequest<NoContent> {
	resource = 'validator-dashboards/{id}/groups/{group_id}'
	method = Method.DELETE
	expectedResponseStatus: number = 204 // no content

	constructor(id: dashboardID, groupID: number) {
		super()
		this.resource = setID(this.resource, id).replace('{group_id}', groupID + '')
	}
}

export class V2UpdateDashboardGroup extends APIRequest<VDBPostCreateGroupData> {
	resource = 'validator-dashboards/{id}/groups/{group_id}'
	method = Method.PUT

	constructor(id: dashboardID, groupID: number, name: string) {
		super()
		this.resource = setID(this.resource, id).replace('{group_id}', groupID + '')
		this.postData = { name: name }
	}
}

// Rocket Pool

export class V2DashboardRocketPool extends APIRequest<VDBRocketPoolTableRow> {
	resource = 'validator-dashboards/{id}/rocket-pool'
	method = Method.GET

	constructor(id: dashboardID) {
		super()
		this.resource = setID(this.resource, id)
	}
}

export function setID(resource: string, id: dashboardID): string {
	if (typeof id === 'string') {
		return resource.replace('{id}', id)
	}
	if (Array.isArray(id)) {
		return resource.replace('{id}', encodeDashboardID(id))
	}
	return resource.replace('{id}', id + '')
}
