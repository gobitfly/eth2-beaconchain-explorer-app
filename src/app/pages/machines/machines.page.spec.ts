import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { MachinesPage } from './machines.page';

describe('MachinesPage', () => {
  let component: MachinesPage;
  let fixture: ComponentFixture<MachinesPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MachinesPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(MachinesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
