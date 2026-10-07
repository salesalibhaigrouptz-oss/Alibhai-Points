import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCustomer, usePreviewPurchase, useRecordPurchase, usePointRules } from '@/services/hooks';
import { apiErrorMessage } from '@/services/api';

const generateIdempotencyKey = () => `purchase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export default function RecordPurchase() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  const [calculatedPoints, setCalculatedPoints] = useState<number | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  
  const { data: pointRules } = usePointRules();
  const previewMutation = usePreviewPurchase();
  const recordMutation = useRecordPurchase();
  
  // Manual customer fetch for search
  const { refetch: refetchCustomer } = useCustomer(customerId, { enabled: false });

  const handleSearchCustomer = async () => {
    if (!customerId) {
      Alert.alert('Error', 'Please enter a customer ID');
      return;
    }

    setSearching(true);
    try {
      const { data: foundCustomer } = await refetchCustomer();
      if (foundCustomer) {
        setCustomer(foundCustomer);
      } else {
        throw new Error('Customer not found');
      }
    } catch (error) {
      Alert.alert('Error', 'Customer not found');
      setCustomer(null);
    } finally {
      setSearching(false);
    }
  };

  const calculatePoints = (amount: number) => {
    if (!pointRules) return 0;
    return Math.floor(amount / pointRules.tzsPerPoint);
  };

  const handleAmountChange = async (value: string) => {
    setAmount(value);
    const numAmount = parseFloat(value) || 0;
    if (numAmount > 0 && customer) {
      try {
        const preview = await previewMutation.mutateAsync({
          customerCode: customer.customer_code,
          purchaseAmount: numAmount,
        });
        setCalculatedPoints(preview.points_earned);
      } catch (error) {
        console.error('Failed to preview purchase:', error);
        setCalculatedPoints(calculatePoints(numAmount));
      }
    } else {
      setCalculatedPoints(null);
    }
  };

  const handleSubmit = async () => {
    if (!customer) {
      Alert.alert('Error', 'Please search for a customer first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid purchase amount');
      return;
    }

    setLoading(true);

    try {
      // Generate or reuse idempotency key
      const key = idempotencyKey || generateIdempotencyKey();
      setIdempotencyKey(key);

      const result = await recordMutation.mutateAsync({
        customerCode: customer.customer_code,
        purchaseAmount: parseFloat(amount),
        idempotencyKey: key,
      });
      
      Alert.alert(
        'Success',
        `Purchase recorded!\nCustomer: ${customer.profiles?.full_name}\nAmount: TZS ${parseFloat(amount).toLocaleString()}\nPoints: ${result.points_earned}\nReference: ${result.reference}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setCustomerId('');
              setAmount('');
              setCustomer(null);
              setCalculatedPoints(null);
              setIdempotencyKey(null);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Record Purchase</Text>
        <Text style={styles.subtitle}>Enter customer ID and purchase amount</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Customer ID</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="e.g., IS01"
              value={customerId}
              onChangeText={setCustomerId}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearchCustomer}
              disabled={searching}
            >
              <Text style={styles.searchButtonText}>
                {searching ? 'Searching...' : 'Search'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {customer && (
          <View style={styles.customerInfo}>
            <Text style={styles.customerInfoTitle}>Customer Found</Text>
            <Text style={styles.customerName}>{customer.profiles?.full_name || 'Unknown'}</Text>
            <Text style={styles.customerDetail}>ID: {customer.customer_code}</Text>
            <Text style={styles.customerDetail}>Phone: {customer.profiles?.phone || 'N/A'}</Text>
            <View style={[styles.statusBadge, customer.status === 'active' ? styles.statusActive : styles.statusInactive]}>
              <Text style={[styles.statusText, customer.status === 'active' ? styles.statusTextActive : styles.statusTextInactive]}>
                {customer.status}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Purchase Amount (TZS)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 50000"
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="numeric"
            editable={!!customer}
          />
        </View>

        {calculatedPoints !== null && calculatedPoints > 0 && (
          <View style={styles.pointsPreview}>
            <Text style={styles.pointsPreviewTitle}>Points to be awarded</Text>
            <Text style={styles.pointsPreviewValue}>+{calculatedPoints} points</Text>
            <Text style={styles.pointsPreviewNote}>
              {pointRules.tzsPerPoint.toLocaleString()} TZS = 1 point
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, (!customer || !amount || loading || searching) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!customer || !amount || loading || searching}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Recording...' : 'Record Purchase'}
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
    flex: 1,
    backgroundColor: '#F3F3F3',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  searchButton: {
    backgroundColor: '#242424',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  pointsPreview: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  pointsPreviewTitle: {
    fontSize: 12,
    color: '#2E7D32',
    marginBottom: 4,
  },
  pointsPreviewValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  pointsPreviewNote: {
    fontSize: 12,
    color: '#777777',
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
});
