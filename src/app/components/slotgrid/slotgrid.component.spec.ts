import { SlotGridComponent } from './slotgrid.component'
import { VDBSlotVizSlot, VDBSlotVizStatus, VDBSlotVizDuty, VDBSlotVizSlashing, VDBSlotVizTuple } from '@requests/types/slot_viz'
import { FilterType } from '@controllers/SlotVizController'
import { signal } from '@angular/core'

// Dummy provider (its functionality is not used in these tests)
const dummySlotVizProvider = {} as any
const dummyApiService = {} as any
const dummyPopOverController = {} as any

// Helper function to simulate a WritableSignal for filterMap.
// It returns a function that produces a Map with the desired filter settings.
function createFilterMap(filters: Partial<Record<FilterType, boolean>>): () => Map<FilterType, boolean> {
	return () => {
		const map = new Map<FilterType, boolean>()
		map.set('block', filters.block ?? false)
		map.set('attestation', filters.attestation ?? false)
		map.set('sync', filters.sync ?? false)
		map.set('slash', filters.slash ?? false)
		return map
	}
}

interface TestCase {
	description: string
	slot: VDBSlotVizSlot
	filters: Partial<Record<FilterType, boolean>>
	expectedBig: string
	expectedSmall: string
	expectedColor: string
	expectedSquareCss: string[]
}

