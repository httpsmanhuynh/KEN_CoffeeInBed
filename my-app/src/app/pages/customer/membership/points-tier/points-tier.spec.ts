import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PointsTierPage } from './points-tier';

describe('PointsTierPage', () => {
  let component: PointsTierPage;
  let fixture: ComponentFixture<PointsTierPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule, RouterModule.forRoot([])],
      declarations: [PointsTierPage],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(PointsTierPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('shows the 3 transactions from the design and filters by date', () => {
    expect(component.rows.length).toBe(3);
    component.fromDate = '2026-10-15';
    component.applyFilter();
    expect(component.rows.length).toBe(2);
    component.clearFilter();
    expect(component.rows.length).toBe(3);
  });
});
