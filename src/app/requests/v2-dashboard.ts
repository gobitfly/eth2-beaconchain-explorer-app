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

import { APIRequest, Method, NoContent } from "./requests"
import { InternalGetValidatorDashboardValidatorsResponse, VDBOverviewData, VDBPostValidatorsData } from "./types/validator_dashboard"

export class V2DashboardSummary extends APIRequest<VDBOverviewData> {
	resource = '/validator-dashboards/'
	method = Method.GET

	constructor(id: string) {
		super()
		this.resource += id
	}
}


interface V2AddValidatorToDashboardData {
	group_id: number 
	validators?: string[]
	deposit_address?: string 
	withdrawal_address?: string 
	graffiti?: string
}


export class V2AddValidatorToDashboard extends APIRequest<VDBPostValidatorsData> {
	resource = '/validator-dashboards/{id}/validators'
	method = Method.POST
	expectedResponseStatus: number = 201 // created

	constructor(id: string, data: V2AddValidatorToDashboardData) {
		super()
		this.resource.replace('{id}', id)
		this.postData = data
	}
}


export class V2GetValidatorFromDashboard extends APIRequest<InternalGetValidatorDashboardValidatorsResponse> {
	resource = '/validator-dashboards/{id}/validators'
	method = Method.GET

	constructor(id: string) {
		super()
		this.resource.replace('{id}', id)
	}
}


export class V2DeleteDashboard extends APIRequest<NoContent> {
	resource = '/validator-dashboards/{id}'
	method = Method.DELETE
    expectedResponseStatus: number = 204 // no content

	constructor(id: string) {
		super()
		this.resource.replace('{id}', id)
	}
}
