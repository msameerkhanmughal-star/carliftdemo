# Car Lift Booking App

## Overview
A React-based car lift / ride booking application with route browsing, monthly plan booking, Firebase Auth, Firestore real-time database, Firebase Storage for car images, and a comprehensive admin panel.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite (port 5000)
- **Routing**: React Router v6
- **State/Data**: Firebase Firestore (real-time) + localStorage fallback
- **UI**: shadcn/ui + Tailwind CSS (dark red theme)
- **Auth**: Firebase Auth (email/password, role-based admin via Firestore)
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage (car images)
- **PDF**: jsPDF (dynamic company info + car image link)

## Pages
- `/` — Home (route showcase)
- `/book` — Book Ride (route carousel + monthly booking form with live fare calculation)
- `/my-rides` — User's ride history
- `/auth` — Login/Signup with Firebase Auth
- `/carlift-admin` — Admin Panel (bookings, routes, settings, revenue)

## Admin Panel Features
- **Auth**: Firebase Auth signup/signin with Firestore role check (`role: 'admin'`). No hardcoded emails. Includes "Register Admin" tab.
- **Bookings Tab**: Real-time Firestore subscription; responsive dual-layout (mobile card + desktop table). Status update, car assignment, **driver assignment**, WhatsApp messaging, PDF invoice generation (with driver info), delete.
- **Car Assignment Enforcement**: Status cannot be set to "approved" until a car is assigned. Warning shown in status popup.
- **Driver Assignment**: Assign any managed driver to a booking from a popup modal. Driver's photo, name, and phone shown inline. Persisted to Firestore (`assignedDriver` field on booking).
- **Routes Tab**: Manage pickup/dropoff locations (synced to Firestore `settings/locations`), route overview.
- **Settings Tab**:
  - **Company Info**: Name, tagline, phone, email, address — saved to Firestore, used in PDF invoices.
  - **Driver Management**: Add drivers (name + phone). Upload/remove profile photo (Firebase Storage + Firestore). View full photo on tap. Delete driver. Driver info appears in PDF invoices.
  - **Routes Management**: Add/edit/delete routes with titles and timings.
  - **Fare Rate Per KM**: Dynamic fare rate saved to Firestore.
  - **Monthly Working Days**: Base working days, synced to Firestore.
  - **Payment Info**: Easypaisa, JazzCash, Bank Transfer — synced to Firestore.
  - **Fleet Management**: Add/remove cars dynamically (saved to Firestore `settings/carsList`). Upload car images to Firebase Storage. View full image on click. Revenue per vehicle shown.
- **Mobile-Responsive Header**: Compact logo + status row; scrollable stats strip on small screens; Back/Logout buttons collapse label on mobile.

## Key Data Architecture
- `bookings/{id}` — Booking documents in Firestore (includes `assignedDriver` field)
- `settings/locations` — Pickup locations + dropoff map
- `settings/carImages` — Car image URLs (from Firebase Storage)
- `settings/carsList` — Dynamic fleet list
- `settings/companyInfo` — Company name, contact, address for invoices
- `settings/fareRate` — farePerKm + workingDays
- `settings/paymentInfo` — Payment account details
- `settings/routes` — Route definitions
- `settings/driversList` — Array of `DriverInfo` objects `{ id, name, phone }`
- `settings/driverImages` — Driver image URLs keyed by driver id
- `users/{uid}` — User profiles with `role: 'admin' | 'user'`
- `adminNotifications` — Admin notification feed
- Firebase Storage: `car-images/{carName}` for vehicle photos, `driver-images/{safeName}` for driver photos

## User Panel (BookRide.tsx) Features
- Route carousel with morning/evening time slots
- Pickup/dropoff selector (locations from Firestore `settings/locations` in real-time)
- Timing slot selection per route
- Weekend options (+Saturday or +Sat & Sun adds days to fare)
- Real-time OSRM driving distance calculation for accurate fare
- Monthly fare = distance × rate × days + 11% SRB tax
- Active booking banner (if user has an approved booking)
- Payment popup (Easypaisa, JazzCash, Bank Transfer) with account details from Firestore

## PDF Invoice
- Dynamic company info header (from Firestore)
- Company logo embedded
- Customer details, route, fare, status, start date
- Car section: embedded image (base64 or Firebase Storage URL via canvas) or fallback link
- Driver section: embedded profile photo + driver name + phone (if driver assigned)
- Editable invoice number per booking (inline click-to-edit)
- WhatsApp sharing: Web Share API on mobile (with PDF file), desktop fallback (download + open WhatsApp Web)
- Professional styled footer with company contact

## Firebase Configuration
- Project: car-lift-98b84
- Storage bucket: car-lift-98b84.firebasestorage.app
- Auth domain: car-lift-98b84.firebaseapp.com

## Development
```bash
npm run dev   # starts on port 5000
```
