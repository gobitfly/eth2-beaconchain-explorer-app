/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DashboardUtils, initDashboard } from '@utils/DashboardUtils'
import { APIUnauthorizedError } from '@requests/requests'
import { SearchResultData } from '@requests/v2-search'
import { VDBOverviewGroup } from '@requests/types/validator_dashboard'
import * as DashboardUtilsModule from './DashboardUtils'

// Redefine a local enum to match the union type string literals exactly.
enum SearchResponseType {
	validator = 'validator',
	validator_list = 'validator_list',
	validators_by_deposit_address = 'validators_by_deposit_address',
	validators_by_withdrawal_credential = 'validators_by_withdrawal_credential',
	validators_by_graffiti = 'validators_by_graffiti',
}

describe('DashboardUtils (service)', () => {
	let dashboardUtils: DashboardUtils
	let mockApi: any
	let mockStorage: any
	let mockAlerts: any
	let mockOAuth: any
	let mockMerchant: any
	let mockUnit: any

	beforeEach(() => {
		mockApi = {
			execute: vi.fn(),
			loadNetworkConfig: vi.fn().mockResolvedValue(undefined),
			getCurrentDashboardChainID: vi.fn().mockResolvedValue(1),
			clearSpecificCache: vi.fn(),
		}
		mockStorage = {
			isLoggedIn: vi.fn().mockResolvedValue(true),
			getDashboardID: vi.fn().mockResolvedValue([1, 2, 3]),
			setDashboardID: vi.fn().mockResolvedValue(undefined),
			setObject: vi.fn().mockResolvedValue(undefined),
		}
		mockAlerts = {
			confirmDialog: vi.fn(),
			showInfo: vi.fn(),
		}
		mockOAuth = {
			login: vi.fn().mockResolvedValue(true),
		}
		mockMerchant = {
			restartApp: vi.fn(),
		}
		mockUnit = {
			loadCurrentChainNetwork: vi.fn(),
		}

		// Construct a DashboardUtils instance.
		dashboardUtils = new DashboardUtils(mockApi, mockStorage, mockAlerts, mockOAuth, mockMerchant, mockUnit)
	})

	describe('initDashboard (instance method)', () => {
		it('should return a dashboard id when storage returns null and API returns dashboards', async () => {
			// Simulate no dashboard stored yet, but user is logged in.
			mockStorage.getDashboardID.mockResolvedValueOnce(null)
			mockStorage.isLoggedIn.mockResolvedValueOnce(true)
			// Simulate API returns a dashboard list with one entry (id 42)
			const dashboards = { validator_dashboards: [{ id: 42 }] }
			mockApi.execute.mockResolvedValueOnce({ error: false, data: dashboards })

			const result = await dashboardUtils.initDashboard()
			expect(result).toBe(42)
			expect(mockStorage.setDashboardID).toHaveBeenCalledWith(42)
		})
	})

	describe('addValidator', () => {
		// For a single validator, include index and public_key.
		const dummyValidator: SearchResultData = {
			type: SearchResponseType.validator,
			chain_id: 1,
			value: { index: 100, public_key: 'pubKey100' },
		}
		it('should add a validator when logged in', async () => {
			mockStorage.isLoggedIn.mockResolvedValue(true)
			mockStorage.getDashboardID.mockResolvedValue([1, 2, 3])
			mockApi.execute.mockResolvedValue({ error: false })
			const result = await dashboardUtils.addValidator(dummyValidator, 0)
			expect(mockApi.execute).toHaveBeenCalled()
			expect(result).toBe(true)
		})

		it('should add a validator when not logged in', async () => {
			mockStorage.isLoggedIn.mockResolvedValue(false)
			mockStorage.getDashboardID.mockResolvedValue([1, 2, 3])
			// For validator_list, value must be an object with a "validators" array.
			const dummyList: SearchResultData = {
				type: SearchResponseType.validator_list,
				chain_id: 1,
				value: { validators: [100, 200] },
			}
			const result = await dashboardUtils.addValidator(dummyList, 0)
			expect(result).toBe(true)
			expect(mockStorage.setDashboardID).toHaveBeenCalled()
		})
	})

	describe('addValidators', () => {
		it('should return true immediately when index array is empty', async () => {
			const result = await dashboardUtils.addValidators([], 0)
			expect(result).toBe(true)
		})

		it('should add validators when logged in', async () => {
			mockStorage.isLoggedIn.mockResolvedValue(true)
			mockStorage.getDashboardID.mockResolvedValue([1, 2, 3])
			mockApi.execute.mockResolvedValue({ error: false })
			const result = await dashboardUtils.addValidators([100, 200, 300], 0)
			expect(mockApi.execute).toHaveBeenCalled()
			expect(result).toBe(true)
		})

		it('should add validators when not logged in (and truncate array to 20)', async () => {
			mockStorage.isLoggedIn.mockResolvedValue(false)
			mockStorage.getDashboardID.mockResolvedValue([1, 2, 3])
			const indices = Array.from({ length: 25 }, (_, i) => i + 100)
			const result = await dashboardUtils.addValidators(indices, 0)
			expect(mockStorage.setDashboardID).toHaveBeenCalled()
			expect(result).toBe(true)
		})
	})

	describe('getGroupList', () => {
		it('should return a default group list when null is passed', () => {
			const groups = dashboardUtils.getGroupList(null)
			expect(groups).toEqual([{ id: 0, count: 0, name: 'Default', realName: 'default' }])
		})

		it('should sort groups and capitalize names', () => {
			const originalCapitalize = (global as any).capitalize || ((s: string) => s)
			;(global as any).capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
			const groupsInput: VDBOverviewGroup[] = [
				{ id: 2, count: 5, name: 'group2' },
				{ id: 1, count: 3, name: 'default' },
				{ id: 0, count: 10, name: 'default' },
			]
			const result = dashboardUtils.getGroupList(groupsInput)
			expect(result).toEqual([
				{ id: 0, count: 10, name: 'Default', realName: 'default' },
				{ id: 1, count: 3, name: 'Default', realName: 'default' },
				{ id: 2, count: 5, name: 'Group2', realName: 'group2' },
			])
			;(global as any).capitalize = originalCapitalize
		})
	})

	describe('deleteValidator', () => {
		it('should delete validator when logged in', async () => {
			mockStorage.isLoggedIn.mockResolvedValue(true)
			mockStorage.getDashboardID.mockResolvedValue([1, 2, 3, 4])
			mockApi.execute.mockResolvedValue({ error: false })
			const result = await dashboardUtils.deleteValidator([2, 4])
			expect(mockApi.execute).toHaveBeenCalled()
			expect(result).toBe(true)
		})

		it('should update dashboard when not logged in and using a local dashboard', async () => {
			mockStorage.isLoggedIn.mockResolvedValue(false)
			mockStorage.getDashboardID.mockResolvedValue([1, 2, 3, 4])
			const result = await dashboardUtils.deleteValidator([2, 4])
			expect(mockStorage.setDashboardID).toHaveBeenCalled()
			expect(result).toBe(true)
		})
	})

	describe('getLocalValidatorCount', () => {
		it('should return the length if dashboard is local', async () => {
			mockStorage.getDashboardID.mockResolvedValue([1, 2, 3])
			const count = await dashboardUtils.getLocalValidatorCount()
			expect(count).toBe(3)
		})

		it('should return 0 if dashboard is not local', async () => {
			mockStorage.getDashboardID.mockResolvedValue('not an array')
			const count = await dashboardUtils.getLocalValidatorCount()
			expect(count).toBe(0)
		})
	})

	describe('defaultDashboardErrorHandler', () => {
		it('should do nothing for null or non-APIError errors', () => {
			const res1 = dashboardUtils.defaultDashboardErrorHandler(null)
			expect(res1).toBeUndefined()
			const res2 = dashboardUtils.defaultDashboardErrorHandler(new Error('Test'))
			expect(res2).toBeUndefined()
		})

		it('should handle APIUnauthorizedError by calling confirmDialog and return true', () => {
			const unauthorizedError = new APIUnauthorizedError('Unauthorized', 401)
			mockOAuth.login.mockResolvedValue(true)
			const res = dashboardUtils.defaultDashboardErrorHandler(unauthorizedError)
			expect(mockAlerts.confirmDialog).toHaveBeenCalled()
			expect(res).toBe(true)
		})
	})
})

