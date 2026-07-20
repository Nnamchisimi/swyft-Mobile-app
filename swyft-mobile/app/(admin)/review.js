import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminAPI } from '../../src/services/api';
import { COLORS } from '../../src/constants/config';

const statusColor = (status) => {
  if (status === 'verified') return '#4CAF50';
  if (status === 'rejected') return '#F44336';
  return '#FF9800';
};

const SectionCard = ({ title, status, children }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>{title}</Text>
      {status != null && (
        <View style={[styles.badge, { backgroundColor: statusColor(status) }]}>
          <Text style={styles.badgeText}>{status}</Text>
        </View>
      )}
    </View>
    <View style={styles.cardBody}>{children}</View>
  </View>
);

const Img = ({ img, label }) => {
  if (!img || !img.url) {
    return (
      <View style={styles.imgWrap}>
        <Text style={styles.imgLabel}>{label}</Text>
        <Text style={{ color: '#999', fontSize: 12 }}>No image on file</Text>
      </View>
    );
  }
  return (
    <View style={styles.imgWrap}>
      <Text style={styles.imgLabel}>{label}</Text>
      <Image source={{ uri: img.url }} style={styles.image} resizeMode="contain" />
      <Text style={styles.imgSource}>
        source: {img.type === 'base64' ? 'embedded in database' : 'Supabase Storage'}
      </Text>
    </View>
  );
};

