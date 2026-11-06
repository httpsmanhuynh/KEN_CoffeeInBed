import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RegisterPage } from './pages/customer/auth/register-page/register-page';
import { OtpVerifyPage } from './pages/customer/auth/otp-verify-page/otp-verify-page';
import { LoginPage } from './pages/customer/auth/login-page/login-page';
import { ForgotOtpPage } from './pages/customer/auth/forgot-otp-page/forgot-otp-page';
import { ForgotPasswordPage } from './pages/customer/auth/forgot-password/forgot-password';
import { ResetPasswordPage } from './pages/customer/auth/reset-password-page/reset-password-page';
import { CoinsRewardsPage } from './pages/customer/membership/coins-rewards/coins-rewards';
import { PointsTierPage } from './pages/customer/membership/points-tier/points-tier';
import { BookingCancel } from './pages/customer/bookings/booking-cancel/booking-cancel';
import { BookingList } from './pages/customer/bookings/booking-list/booking-list';
import { BookingReschedule } from './pages/customer/bookings/booking-reschedule/booking-reschedule';
import { UserProfile } from './pages/customer/account/user-profile/user-profile';
import { Security } from './pages/customer/account/security/security';

const routes: Routes = [
  { path: '', redirectTo: 'register', pathMatch: 'full' },
  { path: 'register', component: RegisterPage },
  { path: 'otp-verify', component: OtpVerifyPage },
  { path: 'login', component: LoginPage },
  { path: 'forgot-password', component: ForgotPasswordPage },
  { path: 'forgot-password/otp', redirectTo: 'forgot-otp', pathMatch: 'full' },
  { path: 'forgot-password/reset', redirectTo: 'reset-password', pathMatch: 'full' },
  { path: 'forgot-otp', component: ForgotOtpPage },
  { path: 'reset-password', component: ResetPasswordPage },
  { path: 'coins-rewards', component: CoinsRewardsPage },
  { path: 'points-tier', component: PointsTierPage },
  { path: 'booking-cancel', component: BookingCancel },
  { path: 'booking-list', component: BookingList },
  { path: 'booking-reschedule', component: BookingReschedule },
  { path: 'user-profile', component: UserProfile },
  { path: 'security', component: Security },


  // Giữ tương thích với các URL cũ đã được dùng trong giao diện.
  { path: 'customer/membership/coins-rewards', redirectTo: 'coins-rewards', pathMatch: 'full' },
  { path: 'customer/membership/points-tier', redirectTo: 'points-tier', pathMatch: 'full' },
  { path: '**', redirectTo: 'register' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
