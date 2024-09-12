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

import { DateTime, type StringUnitLength } from 'luxon'
import { findChainNetworkById } from './NetworkData'

export type AgeFormat = 'absolute' | 'relative'

export const ONE_MINUTE = 60
export const ONE_HOUR = ONE_MINUTE * 60
export const ONE_DAY = ONE_HOUR * 24
export const ONE_WEEK = ONE_DAY * 7
export const ONE_YEAR = ONE_DAY * 365

export function epochToTimestamp(chainID: number, epoch: number) {
	const network = findChainNetworkById(chainID)
	return (network.genesisTs + epoch * network.slotPerEpoch * network.slotsTime) * 1000
}

export function timestampToEpoch(chainID: number, ts: number) {
	const network = findChainNetworkById(chainID)
	return Math.floor((ts / 1000 - network.genesisTs) / network.slotPerEpoch / network.slotsTime)
}

export function slotToSecondsTimestamp(chainID: number, slot: number) {
	const network = findChainNetworkById(chainID)
	return network.genesisTs + slot * network.slotsTime
}

export function getLocale() {
	return navigator.languages && navigator.languages.length ? navigator.languages[0] : navigator.language
}

export function formatTsToDateTime(ts: number, locales: string): string {
	const options: Intl.DateTimeFormatOptions = {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
	}

	const date = new Date(ts * 1000)
	return date.toLocaleDateString(locales, options)
}

export function formatTsToTime(ts: number, locales: string): string {
	const options: Intl.DateTimeFormatOptions = {
		hour: 'numeric',
		minute: 'numeric',
	}
	const date = new Date(ts * 1000)
	return date.toLocaleTimeString(locales, options)
}

export function getEndTs(aggregation: string, startTs: number): number {
	if (!startTs) {
		return
	}
	switch (aggregation) {
		case 'epoch':
			return
		case 'hourly':
			return startTs + ONE_HOUR
		case 'weekly':
			return startTs + ONE_WEEK
		case 'daily':
		default:
			return startTs + ONE_DAY
	}
}

export function formatGoTimestamp(
	timestamp: string | number,
	compareTimestamp?: number,
	format?: AgeFormat,
	style?: StringUnitLength,
	locales?: string,
	withTime?: boolean
) {
	if (typeof timestamp === 'number') {
		timestamp *= 1000
	}
	const dateTime = new Date(timestamp).getTime()
	return formatTs(dateTime / 1000, compareTimestamp, format, style, locales, withTime)
}

function formatTs(
	ts?: number,
	timestamp?: number,
	format: AgeFormat = 'relative',
	style: StringUnitLength = 'narrow',
	locales: string = 'en-US',
	withTime = true
) {
	if (ts === undefined) {
		return undefined
	}

	if (format === 'relative') {
		return formatTsToRelative(ts * 1000, timestamp, style, locales)
	} else {
		return formatTsToAbsolute(ts, locales, withTime)
	}
}

function formatTsToRelative(
	targetTimestamp?: number,
	baseTimestamp?: number,
	style: StringUnitLength = 'narrow',
	locales: string = 'en-US'
): string | null | undefined {
	if (!targetTimestamp) {
		return undefined
	}

	const date = baseTimestamp ? DateTime.fromMillis(baseTimestamp) : DateTime.now()
	return DateTime.fromMillis(targetTimestamp).setLocale(locales).toRelative({ base: date, style })
}

export function formatTsToAbsolute(ts: number, locales: string, includeTime?: boolean): string {
	const timeOptions: Intl.DateTimeFormatOptions = includeTime ? { hour: 'numeric', minute: 'numeric' } : {}
	const options: Intl.DateTimeFormatOptions = {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		...timeOptions,
	}
	const date = new Date(ts * 1000)
	return includeTime ? date.toLocaleString(locales, options) : date.toLocaleDateString(locales, options)
}

export function relativeTs(diff: number) {
	const seconds = Math.floor(diff / 1000)
	const minutes = Math.floor(seconds / 60)
	const hours = Math.floor(minutes / 60)
	const days = Math.floor(hours / 24)

	if (days > 0) {
		return days > 1 ? `${days} days` : 'day'
	} else if (hours > 0) {
		return hours > 1 ? `${hours} hours` : 'hour'
	} else if (minutes > 0) {
		return minutes > 1 ? `${minutes} minutes` : 'minute'
	} else {
		return seconds > 1 ? `${seconds} seconds` : 'second'
	}
}