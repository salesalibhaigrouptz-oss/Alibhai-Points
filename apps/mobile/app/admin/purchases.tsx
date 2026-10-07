import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Alert, TextInput, Modal, TouchableOpacity } from 'react-native';
import { usePurchases, useVoidPurchase } from '@/services/hooks';
import { apiErrorMessage } from '@/services/api';

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-TZ', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function PurchasesList() {
  const { data: purchasesData, isLoading, error, refetch } = usePurchases({ limit: 50 });
  const purchases = purchasesData?.purchases || [];
  const voidMutation = useVoidPurchase();
  
  const [voidModalVisible, setVoidModalVisible] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [voidReason, setVoidReason] = useState('');

  const handleVoidPurchase = (purchase: any) => {
    setSelectedPurchase(purchase);
    setVoidReason('');
    setVoidModalVisible(true);
  };

  const confirmVoid = async () => {
    if (!selectedPurchase || !voidReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for voiding');
      return;
    }

    try {
      await voidMutation.mutateAsync({
        purchaseId: selectedPurchase.id,
        reason: voidReason.trim(),
      });
      setVoidModalVisible(false);
      setSelectedPurchase(null);
      setVoidReason('');
      Alert.alert('Success', 'Purchase voided successfully');
    } catch (err) {
      Alert.alert('Error', apiErrorMessage(err));
    }
  };

  const PurchaseCard = ({ purchase }: { purchase: any }) => (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.id}>{purchase.transaction_reference}</Text>
        <Text style={styles.date}>{formatDate(purchase.purchased_at)}</Text>
      </View>
      <Text style={styles.customer}>{purchase.profiles?.full_name || 'Unknown'}</Text>
      <Text style={styles.customerId}>{purchase.customers?.customer_code}</Text>
      <View style={styles.amountRow}>
        <Text style={styles.amount}>TZS {purchase.purchase_amount.toLocaleString()}</Text>
        <Text style={styles.points}>+{purchase.points_earned} pts</Text>
      </View>
      {purchase.status === 'completed' && (
        <TouchableOpacity
          style={styles.voidButton}
          onPress={() => handleVoidPurchase(purchase)}
        >
          <Text style={styles.voidButtonText}>Void Purchase</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#7A1F2B" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.errorText}>Failed to load purchases. Tap to retry.</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={purchases}
        renderItem={({ item }) => <PurchaseCard purchase={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No purchases found</Text>
          </View>
        }
      />
      
      {/* Void Purchase Modal */}
      <Modal
        visible={voidModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVoidModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Void Purchase</Text>
            <Text style={styles.modalSubtitle}>
              Reference: {selectedPurchase?.transaction_reference}
            </Text>
            <Text style={styles.modalLabel}>Reason for voiding:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter reason..."
              value={voidReason}
              onChangeText={setVoidReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setVoidModalVisible(false)}
                disabled={voidMutation.isPending}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, (!voidReason.trim() || voidMutation.isPending) && styles.buttonDisabled]}
                onPress={confirmVoid}
                disabled={!voidReason.trim() || voidMutation.isPending}
              >
                {voidMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>Void</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  id: {
    fontSize: 14,
    fontWeight: '600',
    color: '#242424',
  },
  date: {
    fontSize: 12,
    color: '#777777',
  },
  customer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#242424',
    marginBottom: 4,
  },
  customerId: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#242424',
  },
  points: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  voidButton: {
    backgroundColor: '#C62828',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    alignItems: 'center',
  },
  voidButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  recordedBy: {
    fontSize: 12,
    color: '#777777',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#777777',
    marginBottom: 16,
  },
  retryText: {
    fontSize: 16,
    color: '#7A1F2B',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#242424',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#242424',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#242424',
    marginBottom: 16,
    minHeight: 80,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelButtonText: {
    color: '#777777',
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmButton: {
    backgroundColor: '#C62828',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
