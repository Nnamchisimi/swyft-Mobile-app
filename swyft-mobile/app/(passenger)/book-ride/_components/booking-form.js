import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../src/constants/config';
import geoService from '../../../../src/services/geo';
import { interCityRoutesData, defaultVehicleTypes } from '../_constants';
import { calculateDistance, getPlaceDetails, getRouteCoordinates } from '../_location';

const { width } = Dimensions.get('window');

export function BookingForm({ state, styles, mapRef, onPickupChange, onDropoffChange, onPickupSelect, onDropoffSelect, onGetCurrentLocation, onBookRide }) {
  const {
    currentLocation, pickupLocation, pickupAddress, dropoffLocation, dropoffAddress,
    pickupSuggestions, dropoffSuggestions, showPickupSuggestions, showDropoffSuggestions,
    selectedRideType, selectedVehicleType, interCityMode, interCityRoute,
    rideTypes, vehicleTypes, packageType, packageSize, packageDetails, specialInstructions,
    selectedQuickNote, receiverName, receiverEmail, receiverPhone,
    pricingLoaded, estimatedPrice, priceBreakdownExpanded, vehicleTypesExpanded,
    locationLoading, loading
  } = state;

  return (
    <>
      <View style={styles.mapContainer}>
        {currentLocation ? (
          <MapView ref={mapRef} style={styles.map} provider={PROVIDER_GOOGLE} initialRegion={{
            latitude: (pickupLocation || currentLocation)?.latitude,
            longitude: (pickupLocation || currentLocation)?.longitude,
            latitudeDelta: 0.05, longitudeDelta: 0.05,
          }} showsUserLocation showsMyLocationButton showsCompass>
            {pickupLocation && <Marker coordinate={{ latitude: pickupLocation.latitude, longitude: pickupLocation.longitude }} title="Pickup Location" pinColor={COLORS.success} />}
            {dropoffLocation && <Marker coordinate={{ latitude: dropoffLocation.latitude, longitude: dropoffLocation.longitude }} title="Dropoff Location" pinColor={COLORS.error} />}
            {state.driverLocation && <Marker coordinate={{ latitude: state.driverLocation.latitude, longitude: state.driverLocation.longitude }} title="Your Courier"><View style={styles.driverMarkerStyle}><Ionicons name="car" size={16} color="white" /></View></Marker>}
            {state.routeCoordinates.length > 1 && <Polyline coordinates={state.routeCoordinates} strokeColor={COLORS.primary} strokeWidth={4} />}
            {state.driverLocation && pickupLocation && dropoffLocation && state.routeCoordinates.length <= 1 && <>
              <Polyline coordinates={[state.driverLocation, pickupLocation]} strokeColor={COLORS.primary} strokeWidth={4} />
              <Polyline coordinates={[pickupLocation, dropoffLocation]} strokeColor={COLORS.success} strokeWidth={4} />
            </>}
            {!state.driverLocation && pickupLocation && dropoffLocation && <Polyline coordinates={[pickupLocation, dropoffLocation]} strokeColor={COLORS.primary} strokeWidth={4} />}
            {!state.driverLocation && !pickupLocation && currentLocation && dropoffLocation && <Polyline coordinates={[{ latitude: currentLocation.latitude, longitude: currentLocation.longitude }, dropoffLocation]} strokeColor={COLORS.primary} strokeWidth={4} />}
          </MapView>
        ) : (
          <View style={[styles.mapPlaceholder, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.mapPlaceholderText}>Getting your location...</Text>
          </View>
        )}
      </View>

      <View style={styles.locationSection}>
        <View style={styles.inputRow}>
          <View style={[styles.inputDot, { backgroundColor: COLORS.success }]} />
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>PICKUP</Text>
            <TextInput style={styles.input} placeholder="Enter pickup location" placeholderTextColor={COLORS.textSecondary} value={pickupAddress} onChangeText={onPickupChange} onFocus={() => state.set('showPickupSuggestions', true)} />
            {showPickupSuggestions && pickupSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {pickupSuggestions.map((suggestion, index) => (
                  <TouchableOpacity key={index} style={styles.suggestionItem} onPress={() => onPickupSelect(suggestion)}>
                    <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.suggestionText} numberOfLines={2}>{suggestion.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.inputConnector} />

        <View style={styles.inputRow}>
          <View style={[styles.inputDot, { backgroundColor: COLORS.error }]} />
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>DROPOFF</Text>
            <TextInput style={styles.input} placeholder="Package destination" placeholderTextColor={COLORS.textSecondary} value={dropoffAddress} onChangeText={onDropoffChange} onFocus={() => state.set('showDropoffSuggestions', true)} />
            {showDropoffSuggestions && dropoffSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {dropoffSuggestions.map((suggestion, index) => (
                  <TouchableOpacity key={index} style={styles.suggestionItem} onPress={() => onDropoffSelect(suggestion)}>
                    <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.suggestionText} numberOfLines={2}>{suggestion.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.currentLocationButton} onPress={onGetCurrentLocation} disabled={locationLoading}>
          {locationLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={styles.currentLocationText}>Use Current Location</Text>
          </>}
        </TouchableOpacity>
      </View>

      <View style={styles.interCityToggleContainer}>
        <TouchableOpacity style={[styles.interCityToggleButton, !interCityMode && styles.interCityToggleButtonActive]} onPress={() => { state.set('interCityMode', false); state.set('interCityRoute', ''); state.set('selectedRideType', ''); state.set('selectedVehicleType', ''); }}>
          <Text style={[styles.interCityToggleText, !interCityMode && styles.interCityToggleTextActive]}>City Hub</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.interCityToggleButton, interCityMode && styles.interCityToggleButtonActive]} onPress={() => { state.set('interCityMode', true); state.set('interCityRoute', ''); state.set('selectedRideType', ''); state.set('selectedVehicleType', ''); }}>
          <Text style={[styles.interCityToggleText, interCityMode && styles.interCityToggleTextActive]}>Inter-City</Text>
        </TouchableOpacity>
      </View>

      {interCityMode ? (
        <View style={styles.interCitySection}>
          <Text style={styles.sectionTitle}>Choose Route</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {interCityRoutesData.map((route) => (
              <TouchableOpacity key={route.id} style={[styles.interCityCard, interCityRoute === route.id && styles.interCityCardSelected]} onPress={() => state.set('interCityRoute', route.id)}>
                <Ionicons name="location" size={28} color={interCityRoute === route.id ? COLORS.primary : COLORS.textSecondary} />
                <Text style={[styles.interCityCardTitle, interCityRoute === route.id && styles.interCityCardSelectedText]}>{route.name}</Text>
                <Text style={styles.interCityCardSubtitle}>{route.time}</Text>
                <Text style={[styles.interCityCardPrice, interCityRoute === route.id && styles.interCityCardPriceSelected]}>₺{route.basePrice}</Text>
                <Text style={styles.rideTypeDesc}>{route.desc}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {interCityRoute && (
            <View style={styles.vehicleTypesSection}>
              <TouchableOpacity style={styles.vehicleSectionHeader} onPress={() => state.set('vehicleTypesExpanded', !state.vehicleTypesExpanded)}>
                <Text style={styles.sectionTitle}>Vehicle Required</Text>
                <Ionicons name={state.vehicleTypesExpanded ? 'chevron-up' : 'chevron-down'} size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
              
              {state.vehicleTypesExpanded && (
                <View style={styles.vehicleTypeContainer}>
                  {defaultVehicleTypes.map((vehicle) => (
                    <View key={vehicle.id} style={[styles.vehicleTypeCard, selectedVehicleType === vehicle.id && styles.vehicleTypeCardSelected]}>
                      <Ionicons name={vehicle.icon} size={28} color={selectedVehicleType === vehicle.id ? COLORS.white : COLORS.textSecondary} />
                      <Text style={[styles.vehicleTypeName, selectedVehicleType === vehicle.id && styles.vehicleTypeNameSelected]}>{vehicle.name}</Text>
                      <Text style={[styles.vehicleTypeDesc, selectedVehicleType === vehicle.id && styles.vehicleTypeDescSelected]}>{vehicle.desc}</Text>
                      <Text style={[styles.vehicleTypeExamples, selectedVehicleType === vehicle.id && styles.vehicleTypeExamplesSelected]}>{vehicle.examples}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      ) : (
        <>
          <View style={styles.rideTypesSection}>
            <Text style={styles.sectionTitle}>Choose City Hub Area</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {rideTypes.map((ride) => (
                <TouchableOpacity key={ride.id} style={[styles.rideTypeCard, selectedRideType === ride.id && styles.rideTypeCardSelected]} onPress={() => state.set('selectedRideType', ride.id)}>
                  <Ionicons name="location" size={28} color={selectedRideType === ride.id ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={[styles.rideTypeName, selectedRideType === ride.id && styles.rideTypeNameSelected]}>{ride.name}</Text>
                  <Text style={styles.rideTypeTime}>{ride.time}</Text>
                  {pricingLoaded ? <Text style={[styles.rideTypePrice, selectedRideType === ride.id && styles.rideTypePriceSelected]}>₺{ride.basePrice}</Text> : <Text style={styles.rideTypePrice}>₺...</Text>}
                  <Text style={styles.rideTypeDesc}>{ride.desc}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {selectedRideType ? (
            <View style={styles.vehicleTypesSection}>
              <TouchableOpacity style={styles.vehicleSectionHeader} onPress={() => state.set('vehicleTypesExpanded', !state.vehicleTypesExpanded)}>
                <Text style={styles.sectionTitle}>Vehicle Required (Based on Size)</Text>
                <Ionicons name={state.vehicleTypesExpanded ? 'chevron-up' : 'chevron-down'} size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
              
              {state.vehicleTypesExpanded && (
                <View style={styles.vehicleTypeContainer}>
                  {defaultVehicleTypes.map((vehicle) => (
                    <View key={vehicle.id} style={[styles.vehicleTypeCard, selectedVehicleType === vehicle.id && styles.vehicleTypeCardSelected]}>
                      <Ionicons name={vehicle.icon} size={28} color={selectedVehicleType === vehicle.id ? COLORS.white : COLORS.textSecondary} />
                      <Text style={[styles.vehicleTypeName, selectedVehicleType === vehicle.id && styles.vehicleTypeNameSelected]}>{vehicle.name}</Text>
                      <Text style={[styles.vehicleTypeDesc, selectedVehicleType === vehicle.id && styles.vehicleTypeDescSelected]}>{vehicle.desc}</Text>
                      <Text style={[styles.vehicleTypeExamples, selectedVehicleType === vehicle.id && styles.vehicleTypeExamplesSelected]}>{vehicle.examples}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.vehicleTypesSection}>
              <TouchableOpacity style={styles.vehicleSectionHeader} onPress={() => state.set('vehicleTypesExpanded', !state.vehicleTypesExpanded)}>
                <Text style={styles.sectionTitle}>Vehicle Required (Based on Size)</Text>
                <Ionicons name={state.vehicleTypesExpanded ? 'chevron-up' : 'chevron-down'} size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
              {state.vehicleTypesExpanded && <Text style={styles.vehicleTypePlaceholder}>Please select a city hub area first</Text>}
            </View>
          )}
        </>
      )}

      <View style={styles.priceEstimate}>
        <TouchableOpacity style={styles.priceBreakdownHeader} onPress={() => state.set('priceBreakdownExpanded', !state.priceBreakdownExpanded)}>
          <Text style={styles.priceBreakdownTitle}>Price Breakdown</Text>
          <Ionicons name={state.priceBreakdownExpanded ? 'chevron-up' : 'chevron-down'} size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>
        
        {state.priceBreakdownExpanded && (
          <View style={styles.priceBreakdown}>
            {interCityMode && interCityRoute ? <>
              <View style={styles.priceRow}><Text style={styles.priceLabel}>Route Fare</Text><Text style={styles.priceValue}>₺{interCityRoutesData.find(r => r.id === interCityRoute)?.basePrice || 0}</Text></View>
              {selectedVehicleType && <View style={styles.priceRow}><Text style={styles.priceLabel}>Vehicle Type</Text><Text style={styles.priceValue}>₺{defaultVehicleTypes.find(v => v.id === selectedVehicleType)?.price || 0}</Text></View>}
            </> : <>
              <View style={styles.priceRow}><Text style={styles.priceLabel}>City Hub Base Fare</Text><Text style={styles.priceValue}>₺{selectedRideType ? (rideTypes.find(r => r.id === selectedRideType)?.price || rideTypes.find(r => r.id === selectedRideType)?.basePrice || 0) : 0}</Text></View>
              {selectedVehicleType && <View style={styles.priceRow}><Text style={styles.priceLabel}>Vehicle Type</Text><Text style={styles.priceValue}>₺{defaultVehicleTypes.find(v => v.id === selectedVehicleType)?.price || 0}</Text></View>}
            </>}
          </View>
        )}
        
        <View style={styles.priceBreakdownBorder} />
        
        <View style={styles.totalPriceRow}>
          <Text style={styles.totalPriceLabel}>Total Estimated Fare</Text>
          <Text style={styles.totalPriceValue}>₺{estimatedPrice}</Text>
        </View>
        
        <Text style={styles.priceNote}>Final price may vary based on actual route and conditions</Text>
      </View>

      <View style={styles.packageSection}>
        <Text style={styles.sectionTitle}>Package Details</Text>
        
        <Text style={styles.inputLabel}>TYPE OF PACKAGE</Text>
        <View style={styles.packageTypeContainer}>
          {['Food', 'Document', 'Parcel'].map((type) => (
            <TouchableOpacity key={type} style={[styles.packageTypeButton, packageType === type && styles.packageTypeButtonSelected]} onPress={() => state.set('packageType', type)}>
              <Text style={[styles.packageTypeText, packageType === type && styles.packageTypeTextSelected]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {packageType && (
          <>
            <Text style={styles.inputLabel}>PACKAGE DETAILS</Text>
            <TextInput style={styles.packageDetailsInput} placeholder={`e.g., ${packageType === 'Food' ? 'Pizza, Burgers, Groceries...' : packageType === 'Document' ? 'Envelope, Folder, ID card...' : 'Electronics, Clothes, Books...'}`} placeholderTextColor={COLORS.textSecondary} value={packageDetails} onChangeText={(val) => state.set('packageDetails', val)} multiline />
          </>
        )}

        <Text style={styles.inputLabel}>SIZE</Text>
        <View style={styles.packageSizeContainer}>
          {['Small', 'Medium', 'Large'].map((size) => (
            <TouchableOpacity key={size} style={[styles.packageSizeButton, packageSize === size && styles.packageSizeButtonSelected]} onPress={() => state.set('packageSize', size)}>
              <Ionicons name={size === 'Small' ? 'cube-outline' : size === 'Medium' ? 'cube' : 'cube-sharp'} size={20} color={packageSize === size ? COLORS.white : COLORS.textSecondary} />
              <Text style={[styles.packageSizeText, packageSize === size && styles.packageSizeTextSelected]}>{size}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {packageSize && <Text style={styles.sizeHelperText}>
          {packageSize === 'Small' && 'Fits in a backpack or small box (documents, small electronics, keys)'}
          {packageSize === 'Medium' && 'Fits in a car trunk or large box (clothing, food orders, small items)'}
          {packageSize === 'Large' && 'Needs a van or truck (furniture, large boxes, appliances)'}
        </Text>}

        <Text style={styles.inputLabel}>SPECIAL INSTRUCTIONS</Text>
        <View style={styles.specialInstructionsContainer}>
          {['Fragile', 'Keep upright'].map((instruction) => (
            <TouchableOpacity key={instruction} style={[styles.instructionChip, selectedQuickNote === instruction && styles.instructionChipSelected]} onPress={() => state.set('selectedQuickNote', selectedQuickNote === instruction ? '' : instruction)}>
              <Ionicons name={instruction === 'Fragile' ? 'alert-circle-outline' : 'arrow-up-outline'} size={16} color={selectedQuickNote === instruction ? COLORS.white : COLORS.textSecondary} />
              <Text style={[styles.instructionChipText, selectedQuickNote === instruction && styles.instructionChipTextSelected]}>{instruction}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>ADDITIONAL NOTES</Text>
        <TextInput style={styles.packageDetailsInput} placeholder="Any other special requirements..." placeholderTextColor={COLORS.textSecondary} value={specialInstructions} onChangeText={(val) => state.set('specialInstructions', val)} multiline />

        <Text style={styles.inputLabel}>RECEIVER NAME *</Text>
        <TextInput style={styles.input} placeholder="Receiver full name (required)" placeholderTextColor={COLORS.textSecondary} value={receiverName} onChangeText={(val) => state.set('receiverName', val)} />
        <Text style={styles.inputLabel}>RECEIVER EMAIL *</Text>
        <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Receiver email for OTP delivery (required)" placeholderTextColor={COLORS.textSecondary} value={receiverEmail} onChangeText={(val) => state.set('receiverEmail', val)} keyboardType="email-address" />
        <Text style={styles.inputLabel}>RECEIVER PHONE *</Text>
        <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Receiver phone number (required)" placeholderTextColor={COLORS.textSecondary} value={receiverPhone} onChangeText={(val) => state.set('receiverPhone', val)} keyboardType="phone-pad" />
      </View>

      <TouchableOpacity style={[styles.bookButton, loading && styles.bookButtonDisabled]} onPress={onBookRide} disabled={loading}>
        {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.bookButtonText}>Book • ₺{estimatedPrice}</Text>}
      </TouchableOpacity>
    </>
  );
}