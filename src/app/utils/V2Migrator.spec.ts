/// <reference types="vitest" />
import V2Migrator from '@utils/V2Migrator'

describe('V2Migrator', () => {
	let migrator: V2Migrator
	let mockApi: any
	let mockStorage: any
	let mockValidatorUtils: any
	let mockDashboardUtils: any
	let mockAlert: any
	let mockMerchant: any

	beforeEach(() => {
		mockApi = {
			loadNetworkConfig: vi.fn().mockResolvedValue(undefined),
			refreshToken: vi.fn().mockResolvedValue(true),
			getLatestState: vi.fn().mockResolvedValue(undefined),
			execute: vi.fn(),
			initialize: vi.fn().mockResolvedValue(undefined),
		}
		mockStorage = {
			setV2: vi.fn().mockResolvedValue(undefined),
			getBooleanSetting: vi.fn().mockResolvedValue(false),
			setBooleanSetting: vi.fn().mockResolvedValue(undefined),
			getAuthUser: vi.fn().mockResolvedValue(null),
			isV2: vi.fn().mockResolvedValue(false),
			getAuthUserv2: vi.fn().mockResolvedValue(null),
			setAuthUser: vi.fn().mockResolvedValue(undefined),
			setAuthUserv2: vi.fn().mockResolvedValue(undefined),
			getDeviceID: vi.fn().mockResolvedValue('device123'),
			getDeviceName: vi.fn().mockResolvedValue('MyDevice'),
		}
		mockValidatorUtils = {
			wasStakeShareUser: vi.fn().mockResolvedValue(false),
			getMyLocalValidators: vi.fn().mockResolvedValue([]),
		}
		mockDashboardUtils = {
			initDashboard: vi.fn().mockResolvedValue(undefined),
			addValidators: vi.fn().mockResolvedValue(true),
		}
		mockAlert = {
			showInfo: vi.fn(),
			presentLoading: vi.fn().mockReturnValue({
				present: vi.fn(),
				dismiss: vi.fn(),
			}),
			noChoiceDialog: vi.fn(),
		}
		mockMerchant = {
			restartApp: vi.fn(),
		}

		migrator = new V2Migrator(mockApi, mockStorage, mockValidatorUtils, mockDashboardUtils, mockAlert, mockMerchant)
	})

	describe('switchToV2', () => {
		it('should set V2 flag and load network config', async () => {
			await migrator.switchToV2(true)
			expect(mockStorage.setV2).toHaveBeenCalledWith(true)
			expect(mockApi.loadNetworkConfig).toHaveBeenCalled()
		})
	})

	describe('showDeprecationNotice', () => {
		it('should do nothing if deprecation notice already seen', async () => {
			mockStorage.getBooleanSetting.mockResolvedValueOnce(true)
			await migrator.showDeprecationNotice()
			expect(mockStorage.getBooleanSetting).toHaveBeenCalledWith('deprecation_info_seen', false)
			// showInfo should not be called if notice was already seen
			expect(mockAlert.showInfo).not.toHaveBeenCalled()
		})

		it('should not show notice if not a stake share user', async () => {
			mockStorage.getBooleanSetting.mockResolvedValueOnce(false)
			mockValidatorUtils.wasStakeShareUser.mockResolvedValueOnce(false)
			await migrator.showDeprecationNotice()
			expect(mockStorage.setBooleanSetting).toHaveBeenCalledWith('deprecation_info_seen', true)
			expect(mockAlert.showInfo).not.toHaveBeenCalled()
		})

		it('should show deprecation notice if stake share user', async () => {
			mockStorage.getBooleanSetting.mockResolvedValueOnce(false)
			mockValidatorUtils.wasStakeShareUser.mockResolvedValueOnce(true)
			await migrator.showDeprecationNotice()
			expect(mockStorage.setBooleanSetting).toHaveBeenCalledWith('deprecation_info_seen', true)
			expect(mockAlert.showInfo).toHaveBeenCalledWith('Deprecation Notice', expect.stringContaining('Stake Share'))
		})
	})

	describe('migrate', () => {
		it('should do nothing if migration already completed', async () => {
			// Simulate that migration is already completed.
			mockStorage.getBooleanSetting.mockResolvedValueOnce(true)
			await migrator.migrate()
			// Expect no migration actions to be performed.
			expect(mockApi.refreshToken).not.toHaveBeenCalled()
			// We assume that if migration is completed, setBooleanSetting for migration_completed is not re‑set.
			expect(mockStorage.setBooleanSetting).not.toHaveBeenCalledWith('migration_completed', true)
		})

		it('should switch to v2 and mark migration completed if nothing to migrate', async () => {
			// Simulate no v1 dashboards and no v1 user.
			mockValidatorUtils.getMyLocalValidators.mockResolvedValueOnce([])
			mockStorage.getAuthUser.mockResolvedValueOnce(null)
			// Simulate migration not completed.
			mockStorage.getBooleanSetting.mockResolvedValueOnce(false)
			await migrator.migrate()
			// Expect switchToV2 to be called internally.
			expect(mockStorage.setV2).toHaveBeenCalledWith(true)
			// Migration flag should be set.
			expect(mockStorage.setBooleanSetting).toHaveBeenCalledWith('migration_completed', true)
		})

		it('should perform migration when v1 user or dashboards are found', async () => {
			// Simulate that v1 dashboards exist.
			mockValidatorUtils.getMyLocalValidators.mockResolvedValueOnce([{ id: 1 }])
			// Simulate that a v1 user is found.
			mockStorage.getAuthUser.mockResolvedValueOnce({ accessToken: 'token', refreshToken: 'rToken' })
			// Ensure migration is not already completed.
			mockStorage.getBooleanSetting.mockResolvedValueOnce(false)
			// Simulate that we're not on v2.
			mockStorage.isV2.mockResolvedValueOnce(false)
			// Simulate refresh token failing so that user gets logged out.
			mockApi.refreshToken.mockResolvedValueOnce(false)
			// Simulate v1SessionToV2 failing.
			vi.spyOn(migrator as any, 'v1SessionToV2').mockResolvedValue(false)
			// Simulate dashboard migration failure.
			mockDashboardUtils.addValidators.mockResolvedValueOnce(false)
			// Simulate that v2 user is not present.
			mockStorage.getAuthUserv2.mockResolvedValueOnce(null)

			await migrator.migrate()

			// Expect that switchToV2 is called to switch to v2.
			expect(mockStorage.setV2).toHaveBeenCalledWith(true)
			// Expect that api.getLatestState is called with true.
			expect(mockApi.getLatestState).toHaveBeenCalledWith(true)
			// Expect that the v1 session is cleared.
			expect(mockStorage.setAuthUser).toHaveBeenCalledWith(null)
			// Verify that a dialog is shown.
			expect(mockAlert.noChoiceDialog).toHaveBeenCalled()
			// Simulate the dialog callback execution.
			const dialogCallback = (mockAlert.noChoiceDialog as vi.Mock).mock.calls[0][2]
			dialogCallback()
			expect(mockMerchant.restartApp).toHaveBeenCalled()
			// Finally, the migration_completed flag should be set.
			expect(mockStorage.setBooleanSetting).toHaveBeenCalledWith('migration_completed', true)
		})
	})

	describe('isMigrationCompleted', () => {
		it('should return the migration completed status from storage', async () => {
			mockStorage.getBooleanSetting.mockResolvedValueOnce(true)
			const result = await migrator.isMigrationCompleted()
			expect(result).toBe(true)
			expect(mockStorage.getBooleanSetting).toHaveBeenCalledWith('migration_completed', false)
		})
	})

	describe('v1SessionToV2', () => {
		// Test v1SessionToV2 by accessing it via bracket notation.
		it('should return false if no user is found', async () => {
			mockStorage.getAuthUser.mockResolvedValueOnce(null)
			const result = await (migrator as any).v1SessionToV2()
			expect(result).toBe(false)
		})

		it('should return false if user has no refreshToken', async () => {
			mockStorage.getAuthUser.mockResolvedValueOnce({ accessToken: 'token' })
			const result = await (migrator as any).v1SessionToV2()
			expect(result).toBe(false)
		})

		it('should return false if api.execute returns error', async () => {
			const user = { accessToken: 'token', refreshToken: 'rToken' }
			mockStorage.getAuthUser.mockResolvedValueOnce(user)
			mockApi.execute.mockResolvedValueOnce({ error: true })
			const result = await (migrator as any).v1SessionToV2()
			expect(result).toBe(false)
		})

		it('should return false if no session is found in api.execute response', async () => {
			const user = { accessToken: 'token', refreshToken: 'rToken' }
			mockStorage.getAuthUser.mockResolvedValueOnce(user)
			mockApi.execute.mockResolvedValueOnce({ data: {} })
			const result = await (migrator as any).v1SessionToV2()
			expect(result).toBe(false)
		})

		it('should migrate successfully if api.execute returns a valid session', async () => {
			const user = { accessToken: 'token', refreshToken: 'rToken' }
			const sessionData = { Session: { token: 'v2Token' } }
			mockStorage.getAuthUser.mockResolvedValueOnce(user)
			mockApi.execute.mockResolvedValueOnce({ data: sessionData })
			const result = await (migrator as any).v1SessionToV2()
			expect(result).toBe(true)
			expect(mockStorage.setAuthUserv2).toHaveBeenCalledWith({ Session: sessionData.Session })
			expect(mockApi.initialize).toHaveBeenCalled()
		})
	})
})
