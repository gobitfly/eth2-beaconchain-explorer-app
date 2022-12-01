import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { IonicModule } from '@ionic/angular'

import { BlockDetailPage } from './block-detail.page'

describe('BlockDetailPage', () => {
	let component: BlockDetailPage
	let fixture: ComponentFixture<BlockDetailPage>

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [BlockDetailPage],
			imports: [IonicModule.forRoot()],
		}).compileComponents()

		fixture = TestBed.createComponent(BlockDetailPage)
		component = fixture.componentInstance
		fixture.detectChanges()
	}))

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
