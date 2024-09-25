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
import { SearchResult } from './types/common'
import { networkID } from './v2-dashboard'

export enum searchType {
	validatorByIndex = 'validator_by_index',
	validatorByPublicKey = 'validator_by_public_key',
	validatorsByDepositAddress = 'validators_by_deposit_address',
	validatorsByDepositEnsName = 'validators_by_deposit_ens_name',
	validatorsByWithdrawalCredential = 'validators_by_withdrawal_credential',
	validatorsByWithdrawalAddress = 'validators_by_withdrawal_address',
	validatorsByWithdrawalEns = 'validators_by_withdrawal_ens_name',
	validatorsByGraffiti = 'validators_by_graffiti',

	validatorByIndexBatch = 'validator_by_index_batch', // app only
}

export class V2SearchValidators extends APIRequest<SearchResult[]> {
	resource = 'search'
	method = Method.POST

	constructor(query: string, networks: networkID[], types: searchType[] | undefined = undefined) {
		super()
		if (types) {
			this.postData = { input: query, networks: networks, types: types }
		} else {
			this.postData = { input: query, networks: networks }
		}
	}
}
