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

import { ApiNetwork, NetworkMainCurrency } from '../models/StorageTypes'

export const MAP: ApiNetwork[] = [
	{
		key: 'main',
		protocol: 'https',
		host: 'beaconcha.in',
		net: '',
		endpoint: '/api/',
		version: 'v1',
		onlyDebug: false,
		active: true,
		genesisTs: 1606824023,
		clCurrency: NetworkMainCurrency.ETH,
		elCurrency: NetworkMainCurrency.ETH,
		slotPerEpoch: 32,
		slotsTime: 12,
		epochsPerSyncPeriod: 256,
		name: 'Ethereum',
		v2NetworkConfigKey: 'main_v2',
	},
	{
		key: 'gnosis',
		protocol: 'https',
		host: 'gnosischa.in',
		net: '',
		endpoint: '/api/',
		version: 'v1',
		onlyDebug: false,
		active: true,
		genesisTs: 1638993340,
		clCurrency: NetworkMainCurrency.GNO,
		elCurrency: NetworkMainCurrency.xDAI,
		slotPerEpoch: 16,
		slotsTime: 5,
		epochsPerSyncPeriod: 512,
		name: 'Gnosis',
		v2NetworkConfigKey: 'main_v2',
	},
	{
		key: 'sepolia',
		protocol: 'https',
		host: 'beaconcha.in',
		net: 'sepolia.',
		endpoint: '/api/',
		version: 'v1',
		onlyDebug: false,
		active: true,
		genesisTs: 1655733600,
		clCurrency: NetworkMainCurrency.ETH,
		elCurrency: NetworkMainCurrency.ETH,
		slotPerEpoch: 32,
		slotsTime: 12,
		epochsPerSyncPeriod: 256,
		name: 'Ethereum',
		v2NetworkConfigKey: 'todo',
	},
	{
		key: 'holesky',
		protocol: 'https',
		host: 'beaconcha.in',
		net: 'holesky.',
		endpoint: '/api/',
		version: 'v1',
		onlyDebug: false,
		active: true,
		genesisTs: 1695902400,
		clCurrency: NetworkMainCurrency.ETH,
		elCurrency: NetworkMainCurrency.ETH,
		slotPerEpoch: 32,
		slotsTime: 12,
		epochsPerSyncPeriod: 256,
		name: 'Ethereum',
		v2NetworkConfigKey: 'holesky_v2',
	},
	{
		key: 'holesky_v2',
		protocol: 'http',
		host: 'local.beaconcha.in:8083',
		passXCookieDANGEROUS: true, // DO NOT COMMIT!
		net: '',
		endpoint: '/api/',
		version: 'i',
		onlyDebug: true,
		active: true,
		genesisTs: 1695902400,
		clCurrency: NetworkMainCurrency.ETH,
		elCurrency: NetworkMainCurrency.ETH,
		slotPerEpoch: 32,
		slotsTime: 12,
		epochsPerSyncPeriod: 256,
		name: 'Ethereum',
	},
	{
		key: 'invalid (no connection)',
		protocol: 'http',
		host: '0.0.0.0',
		net: '',
		endpoint: '/api/',
		version: 'v1',
		onlyDebug: true,
		active: true,
		genesisTs: 1606824023,
		clCurrency: NetworkMainCurrency.ETH,
		elCurrency: NetworkMainCurrency.ETH,
		slotPerEpoch: 32,
		slotsTime: 12,
		epochsPerSyncPeriod: 256,
		name: 'Ethereum',
	},
]

export function findConfigForKey(key: string): ApiNetwork {
	for (const entry of MAP) {
		if (entry.key == key) {
			return entry
		}
	}
	console.log('config for ' + key + ' not found, using mainnet instead', key)
	return MAP[0]
}
