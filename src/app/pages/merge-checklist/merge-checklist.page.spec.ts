import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { IonicModule } from '@ionic/angular'

import { MergeChecklistPage } from './merge-checklist.page'

describe('MergeChecklistPage', () => {
	let component: MergeChecklistPage
	let fixture: ComponentFixture<MergeChecklistPage>

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [MergeChecklistPage],
			imports: [IonicModule.forRoot()],
		}).compileComponents()

		fixture = TestBed.createComponent(MergeChecklistPage)
		component = fixture.componentInstance
		fixture.detectChanges()
	}))

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
