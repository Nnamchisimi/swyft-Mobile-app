import React from 'react';
import { View, StyleSheet } from 'react-native';
import SignInScreen from '../src/screens/SignInScreen';
import { COLORS } from '../src/constants/config';

export default function SignIn() {
  return (
    <View style={styles.container}>
      <SignInScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});