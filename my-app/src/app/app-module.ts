import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';

// Shared Components & Layouts
import { Footer } from './shared/components/footer/footer';
import { Header } from './shared/components/header/header';
import { CustomerLayout } from './shared/layouts/customer-layout/customer-layout';
import { OtpInput } from './shared/components/otp-input/otp-input';
import { ConfirmDialog } from './shared/components/confirm-dialog/confirm-dialog';
import { AccountSidebar } from './shared/components/account-sidebar/account-sidebar';
import { SuggestionPopup } from './shared/components/suggestion-popup/suggestion-popup';
import { AccessDenied } from './shared/components/errors/access-denied/access-denied';
import { NotFound } from './shared/components/errors/not-found/not-found';

// Auth & Account (pthao)
import { RegisterPage } from './pages/customer/auth/register-page/register-page';
import { OtpVerifyPage } from './pages/customer/auth/otp-verify-page/otp-verify-page';
import { LoginPage } from './pages/customer/auth/login-page/login-page';
import { ForgotPasswordPage } from './pages/customer/auth/forgot-password/forgot-password';
import { ForgotOtpPage } from './pages/customer/auth/forgot-otp-page/forgot-otp-page';
import { ResetPasswordPage } from './pages/customer/auth/reset-password-page/reset-password-page';
import { UserProfile } from './pages/customer/account/user-profile/user-profile';
import { Security } from './pages/customer/account/security/security';

// Bookings, Membership & Menu (pthao)
import { CoinsRewardsPage } from './pages/customer/membership/coins-rewards/coins-rewards';
import { PointsTierPage } from './pages/customer/membership/points-tier/points-tier';
import { BookingList } from './pages/customer/bookings/booking-list/booking-list';
import { BookingReschedule } from './pages/customer/bookings/booking-reschedule/booking-reschedule';
import { BookingCancel } from './pages/customer/bookings/booking-cancel/booking-cancel';
import { TopTrending } from './pages/customer/menu/top-trending/top-trending';
import { MenuPage } from './pages/customer/menu/menu-page/menu-page';

// Home, Booking Flow, Spaces & Info Pages (ttrinh)
import { KenHomeContent } from './pages/customer/home-page/home-content/home-content';
import { HomeGuestPage } from './pages/customer/home-page/home-guest/home-guest';
import { HomeMemberPage } from './pages/customer/home-page/home-member/home-member';
import { KenBookingShell } from './pages/customer/ken-booking/booking-shell/booking-shell';
import { KenCafeCatalogPage } from './pages/customer/ken-booking/cafe-catalog/cafe-catalog';
import { KenSpaceListingPage } from './pages/customer/ken-booking/space-listing/space-listing';
import { KenOtherSpacePage } from './pages/customer/ken-booking/other-space-booking/other-space-booking';
import { KenFocusPodPage } from './pages/customer/ken-booking/focus-pod/focus-pod';
import { KenDrinkPickerPage } from './pages/customer/ken-booking/drink-picker/drink-picker';
import { KenBookingReviewPage } from './pages/customer/ken-booking/booking-review/booking-review';
import { KenBookingPaymentPage } from './pages/customer/ken-booking/booking-payment/booking-payment';
import { SupportComponent } from './pages/customer/support/support';
import { PolicyPage } from './pages/customer/policy-page/policy-page';
import { TermsPage } from './pages/customer/terms-page/terms-page';
import { ReviewPage } from './pages/customer/review-page/review-page';
import { StoryPage } from './pages/customer/story-page/story-page';
import { PointsPage } from './pages/customer/points-page/points-page';
import { CoinsPage } from './pages/customer/coins-page/coins-page';
import { JourneysPage } from './pages/customer/journeys-page/journeys-page';
import { AboutPage } from './pages/customer/about-page/about-page';
import { SpacesPage } from './pages/customer/spaces-page/spaces-page';
import { ConnectPage } from './pages/customer/space-details/connect-page/connect-page';
import { CoworkPage } from './pages/customer/space-details/cowork-page/cowork-page';
import { FocusPage } from './pages/customer/space-details/focus-page/focus-page';
import { MeetingPage } from './pages/customer/space-details/meeting-page/meeting-page';

@NgModule({
  declarations: [
    App,
    Footer,
    Header,
    CustomerLayout,
    OtpInput,
    AccountSidebar,
    SuggestionPopup,
    AccessDenied,
    NotFound,
    RegisterPage,
    OtpVerifyPage,
    LoginPage,
    ForgotPasswordPage,
    ForgotOtpPage,
    ResetPasswordPage,
    UserProfile,
    Security,
    CoinsRewardsPage,
    PointsTierPage,
    BookingList,
    BookingReschedule,
    BookingCancel,
    TopTrending,
    MenuPage,
    KenHomeContent,
    HomeGuestPage,
    HomeMemberPage,
    KenBookingShell,
    KenCafeCatalogPage,
    KenSpaceListingPage,
    KenOtherSpacePage,
    KenFocusPodPage,
    KenDrinkPickerPage,
    KenBookingReviewPage,
    KenBookingPaymentPage,
    SupportComponent,
    PolicyPage,
    TermsPage,
    ReviewPage,
    StoryPage,
    PointsPage,
    CoinsPage,
    JourneysPage,
    AboutPage,
    SpacesPage,
    ConnectPage,
    CoworkPage,
    FocusPage,
    MeetingPage,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    ConfirmDialog,
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
  ],
  bootstrap: [App],
})
export class AppModule {}
