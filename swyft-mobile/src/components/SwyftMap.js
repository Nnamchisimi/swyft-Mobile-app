import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { PROVIDER_DEFAULT } from 'react-native-maps';
import { COLORS } from '../constants/config';

// The native map surface paints blank before its first frame; cover it with a
// themed loading state until the map renders, capped so it can never outlive
// the map itself.
const MAP_OVERLAY_MAX_MS = 5000;

// Catches render-time JS crashes from the map and shows a themed placeholder
// instead of leaving a blank white card. Keyed by the retry count so pressing
// Retry resets the boundary.
class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    console.warn('SwyftMap: map failed to render, showing placeholder.', error, info);
  }

  render() {
    return this.state.crashed ? this.props.fallback : this.props.children;
  }
}

function MapUnavailable({ style, onRetry }) {
  return (
    <View style={[style, styles.unavailable]}>
      <Text style={styles.unavailableText}>Map temporarily unavailable</Text>
      {onRetry ? (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.7}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const SwyftMap = forwardRef(function SwyftMap(props, ref) {
  const {
    style,
    children,
    onMapReady: onMapReadyProp,
    onRegionChangeComplete: onRegionChangeCompleteProp,
    ...rest
  } = props;

  const [mapReady, setMapReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [overlayTimedOut, setOverlayTimedOut] = useState(false);
  const mapNodeRef = useRef(null);

  // Merged ref: keep the native node for callers while still forwarding the
  // caller's ref unchanged (call sites use it for animateToRegion).
  const attachRef = useCallback((node) => {
    mapNodeRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }, [ref]);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
    if (onMapReadyProp) onMapReadyProp();
  }, [onMapReadyProp]);

  // The first settled region is the strongest signal available that MapKit has
  // actually painted a frame.
  const handleRegionChangeComplete = useCallback((event) => {
    setMapReady(true);
    if (onRegionChangeCompleteProp) onRegionChangeCompleteProp(event);
  }, [onRegionChangeCompleteProp]);

  // Retry restarts the map with the native view fully remounted. All state is
  // reset here (event handler), not in an effect.
  const handleRetry = useCallback(() => {
    setMapReady(false);
    setOverlayTimedOut(false);
    setRetryCount((count) => count + 1);
  }, []);

  // Safety cap for the loading overlay: it hides once the map paints, and if
  // that never happens it must not block the map surface forever.
  useEffect(() => {
    if (mapReady || overlayTimedOut) return;
    const overlayCap = setTimeout(() => setOverlayTimedOut(true), MAP_OVERLAY_MAX_MS);
    return () => clearTimeout(overlayCap);
  }, [mapReady, overlayTimedOut, retryCount]);

  const showLoadingOverlay = !mapReady && !overlayTimedOut;

  return (
    <MapErrorBoundary key={`map-boundary-${retryCount}`} fallback={<MapUnavailable style={style} onRetry={handleRetry} />}>
      <View style={style}>
        <MapView
          key={`map-${retryCount}`}
          ref={attachRef}
          style={StyleSheet.absoluteFill}
          {...rest}
          provider={PROVIDER_DEFAULT}
          onMapReady={handleMapReady}
          onRegionChangeComplete={handleRegionChangeComplete}
        >
          {children}
        </MapView>
        {showLoadingOverlay ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingOverlayText}>Loading map…</Text>
          </View>
        ) : null}
      </View>
    </MapErrorBoundary>
  );
});

const styles = StyleSheet.create({
  unavailable: {
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailableText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlayText: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  retryButton: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
});

export default SwyftMap;
