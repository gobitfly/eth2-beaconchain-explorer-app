import { describe, it, expect } from 'vitest'
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
		expect(timestampToEpoch(chainID, genesisMainnet)).toBe(0)
		expect(timestampToEpoch(chainID, genesisMainnet + 12 * 32 * 1000)).toBe(1)
	})

	it('should convert timestamp to slot', () => {
		expect(timestampToSlot(chainID, genesisMainnet)).toBe(0)
		expect(timestampToSlot(chainID, genesisMainnet + 36000)).toBe(3)
	})

	it('should calculate time until next slot', () => {
		expect(timeUntilNextSlot(chainID, genesisMainnet)).toBe(12000)
	})

	it('should calculate time until next slot offset', () => {
		expect(timeUntilNextSlot(chainID, genesisMainnet + 2000)).toBe(10000)
	})

	it('should convert slot to seconds timestamp', () => {
		expect(slotToSecondsTimestamp(chainID, slot)).toBe(genesisMainnet / 1000 + slot * 12)
	})

	it('should convert seconds to Date object', () => {
		expect(toDateTime(ts)).toEqual(new Date(1970, 0, 1, 0, 0, ts))
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

	it('should format month short', () => {
		expect(formatMonthShort(0)).toBe('Jan')
		expect(formatMonthShort(11)).toBe('Dec')
	})

	it('should format month long', () => {
		expect(formatMonthLong(0)).toBe('January')
		expect(formatMonthLong(11)).toBe('December')
	})
})
