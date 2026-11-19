import { TestBed } from '@angular/core/testing';
import { AppModule } from '../../../../app-module';
import { KenHomeContent } from './home-content';
import { SuggestionPopupService } from '../../../../shared/services/suggestion-popup.service';

describe('KenHomeContent', () => {
  beforeEach(() => sessionStorage.clear());

  it('exports the Angular component', () => {
    expect(KenHomeContent).toBeDefined();
  });

  it('opens the trending suggestion when the home page is initialized', async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
    }).compileComponents();
    const fixture = TestBed.createComponent(KenHomeContent);

    fixture.detectChanges();

    expect(TestBed.inject(SuggestionPopupService).isOpen()).toBe(true);
    fixture.destroy();
  });
});