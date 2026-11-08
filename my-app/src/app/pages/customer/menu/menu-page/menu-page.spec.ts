import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, RouterModule } from '@angular/router';
import { MenuPage } from './menu-page';
import { SuggestionPopupService } from '../../../../shared/services/suggestion-popup.service';

function setup(params: Record<string, string>) {
  sessionStorage.clear();
  TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    declarations: [MenuPage],
    providers: [{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } }],
  });
  const f = TestBed.createComponent(MenuPage);
  return { c: f.componentInstance, svc: TestBed.inject(SuggestionPopupService) };
}

describe('MenuPage', () => {
  it('opens the suggestion popup with ?popup=1', () => {
    const { c, svc } = setup({ popup: '1' });
    c.ngOnInit();
    expect(svc.isOpen()).toBe(true);
  });

  it('the button reopens the popup on demand', () => {
    const { c, svc } = setup({});
    c.openSuggestion();
    expect(svc.isOpen()).toBe(true);
  });
});