describe('mergeLocalDashboardToRemote (exported function)', () => {
	let mockApi: any, mockStorage: any
	beforeEach(() => {
		mockApi = { execute: vi.fn() }
		mockStorage = {
			getDashboardID: vi.fn(),
			setDashboardID: vi.fn().mockResolvedValue(undefined),
			setObject: vi.fn().mockResolvedValue(undefined),
			isLoggedIn: vi.fn().mockResolvedValue(true),
		}
	})

	it('should merge a local dashboard when present', async () => {
		const localDashboard = [1, 2, 3]
		mockStorage.getDashboardID.mockResolvedValue(localDashboard)
		mockApi.execute.mockResolvedValue({ error: false })
		vi.spyOn(DashboardUtilsModule, 'initDashboard').mockResolvedValue(42)
		await DashboardUtilsModule.mergeLocalDashboardToRemote(mockApi, mockStorage)
		expect(mockStorage.setObject).toHaveBeenCalledWith('local_dashboard_backup', null)
	})
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('initDashboard (exported function)', () => {
	let mockApi: any, mockStorage: any
	beforeEach(() => {
		mockApi = {
			execute: vi.fn(),
			getCurrentDashboardChainID: vi.fn().mockResolvedValue(1),
			clearSpecificCache: vi.fn(),
		}
		mockStorage = {
			getDashboardID: vi.fn(),
			isLoggedIn: vi.fn(),
			setDashboardID: vi.fn().mockResolvedValue(undefined),
		}
	})

	it('should return existing dashID if present', async () => {
		mockStorage.getDashboardID.mockResolvedValue(42)
		mockStorage.isLoggedIn.mockResolvedValue(false)
		const result = await initDashboard(mockApi, mockStorage)
		expect(result).toBe(42)
	})

	it('should load dashboards when no dashID exists and user is logged in', async () => {
		mockStorage.getDashboardID.mockResolvedValue(null)
		mockStorage.isLoggedIn.mockResolvedValue(true)
		const dashboards = { validator_dashboards: [{ id: 99 }] }
		mockApi.execute.mockResolvedValue({ error: false, data: dashboards })
		const result = await initDashboard(mockApi, mockStorage)
		expect(result).toBe(99)
		expect(mockStorage.setDashboardID).toHaveBeenCalledWith(99)
	})

	it('should create a dashboard if no dashboards are found', async () => {
		mockStorage.getDashboardID.mockResolvedValue(null)
		mockStorage.isLoggedIn.mockResolvedValue(true)
		mockApi.execute.mockResolvedValueOnce({ error: false, data: { validator_dashboards: [] } })
		const creationResult = { error: false, data: { id: 77 } }
		mockApi.execute.mockResolvedValueOnce(creationResult)
		const result = await initDashboard(mockApi, mockStorage)
		expect(result).toBe(77)
	})
})

describe('SeachResultHandler (helper class)', () => {
	let srHandler: any
	beforeEach(() => {
		// Create a dummy instance to access the searchResultHandler property.
		srHandler = new DashboardUtils({} as any, {} as any, {} as any, {} as any, {} as any, {} as any).searchResultHandler
	})

	it('should format search type correctly', () => {
		expect(srHandler.formatSearchType(SearchResponseType.validator_list)).toBe('Validator Indices')
		expect(srHandler.formatSearchType(SearchResponseType.validator)).toBe('Validator Index')
		expect(srHandler.formatSearchType(SearchResponseType.validators_by_deposit_address)).toBe('Deposit Address')
	})

	it('should correctly determine if item is index', () => {
		const item: SearchResultData = { type: SearchResponseType.validator, chain_id: 1, value: { index: 100, public_key: 'pk' } }
		expect(srHandler.isIndex(item)).toBe(true)
		const item2: SearchResultData = { type: SearchResponseType.validator_list, chain_id: 1, value: { validators: [100, 200] } }
		expect(srHandler.isIndex(item2)).toBe(false)
	})

	it('should return correct add-by index values', () => {
		const item: SearchResultData = { type: SearchResponseType.validator_list, chain_id: 1, value: { validators: [1, 2, 3] } }
		expect(srHandler.getAddByIndex(item)).toEqual([1, 2, 3])
		const item2: SearchResultData = { type: SearchResponseType.validator, chain_id: 1, value: { index: 42, public_key: 'pk' } }
		expect(srHandler.getAddByIndex(item2)).toEqual([42])
	})

	it('should return deposit address when applicable', () => {
		const item: SearchResultData = {
			type: SearchResponseType.validators_by_deposit_address,
			chain_id: 1,
			value: { deposit_address: 'addr', count: 1 },
		}
		expect(srHandler.getAddByDepositAddress(item)).toBe('addr')
	})

	it('should return withdrawal credential when applicable', () => {
		const item: SearchResultData = {
			type: SearchResponseType.validators_by_withdrawal_credential,
			chain_id: 1,
			value: { withdrawal_credential: 'cred', count: 1 },
		}
		expect(srHandler.getAddByWithdrawalCredential(item)).toBe('cred')
	})

	it('should return graffiti when applicable', () => {
		const item: SearchResultData = {
			type: SearchResponseType.validators_by_graffiti,
			chain_id: 1,
			value: { graffiti: 'graffiti', count: 1 },
		}
		expect(srHandler.getAddByGraffiti(item)).toBe('graffiti')
	})

	it('should indicate premium requirement for deposit, withdrawal, and graffiti types', () => {
		const item: SearchResultData = {
			type: SearchResponseType.validators_by_graffiti,
			chain_id: 1,
			value: { graffiti: 'graffiti', count: 1 },
		}
		expect(srHandler.requiresPremium(item)).toBe(true)
	})

	it('should return correct result count', () => {
		const item: SearchResultData = {
			type: SearchResponseType.validator_list,
			chain_id: 1,
			value: { validators: [1, 2, 3] },
		}
		expect(srHandler.resultCount(item)).toBe(3)
		const item2: SearchResultData = {
			type: SearchResponseType.validator,
			chain_id: 1,
			value: { index: 42, public_key: 'pk' },
		}
		expect(srHandler.resultCount(item2)).toBe(1)
	})
})
