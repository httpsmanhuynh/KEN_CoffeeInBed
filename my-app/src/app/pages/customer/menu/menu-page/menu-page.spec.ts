import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { MenuPage } from './menu-page';
import { SuggestionPopupService } from '../../../../shared/services/suggestion-popup.service';

async function setup() {
  sessionStorage.clear();
  await TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    declarations: [MenuPage],
  }).compileComponents();
  const fixture = TestBed.createComponent(MenuPage);
  return { fixture, svc: TestBed.inject(SuggestionPopupService) };
}

describe('MenuPage', () => {
  it('does not open the popup when the Menu page is visited', async () => {
    const { fixture, svc } = await setup();
    fixture.detectChanges();

    expect(svc.isOpen()).toBe(false);
    fixture.destroy();
  });
});
