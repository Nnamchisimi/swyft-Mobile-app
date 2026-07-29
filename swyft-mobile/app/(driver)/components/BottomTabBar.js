import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../src/constants/config';

const tabs = [
  {
    name: 'dashboard',
    label: 'Home',
    icon: 'home',
    iconOutline: 'home-outline',
  },
  {
    name: 'deliveries',
    label: 'Deliveries',
    icon: 'cube',
    iconOutline: 'cube-outline',
  },
  {
    name: 'earnings',
    label: 'Earnings',
    icon: 'wallet',
    iconOutline: 'wallet-outline',
  },
  {
    name: 'account',
    label: 'Account',
    icon: 'person',
    iconOutline: 'person-outline',
  },
];

export default function DriverBottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = pathname === `/${tab.name}`;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => router.push(`/(driver)/${tab.name}`)}
          >
            <Ionicons
              name={isActive ? tab.icon : tab.iconOutline}
              size={24}
              color={isActive ? COLORS.primary : '#6B7280'}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 10,
    paddingHorizontal: 8,
    paddingBottom: 18,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  labelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
