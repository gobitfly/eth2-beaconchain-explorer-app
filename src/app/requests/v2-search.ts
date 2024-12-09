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
import { SearchValidator, SearchValidatorList, SearchValidatorsByDepositAddress, SearchValidatorsByGraffiti, SearchValidatorsByWithdrwalCredential } from './types/search'
import { networkID } from './v2-dashboard'

// possible search types for a search request
export enum searchType {
	validatorByIndex = 'validator_by_index',
	validatorByPublicKey = 'validator_by_public_key',
	validatorsByDepositAddress = 'validators_by_deposit_address',
	validatorsByDepositEnsName = 'validators_by_deposit_ens_name',
	validatorsByWithdrawalCredential = 'validators_by_withdrawal_credential',
	validatorsByWithdrawalAddress = 'validators_by_withdrawal_address',
	validatorsByWithdrawalEns = 'validators_by_withdrawal_ens_name',
	validatorsByGraffiti = 'validators_by_graffiti',
	validatorList = 'validator_list'
}

// Possible data types of a search response
export enum SearchResponseType {
	validator = 'validator',
	validatorList = 'validator_list',
	validatorsByDepositAddress = 'validators_by_deposit_address',
	validatorsByWithdrawalCredential = 'validators_by_withdrawal_credential',
	validatorsByGraffiti = 'validators_by_graffiti'
}

export type SearchResultData = ({ type: 'validator'; chain_id: number; value: SearchValidator } | { type: 'validator_list'; chain_id: number; value: SearchValidatorList } | { type: 'validators_by_deposit_address'; chain_id: number; value: SearchValidatorsByDepositAddress } | { type: 'validators_by_withdrawal_credential'; chain_id: number; value: SearchValidatorsByWithdrwalCredential } | { type: 'validators_by_graffiti'; chain_id: number; value: SearchValidatorsByGraffiti });

export class V2SearchValidators extends APIRequest<SearchResultData[]> {
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
