import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ridesAPI } from '../../src/services/api';
import { authService } from '../../src/services/auth';
import { COLORS } from '../../src/constants/config';

export default function RateRideScreen() {
  const router = useRouter();
  const { rideId, driverName, driverVehicle } = useLocalSearchParams();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const handleRate = async (score) => {
    setRating(score);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Required', 'Please select a rating');
      return;
    }

    setLoading(true);
    try {
      const email = await authService.getUserEmail();
      
      await ridesAPI.rateRide(rideId, {
        rating,
        comment: comment.trim(),
        rated_by: 'passenger',
      });

      Alert.alert(
        'Thank you!',
        'Your rating has been submitted. Safe travels!',
        [{ text: 'OK', onPress: () => router.replace('/(passenger)/home') }]
      );
    } catch (error) {
      console.error('Rating error:', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStar = (score) => {
    const isFilled = (hoverRating || rating) >= score;
    return (
      <TouchableOpacity
        key={score}
        onPress={() => handleRate(score)}
        onPressIn={() => setHoverRating(score)}
        onPressOut={() => setHoverRating(0)}
        style={styles.starButton}
      >
        <Text style={[styles.star, isFilled && styles.starFilled]}>
          {isFilled ? '⭐' : '☆'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Rate Your Ride</Text>
        
        <View style={styles.driverInfo}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>
              {(driverName || 'D').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.driverName}>{driverName || 'Driver'}</Text>
          <Text style={styles.driverVehicle}>{driverVehicle || 'Vehicle'}</Text>
        </View>

        <View style={styles.ratingSection}>
          <Text style={styles.ratingQuestion}>How was your ride?</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map(renderStar)}
          </View>
          <Text style={styles.ratingText}>
            {rating === 0 ? 'Tap to rate' : 
             rating === 1 ? 'Terrible' :
             rating === 2 ? 'Bad' :
             rating === 3 ? 'Okay' :
             rating === 4 ? 'Good' :
             rating === 5 ? 'Excellent!' : ''}
          </Text>
        </View>

        <View style={styles.commentSection}>
          <Text style={styles.commentLabel}>Add a comment (optional)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Tell us about your experience..."
            placeholderTextColor={COLORS.textSecondary}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.quickRatings}>
          <Text style={styles.quickRatingsLabel}>Quick tags:</Text>
          <View style={styles.quickTags}>
            {['Friendly', 'Safe', 'Clean', 'On Time', 'Professional'].map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.quickTag,
                  comment.toLowerCase().includes(tag.toLowerCase()) && styles.quickTagActive,
                ]}
                onPress={() => {
                  setComment(comment ? `${comment}, ${tag}` : tag);
                }}
              >
                <Text style={[
                  styles.quickTagText,
                  comment.toLowerCase().includes(tag.toLowerCase()) && styles.quickTagTextActive,
                ]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.submitButtonText}>Submit Rating</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace('/(passenger)/home')}
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  driverInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  driverAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverAvatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  driverName: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  driverVehicle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ratingQuestion: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 40,
    color: COLORS.border,
  },
  starFilled: {
    color: '#FFD700',
  },
  ratingText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  commentSection: {
    marginBottom: 24,
  },
  commentLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  commentInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickRatings: {
    marginBottom: 32,
  },
  quickRatingsLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  quickTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickTag: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickTagActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  quickTagText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  quickTagTextActive: {
    color: COLORS.white,
  },
  submitButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});
