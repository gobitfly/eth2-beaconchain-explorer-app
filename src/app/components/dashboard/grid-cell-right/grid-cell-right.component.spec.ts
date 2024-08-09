import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GridCellRightComponent } from './grid-cell-right.component';

describe('GridCellRightComponent', () => {
  let component: GridCellRightComponent;
  let fixture: ComponentFixture<GridCellRightComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GridCellRightComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GridCellRightComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
