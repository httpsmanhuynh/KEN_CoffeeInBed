import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CoinsRewardsPage } from './coins-rewards';

describe('CoinsRewards', () => {
  let component: CoinsRewardsPage;
  let fixture: ComponentFixture<CoinsRewardsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CoinsRewardsPage],
    }).compileComponents();

    fixture = TestBed.createComponent(CoinsRewardsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
