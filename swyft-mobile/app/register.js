import React from 'react';
import { View, StyleSheet } from 'react-native';
import RegisterScreen from '../src/screens/RegisterScreen';
import { COLORS } from '../src/constants/config';

export default function Register() {
  return (
    <View style={styles.container}>
      <RegisterScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});