import { KenBookingShell } from './pages/customer/ken-booking/booking-shell/booking-shell';
import { KenCafeCatalogPage } from './pages/customer/ken-booking/cafe-catalog/cafe-catalog';
import { KenSpaceListingPage } from './pages/customer/ken-booking/space-listing/space-listing';
import { KenOtherSpacePage } from './pages/customer/ken-booking/other-space-booking/other-space-booking';
import { KenFocusPodPage } from './pages/customer/ken-booking/focus-pod/focus-pod';
import { KenDrinkPickerPage } from './pages/customer/ken-booking/drink-picker/drink-picker';
import { KenBookingReviewPage } from './pages/customer/ken-booking/booking-review/booking-review';
import { KenBookingPaymentPage } from './pages/customer/ken-booking/booking-payment/booking-payment';
import { KenHomeContent } from './pages/customer/home-page/home-content/home-content';
import { HomeGuestPage } from './pages/customer/home-page/home-guest/home-guest';
import { HomeMemberPage } from './pages/customer/home-page/home-member/home-member';
import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';

import { HeaderComponent } from './shared/components/header/header';
import { Footer } from './shared/components/footer/footer';
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

@NgModule({
  declarations: [
    App,

    HeaderComponent,
    Footer,
    CustomerLayout,

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
    HomeGuestPage,
    HomeMemberPage,
    KenHomeContent,
    KenCafeCatalogPage,
    KenBookingShell,
    KenSpaceListingPage,
    KenOtherSpacePage,
    KenFocusPodPage,
    KenDrinkPickerPage,
    KenBookingReviewPage,
    KenBookingPaymentPage,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule
  ],
  providers: [
    provideBrowserGlobalErrorListeners()
  ],
  bootstrap: [App]
})
export class AppModule {}