/*
 *  // Copyright (C) 2020 - 2024 bitfly explorer GmbH
 *  //
 *  // This file is part of Beaconchain Dashboard.
 *  //
 *  // Beaconchain Dashboard is free software: you can redistribute it and/or modify
 *  // it under the terms of the GNU General Public License as published by
 *  // the Free Software Foundation, either version 3 of the License, or
 *  // (at your option) any later version.
 *  //
 *  // Beaconchain Dashboard is distributed in the hope that it will be useful,
 *  // but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  // MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  // GNU General Public License for more details.
 *  //
 *  // You should have received a copy of the GNU General Public License
 *  // along with Beaconchain Dashboard.  If not, see <http://www.gnu.org/licenses/>.
 */

/**@deprecated */
export interface AuthUser {
	accessToken: string
	refreshToken: string
	expiresIn: number
}

export interface AuthUserv2 {
	Session: string
}

export interface ApiNetwork {
	key: string
	protocol: string
	host: string
	net: string
	endpoint: string
	version: string
	onlyDebug: boolean
	active: boolean
	supportedChainIds: number
	name: string
	v2NetworkConfigKey?: string
}

export class NetworkMainCurrency {
	static readonly ETH = new NetworkMainCurrency('ETHER', 'Ether', 'ETH')
	static readonly GNO = new NetworkMainCurrency('GNO', 'GNO', 'GNO')
	static readonly xDAI = new NetworkMainCurrency('xDAI', 'xDAI', 'DAI')

	public internalName: string
	public formattedName: string
	public coinbaseSpot: string
	private constructor(internName: string, formattedName: string, coinbaseSpot: string) {
		this.internalName = internName
		this.coinbaseSpot = coinbaseSpot
		this.formattedName = formattedName
	}
}

export interface NetworkPreferences {
	network: ApiNetwork
}
