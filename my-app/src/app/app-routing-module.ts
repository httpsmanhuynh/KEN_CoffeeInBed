import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Auth & Account (pthao)
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
import { TopTrending } from './pages/customer/menu/top-trending/top-trending';
import { MenuPage } from './pages/customer/menu/menu-page/menu-page';
import { AccessDenied } from './shared/components/errors/access-denied/access-denied';
import { NotFound } from './shared/components/errors/not-found/not-found';

// Home, Booking Flow, Spaces & Info Pages (ttrinh)
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
import { KenBookingSpaceDetailPage } from './pages/customer/ken-booking/space-detail/space-detail';
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
import { adminRoutes } from './pages/admin/admin.routes';

const routes: Routes = [
  ...adminRoutes,
  // Home
  { path: '', component: HomeGuestPage, pathMatch: 'full' },
  { path: 'home-logged-in', component: HomeMemberPage },

  // Auth (pthao)
  { path: 'register', component: RegisterPage },
  { path: 'otp-verify', component: OtpVerifyPage },
  { path: 'login', component: LoginPage },
  { path: 'forgot-password', component: ForgotPasswordPage },
  { path: 'forgot-password/otp', redirectTo: 'forgot-otp', pathMatch: 'full' },
  { path: 'forgot-password/reset', redirectTo: 'reset-password', pathMatch: 'full' },
  { path: 'forgot-otp', component: ForgotOtpPage },
  { path: 'reset-password', component: ResetPasswordPage },

  // Account, Bookings, Membership & Menu (pthao)
  { path: 'coins-rewards', component: CoinsRewardsPage },
  { path: 'points-tier', component: PointsTierPage },
  { path: 'booking-cancel', component: BookingCancel },
  { path: 'booking-list', component: BookingList },
  { path: 'booking-reschedule', component: BookingReschedule },
  { path: 'user-profile', component: UserProfile },
  { path: 'security', component: Security },
  { path: 'menu', component: KenCafeCatalogPage },
  { path: 'menu-intro', component: MenuPage },
  { path: 'top-trending', component: TopTrending },
  { path: 'access-denied', component: AccessDenied },

  // 5-Step Booking Flow (ttrinh)
  {
    path: 'booking',
    component: KenBookingShell,
    children: [
      { path: '', redirectTo: 'spaces', pathMatch: 'full' },
      { path: 'spaces', component: KenSpaceListingPage },
      { path: 'focus-pod', component: KenFocusPodPage },
      { path: 'drinks', component: KenDrinkPickerPage },
      { path: 'review', component: KenBookingReviewPage },
      { path: 'payment', component: KenBookingPaymentPage },
      { path: ':id', component: KenOtherSpacePage },
    ],
  },
  {
    path: 'bookings',
    component: KenBookingShell,
    children: [
      { path: 'payment', component: KenBookingPaymentPage },
    ],
  },

  // Public & Space Detail Pages (ttrinh)
  { path: 'support', component: SupportComponent },
  { path: 'policy', component: PolicyPage },
  { path: 'terms', component: TermsPage },
  { path: 'reviews', component: ReviewPage },
  { path: 'blog', component: StoryPage },
  { path: 'points', component: PointsPage },
  { path: 'coins', component: CoinsPage },
  { path: 'our-story', component: JourneysPage },
  { path: 'about', component: AboutPage },
  { path: 'spaces/connect', component: ConnectPage },
  { path: 'spaces/work-lounge', component: CoworkPage },
  { path: 'spaces/focus-pod', component: FocusPage },
  { path: 'spaces/small-meeting-room', component: MeetingPage },
  { path: 'spaces/booking/:id', component: KenBookingSpaceDetailPage },
  { path: 'spaces', component: SpacesPage },

  // Legacy redirects
  { path: 'customer/membership/coins-rewards', redirectTo: 'coins-rewards', pathMatch: 'full' },
  { path: 'customer/membership/points-tier', redirectTo: 'points-tier', pathMatch: 'full' },
  { path: 'ho-tro', redirectTo: '/support', pathMatch: 'full' },
  { path: 'chinh-sach', redirectTo: '/policy', pathMatch: 'full' },
  { path: 'dieu-khoan', redirectTo: '/terms', pathMatch: 'full' },
  { path: 'danh-gia', redirectTo: '/reviews', pathMatch: 'full' },
  { path: 'chuyen-o-ken', redirectTo: '/blog', pathMatch: 'full' },
  { path: 'ken-diem', redirectTo: '/points', pathMatch: 'full' },
  { path: 'ken-coins', redirectTo: '/coins', pathMatch: 'full' },
  { path: 'cau-chuyen-ken', redirectTo: '/our-story', pathMatch: 'full' },
  { path: 've-chung-toi', redirectTo: '/about', pathMatch: 'full' },
  { path: 'khong-gian/ken-ket-noi', redirectTo: '/spaces/connect', pathMatch: 'full' },
  { path: 'khong-gian/khu-lam-viec-chung', redirectTo: '/spaces/work-lounge', pathMatch: 'full' },
  { path: 'khong-gian/o-tap-trung-ca-nhan', redirectTo: '/spaces/focus-pod', pathMatch: 'full' },
  { path: 'khong-gian/phong-hop-nho', redirectTo: '/spaces/small-meeting-room', pathMatch: 'full' },
  { path: 'khong-gian', redirectTo: '/spaces', pathMatch: 'full' },

  { path: '**', component: NotFound },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