const testCases: TestCase[] = [
	{
		description: 'Proposal slot with no filter applied, status "proposed"',
		slot: {
			slot: 1,
			status: 'proposed',
			proposal: { duty_object: 123, validator: 1 } as VDBSlotVizTuple,
		},
		filters: {},
		expectedBig: 'cube-outline',
		expectedSmall: '',
		expectedColor: 'success',
		expectedSquareCss: ['square', 'network-proposed', 'success'],
	},
	{
		description: 'Proposal slot with no filter applied, status "scheduled"',
		slot: {
			slot: 1,
			status: 'scheduled',
			proposal: { duty_object: 123, validator: 1 } as VDBSlotVizTuple,
		},
		filters: {},
		expectedBig: 'cube-outline',
		expectedSmall: '',
		expectedColor: '',
		expectedSquareCss: ['square', 'network-scheduled', ''],
	},
	{
		description: 'Proposal slot with block filter applied',
		slot: {
			slot: 1,
			status: 'proposed',
			proposal: { duty_object: 123, validator: 1 } as VDBSlotVizTuple,
		},
		filters: { block: true },
		expectedBig: '',
		expectedSmall: '',
		expectedColor: 'success',
		expectedSquareCss: ['square', 'network-proposed', 'success'],
	},
	{
		description: 'Attestations with both success and failed > 0, no filter, status "scheduled"',
		slot: {
			slot: 2,
			status: 'scheduled',
			attestations: {
				success: { total_count: 5, validators: [1, 2, 3] },
				failed: { total_count: 3, validators: [4, 5] },
			} as VDBSlotVizStatus<VDBSlotVizDuty>,
		},
		filters: {},
		expectedBig: 'document-text-outline',
		expectedSmall: '',
		expectedColor: 'warning',
		expectedSquareCss: ['square', 'network-scheduled', 'warning'],
	},
	{
		description: 'Sync duty with failed > 0 and zero success, no filter, status "scheduled"',
		slot: {
			slot: 3,
			status: 'scheduled',
			sync: {
				failed: { total_count: 2, validators: [1] },
				success: { total_count: 0, validators: [] },
			} as VDBSlotVizStatus<VDBSlotVizDuty>,
		},
		filters: {},
		expectedBig: 'sync-outline',
		expectedSmall: '',
		expectedColor: 'danger',
		expectedSquareCss: ['square', 'network-scheduled', 'danger'],
	},
	{
		description: 'Slashing duty with success > 0, no filter, status "scheduled"',
		slot: {
			slot: 4,
			status: 'scheduled',
			slashing: {
				success: { total_count: 5, slashings: [] },
				failed: { total_count: 0, slashings: [] },
			} as VDBSlotVizStatus<VDBSlotVizSlashing>,
		},
		filters: {},
		expectedBig: 'person-remove-outline',
		expectedSmall: '',
		expectedColor: 'success',
		expectedSquareCss: ['square', 'network-scheduled', 'success'],
	},
	{
		description: 'Slashed (failed > 0), no filter, status "scheduled"',
		slot: {
			slot: 4,
			status: 'scheduled',
			slashing: {
				success: { total_count: 0, slashings: [] },
				failed: { total_count: 5, slashings: [] },
			} as VDBSlotVizStatus<VDBSlotVizSlashing>,
		},
		filters: {},
		expectedBig: 'person-remove-outline',
		expectedSmall: '',
		expectedColor: 'danger',
		expectedSquareCss: ['square', 'network-scheduled', 'danger'],
	},
	{
		description: 'Slot with both proposal and attestations, no filters, status "proposed"',
		slot: {
			slot: 5,
			status: 'proposed',
			proposal: { duty_object: 123, validator: 1 } as VDBSlotVizTuple,
			attestations: {
				success: { total_count: 3, validators: [1, 2] },
				failed: { total_count: 0, validators: [] },
			} as VDBSlotVizStatus<VDBSlotVizDuty>,
		},
		filters: {},
		expectedBig: 'cube-outline',
		expectedSmall: 'document-text-outline',
		expectedColor: 'success',
		expectedSquareCss: ['square', 'network-proposed', 'success'],
	},
	{
		description: 'Attestations filtered out (filter attestation true)',
		slot: {
			slot: 6,
			status: 'scheduled',
			attestations: {
				success: { total_count: 3, validators: [1, 2] },
				failed: { total_count: 0, validators: [] },
			} as VDBSlotVizStatus<VDBSlotVizDuty>,
		},
		filters: { attestation: true },
		expectedBig: '',
		expectedSmall: '',
		expectedColor: 'success',
		expectedSquareCss: ['square', 'network-scheduled', 'success'],
	},
	{
		description: 'Slashing filtered out (filter slash true)',
		slot: {
			slot: 7,
			status: 'scheduled',
			slashing: {
				success: { total_count: 5, slashings: [] },
				failed: { total_count: 0, slashings: [] },
			} as VDBSlotVizStatus<VDBSlotVizSlashing>,
		},
		filters: { slash: true },
		expectedBig: '',
		expectedSmall: '',
		expectedColor: 'success',
		expectedSquareCss: ['square', 'network-scheduled', 'success'],
	},
	{
		description: 'Sync filtered out (filter sync true)',
		slot: {
			slot: 8,
			status: 'scheduled',
			sync: {
				failed: { total_count: 2, validators: [1] },
				success: { total_count: 0, validators: [] },
			} as VDBSlotVizStatus<VDBSlotVizDuty>,
		},
		filters: { sync: true },
		expectedBig: '',
		expectedSmall: '',
		expectedColor: 'danger',
		expectedSquareCss: ['square', 'network-scheduled', 'danger'],
	},
	{
		description: 'Slot with both slashing and proposal',
		slot: {
			slot: 9,
			status: 'scheduled',
			slashing: {
				success: { total_count: 1, slashings: [] },
				failed: { total_count: 0, slashings: [] },
			} as VDBSlotVizStatus<VDBSlotVizSlashing>,
			proposal: { duty_object: 123, validator: 1 } as VDBSlotVizTuple,
		},
		filters: {},
		expectedBig: 'person-remove-outline',
		expectedSmall: 'cube-outline',
		expectedColor: 'success',
		expectedSquareCss: ['square', 'network-scheduled', 'success'],
	},
	{
		description: 'Slot slashing, proposal, sync and attestation',
		slot: {
			slot: 9,
			status: 'proposed',
			slashing: {
				success: { total_count: 1, slashings: [] },
				failed: { total_count: 0, slashings: [] },
			} as VDBSlotVizStatus<VDBSlotVizSlashing>,
			proposal: { duty_object: 123, validator: 1 } as VDBSlotVizTuple,
			sync: {
				failed: { total_count: 0, validators: [] },
				success: { total_count: 2, validators: [] },
			} as VDBSlotVizStatus<VDBSlotVizDuty>,
			attestations: {
				success: { total_count: 3, validators: [1, 2] },
				failed: { total_count: 0, validators: [] },
			} as VDBSlotVizStatus<VDBSlotVizDuty>,
		},
		filters: {},
		expectedBig: 'person-remove-outline',
		expectedSmall: 'add-outline',
		expectedColor: 'success',
		expectedSquareCss: ['square', 'network-proposed', 'success'],
	},
	{
		description: 'Slot slashing, proposal, sync and attestation but missed attestations (color should be warning)',
		slot: {
			slot: 9,
			status: 'proposed',
			slashing: {
				success: { total_count: 1, slashings: [] },
				failed: { total_count: 0, slashings: [] },
			} as VDBSlotVizStatus<VDBSlotVizSlashing>,
			proposal: { duty_object: 123, validator: 1 } as VDBSlotVizTuple,
			sync: {
				failed: { total_count: 2, validators: [1] },
				success: { total_count: 0, validators: [] },
			} as VDBSlotVizStatus<VDBSlotVizDuty>,
			attestations: {
				success: { total_count: 0, validators: [1, 2] },
				failed: { total_count: 3, validators: [] },
			} as VDBSlotVizStatus<VDBSlotVizDuty>,
		},
		filters: {},
		expectedBig: 'person-remove-outline',
		expectedSmall: 'add-outline',
		expectedColor: 'warning',
		expectedSquareCss: ['square', 'network-proposed', 'warning'],
	},
]

describe('SlotGridComponent', () => {
	let component: SlotGridComponent

	beforeEach(() => {
		component = new SlotGridComponent(dummySlotVizProvider, dummyApiService, dummyPopOverController)
	})

	testCases.forEach((tc) => {
		describe(tc.description, () => {
			beforeEach(() => {
				component.filterMap = signal(createFilterMap(tc.filters)())
			})

			it(`should return expected big icon: "${tc.expectedBig}"`, () => {
				const result = component.getIconBig(tc.slot, component.filterMap())
				expect(result).toEqual(tc.expectedBig)
			})

			it(`should return expected small icon: "${tc.expectedSmall}"`, () => {
				const result = component.getIconSmall(tc.slot, component.filterMap())
				expect(result).toEqual(tc.expectedSmall)
			})

			it(`should return expected icon color: "${tc.expectedColor}"`, () => {
				const result = component.getIconColor(tc.slot, component.filterMap())
				expect(result).toEqual(tc.expectedColor)
			})

			it(`should return expected square CSS: ${JSON.stringify(tc.expectedSquareCss)}`, () => {
				const result = component.getSquareCss(tc.slot, component.filterMap())
				expect(result).toEqual(tc.expectedSquareCss)
			})
		})
	})
})
