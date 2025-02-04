// Copyright (C) 2025 Bitfly GmbH
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

import {
	epochToTimestamp,
	formatMonthLong,
	formatMonthShort,
	formatTsToRelative,
	getEndTs,
	ONE_DAY,
	ONE_HOUR,
	ONE_WEEK,
	relativeTs,
	shortTimeFormatLocale,
	slotToSecondsTimestamp,
	timestampToEpoch,
	timestampToSlot,
	timeUntilNextSlot,
	toDateTime,
} from './TimeUtils'

describe('TimeUtils', () => {
	const chainID = 1
	const epoch = 12345
	const slot = 123456
	const ts = 1609459200 // January 1, 2021 00:00:00 UTC in seconds
	const genesisMainnet = 1606824023000

	it('should convert epoch to timestamp', () => {
		const result = epochToTimestamp(chainID, epoch)
		expect(result).toBe(genesisMainnet + epoch * 32 * 12 * 1000)
	})

	it('should convert timestamp to epoch', () => {
		const result = timestampToEpoch(chainID, genesisMainnet)
		expect(result).toBe(0)

		const result2 = timestampToEpoch(chainID, genesisMainnet + 12 * 32 * 1000)
		expect(result2).toBe(1)
	})

	it('should convert timestamp to slot', () => {
		const result = timestampToSlot(chainID, genesisMainnet)
		expect(result).toBe(0)

		const result2 = timestampToSlot(chainID, genesisMainnet + 36000)
		expect(result2).toBe(3)
	})

	it('should calculate time until next slot', () => {
		const result = timeUntilNextSlot(chainID, genesisMainnet)
		expect(result).toBe(12000)
	})

	it('should calculate time until next slot offset', () => {
		const result = timeUntilNextSlot(chainID, genesisMainnet + 2000)
		expect(result).toBe(10000)
	})

	it('should convert slot to seconds timestamp', () => {
		const result = slotToSecondsTimestamp(chainID, slot)
		expect(result).toBe(genesisMainnet / 1000 + slot * 12)
	})

	it('should convert seconds to Date object', () => {
		const result = toDateTime(ts)
		expect(result).toEqual(new Date(1970, 0, 1, 0, 0, ts))
	})

	it('should get end timestamp based on aggregation', () => {
		const startTs = 1609459200
		expect(getEndTs('hourly', startTs)).toBe(startTs + ONE_HOUR)
		expect(getEndTs('weekly', startTs)).toBe(startTs + ONE_WEEK)
		expect(getEndTs('daily', startTs)).toBe(startTs + ONE_DAY)
	})

	it('should format timestamp to relative time', () => {
		const result = formatTsToRelative(Date.now() + 100, undefined, 'narrow', 'en-US')
		expect(result).toBe('in 0 sec.')
	})

	it('should return relative time string', () => {
		expect(relativeTs(3600)).toBe('hour')
		expect(relativeTs(7200)).toBe('2 hours')
		expect(relativeTs(86400)).toBe('day')
		expect(relativeTs(172800)).toBe('2 days')
	})

	it('should return short time format locale', () => {
		expect(shortTimeFormatLocale()).toBe('M/d/yy, h:mm a')
	})

	it('should format month short', () => {
		expect(formatMonthShort(0)).toBe('Jan')
		expect(formatMonthShort(11)).toBe('Dec')
	})

	it('should format month long', () => {
		expect(formatMonthLong(0)).toBe('January')
		expect(formatMonthLong(11)).toBe('December')
	})
})
