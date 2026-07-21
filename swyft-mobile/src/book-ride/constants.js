export const interCityRoutesData = [
  { id: 'lefkosa-magusa', name: 'Lefkoşa - Magusa', time: '60-75 min', desc: 'Between lefkosa and Magusa', basePrice: 550 },
  { id: 'lefkosa-girne', name: 'Lefkoşa - Girne', time: '30-45 mins', desc: 'Between lefkosa and Girne', basePrice: 450 },
  { id: 'girne-magusa', name: 'Girne - Magusa', time: '75-90 min', desc: 'Between girne and Magusa', basePrice: 650 },
  { id: 'lefkosa-ercan', name: 'Lefkoşa - Ercan', time: '30-45 min', desc: 'From Lefkosa to Ercan Airport', basePrice: 300 }
];

export const defaultRideTypes = [
  { id: 'lefkosa', name: 'Lefkoşa', icon: 'location', time: '15-30 min', desc: 'Within Lefkosa', basePrice: 250, coverageArea: 'Hamitköy to Gönyeli Çemberi', type: 'intra-city' },
  { id: 'girne', name: 'Girne', icon: 'location', time: '45-60 min', desc: 'Within Girne', basePrice: 350, coverageArea: 'Higher due to traffic/hills', type: 'intra-city' },
  { id: 'magusa', name: 'Gazimağusa', icon: 'location', time: '20-35 min', desc: 'Within Magusa', basePrice: 250, coverageArea: 'City Center to Sakarya', type: 'intra-city' },
  { id: 'iskele', name: 'İskele', icon: 'location', time: '35-50 min', desc: 'Within Iskele', basePrice: 300, coverageArea: 'Long Beach area to Center', type: 'intra-city' }
];

export const defaultVehicleTypes = [
  { id: 'motorcycle', name: 'Motorcycle', icon: 'bicycle', desc: 'Documents, small items', examples: 'Letters, small electronics, keys', price: 50 },
  { id: 'sedan', name: 'Sedan', icon: 'car-sport', desc: 'Medium packages', examples: 'Clothing, small boxes, food orders', price: 150 },
  { id: 'truck', name: 'Van/Truck', icon: 'bus', desc: 'Large packages', examples: 'Furniture, large boxes, appliances', price: 400 },
];

export const mountainKeywords = ['bellapais', 'karaman', 'edremit', 'lapta', 'alsancak', 'beylerbeyi', 'ciftlik', 'kaynakkaya', 'tepebaşı'];

export const quickNotes = ['Fragile', 'Keep upright'];
export const packageTypes = ['Food', 'Document', 'Parcel'];
export const packageSizes = ['Small', 'Medium', 'Large'];

export const sizeHelperTexts = {
  Small: 'Fits in a backpack or small box (documents, small electronics, keys)',
  Medium: 'Fits in a car trunk or large box (clothing, food orders, small items)',
  Large: 'Needs a van or truck (furniture, large boxes, appliances)'
};