import { sumBigInt, findHighest, findLowest, slotToEpoch, startEpochSyncCommittee, endEpochSyncCommittee } from './MathUtils'
import BigNumber from 'bignumber.js'

describe('MathUtils', () => {
	describe('sumBigInt', () => {
		it('should return the sum of BigNumber fields', () => {
			const validators = [{ value: new BigNumber(10) }, { value: new BigNumber(20) }, { value: new BigNumber(30) }]
			const result = sumBigInt(validators, (v) => v.value)
			expect(result.toString()).toBe('60')
		})

		it('should return 0 for an empty array', () => {
			const validators: { value: BigNumber }[] = []
			const result = sumBigInt(validators, (v) => v.value)
			expect(result.toString()).toBe('0')
		})
	})

	describe('findHighest', () => {
		it('should return the highest number', () => {
			const validators = [{ value: 10 }, { value: 20 }, { value: 30 }]
			const result = findHighest(validators, (v) => v.value)
			expect(result).toBe(30)
		})

		it('should return MIN_SAFE_INTEGER for an empty array', () => {
			const validators: { value: number }[] = []
			const result = findHighest(validators, (v) => v.value)
			expect(result).toBe(Number.MIN_SAFE_INTEGER)
		})
	})

	describe('findLowest', () => {
		it('should return the lowest number', () => {
			const validators = [{ value: 10 }, { value: 20 }, { value: 30 }]
			const result = findLowest(validators, (v) => v.value)
			expect(result).toBe(10)
		})

		it('should return MAX_SAFE_INTEGER for an empty array', () => {
			const validators: { value: number }[] = []
			const result = findLowest(validators, (v) => v.value)
			expect(result).toBe(Number.MAX_SAFE_INTEGER)
		})
	})

	describe('slotToEpoch', () => {
		it('should convert slot to epoch correctly', () => {
			const result = slotToEpoch(1, 64)
			expect(result).toBe(2)
		})
	})

	describe('startEpochSyncCommittee', () => {
		it('should return the correct start epoch of the sync committee', () => {
			const result = startEpochSyncCommittee(1, 256)
			expect(result).toBe(0)
		})
	})

	describe('endEpochSyncCommittee', () => {
		it('should return the correct end epoch of the sync committee', () => {
			const result = endEpochSyncCommittee(1, 256)
			expect(result).toBe(256)
		})
	})
})
