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
import { GetAddressForEnsRequest } from "../requests/requests";


export interface EnsRelationship {
    domain: string
    address: string
}


@Injectable({
    providedIn: 'root'
  })
export default class EnsUtils {

    constructor(
        private api: ApiService,
    ) { }

    async getAddressForEns(domain: string): Promise<EnsRelationship[]> {
        const request = new GetAddressForEnsRequest(domain)
        const response = await this.api.execute(request)
        if (request.wasSuccessfull(response)) {
            const result = request.parse(response)
            return result
        } else {
            if (response && response.data && response.data.status) {
                return Promise.reject(new Error(response.data.status))
            }
            return Promise.reject(new Error("Response is invalid"))
        }
    }
}