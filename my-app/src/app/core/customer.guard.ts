import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Ngăn tài khoản ADMIN truy cập các trang dành cho khách hàng.
 * Nếu đang đăng nhập bằng tài khoản ADMIN, chuyển hướng về /admin/dashboard.
 */
export const customerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureSession().pipe(
    map((user) => (user?.role === 'ADMIN' ? router.createUrlTree(['/admin/dashboard']) : true)),
    catchError(() => of(auth.user?.role === 'ADMIN' ? router.createUrlTree(['/admin/dashboard']) : true)),
  );
};
