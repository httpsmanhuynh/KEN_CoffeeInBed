import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CoinsRewardsPage } from './coins-rewards';

describe('CoinsRewardsPage', () => {
  let component: CoinsRewardsPage;
  let fixture: ComponentFixture<CoinsRewardsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [CoinsRewardsPage],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(CoinsRewardsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('computes missing coins like the design (150 and 250)', () => {
    expect(component.enough(450)).toBeTrue();
    expect(component.missing(800)).toBe(150);
    expect(component.missing(900)).toBe(250);
  });

  it('filters history by tab', () => {
    component.setTab('pending');
    expect(component.filteredHistory.length).toBe(1);
    component.setTab('spent');
    expect(component.filteredHistory.length).toBe(2);
    component.setTab('earned');
    expect(component.filteredHistory.length).toBe(2);
  });
});
