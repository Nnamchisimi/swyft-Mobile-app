const CITY_HUBS = {
  lefkosa: {
    id: 'lefkosa',
    name: 'Lefkoşa',
    basePrice: 250,
    coverageArea: 'Hamitköy to Gönyeli Çemberi',
    type: 'intra-city',
    estimatedTime: '15-30 min',
  },
  girne: {
    id: 'girne',
    name: 'Girne',
    basePrice: 350,
    coverageArea: 'Zeytinlik to Karakum',
    type: 'intra-city',
    estimatedTime: '45-60 min',
    notes: 'Higher due to traffic/hills',
  },
  magusa: {
    id: 'magusa',
    name: 'Gazimağusa',
    basePrice: 250,
    coverageArea: 'City Center to Sakarya',
    type: 'intra-city',
    estimatedTime: '20-35 min',
  },
  iskele: {
    id: 'iskele',
    name: 'İskele',
    basePrice: 300,
    coverageArea: 'Long Beach area to Center',
    type: 'intra-city',
    estimatedTime: '35-50 min',
  },
};

const INTER_CITY_ROUTES = {
   'lefkosa-magusa': {
     id: 'lefkosa-magusa',
     name: 'Lefkoşa ↔ Mağusa',
     basePrice: 550,
     type: 'inter-city',
     estimatedTime: '60-75 min',
     notes: 'Long straight drive, high mileage',
   },
   'girne-magusa': {
     id: 'girne-magusa',
     name: 'Girne ↔ Mağusa',
     basePrice: 650,
     type: 'inter-city',
     estimatedTime: '90-110 min',
     notes: 'Coast Road or via Lefkoşa',
   },
   'lefkosa-ercan': {
     id: 'lefkosa-ercan',
     name: 'Lefkoşa ↔ Ercan',
     basePrice: 300,
     type: 'airport',
     estimatedTime: '25-35 min',
     notes: 'Special airport/logistic rate',
   },
 };

const VEHICLE_PRICES = {
  motorcycle: { id: 'motorcycle', name: 'Motorcycle', price: 50, desc: 'Documents, small items' },
  sedan: { id: 'sedan', name: 'Sedan', price: 150, desc: 'Medium packages' },
  truck: { id: 'truck', name: 'Van/Truck', price: 400, desc: 'Large packages' },
};

const SURCHARGES = {
  mountainVillage: {
    id: 'mountain_village',
    name: 'Mountain/Village Fee',
    amount: 80,
    description: 'Applies to mountain destinations (Bellapais, Karaman, Edremit) or far out (Lapta/Alsancak)',
    keywords: ['bellapais', 'karaman', 'edremit', 'lapta', 'alsancak', 'beylerbeyi', 'ciftlik', 'kaynakkaya', 'tepebaşı'],
  },
  nightShift: {
    id: 'night_shift',
    name: 'Night Shift',
    amount: 50,
    description: 'For any delivery requested after 9:00 PM',
    startHour: 21,
    endHour: 6,
  },
  waitingFee: {
    id: 'waiting_fee',
    name: 'Waiting Fee',
    amountPerUnit: 20,
    unitMinutes: 5,
    description: 'If the driver arrives and the person is not ready',
  },
};

function isMountainVillage(address) {
  if (!address) return false;
  return SURCHARGES.mountainVillage.keywords.some(kw =>
    address.toLowerCase().includes(kw.toLowerCase())
  );
}

function isNightShift() {
  const hour = new Date().getHours();
  return hour >= SURCHARGES.nightShift.startHour || hour < SURCHARGES.nightShift.endHour;
}

function calculateFare({ routeId, vehicleType, dropoffAddress }) {
  let basePrice = 0;
  let vehiclePrice = 0;
  const appliedSurcharges = [];

  const cityHub = CITY_HUBS[routeId];
  const interCity = INTER_CITY_ROUTES[routeId];

  if (cityHub) {
    basePrice = cityHub.basePrice;
  } else if (interCity) {
    basePrice = interCity.basePrice;
  }

  const vehicle = VEHICLE_PRICES[vehicleType];
  if (vehicle) {
    vehiclePrice = vehicle.price;
  }

  if (isMountainVillage(dropoffAddress)) {
    appliedSurcharges.push({
      id: 'mountain_village',
      name: SURCHARGES.mountainVillage.name,
      amount: SURCHARGES.mountainVillage.amount,
    });
  }

  if (isNightShift()) {
    appliedSurcharges.push({
      id: 'night_shift',
      name: SURCHARGES.nightShift.name,
      amount: SURCHARGES.nightShift.amount,
    });
  }

  const surchargeTotal = appliedSurcharges.reduce((sum, s) => sum + s.amount, 0);
  const totalFare = basePrice + vehiclePrice + surchargeTotal;

  return {
    basePrice,
    vehiclePrice,
    surchargeTotal,
    totalFare,
    surcharges: appliedSurcharges,
    currency: 'TL',
  };
}

function calculateWaitingFee(waitingMinutes) {
  const { amountPerUnit, unitMinutes } = SURCHARGES.waitingFee;
  const units = Math.ceil(waitingMinutes / unitMinutes);
  return units * amountPerUnit;
}

export default {
  CITY_HUBS,
  INTER_CITY_ROUTES,
  VEHICLE_PRICES,
  SURCHARGES,
  isMountainVillage,
  isNightShift,
  calculateFare,
  calculateWaitingFee,
};
