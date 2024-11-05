import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MoreComponent } from './more.component';

describe('MoreComponent', () => {
  let component: MoreComponent;
  let fixture: ComponentFixture<MoreComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MoreComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MoreComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
