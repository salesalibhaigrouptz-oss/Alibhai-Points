import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCustomerLookup, usePreviewPurchase, useRecordPurchase } from '@/services/hooks';
import { apiErrorMessage, formatPoints, formatTzs } from '@/services/api';

const generateIdempotencyKey = () => `purchase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export default function RecordPurchase() {
  const router = useRouter();
  const { t } = useTranslation();
  const [customerQuery, setCustomerQuery] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);

  const { data: lookupResult, isLoading: lookupLoading } = useCustomerLookup(debouncedQuery);
  const previewMutation = usePreviewPurchase();
  const recordMutation = useRecordPurchase();

  // Debounce customer lookup (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerQuery.length >= 2) {
        setDebouncedQuery(customerQuery);
      } else {
        setDebouncedQuery('');
        setCustomer(null);
        setPreview(null);
        setPreviewError(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  // Update customer when lookup result changes
  useEffect(() => {
    if (lookupResult) {
      setCustomer(lookupResult);
      setPreview(null);
      setPreviewError(null);
    } else if (debouncedQuery && !lookupLoading) {
      setCustomer(null);
      setPreview(null);
      setPreviewError(null);
    }
  }, [lookupResult, debouncedQuery, lookupLoading]);

  const handleAmountChange = async (value: string) => {
    setAmount(value);
    setPreviewError(null);
    const numAmount = parseFloat(value) || 0;
    if (numAmount > 0 && customer) {
      try {
        const customerIdentifier =
          customer.customer_code ||
          customer.customer?.customer_code ||
          customerQuery.trim();

        if (!customerIdentifier) {
          setPreview(null);
          return;
        }

        const previewResult = await previewMutation.mutateAsync({
          customer: customerIdentifier,
          purchaseAmount: numAmount,
        });
        setPreview(previewResult);
      } catch (error) {
        setPreview(null);
        setPreviewError(apiErrorMessage(error));
      }
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async () => {
    if (!customer) {
      Alert.alert(t('common.error'), t('admin.recordPurchase.notFound'));
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert(t('common.error'), t('admin.recordPurchase.purchaseAmount'));
      return;
    }

    const customerIdentifier =
      customer.customer_code ||
      customer.customer?.customer_code ||
      customerQuery.trim();

    if (!customerIdentifier) {
      Alert.alert(t('common.error'), t('admin.recordPurchase.notFound'));
      return;
    }

    setLoading(true);

    try {
      // Generate or reuse idempotency key
      const key = idempotencyKey || generateIdempotencyKey();
      setIdempotencyKey(key);

      const result = await recordMutation.mutateAsync({
        customer: customerIdentifier,
        purchaseAmount: parseFloat(amount),
        idempotencyKey: key,
      });

      setSuccessData(result);
      setShowSuccess(true);
    } catch (error) {
      Alert.alert(t('common.error'), apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCustomerQuery('');
    setAmount('');
    setCustomer(null);
    setPreview(null);
    setIdempotencyKey(null);
    setShowSuccess(false);
    setSuccessData(null);
    setDebouncedQuery('');
  };

  // Success screen
  if (showSuccess && successData) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.card}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>
          <Text style={styles.successTitle}>{t('admin.recordPurchase.success')}</Text>
          <Text style={styles.successSubtitle}>{t('admin.recordPurchase.successSubtitle')}</Text>

          <View style={styles.successInfo}>
            <Text style={styles.successLabel}>Reference</Text>
            <Text style={styles.successValue}>{successData.reference}</Text>
          </View>

          <View style={styles.successInfo}>
            <Text style={styles.successLabel}>{t('admin.recordPurchase.pointsToEarn')}</Text>
            <Text style={styles.successValue}>+{formatPoints(successData.points_earned)}</Text>
          </View>

          <View style={styles.successInfo}>
            <Text style={styles.successLabel}>{t('admin.recordPurchase.newTier')}</Text>
            <Text style={styles.successValue}>{successData.tier_after}</Text>
          </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleReset}
          >
            <Text style={styles.submitButtonText}>{t('admin.recordPurchase.recordAnother')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('admin.recordPurchase.title')}</Text>
        <Text style={styles.subtitle}>{t('admin.recordPurchase.subtitle')}</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('admin.recordPurchase.customerOrPhone')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('admin.recordPurchase.customerPlaceholder')}
            value={customerQuery}
            onChangeText={setCustomerQuery}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {lookupLoading && (
            <ActivityIndicator size="small" color="#7A1F2B" style={styles.loadingIndicator} />
          )}
        </View>

        {customer && (
          <View style={styles.customerInfo}>
            <Text style={styles.customerInfoTitle}>{t('admin.recordPurchase.customerFound')}</Text>
            <Text style={styles.customerName}>{customer.full_name || customer.profile?.full_name}</Text>
            <Text style={styles.customerDetail}>ID: {customer.customer_code || customer.customer?.customer_code}</Text>
            <Text style={styles.customerDetail}>{t('admin.recordPurchase.phone')}: {customer.phone || customer.profile?.phone}</Text>
            <Text style={styles.customerDetail}>{t('admin.recordPurchase.city')}: {customer.city || customer.customer?.city}</Text>
            <Text style={styles.customerDetail}>{t('admin.recordPurchase.tier')}: {typeof customer.tier === 'string' ? customer.tier : (customer.tier?.name || 'N/A')}</Text>
            <View style={[styles.statusBadge, (customer.status || customer.customer?.status) === 'active' ? styles.statusActive : styles.statusInactive]}>
              <Text style={[styles.statusText, (customer.status || customer.customer?.status) === 'active' ? styles.statusTextActive : styles.statusTextInactive]}>
                {(customer.status || customer.customer?.status) === 'active' ? t('home.statusActive') : t('home.statusInactive')}
              </Text>
            </View>
            {(customer.last_purchase_at || customer.last_transaction_at) && (
              <Text style={styles.customerDetail}>
                {t('admin.recordPurchase.lastPurchase')}: {new Date(customer.last_purchase_at || customer.last_transaction_at).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}

        {customerQuery && !lookupLoading && !customer && (
          <Text style={styles.notFoundText}>{t('admin.recordPurchase.notFound')}</Text>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('admin.recordPurchase.purchaseAmount')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('admin.recordPurchase.amountPlaceholder')}
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="numeric"
            editable={!!customer}
          />
        </View>

        {previewError ? (
          <Text style={styles.notFoundText}>{previewError}</Text>
        ) : null}

        {preview && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>{t('admin.recordPurchase.preview')}</Text>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>{t('admin.recordPurchase.pointsToEarn')}</Text>
              <Text style={styles.previewValue}>+{formatPoints(preview.points_earned)}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>{t('admin.recordPurchase.currentTier')}</Text>
              <Text style={styles.previewValue}>{preview.tier_before}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>{t('admin.recordPurchase.newTier')}</Text>
              <Text style={styles.previewValue}>{preview.tier_after}</Text>
            </View>

            {preview.tier_will_change && (
              <View style={styles.tierChangeBanner}>
                <Text style={styles.tierChangeText}>
                  {t('admin.recordPurchase.tierChange', { tier: preview.tier_after })}
                </Text>
              </View>
            )}

            {(preview.will_reactivate || preview.old_points_will_expire_first) && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>
                  {t('admin.recordPurchase.reactivationWarning')}
                </Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, (!customer || !amount || loading || previewMutation.isPending) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!customer || !amount || loading || previewMutation.isPending}
        >
          <Text style={styles.submitButtonText}>
            {loading ? t('admin.recordPurchase.recording') : t('admin.recordPurchase.submit')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7A1F2B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#242424',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F3F3',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
  },
  loadingIndicator: {
    marginTop: 8,
  },
  customerInfo: {
    backgroundColor: '#F3F3F3',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  customerInfoTitle: {
    fontSize: 12,
    color: '#777777',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#242424',
    marginBottom: 4,
  },
  customerDetail: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  statusActive: {
    backgroundColor: '#E8F5E9',
  },
  statusInactive: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#2E7D32',
  },
  statusTextInactive: {
    color: '#C62828',
  },
  notFoundText: {
    fontSize: 14,
    color: '#C62828',
    marginBottom: 20,
  },
  previewCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: '#777777',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#242424',
  },
  tierChangeBanner: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  tierChangeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  warningBanner: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#7A1F2B',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successIconText: {
    fontSize: 48,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#242424',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 24,
    textAlign: 'center',
  },
  successInfo: {
    backgroundColor: '#F3F3F3',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  successLabel: {
    fontSize: 12,
    color: '#777777',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  successValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#242424',
  },
});
