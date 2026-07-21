import { interCityRoutesData, defaultVehicleTypes, mountainKeywords } from './_constants';

export function calculateFare(state) {
  const { selectedRideType, selectedVehicleType, interCityMode, interCityRoute, rideTypes, vehicleTypes, dropoffAddress, setEstimatedPrice, setSurchargeDetails } = state;

  let totalPrice = 0;
  let basePrice = 0;
  let vehiclePrice = 0;

  if (interCityMode && interCityRoute) {
    const route = interCityRoutesData.find(r => r.id === interCityRoute);
    basePrice = route ? route.basePrice : 0;
    vehiclePrice = selectedVehicleType ? (vehicleTypes.find(v => v.id === selectedVehicleType)?.price || 0) : 0;
    totalPrice = basePrice + vehiclePrice;
  } else {
    const ride = rideTypes.find(r => r.id === selectedRideType);
    const vehicle = vehicleTypes.find(v => v.id === selectedVehicleType);
    basePrice = ride ? ride.basePrice : 0;
    vehiclePrice = vehicle ? vehicle.price : 0;
    totalPrice = basePrice + vehiclePrice;
  }

  let surcharge = 0;
  const surchargeDetails = [];

  if (dropoffAddress) {
    const isMountain = mountainKeywords.some(kw => dropoffAddress.toLowerCase().includes(kw.toLowerCase()));
    if (isMountain) {
      surcharge += 80;
      surchargeDetails.push({ name: 'Mountain/Village Fee', amount: 80 });
    }
  }

  const currentHour = new Date().getHours();
  if (currentHour >= 21 || currentHour < 6) {
    surcharge += 50;
    surchargeDetails.push({ name: 'Night Shift (after 9PM)', amount: 50 });
  }

  totalPrice += surcharge;
  setEstimatedPrice(totalPrice);
  setSurchargeDetails(surchargeDetails);
}