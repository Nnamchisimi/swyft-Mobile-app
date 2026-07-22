import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/config';
import geoService from '../../services/geo';
import { interCityRoutesData, defaultVehicleTypes } from '../constants';
import { calculateDistance, getPlaceDetails, getRouteCoordinates } from '../location';

const { width } = Dimensions.get('window');

const SIZE_TO_VEHICLE = { Small: 'motorcycle', Medium: 'sedan', Large: 'truck' };
const VEHICLE_LABEL = { motorcycle: 'Motorcycle', sedan: 'Sedan', truck: 'Van/Truck' };
const VEHICLE_ICON = { motorcycle: 'bicycle', sedan: 'car-sport', truck: 'bus' };

export function BookingForm({ state, styles, mapRef, onPickupChange, onDropoffChange, onPickupSelect, onDropoffSelect, onGetCurrentLocation, onBookRide }) {
  const {
    currentLocation, pickupLocation, pickupAddress, dropoffLocation, dropoffAddress,
    pickupSuggestions, dropoffSuggestions, showPickupSuggestions, showDropoffSuggestions,
    selectedRideType, selectedVehicleType, interCityMode, interCityRoute,
    rideTypes, vehicleTypes, packageType, packageSize, packageDetails, specialInstructions,
    selectedQuickNote, receiverName, receiverEmail, receiverPhone,
    pricingLoaded, estimatedPrice, priceBreakdownExpanded,
    locationLoading, loading
  } = state;

  const assignedVehicleId = packageSize ? SIZE_TO_VEHICLE[packageSize] : null;
  const assignedVehicle = assignedVehicleId ? defaultVehicleTypes.find(v => v.id === assignedVehicleId) : null;

  const canBook = selectedRideType && assignedVehicleId && pickupAddress && dropoffLocation && receiverName?.trim() && receiverEmail?.trim() && receiverPhone?.trim() && !loading;

  return (
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        {['Location', 'Route', 'Package', 'Details'].map((step, i) => (
          <View key={step} style={styles.stepItem}>
            <View style={[styles.stepCircle, i <= 2 ? styles.stepCircleActive : styles.stepCircleInactive]}>
              <Text style={[styles.stepNumber, i <= 2 && styles.stepNumberActive]}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, i <= 2 && styles.stepLabelActive]}>{step}</Text>
            {i < 3 && <View style={[styles.stepLine, i < 2 ? styles.stepLineActive : styles.stepLineInactive]} />}
          </View>
        ))}
      </View>

      {/* Map */}
      <View style={styles.mapCard}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapHeaderTitle}>Delivery Route</Text>
          {pickupAddress && dropoffAddress && (
            <View style={styles.mapBadge}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
              <Text style={styles.mapBadgeText}>Route ready</Text>
            </View>
          )}
        </View>
        {currentLocation ? (
          <MapView ref={mapRef} style={styles.map} provider={PROVIDER_GOOGLE} initialRegion={{
            latitude: (pickupLocation || currentLocation)?.latitude,
            longitude: (pickupLocation || currentLocation)?.longitude,
            latitudeDelta: 0.05, longitudeDelta: 0.05,
          }} showsUserLocation showsMyLocationButton showsCompass>
            {pickupLocation && <Marker coordinate={{ latitude: pickupLocation.latitude, longitude: pickupLocation.longitude }} title="Pickup" pinColor={COLORS.success} />}
            {dropoffLocation && <Marker coordinate={{ latitude: dropoffLocation.latitude, longitude: dropoffLocation.longitude }} title="Dropoff" pinColor={COLORS.error} />}
            {state.driverLocation && <Marker coordinate={{ latitude: state.driverLocation.latitude, longitude: state.driverLocation.longitude }} title="Courier"><View style={styles.driverMarkerStyle}><Ionicons name="car" size={14} color="white" /></View></Marker>}
            {(pickupLocation && dropoffLocation) && <Polyline coordinates={[pickupLocation, dropoffLocation]} strokeColor={COLORS.primary} strokeWidth={4} />}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.mapPlaceholderText}>Getting your location...</Text>
          </View>
        )}
      </View>

      {/* Location Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: COLORS.primary + '15' }]}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.cardTitle}>Pickup & Dropoff</Text>
            <Text style={styles.cardSubtitle}>Where should we pick up and deliver?</Text>
          </View>
        </View>

        <View style={styles.locationInputs}>
          <View style={styles.inputRow}>
            <View style={[styles.inputDot, { backgroundColor: COLORS.success }]} />
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>PICKUP LOCATION</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Enter pickup address" 
                placeholderTextColor={COLORS.textSecondary} 
                value={pickupAddress} 
                onChangeText={onPickupChange} 
                onFocus={() => state.set('showPickupSuggestions', true)} 
              />
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
              <Text style={styles.inputLabel}>DROPOFF LOCATION</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Package destination" 
                placeholderTextColor={COLORS.textSecondary} 
                value={dropoffAddress} 
                onChangeText={onDropoffChange} 
                onFocus={() => state.set('showDropoffSuggestions', true)} 
              />
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
        </View>

        <TouchableOpacity style={styles.locationButton} onPress={onGetCurrentLocation} disabled={locationLoading}>
          {locationLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <>
            <Ionicons name="navigate" size={18} color={COLORS.primary} />
            <Text style={styles.locationButtonText}>Use Current Location</Text>
          </>}
        </TouchableOpacity>
      </View>

      {/* Mode Toggle */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Delivery Type</Text>
        <Text style={styles.cardSubtitle}>Choose between city hub or inter-city delivery</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity 
            style={[styles.toggleButton, !interCityMode && styles.toggleButtonActive]} 
            onPress={() => { state.set('interCityMode', false); state.set('interCityRoute', ''); state.set('selectedRideType', ''); }}
          >
            <Ionicons name="business" size={20} color={!interCityMode ? COLORS.white : COLORS.textSecondary} />
            <Text style={[styles.toggleText, !interCityMode && styles.toggleTextActive]}>City Hub</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, interCityMode && styles.toggleButtonActive]} 
            onPress={() => { state.set('interCityMode', true); state.set('interCityRoute', ''); state.set('selectedRideType', ''); }}
          >
            <Ionicons name="airplane" size={20} color={interCityMode ? COLORS.white : COLORS.textSecondary} />
            <Text style={[styles.toggleText, interCityMode && styles.toggleTextActive]}>Inter-City</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Route Selection */}
      {interCityMode ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Choose Route</Text>
          <Text style={styles.cardSubtitle}>Select your inter-city route</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.routeScroll}>
            {interCityRoutesData.map((route) => (
              <TouchableOpacity 
                key={route.id} 
                style={[styles.routeCard, interCityRoute === route.id && styles.routeCardSelected]} 
                onPress={() => state.set('interCityRoute', route.id)}
              >
                <View style={[styles.routeIconBox, interCityRoute === route.id && styles.routeIconBoxSelected]}>
                  <Ionicons name="location" size={22} color={interCityRoute === route.id ? COLORS.white : COLORS.primary} />
                </View>
                <Text style={[styles.routeName, interCityRoute === route.id && styles.routeNameSelected]}>{route.name}</Text>
                <Text style={styles.routeTime}>{route.time}</Text>
                <Text style={[styles.routePrice, interCityRoute === route.id && styles.routePriceSelected]}>₺{route.basePrice}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Choose City Hub</Text>
          <Text style={styles.cardSubtitle}>Select your delivery area</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.routeScroll}>
            {rideTypes.map((ride) => (
              <TouchableOpacity 
                key={ride.id} 
                style={[styles.routeCard, selectedRideType === ride.id && styles.routeCardSelected]} 
                onPress={() => state.set('selectedRideType', ride.id)}
              >
                <View style={[styles.routeIconBox, selectedRideType === ride.id && styles.routeIconBoxSelected]}>
                  <Ionicons name="location" size={22} color={selectedRideType === ride.id ? COLORS.white : COLORS.primary} />
                </View>
                <Text style={[styles.routeName, selectedRideType === ride.id && styles.routeNameSelected]}>{ride.name}</Text>
                <Text style={styles.routeTime}>{ride.time}</Text>
                {pricingLoaded ? (
                  <Text style={[styles.routePrice, selectedRideType === ride.id && styles.routePriceSelected]}>₺{ride.basePrice}</Text>
                ) : (
                  <Text style={styles.routePrice}>₺...</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Vehicle Assignment */}
      {(interCityRoute || selectedRideType) && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: COLORS.success + '15' }]}>
              <Ionicons name="car" size={20} color={COLORS.success} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Vehicle Assigned</Text>
              <Text style={styles.cardSubtitle}>Based on your package size</Text>
            </View>
          </View>
          {assignedVehicle ? (
            <View style={styles.vehicleBadgeRow}>
              <View style={styles.vehicleBadge}>
                <Ionicons name={VEHICLE_ICON[assignedVehicle.id]} size={22} color={COLORS.primary} />
                <View style={styles.vehicleBadgeText}>
                  <Text style={styles.vehicleBadgeName}>{assignedVehicle.name}</Text>
                  <Text style={styles.vehicleBadgeDesc}>{assignedVehicle.desc}</Text>
                </View>
              </View>
              <View style={styles.vehiclePriceBadge}>
                <Text style={styles.vehiclePriceText}>+₺{assignedVehicle.price}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.vehiclePlaceholder}>
              <Ionicons name="cube-outline" size={32} color={COLORS.textSecondary} />
              <Text style={styles.vehiclePlaceholderText}>Select package size to see assigned vehicle</Text>
            </View>
          )}
        </View>
      )}

      {/* Package Details */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: COLORS.secondary + '15' }]}>
            <Ionicons name="cube" size={20} color={COLORS.secondary} />
          </View>
          <View>
            <Text style={styles.cardTitle}>Package Details</Text>
            <Text style={styles.cardSubtitle}>Help us match the right courier</Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>PACKAGE TYPE</Text>
        <View style={styles.chipRow}>
          {['Food', 'Document', 'Parcel'].map((type) => (
            <TouchableOpacity 
              key={type} 
              style={[styles.chip, packageType === type && styles.chipActive]} 
              onPress={() => state.set('packageType', type)}
            >
              <Ionicons 
                name={type === 'Food' ? 'fast-food' : type === 'Document' ? 'document' : 'cube'} 
                size={16} 
                color={packageType === type ? COLORS.white : COLORS.textSecondary} 
              />
              <Text style={[styles.chipText, packageType === type && styles.chipTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {packageType && (
          <>
            <Text style={styles.fieldLabel}>PACKAGE DETAILS</Text>
            <TextInput 
              style={styles.textArea} 
              placeholder={packageType === 'Food' ? 'e.g., Pizza, Burgers, Groceries...' : packageType === 'Document' ? 'Envelope, Folder, ID card...' : 'Electronics, Clothes, Books...'} 
              placeholderTextColor={COLORS.textSecondary} 
              value={packageDetails} 
              onChangeText={(val) => state.set('packageDetails', val)} 
              multiline 
            />
          </>
        )}

        <Text style={styles.fieldLabel}>PACKAGE SIZE</Text>
        <View style={styles.sizeRow}>
          {[
            { key: 'Small', label: 'Small', icon: 'cube-outline', desc: 'Backpack / Small box' },
            { key: 'Medium', label: 'Medium', icon: 'cube', desc: 'Car trunk / Large box' },
            { key: 'Large', label: 'Large', icon: 'cube-sharp', desc: 'Van / Truck needed' },
          ].map((item) => (
            <TouchableOpacity 
              key={item.key} 
              style={[styles.sizeCard, packageSize === item.key && styles.sizeCardSelected]} 
              onPress={() => state.set('packageSize', item.key)}
            >
              <Ionicons name={item.icon} size={24} color={packageSize === item.key ? COLORS.white : COLORS.textSecondary} />
              <Text style={[styles.sizeLabel, packageSize === item.key && styles.sizeLabelSelected]}>{item.label}</Text>
              <Text style={[styles.sizeDesc, packageSize === item.key && styles.sizeDescSelected]}>{item.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>SPECIAL INSTRUCTIONS</Text>
        <View style={styles.chipRow}>
          {['Fragile', 'Keep upright'].map((instruction) => (
            <TouchableOpacity 
              key={instruction} 
              style={[styles.chip, styles.chipOutline, selectedQuickNote === instruction && styles.chipOutlineActive]} 
              onPress={() => state.set('selectedQuickNote', selectedQuickNote === instruction ? '' : instruction)}
            >
              <Ionicons name={instruction === 'Fragile' ? 'alert-circle-outline' : 'arrow-up-outline'} size={16} color={selectedQuickNote === instruction ? COLORS.white : COLORS.textSecondary} />
              <Text style={[styles.chipText, selectedQuickNote === instruction && styles.chipTextActive]}>{instruction}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>ADDITIONAL NOTES</Text>
        <TextInput 
          style={styles.textArea} 
          placeholder="Any other special requirements..." 
          placeholderTextColor={COLORS.textSecondary} 
          value={specialInstructions} 
          onChangeText={(val) => state.set('specialInstructions', val)} 
          multiline 
        />
      </View>

      {/* Receiver Details */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: COLORS.error + '15' }]}>
            <Ionicons name="person" size={20} color={COLORS.error} />
          </View>
          <View>
            <Text style={styles.cardTitle}>Receiver Details</Text>
            <Text style={styles.cardSubtitle}>OTP will be sent to confirm delivery</Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>RECEIVER NAME *</Text>
        <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={COLORS.textSecondary} value={receiverName} onChangeText={(val) => state.set('receiverName', val)} />

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>RECEIVER EMAIL *</Text>
        <TextInput style={styles.input} placeholder="Email for OTP delivery" placeholderTextColor={COLORS.textSecondary} value={receiverEmail} onChangeText={(val) => state.set('receiverEmail', val)} keyboardType="email-address" />

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>RECEIVER PHONE *</Text>
        <TextInput style={styles.input} placeholder="Phone number" placeholderTextColor={COLORS.textSecondary} value={receiverPhone} onChangeText={(val) => state.set('receiverPhone', val)} keyboardType="phone-pad" />
      </View>

      {/* Price Summary */}
      <View style={styles.card}>
        <TouchableOpacity style={styles.priceHeader} onPress={() => state.set('priceBreakdownExpanded', !state.priceBreakdownExpanded)}>
          <View style={styles.priceHeaderLeft}>
            <Ionicons name="receipt" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Price Summary</Text>
          </View>
          <View style={styles.priceHeaderRight}>
            <Text style={styles.totalPriceValue}>₺{estimatedPrice}</Text>
            <Ionicons name={priceBreakdownExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textSecondary} />
          </View>
        </TouchableOpacity>

        {priceBreakdownExpanded && (
          <View style={styles.priceBreakdown}>
            {interCityRoute ? (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Route Fare</Text>
                <Text style={styles.priceValue}>₺{interCityRoutesData.find(r => r.id === interCityRoute)?.basePrice || 0}</Text>
              </View>
            ) : (
              selectedRideType && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>City Hub Base Fare</Text>
                  <Text style={styles.priceValue}>₺{rideTypes.find(r => r.id === selectedRideType)?.basePrice || 0}</Text>
                </View>
              )
            )}
            {assignedVehicle && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Vehicle Fee</Text>
                <Text style={styles.priceValue}>₺{assignedVehicle.price}</Text>
              </View>
            )}
            <View style={styles.priceDivider} />
            <View style={styles.priceRow}>
              <Text style={styles.priceTotalLabel}>Total Estimated</Text>
              <Text style={styles.priceTotalValue}>₺{estimatedPrice}</Text>
            </View>
          </View>
        )}
        <Text style={styles.priceNote}>Final price may vary based on actual route and conditions</Text>
      </View>

      {/* Book Button */}
      <TouchableOpacity 
        style={[styles.bookButton, (!canBook || loading) && styles.bookButtonDisabled]} 
        onPress={() => onBookRide(state)} 
        disabled={!canBook || loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <>
            <Ionicons name="send" size={20} color={COLORS.white} />
            <Text style={styles.bookButtonText}>
              {canBook ? `Book Courier • ₺${estimatedPrice}` : 'Book Courier'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
