import { KenCafeCatalogPage, KenBookingShell, KenSpaceListingPage, KenFocusPodPage, KenDrinkPickerPage, KenBookingReviewPage, KenBookingPaymentPage } from './pages/customer/ken-booking/booking-pages';
import { HomeGuestPage, HomeMemberPage } from './pages/customer/home-page/home-pages';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CustomerLayout } from './shared/layouts/customer-layout/customer-layout';

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

const routes: Routes = [
  { path: 'booking', component: KenBookingShell, children: [
      { path: '', redirectTo: 'spaces', pathMatch: 'full' },
      { path: 'spaces', component: KenSpaceListingPage },
      { path: 'focus-pod', component: KenFocusPodPage },
      { path: 'drinks', component: KenDrinkPickerPage },
      { path: 'review', component: KenBookingReviewPage },
      { path: 'payment', component: KenBookingPaymentPage }
  ] },
  { path: 'home-logged-in', component: HomeMemberPage },
  {
    path: '',
    component: CustomerLayout,
    children: [
      { path: 'menu', component: KenCafeCatalogPage },
      // English routes - Public pages
      { path: 'support', component: SupportComponent },
      { path: 'policy', component: PolicyPage },
      { path: 'terms', component: TermsPage },
      { path: 'reviews', component: ReviewPage },
      { path: 'blog', component: StoryPage },
      { path: 'points', component: PointsPage },
      { path: 'coins', component: CoinsPage },
      { path: 'our-story', component: JourneysPage },
      { path: 'about', component: AboutPage },

      // English routes - Spaces
      { path: 'spaces/connect', component: ConnectPage },
      { path: 'spaces/work-lounge', component: CoworkPage },
      { path: 'spaces/focus-pod', component: FocusPage },
      { path: 'spaces/small-meeting-room', component: MeetingPage },
      { path: 'spaces', component: SpacesPage },

      // Redirect old Vietnamese routes
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

      // Default page
      { path: '', component: HomeGuestPage }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'enabled'
    })],
  exports: [RouterModule]
})
export class AppRoutingModule {}