export default function AdminReviewScreen() {
  const router = useRouter();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [loadingBundle, setLoadingBundle] = useState(false);
  const [acting, setActing] = useState(false);
  const [message, setMessage] = useState('');
  const [rejectTarget, setRejectTarget] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminAPI.getPendingDrivers();
      setDrivers(res.data || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load drivers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const openDriver = async (driver) => {
    setSelected(driver);
    setBundle(null);
    setRejectTarget('');
    setRejectReason('');
    setMessage('');
    setLoadingBundle(true);
    try {
      const res = await adminAPI.getDriverVerification(driver.email);
      setBundle(res.data);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || e.message);
    } finally {
      setLoadingBundle(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setBundle(null);
  };

  const review = async (kind, decision) => {
    if (!selected) return;
    setActing(true);
    setMessage('');
    try {
      if (kind === 'id-document') await adminAPI.reviewIdDocument(selected.email, decision, rejectReason);
      else if (kind === 'selfie') await adminAPI.reviewSelfie(selected.email, decision, rejectReason);
      else if (kind === 'phone') await adminAPI.reviewPhone(selected.email, decision);
      else if (kind === 'bank') await adminAPI.reviewBank(selected.email, decision, rejectReason);
      setMessage(`${kind} ${decision === 'approve' ? 'approved' : 'rejected'}`);
      setRejectTarget('');
      setRejectReason('');
      await openDriver(selected);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || e.message);
    } finally {
      setActing(false);
    }
  };

  const approveAll = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await adminAPI.reviewIdDocument(selected.email, 'approve');
      await adminAPI.reviewSelfie(selected.email, 'approve');
      await adminAPI.reviewPhone(selected.email, 'approve');
      await adminAPI.reviewBank(selected.email, 'approve');
      setMessage('All sections approved');
      await openDriver(selected);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || e.message);
    } finally {
      setActing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack && router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(auth)/signin');
            }
          }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Verification Review</Text>
        <View style={{ width: 24 }} />
      </View>

      {!selected && (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDrivers} />}
        >
          {loading && <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.primary} />}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {!loading && !error && drivers.length === 0 && (
            <Text style={styles.emptyText}>No drivers pending review.</Text>
          )}
          {drivers.map((d) => (
            <TouchableOpacity key={d.id} style={styles.driverRow} onPress={() => openDriver(d)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{d.first_name} {d.last_name}</Text>
                <Text style={styles.driverSub}>{d.email}</Text>
                <Text style={styles.driverSub}>{d.phone || ''}</Text>
              </View>
              {d.is_approved ? (
                <View style={[styles.badge, { backgroundColor: '#4CAF50' }]}>
                  <Text style={styles.badgeText}>Approved</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {selected && (
        <ScrollView style={styles.detail}>
          {message ? (
            <View style={[styles.banner, { backgroundColor: message.startsWith('Error') ? '#F44336' : '#4CAF50' }]}>
              <Text style={{ color: '#fff' }}>{message}</Text>
            </View>
          ) : null}

          {loadingBundle && <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.primary} />}

          {bundle && (
            <>
              <SectionCard title="Driver">
                <Text style={styles.field}>Email: {bundle.driver.email}</Text>
                <Text style={styles.field}>Phone: {bundle.driver.phone || '—'}</Text>
                <Text style={styles.field}>
                  Registered: {new Date(bundle.driver.created_at).toLocaleString()}
                </Text>
              </SectionCard>

              <SectionCard title="ID Document" status={bundle.id_document?.verification_status}>
                {bundle.id_document ? (
                  <>
                    <Text style={styles.field}>Type: {bundle.id_document.document_type}</Text>
                    <Text style={styles.field}>Number: {bundle.id_document.document_number}</Text>
                    <Text style={styles.field}>Expiry: {bundle.id_document.expiry_date || '—'}</Text>
                    {bundle.id_document.rejection_reason ? (
                      <Text style={{ color: '#F44336' }}>Reason: {bundle.id_document.rejection_reason}</Text>
                    ) : null}
                    <View style={styles.imgRow}>
                      <Img img={bundle.id_document.front_image} label="Front" />
                      <Img img={bundle.id_document.back_image} label="Back" />
                    </View>
                  </>
                ) : (
                  <Text style={styles.field}>Not submitted</Text>
                )}
              </SectionCard>

              <SectionCard title="Selfie" status={bundle.selfie?.verification_status}>
                {bundle.selfie ? (
                  <>
                    {bundle.selfie.match_confidence != null && (
                      <Text style={styles.field}>Match confidence: {bundle.selfie.match_confidence}%</Text>
                    )}
                    {bundle.selfie.rejection_reason ? (
                      <Text style={{ color: '#F44336' }}>Reason: {bundle.selfie.rejection_reason}</Text>
                    ) : null}
                    <View style={styles.imgRow}>
                      <Img img={bundle.selfie.selfie_image} label="Selfie" />
                      <Img img={bundle.selfie.id_document_image} label="ID Used For Match" />
                    </View>
                  </>
                ) : (
                  <Text style={styles.field}>Not submitted</Text>
                )}
              </SectionCard>

              <SectionCard title="Phone" status={bundle.phone?.is_verified ? 'verified' : 'pending'}>
                {bundle.phone ? (
                  <>
                    <Text style={styles.field}>Number: {bundle.phone.phone_number}</Text>
                    <Text style={styles.field}>Verified: {bundle.phone.is_verified ? 'Yes' : 'No'}</Text>
                  </>
                ) : (
                  <Text style={styles.field}>Not submitted</Text>
                )}
              </SectionCard>

              <SectionCard title="Bank Account" status={bundle.bank_account?.verification_status}>
                {bundle.bank_account ? (
                  <>
                    <Text style={styles.field}>Bank: {bundle.bank_account.bank_name}</Text>
                    <Text style={styles.field}>Holder: {bundle.bank_account.account_holder_name}</Text>
                    <Text style={styles.field}>Account: {bundle.bank_account.account_number}</Text>
                    {bundle.bank_account.routing_number ? (
                      <Text style={styles.field}>Routing: {bundle.bank_account.routing_number}</Text>
                    ) : null}
                    {bundle.bank_account.iban ? (
                      <Text style={styles.field}>IBAN: {bundle.bank_account.iban}</Text>
                    ) : null}
                    {bundle.bank_account.swift_code ? (
                      <Text style={styles.field}>Swift: {bundle.bank_account.swift_code}</Text>
                    ) : null}
                    {bundle.bank_account.rejection_reason ? (
                      <Text style={{ color: '#F44336' }}>Reason: {bundle.bank_account.rejection_reason}</Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.field}>Not submitted</Text>
                )}
              </SectionCard>

              {rejectTarget ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Rejection reason for {rejectTarget}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Reason (optional)"
                    value={rejectReason}
                    onChangeText={setRejectReason}
                  />
                </View>
              ) : null}
            </>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.closeBtn]} onPress={closeDetail}>
              <Text style={styles.btnTextDark}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.approveAllBtn]} disabled={acting} onPress={approveAll}>
              <Text style={styles.btnText}>Approve All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionsWrap}>
            {['id-document', 'selfie', 'phone', 'bank'].map((kind) => (
              <View key={kind} style={styles.actionGroup}>
                <TouchableOpacity
                  style={[styles.btn, styles.approveBtn]}
                  disabled={acting}
                  onPress={() => review(kind, 'approve')}
                >
                  <Text style={styles.btnText}>Approve {kind.split('-')[0]}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.rejectBtn]}
                  disabled={acting}
                  onPress={() => {
                    setRejectTarget(kind);
                    review(kind, 'reject');
                  }}
                >
                  <Text style={styles.btnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  list: { flex: 1, padding: 12 },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  driverName: { fontSize: 16, fontWeight: 'bold', color: '#212121' },
  driverSub: { fontSize: 13, color: '#757575' },
  errorText: { color: '#F44336', textAlign: 'center', marginTop: 20 },
  emptyText: { textAlign: 'center', marginTop: 30, color: '#757575' },
  detail: { flex: 1, padding: 12 },
  banner: { padding: 10, borderRadius: 8, marginBottom: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#212121' },
  cardBody: {},
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  field: { fontSize: 14, color: '#424242', marginBottom: 2 },
  imgRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  imgWrap: { flex: 1 },
  imgLabel: { fontSize: 12, fontWeight: 'bold', color: '#757575', marginBottom: 4 },
  image: { width: '100%', height: 160, backgroundColor: '#111', borderRadius: 8 },
  imgSource: { fontSize: 10, color: '#9E9E9E', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionsWrap: { marginTop: 12, marginBottom: 30 },
  actionGroup: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  btnTextDark: { color: '#212121', fontWeight: 'bold' },
  approveBtn: { backgroundColor: '#4CAF50' },
  rejectBtn: { backgroundColor: '#F44336' },
  approveAllBtn: { backgroundColor: '#2196F3' },
  closeBtn: { backgroundColor: '#E0E0E0' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    backgroundColor: '#fff',
  },
});
