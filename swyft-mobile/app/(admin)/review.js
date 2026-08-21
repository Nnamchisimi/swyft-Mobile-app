import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl,
  TextInput,
  Modal,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminAPI } from '../../src/services/api';
import authService from '../../src/services/auth';
import { COLORS } from '../../src/constants/config';

  const SECTIONS = [
    { key: 'id-document', label: 'ID Document' },
    { key: 'selfie', label: 'Selfie Verification' },
    { key: 'phone', label: 'Phone Number' },
    { key: 'bank', label: 'Bank Account' },
    { key: 'car', label: 'Vehicle' },
  ];

const statusColor = (status) => {
  if (status === 'verified' || status === 'approved') return '#4CAF50';
  if (status === 'rejected') return '#F44336';
  return '#FF9800';
};

const statusLabel = (status) => {
  if (status === 'verified' || status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'pending') return 'Pending';
  return 'Pending';
};

const getStatus = (bundle, key) => {
  const node = bundle[key];
  if (!node) return 'pending';
  if (key === 'phone') return node.is_verified ? 'verified' : 'pending';
  if (key === 'car') return node.make ? 'verified' : 'pending';
  return node.verification_status || 'pending';
};

const getReason = (bundle, key) => {
  const node = bundle[key];
  if (!node) return '';
  return node.rejection_reason || '';
};

const StatusBadge = ({ status }) => (
  <View style={[styles.badge, { backgroundColor: statusColor(status) }]}>
    <Text style={styles.badgeText}>{statusLabel(status)}</Text>
  </View>
);

const Img = ({ img, label }) => {
  if (!img || !img.url) {
    return (
      <View style={styles.imgWrap}>
        <Text style={styles.imgLabel}>{label}</Text>
        <View style={styles.imgPlaceholder}>
          <Ionicons name="image-outline" size={28} color="#bbb" />
          <Text style={styles.imgPlaceholderText}>No image</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.imgWrap}>
      <Text style={styles.imgLabel}>{label}</Text>
      <Image source={{ uri: img.url }} style={styles.image} resizeMode="contain" />
      <Text style={styles.imgSource}>
        {img.type === 'base64' ? 'embedded in database' : 'Supabase Storage'}
      </Text>
    </View>
  );
};

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value || '—'}</Text>
  </View>
);

