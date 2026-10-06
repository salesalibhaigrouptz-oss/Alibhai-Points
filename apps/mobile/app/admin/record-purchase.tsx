import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { mockCustomers, mockPointRules } from '@/services/mock-admin-data';

export default function RecordPurchase() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  const [calculatedPoints, setCalculatedPoints] = useState<number | null>(null);

  const handleSearchCustomer = () => {
    const foundCustomer = mockCustomers.find(c => c.id === customerId);
    if (foundCustomer) {
      setCustomer(foundCustomer);
    } else {
      Alert.alert('Error', 'Customer not found');
      setCustomer(null);
    }
  };

  const calculatePoints = (amount: number) => {
    return Math.floor(amount / mockPointRules.tzsPerPoint);
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    const numAmount = parseFloat(value) || 0;
    setCalculatedPoints(calculatePoints(numAmount));
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

    // Mock API call - in production, this would call the backend
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Success',
        `Purchase recorded!\nCustomer: ${customer.name}\nAmount: TZS ${parseFloat(amount).toLocaleString()}\nPoints: ${calculatedPoints}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setCustomerId('');
              setAmount('');
              setCustomer(null);
              setCalculatedPoints(null);
            },
          },
        ]
      );
    }, 1000);
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
            >
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>

        {customer && (
          <View style={styles.customerInfo}>
            <Text style={styles.customerInfoTitle}>Customer Found</Text>
            <Text style={styles.customerName}>{customer.name}</Text>
            <Text style={styles.customerDetail}>ID: {customer.id}</Text>
            <Text style={styles.customerDetail}>Phone: {customer.phone}</Text>
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
              {mockPointRules.tzsPerPoint.toLocaleString()} TZS = 1 point
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, (!customer || !amount || loading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!customer || !amount || loading}
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
