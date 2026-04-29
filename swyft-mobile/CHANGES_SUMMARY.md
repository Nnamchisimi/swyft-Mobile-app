## Summary of Changes (Updated)

### Modified File
- `swyft-mobile/app/(passenger)/book-ride.js`

### Changes Made

#### 1. Vehicle Auto-Selection Based on Package Size (Now Collapsible)
- **Auto-selection logic**: Vehicle type is automatically selected based on package size (Small → Motorcycle, Medium → Sedan, Large → Truck)
- **UI change**: Replaced interactive vehicle selection cards with a **collapsible section** that shows the auto-selected vehicle details
- **Collapsible**: Vehicle section is folded by default with a chevron indicator; user can click to expand/collapse
- Display includes: vehicle icon, name, description, examples, and package size label

#### 2. Collapsible Price Breakdown
- Price breakdown section is folded by default (same as vehicle section)
- Clickable header with chevron-up/chevron-down indicator toggles detailed breakdown visibility
- Total price always visible outside the collapsible area

#### 3. Centralized Pricing Data
- Replaced hardcoded pricing arrays with imports from `src/services/courierPricing.js`
- `CITY_HUBS`, `INTER_CITY_ROUTES`, and `VEHICLE_PRICES` now pulled from centralized module
- `calculateFare()` function replaces inline calculation logic

### State Variables Added
- `priceBreakdownOpen` (boolean) - tracks price breakdown open/closed state
- `vehicleSectionOpen` (boolean) - tracks vehicle section open/closed state

### Technical Details
- Both collapsible sections default to **closed/folded** state
- Users can expand either section by clicking the header
- All existing functionality preserved (package size → vehicle auto-selection, fare calculation, surcharges)
- Styling consistent with existing app design
- No breaking changes

### File Line Count
- Updated file: 2,305 lines