export default function AdminReviewScreen() {
  const router = useRouter();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [loadingBundle, setLoadingBundle] = useState(false);
  const [acting, setActing] = useState(false);
  const [banner, setBanner] = useState({ text: '', type: '' });
  const [rejectFor, setRejectFor] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const [view, setView] = useState('pending'); // 'pending' | 'withdrawals' | 'archive'
  const [withdrawals, setWithdrawals] = useState([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState('');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [processNotes, setProcessNotes] = useState('');
  const [transferReference, setTransferReference] = useState('');
  const [actingWithdrawal, setActingWithdrawal] = useState(false);

  const [archived, setArchived] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [archiveDetail, setArchiveDetail] = useState(null);

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

  const loadArchived = useCallback(async () => {
    setLoadingArchived(true);
    try {
      const res = await adminAPI.getArchivedDrivers();
      setArchived(res.data || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load archive');
    } finally {
      setLoadingArchived(false);
    }
  }, []);

  const loadWithdrawals = useCallback(async () => {
    setLoadingWithdrawals(true);
    setWithdrawalError('');
    try {
      const res = await adminAPI.getWithdrawals();
      setWithdrawals(res.data || []);
    } catch (e) {
      setWithdrawalError(e.response?.data?.error || e.message || 'Failed to load withdrawals');
    } finally {
      setLoadingWithdrawals(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'withdrawals') loadWithdrawals();
  }, [view, loadWithdrawals]);

  useEffect(() => {
    if (view === 'archive') loadArchived();
  }, [view, loadArchived]);

  const archiveDriver = async (decision) => {
    if (!selected) return;
    try {
      await adminAPI.archiveDriver(selected.email, decision);
    } catch (e) {
      // archive failure shouldn't block the review action
      console.warn('Archive failed:', e?.response?.data?.error || e.message);
    }
  };

  const openDriver = async (driver) => {
    setSelected(driver);
    setBundle(null);
    setRejectFor('');
    setRejectReason('');
    setBanner({ text: '', type: '' });
    setLoadingBundle(true);
    try {
      const res = await adminAPI.getDriverVerification(driver.email);
      setBundle(res.data);
    } catch (e) {
      setBanner({ text: e.response?.data?.error || e.message || 'Failed to load driver', type: 'error' });
    } finally {
      setLoadingBundle(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setBundle(null);
    setRejectFor('');
    setRejectReason('');
    setBanner({ text: '', type: '' });
  };

  const review = async (kind, decision) => {
    if (!selected) return;
    if (!bundle || !bundle[kind]) {
      setBanner({ text: `${SECTIONS.find((s) => s.key === kind)?.label || kind} has no submission to review`, type: 'error' });
      return;
    }
    setActing(true);
    setBanner({ text: '', type: '' });
    try {
      if (kind === 'id-document') await adminAPI.reviewIdDocument(selected.email, decision, rejectReason);
      else if (kind === 'selfie') await adminAPI.reviewSelfie(selected.email, decision, rejectReason);
      else if (kind === 'phone') await adminAPI.reviewPhone(selected.email, decision);
      else if (kind === 'bank') await adminAPI.reviewBank(selected.email, decision, rejectReason);
      else if (kind === 'car') {
        if (decision === 'approve') {
          await adminAPI.archiveDriver(selected.email, 'approved');
        } else {
          await adminAPI.archiveDriver(selected.email, 'rejected');
        }
      }
      const label = SECTIONS.find((s) => s.key === kind)?.label || kind;
      setBanner({
        text: `${label} ${decision === 'approve' ? 'approved' : 'rejected'}`,
        type: decision === 'approve' ? 'success' : 'error',
      });
      if (kind !== 'car') {
        await archiveDriver(decision === 'approve' ? 'approved' : 'rejected');
      }
      setRejectFor('');
      setRejectReason('');
      await openDriver(selected);
    } catch (e) {
      setBanner({ text: e.response?.data?.error || e.message || 'Action failed', type: 'error' });
    } finally {
      setActing(false);
    }
  };

  const approveAll = async () => {
    if (!selected) return;
    setActing(true);
    setBanner({ text: '', type: '' });
    try {
      await adminAPI.reviewIdDocument(selected.email, 'approve');
      await adminAPI.reviewSelfie(selected.email, 'approve');
      await adminAPI.reviewPhone(selected.email, 'approve');
      await adminAPI.reviewBank(selected.email, 'approve');
      setBanner({ text: 'All sections approved', type: 'success' });
      await archiveDriver('approved');
      await openDriver(selected);
    } catch (e) {
      setBanner({ text: e.response?.data?.error || e.message || 'Action failed', type: 'error' });
    } finally {
      setActing(false);
    }
  };

  const pendingCount = bundle
    ? SECTIONS.filter((s) => getStatus(bundle, s.key) === 'pending').length
    : 0;
  const doneCount = bundle ? SECTIONS.length - pendingCount : 0;

  const confirmReject = (kind) => {
    setRejectFor(kind);
    setRejectReason(getReason(bundle, kind) || '');
  };

  const submitReject = () => {
    const kind = rejectFor;
    setRejectFor('');
    review(kind, 'reject');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.brandName}>SWYFTinc</Text>
          <Text style={styles.headerTitle}>Moderator Review</Text>
        </View>
        <TouchableOpacity
          style={styles.headerLogoutBtn}
          onPress={() =>
            Alert.alert('Logout', 'Are you sure you want to logout?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                  await authService.logout();
                  router.replace('/(auth)/signin');
                },
              },
            ])
          }
        >
          <Ionicons name="log-out-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, view === 'pending' && styles.tabActive]}
          onPress={() => { setView('pending'); setSelected(null); setBundle(null); }}
        >
          <Text style={[styles.tabText, view === 'pending' && styles.tabTextActive]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, view === 'withdrawals' && styles.tabActive]}
          onPress={() => { setView('withdrawals'); setSelected(null); setBundle(null); }}
        >
          <Text style={[styles.tabText, view === 'withdrawals' && styles.tabTextActive]}>Withdrawals</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, view === 'archive' && styles.tabActive]}
          onPress={() => { setView('archive'); setSelected(null); setBundle(null); }}
        >
          <Text style={[styles.tabText, view === 'archive' && styles.tabTextActive]}>Archive</Text>
        </TouchableOpacity>
      </View>

      {!selected && !archiveDetail && view === 'pending' && (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDrivers} />}
        >
          <Text style={styles.sectionHint}>Drivers awaiting verification</Text>
          {loading && <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.primary} />}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {!loading && !error && Array.isArray(drivers) && drivers.length === 0 && (
            <View style={styles.emptyWrap}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color="#4CAF50" />
              <Text style={styles.emptyText}>All caught up. No drivers pending review.</Text>
            </View>
          )}
          {Array.isArray(drivers) && drivers.map((d) => (
            <TouchableOpacity key={d.id} style={styles.driverRow} onPress={() => openDriver(d)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(d.first_name?.[0] || '') + (d.last_name?.[0] || '')}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.driverName}>
                  {d.first_name} {d.last_name}
                </Text>
                <Text style={styles.driverSub}>{d.email}</Text>
                <Text style={styles.driverSub}>{d.phone || ''}</Text>
                {d.is_approved ? (
                  <View style={[styles.badge, { backgroundColor: '#4CAF50' }]}>
                    <Text style={styles.badgeText}>Approved</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!selected && !archiveDetail && view === 'withdrawals' && (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={loadingWithdrawals} onRefresh={loadWithdrawals} />}
        >
          <Text style={styles.sectionHint}>Driver withdrawal requests</Text>
          {loadingWithdrawals && <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.primary} />}
          {withdrawalError ? <Text style={styles.errorText}>{withdrawalError}</Text> : null}
          {!loadingWithdrawals && !withdrawalError && withdrawals.length === 0 && (
            <View style={styles.emptyWrap}>
              <Ionicons name="cash-outline" size={48} color="#FF9800" />
              <Text style={styles.emptyText}>No withdrawal requests yet.</Text>
            </View>
          )}
          {withdrawals.map((w) => (
            <View key={w.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>₺{Number(w.amount).toFixed(2)}</Text>
                <View style={[styles.badge, { backgroundColor: w.status === 'PAID' ? '#4CAF50' : w.status === 'REJECTED' ? '#F44336' : w.status === 'PROCESSING' ? '#2196F3' : '#FF9800' }]}>
                  <Text style={styles.badgeText}>{w.status}</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <DetailRow label="Driver" value={`${w.driver_name || ''} ${w.driver_email ? `(${w.driver_email})` : ''}`} />
                <DetailRow label="Bank" value={w.bank_name || '—'} />
                <DetailRow label="IBAN" value={w.iban || '—'} />
                <DetailRow label="Holder" value={w.account_holder_name || '—'} />
                <DetailRow label="Requested" value={w.created_at ? new Date(w.created_at).toLocaleString() : '—'} />
                {w.processed_at ? <DetailRow label="Processed" value={new Date(w.processed_at).toLocaleString()} /> : null}
                {w.admin_notes ? <DetailRow label="Notes" value={w.admin_notes} /> : null}
                {w.transfer_reference ? <DetailRow label="Reference" value={w.transfer_reference} /> : null}
              </View>
              {w.status === 'PENDING' && (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => setSelectedWithdrawal(w)}
                  >
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Process</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={async () => {
                      setActingWithdrawal(true);
                      try {
                        await adminAPI.rejectWithdrawal(w.id, { admin_email: 'admin@swyft.com', admin_notes: 'Rejected from admin' });
                        await loadWithdrawals();
                      } catch (e) {
                        Alert.alert('Error', e.response?.data?.error || e.message || 'Failed to reject');
                      } finally {
                        setActingWithdrawal(false);
                      }
                    }}
                    disabled={actingWithdrawal}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
              {w.status === 'PROCESSING' && (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => setSelectedWithdrawal(w)}
                  >
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Mark as Paid</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {selectedWithdrawal && (
        <ScrollView style={styles.detail}>
          <View style={styles.banner}>
            <Ionicons name="cash" size={18} color="#fff" />
            <Text style={styles.bannerText}>Withdrawal #{selectedWithdrawal.id}</Text>
          </View>

          <View style={styles.driverCard}>
            <View style={styles.avatarLg}>
              <Text style={styles.avatarTextLg}>₺</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverCardName}>₺{Number(selectedWithdrawal.amount).toFixed(2)}</Text>
              <Text style={styles.driverCardSub}>{selectedWithdrawal.driver_name || 'Driver'} · {selectedWithdrawal.driver_email}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: selectedWithdrawal.status === 'PAID' ? '#4CAF50' : selectedWithdrawal.status === 'REJECTED' ? '#F44336' : selectedWithdrawal.status === 'PROCESSING' ? '#2196F3' : '#FF9800' }]}>
              <Text style={styles.badgeText}>{selectedWithdrawal.status}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bank Details</Text>
            <View style={styles.cardBody}>
              <DetailRow label="Bank" value={selectedWithdrawal.bank_name || '—'} />
              <DetailRow label="IBAN" value={selectedWithdrawal.iban || '—'} />
              <DetailRow label="Account Holder" value={selectedWithdrawal.account_holder_name || '—'} />
            </View>
          </View>

          {selectedWithdrawal.status === 'PENDING' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Process Withdrawal</Text>
              <Text style={styles.reasonText}>Mark this request as processing before transferring.</Text>
              <TextInput
                style={styles.input}
                placeholder="Admin notes (optional)"
                placeholderTextColor="#9E9E9E"
                value={processNotes}
                onChangeText={setProcessNotes}
                multiline
                numberOfLines={2}
              />
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn]}
                  disabled={actingWithdrawal}
                  onPress={async () => {
                    setActingWithdrawal(true);
                    try {
                      await adminAPI.processWithdrawal(selectedWithdrawal.id, { admin_email: 'admin@swyft.com', admin_notes: processNotes || 'Processing' });
                      setProcessNotes('');
                      setSelectedWithdrawal(null);
                      await loadWithdrawals();
                    } catch (e) {
                      Alert.alert('Error', e.response?.data?.error || e.message || 'Failed to process');
                    } finally {
                      setActingWithdrawal(false);
                    }
                  }}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Mark Processing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  disabled={actingWithdrawal}
                  onPress={async () => {
                    setActingWithdrawal(true);
                    try {
                      await adminAPI.rejectWithdrawal(selectedWithdrawal.id, { admin_email: 'admin@swyft.com', admin_notes: processNotes || 'Rejected' });
                      setProcessNotes('');
                      setSelectedWithdrawal(null);
                      await loadWithdrawals();
                    } catch (e) {
                      Alert.alert('Error', e.response?.data?.error || e.message || 'Failed to reject');
                    } finally {
                      setActingWithdrawal(false);
                    }
                  }}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {selectedWithdrawal.status === 'PROCESSING' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Mark as Paid</Text>
              <Text style={styles.reasonText}>Use this after the bank transfer is completed.</Text>
              <TextInput
                style={styles.input}
                placeholder="Transfer reference (optional)"
                placeholderTextColor="#9E9E9E"
                value={transferReference}
                onChangeText={setTransferReference}
              />
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn]}
                  disabled={actingWithdrawal}
                  onPress={async () => {
                    setActingWithdrawal(true);
                    try {
                      await adminAPI.markWithdrawalPaid(selectedWithdrawal.id, { admin_email: 'admin@swyft.com', transfer_reference: transferReference || undefined });
                      setTransferReference('');
                      setSelectedWithdrawal(null);
                      await loadWithdrawals();
                    } catch (e) {
                      Alert.alert('Error', e.response?.data?.error || e.message || 'Failed to mark paid');
                    } finally {
                      setActingWithdrawal(false);
                    }
                  }}
                >
                  <Ionicons name="checkmark-done" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Mark Paid</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={() => { setSelectedWithdrawal(null); setProcessNotes(''); setTransferReference(''); }}>
            <Text style={styles.closeText}>Back to list</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      {!selected && !archiveDetail && view === 'archive' && (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={loadingArchived} onRefresh={loadArchived} />}
        >
          <Text style={styles.sectionHint}>Archived drivers (reference)</Text>
          {loadingArchived && <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.primary} />}
          {!loadingArchived && archived.length === 0 && (
            <View style={styles.emptyWrap}>
              <Ionicons name="archive-outline" size={48} color="#9E9E9E" />
              <Text style={styles.emptyText}>No archived drivers yet. Reviewed drivers will appear here.</Text>
            </View>
          )}
          {archived.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.driverRow}
              onPress={() =>
                setArchiveDetail({
                  driver: { first_name: a.first_name, last_name: a.last_name, email: a.email, phone: a.phone },
                  id_document: a.id_document,
                  selfie: a.selfie,
                  phone: a.phone,
                  bank_account: a.bank_account,
                  car: a.car,
                  decision: a.decision,
                  reviewer_email: a.reviewer_email,
                  notes: a.notes,
                  archived_at: a.archived_at,
                })
              }
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(a.first_name?.[0] || '') + (a.last_name?.[0] || '')}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.driverName}>
                  {a.first_name} {a.last_name}
                </Text>
                <Text style={styles.driverSub}>{a.email}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: a.decision === 'approved' ? '#4CAF50' : '#F44336' }]}>
                <Text style={styles.badgeText}>{a.decision === 'approved' ? 'Approved' : 'Rejected'}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {selected && (
        <ScrollView style={styles.detail}>
          {banner.text ? (
            <View style={[styles.banner, banner.type === 'error' ? styles.bannerError : styles.bannerSuccess]}>
              <Ionicons
                name={banner.type === 'error' ? 'close-circle' : 'checkmark-circle'}
                size={18}
                color="#fff"
              />
              <Text style={styles.bannerText}>{banner.text}</Text>
            </View>
          ) : null}

          {loadingBundle && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading verification bundle…</Text>
            </View>
          )}

          {bundle && (
            <>
              {!acting && (
                <View style={styles.progressCard}>
                  <Text style={styles.progressTitle}>Review progress</Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${(doneCount / SECTIONS.length) * 100}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    {doneCount} of {SECTIONS.length} sections reviewed
                    {pendingCount > 0 ? ` · ${pendingCount} pending` : ' · complete'}
                  </Text>
                </View>
              )}

              <View style={styles.driverCard}>
                <View style={styles.avatarLg}>
                  <Text style={styles.avatarTextLg}>
                    {(bundle.driver.first_name?.[0] || '') + (bundle.driver.last_name?.[0] || '')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverCardName}>
                    {bundle.driver.first_name} {bundle.driver.last_name}
                  </Text>
                  <Text style={styles.driverCardSub}>{bundle.driver.email}</Text>
                  <Text style={styles.driverCardSub}>{bundle.driver.phone || ''}</Text>
                </View>
              </View>

              <SectionBlock
                title="ID Document"
                status={getStatus(bundle, 'id-document')}
                hasData={!!bundle.id_document}
                acting={acting}
                onApprove={() => review('id-document', 'approve')}
                onReject={() => confirmReject('id-document')}
              >
                {bundle.id_document ? (
                  <>
                    <DetailRow label="Type" value={bundle.id_document.document_type} />
                    <DetailRow label="Number" value={bundle.id_document.document_number} />
                    <DetailRow label="Expiry" value={bundle.id_document.expiry_date} />
                    {getReason(bundle, 'id-document') ? (
                      <Text style={styles.reasonText}>Reason: {getReason(bundle, 'id-document')}</Text>
                    ) : null}
                    <View style={styles.imgRow}>
                      <Img img={bundle.id_document.front_image} label="Front" />
                      <Img img={bundle.id_document.back_image} label="Back" />
                    </View>
                  </>
                ) : (
                  <Text style={styles.notSubmitted}>Not submitted</Text>
                )}
              </SectionBlock>

              <SectionBlock
                title="Selfie Verification"
                status={getStatus(bundle, 'selfie')}
                hasData={!!bundle.selfie}
                acting={acting}
                onApprove={() => review('selfie', 'approve')}
                onReject={() => confirmReject('selfie')}
              >
                {bundle.selfie ? (
                  <>
                    {bundle.selfie.match_confidence != null && (
                      <DetailRow label="Match confidence" value={`${bundle.selfie.match_confidence}%`} />
                    )}
                    {getReason(bundle, 'selfie') ? (
                      <Text style={styles.reasonText}>Reason: {getReason(bundle, 'selfie')}</Text>
                    ) : null}
                    <View style={styles.imgRow}>
                      <Img img={bundle.selfie.selfie_image} label="Selfie" />
                      <Img img={bundle.selfie.id_document_image} label="ID Used For Match" />
                    </View>
                  </>
                ) : (
                  <Text style={styles.notSubmitted}>Not submitted</Text>
                )}
              </SectionBlock>

              <SectionBlock
                title="Phone Number"
                status={getStatus(bundle, 'phone')}
                hasData={!!bundle.phone}
                acting={acting}
                onApprove={() => review('phone', 'approve')}
                onReject={() => confirmReject('phone')}
              >
                {bundle.phone ? (
                  <>
                    <DetailRow label="Number" value={bundle.phone.phone_number} />
                    <DetailRow label="Verified" value={bundle.phone.is_verified ? 'Yes' : 'No'} />
                  </>
                ) : (
                  <Text style={styles.notSubmitted}>Not submitted</Text>
                )}
              </SectionBlock>

              <SectionBlock
                title="Bank Account"
                status={getStatus(bundle, 'bank')}
                hasData={!!bundle.bank_account}
                acting={acting}
                onApprove={() => review('bank', 'approve')}
                onReject={() => confirmReject('bank')}
              >
                {bundle.bank_account ? (
                  <>
                    <DetailRow label="Bank" value={bundle.bank_account.bank_name} />
                    <DetailRow label="Holder" value={bundle.bank_account.account_holder_name} />
                    <DetailRow label="Account" value={bundle.bank_account.account_number} />
                    {bundle.bank_account.routing_number ? (
                      <DetailRow label="Routing" value={bundle.bank_account.routing_number} />
                    ) : null}
                    {bundle.bank_account.iban ? (
                      <DetailRow label="IBAN" value={bundle.bank_account.iban} />
                    ) : null}
                    {bundle.bank_account.swift_code ? (
                      <DetailRow label="Swift" value={bundle.bank_account.swift_code} />
                    ) : null}
                    {getReason(bundle, 'bank') ? (
                      <Text style={styles.reasonText}>Reason: {getReason(bundle, 'bank')}</Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.notSubmitted}>Not submitted</Text>
                )}
               </SectionBlock>

               <SectionBlock
                 title="Vehicle"
                 status={bundle.car ? 'verified' : 'pending'}
                 hasData={!!bundle.car}
                 acting={acting}
                 onApprove={() => review('car', 'approve')}
                 onReject={() => confirmReject('car')}
               >
                 {bundle.car ? (
                   <>
                     <DetailRow label="Make" value={bundle.car.make} />
                     <DetailRow label="Model" value={bundle.car.model} />
                     <DetailRow label="Year" value={bundle.car.year} />
                     <DetailRow label="Color" value={bundle.car.color} />
                     <DetailRow label="Plate" value={bundle.car.plate_number} />
                     {bundle.car.image_url ? (
                       <View style={styles.imgRow}>
                         <Img img={{ url: bundle.car.image_url, type: 'url' }} label="Vehicle Image" />
                       </View>
                     ) : null}
                   </>
                 ) : (
                   <Text style={styles.notSubmitted}>Not submitted</Text>
                 )}
               </SectionBlock>

               <TouchableOpacity style={[styles.approveAllBtn, acting && styles.disabled]} disabled={acting} onPress={approveAll}>
                <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                <Text style={styles.approveAllText}>Approve All</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.closeBtn} onPress={closeDetail}>
                <Text style={styles.closeText}>Back to list</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      {archiveDetail && (
        <ScrollView style={styles.detail}>
          <View style={[styles.banner, archiveDetail.decision === 'approved' ? styles.bannerSuccess : styles.bannerError]}>
            <Ionicons
              name={archiveDetail.decision === 'approved' ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color="#fff"
            />
            <Text style={styles.bannerText}>
              {archiveDetail.decision === 'approved' ? 'Approved' : 'Rejected'} · archived for reference
            </Text>
          </View>

          {archiveDetail.reviewer_email ? (
            <Text style={styles.archiveMeta}>Reviewed by: {archiveDetail.reviewer_email}</Text>
          ) : null}
          {archiveDetail.archived_at ? (
            <Text style={styles.archiveMeta}>
              Archived: {new Date(archiveDetail.archived_at).toLocaleString()}
            </Text>
          ) : null}

          <View style={styles.driverCard}>
            <View style={styles.avatarLg}>
              <Text style={styles.avatarTextLg}>
                {(archiveDetail.driver.first_name?.[0] || '') + (archiveDetail.driver.last_name?.[0] || '')}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverCardName}>
                {archiveDetail.driver.first_name} {archiveDetail.driver.last_name}
              </Text>
              <Text style={styles.driverCardSub}>{archiveDetail.driver.email}</Text>
              <Text style={styles.driverCardSub}>{archiveDetail.driver.phone || ''}</Text>
            </View>
          </View>

          {archiveDetail.id_document ? (
            <SectionBlock title="ID Document" status={getStatus(archiveDetail, 'id-document')} hasData={false} acting={false}>
              <DetailRow label="Type" value={archiveDetail.id_document.document_type} />
              <DetailRow label="Number" value={archiveDetail.id_document.document_number} />
              <DetailRow label="Expiry" value={archiveDetail.id_document.expiry_date} />
              {archiveDetail.id_document.rejection_reason ? (
                <Text style={styles.reasonText}>Reason: {archiveDetail.id_document.rejection_reason}</Text>
              ) : null}
              <View style={styles.imgRow}>
                <Img img={archiveDetail.id_document.front_image} label="Front" />
                <Img img={archiveDetail.id_document.back_image} label="Back" />
              </View>
            </SectionBlock>
          ) : null}

          {archiveDetail.selfie ? (
            <SectionBlock title="Selfie Verification" status={getStatus(archiveDetail, 'selfie')} hasData={false} acting={false}>
              {archiveDetail.selfie.match_confidence != null && (
                <DetailRow label="Match confidence" value={`${archiveDetail.selfie.match_confidence}%`} />
              )}
              {archiveDetail.selfie.rejection_reason ? (
                <Text style={styles.reasonText}>Reason: {archiveDetail.selfie.rejection_reason}</Text>
              ) : null}
              <View style={styles.imgRow}>
                <Img img={archiveDetail.selfie.selfie_image} label="Selfie" />
                <Img img={archiveDetail.selfie.id_document_image} label="ID Used For Match" />
              </View>
            </SectionBlock>
          ) : null}

          {archiveDetail.phone ? (
            <SectionBlock title="Phone Number" status={getStatus(archiveDetail, 'phone')} hasData={false} acting={false}>
              <DetailRow label="Number" value={archiveDetail.phone.phone_number} />
              <DetailRow label="Verified" value={archiveDetail.phone.is_verified ? 'Yes' : 'No'} />
            </SectionBlock>
          ) : null}

          {archiveDetail.bank_account ? (
            <SectionBlock title="Bank Account" status={getStatus(archiveDetail, 'bank')} hasData={false} acting={false}>
              <DetailRow label="Bank" value={archiveDetail.bank_account.bank_name} />
              <DetailRow label="Holder" value={archiveDetail.bank_account.account_holder_name} />
              <DetailRow label="Account" value={archiveDetail.bank_account.account_number} />
              {archiveDetail.bank_account.routing_number ? (
                <DetailRow label="Routing" value={archiveDetail.bank_account.routing_number} />
              ) : null}
              {archiveDetail.bank_account.iban ? (
                <DetailRow label="IBAN" value={archiveDetail.bank_account.iban} />
              ) : null}
              {archiveDetail.bank_account.swift_code ? (
                <DetailRow label="Swift" value={archiveDetail.bank_account.swift_code} />
              ) : null}
              {archiveDetail.bank_account.rejection_reason ? (
                <Text style={styles.reasonText}>Reason: {archiveDetail.bank_account.rejection_reason}</Text>
              ) : null}
            </SectionBlock>
          ) : null}

          {archiveDetail.car ? (
            <SectionBlock title="Vehicle" status="verified" hasData={false} acting={false}>
              <DetailRow label="Make" value={archiveDetail.car.make} />
              <DetailRow label="Model" value={archiveDetail.car.model} />
              <DetailRow label="Year" value={archiveDetail.car.year} />
              <DetailRow label="Color" value={archiveDetail.car.color} />
              <DetailRow label="Plate" value={archiveDetail.car.plate_number} />
              {archiveDetail.car.image_url ? (
                <View style={styles.imgRow}>
                  <Img img={{ url: archiveDetail.car.image_url, type: 'url' }} label="Vehicle Image" />
                </View>
              ) : null}
            </SectionBlock>
          ) : null}

          {archiveDetail.notes ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Reviewer notes</Text>
              {typeof archiveDetail.notes === 'string' ? (
                <Text style={styles.detailValue}>{archiveDetail.notes}</Text>
              ) : (
                <Text style={styles.detailValue}>{JSON.stringify(archiveDetail.notes)}</Text>
              )}
            </View>
          ) : null}

          <TouchableOpacity style={styles.closeBtn} onPress={() => setArchiveDetail(null)}>
            <Text style={styles.closeText}>Back to archive</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal visible={!!rejectFor} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Reject {SECTIONS.find((s) => s.key === rejectFor)?.label || ''}
            </Text>
            <Text style={styles.modalHint}>Provide a reason (optional but recommended)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Document blurry / mismatch with selfie"
              placeholderTextColor="#9E9E9E"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => {
                  setRejectFor('');
                  setRejectReason('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirm]}
                onPress={submitReject}
                disabled={acting}
              >
                <Text style={styles.modalConfirmText}>Confirm Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const SectionBlock = ({ title, status, acting, hasData = true, onApprove, onReject, children }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>{title}</Text>
      <StatusBadge status={status} />
    </View>
    <View style={styles.cardBody}>{children}</View>
    {!hasData ? (
      <View style={styles.reviewedNote}>
        <Ionicons name="time-outline" size={14} color="#9E9E9E" />
        <Text style={[styles.reviewedText, { color: '#9E9E9E' }]}>Awaiting submission</Text>
      </View>
    ) : status === 'pending' ? (
      <View style={styles.cardActions}>
        <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} disabled={acting} onPress={onApprove}>
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} disabled={acting} onPress={onReject}>
          <Ionicons name="close" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Reject</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <View style={styles.reviewedNote}>
        <Ionicons
          name={status === 'rejected' ? 'close-circle' : 'checkmark-circle'}
          size={14}
          color={statusColor(status)}
        />
        <Text style={[styles.reviewedText, { color: statusColor(status) }]}>
          {status === 'rejected' ? 'Rejected' : 'Approved'} — no further action
        </Text>
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    position: 'relative',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  brandName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
    marginBottom: 2,
  },
  headerLogoutBtn: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHint: { fontSize: 13, fontWeight: '600', color: '#607D8B', marginBottom: 10, textTransform: 'uppercase' },
  tabBar: { flexDirection: 'row', backgroundColor: '#ECEFF1', padding: 6 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#607D8B' },
  tabTextActive: { color: COLORS.primary },
  archiveMeta: { fontSize: 12, color: '#757575', marginBottom: 2, paddingHorizontal: 2 },
  list: { flex: 1, padding: 14 },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  driverName: { fontSize: 16, fontWeight: 'bold', color: '#212121' },
  driverSub: { fontSize: 13, color: '#757575' },
  errorText: { color: '#F44336', textAlign: 'center', marginTop: 20 },
  emptyWrap: { alignItems: 'center', marginTop: 60 },
  emptyText: { textAlign: 'center', marginTop: 12, color: '#757575', paddingHorizontal: 30 },
  detail: { flex: 1, padding: 14 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  bannerSuccess: { backgroundColor: '#4CAF50' },
  bannerError: { backgroundColor: '#F44336' },
  bannerText: { color: '#fff', fontWeight: '600', flex: 1 },
  loadingWrap: { alignItems: 'center', marginTop: 30 },
  loadingText: { marginTop: 8, color: '#757575' },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  progressTitle: { fontSize: 14, fontWeight: 'bold', color: '#212121', marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#4CAF50', borderRadius: 4 },
  progressText: { marginTop: 6, fontSize: 12, color: '#757575' },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  avatarLg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextLg: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  driverCardName: { fontSize: 17, fontWeight: 'bold', color: '#212121' },
  driverCardSub: { fontSize: 13, color: '#757575' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#212121' },
  cardBody: {},
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontSize: 14, color: '#757575' },
  detailValue: { fontSize: 14, color: '#212121', fontWeight: '500', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  reasonText: { color: '#F44336', fontSize: 13, marginTop: 6 },
  notSubmitted: { color: '#9E9E9E', fontSize: 14, fontStyle: 'italic' },
  imgRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  imgWrap: { flex: 1 },
  imgLabel: { fontSize: 12, fontWeight: 'bold', color: '#757575', marginBottom: 4 },
  image: { width: '100%', height: 160, backgroundColor: '#111', borderRadius: 8 },
  imgPlaceholder: {
    height: 160,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgPlaceholderText: { fontSize: 12, color: '#bbb', marginTop: 4 },
  imgSource: { fontSize: 10, color: '#9E9E9E', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  actionBtnText: { color: '#fff', fontWeight: 'bold' },
  approveBtn: { backgroundColor: '#4CAF50' },
  rejectBtn: { backgroundColor: '#F44336' },
  reviewedNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  reviewedText: { fontSize: 13, fontWeight: '600' },
  approveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 10,
  },
  approveAllText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  disabled: { opacity: 0.6 },
  closeBtn: {
    alignItems: 'center',
    backgroundColor: '#ECEFF1',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 30,
  },
  closeText: { color: '#455A64', fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 28,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#212121' },
  modalHint: { fontSize: 13, color: '#757575', marginTop: 4, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fafafa',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalCancel: { backgroundColor: '#ECEFF1' },
  modalCancelText: { color: '#455A64', fontWeight: 'bold' },
  modalConfirm: { backgroundColor: '#F44336' },
  modalConfirmText: { color: '#fff', fontWeight: 'bold' },
});
