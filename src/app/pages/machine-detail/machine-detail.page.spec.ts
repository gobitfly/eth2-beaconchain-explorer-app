import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { MachineDetailPage } from './machine-detail.page';

describe('MachineDetailPage', () => {
  let component: MachineDetailPage;
  let fixture: ComponentFixture<MachineDetailPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MachineDetailPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(MachineDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
