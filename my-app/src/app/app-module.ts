import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { RegisterPage } from './pages/customer/auth/register-page/register-page';
import { OtpVerifyPage } from './pages/customer/auth/otp-verify-page/otp-verify-page';
import { OtpInput } from './shared/components/otp-input/otp-input';
import { provideHttpClient } from '@angular/common/http';
import { LoginPage } from './pages/customer/auth/login-page/login-page';
import { ForgotPasswordPage } from './pages/customer/auth/forgot-password/forgot-password';
import { FormsModule } from '@angular/forms';
import { Footer } from './shared/components/footer/footer';
import { Header } from './shared/components/header/header';
import { CustomerLayout } from './shared/layouts/customer-layout/customer-layout';
import { ForgotOtpPage } from './pages/customer/auth/forgot-otp-page/forgot-otp-page';
import { ResetPasswordPage } from './pages/customer/auth/reset-password-page/reset-password-page';
import { CoinsRewardsPage } from './pages/customer/membership/coins-rewards/coins-rewards';
import { PointsTierPage } from './pages/customer/membership/points-tier/points-tier';
import { BookingList } from './pages/customer/bookings/booking-list/booking-list';
import { BookingReschedule } from './pages/customer/bookings/booking-reschedule/booking-reschedule';
import { BookingCancel } from './pages/customer/bookings/booking-cancel/booking-cancel';
import { ConfirmDialog } from './shared/components/confirm-dialog/confirm-dialog';
import { UserProfile } from './pages/customer/account/user-profile/user-profile';
import { Security } from './pages/customer/account/security/security';
import { AccountSidebar } from './shared/components/account-sidebar/account-sidebar';

@NgModule({
  declarations: [
    App,
    RegisterPage,
    OtpVerifyPage,
    OtpInput,
    LoginPage,
    ForgotPasswordPage,
    Footer,
    Header,
    CustomerLayout,
    ForgotOtpPage,
    ResetPasswordPage,
    CoinsRewardsPage,
    PointsTierPage,
    BookingList,
    BookingReschedule,
    BookingCancel,
    UserProfile,
    Security,
    AccountSidebar,
    // Remove ConfirmDialog from declarations
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    ConfirmDialog, // Import ConfirmDialog here
  ],
  providers: [provideHttpClient()],
  bootstrap: [App],
})
export class AppModule {}
