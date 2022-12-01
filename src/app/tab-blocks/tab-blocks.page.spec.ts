import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { IonicModule } from '@ionic/angular'

import { TabBlocksPage } from './tab-blocks.page'

describe('TabBlocksPage', () => {
	let component: TabBlocksPage
	let fixture: ComponentFixture<TabBlocksPage>

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [TabBlocksPage],
			imports: [IonicModule.forRoot()],
		}).compileComponents()

		fixture = TestBed.createComponent(TabBlocksPage)
		component = fixture.componentInstance
		fixture.detectChanges()
	}))

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
