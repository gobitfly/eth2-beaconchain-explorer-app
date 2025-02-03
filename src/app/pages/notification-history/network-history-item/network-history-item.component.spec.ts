import { ComponentFixture, TestBed } from '@angular/core/testing'

import { NetworkHistoryItemComponent } from './network-history-item.component'

describe('NetworkHistoryItemComponent', () => {
	let component: NetworkHistoryItemComponent
	let fixture: ComponentFixture<NetworkHistoryItemComponent>

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [NetworkHistoryItemComponent],
		}).compileComponents()

		fixture = TestBed.createComponent(NetworkHistoryItemComponent)
		component = fixture.componentInstance
		fixture.detectChanges()
	})

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
