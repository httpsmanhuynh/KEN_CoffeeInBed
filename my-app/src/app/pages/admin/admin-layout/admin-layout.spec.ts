import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout.component';
<<<<<<< HEAD
=======
import { AuthService } from '../../../core/auth.service';
import { of } from 'rxjs';
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12

describe('AdminLayoutComponent', () => {
  let component: AdminLayoutComponent;
  let fixture: ComponentFixture<AdminLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdminLayoutComponent],
      imports: [RouterModule.forRoot([])],
<<<<<<< HEAD
=======
      providers: [
        { provide: AuthService, useValue: { logout: () => of(void 0), user: { fullName: 'Admin' } } },
      ],
>>>>>>> a79e6f8a04dfd3fb248b0a1ecdbdd22df5bd1d12
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
