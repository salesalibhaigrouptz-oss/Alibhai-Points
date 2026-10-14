import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, TextInput, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRedemptions, useCompleteRedemption, useCancelRedemption } from '@/services/hooks';
import { apiErrorMessage } from '@/services/api';

export default function RedemptionsList() {
  const { t } = useTranslation();
  const { data: redemptionsData, isLoading, error, refetch } = useRedemptions({ limit: 50 });
  const redemptions = redemptionsData?.redemptions || [];
  
  const completeMutation = useCompleteRedemption();
  const cancelMutation = useCancelRedemption();
  
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedRedemption, setSelectedRedemption] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('common.never');
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleComplete = (redemption: any) => {
    Alert.alert(
      t('admin.redemptions.completeRedemption'),
      t('admin.redemptions.completeConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.redemptions.complete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await completeMutation.mutateAsync(redemption.id);
              Alert.alert(t('common.done'), t('admin.redemptions.completeSuccess'));
            } catch (err) {
              Alert.alert(t('common.error'), apiErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  const handleCancel = (redemption: any) => {
    setSelectedRedemption(redemption);
    setCancelReason('');
    setCancelModalVisible(true);
  };

  const confirmCancel = async () => {
    if (!selectedRedemption) return;

    try {
      await cancelMutation.mutateAsync({
        id: selectedRedemption.id,
        reason: cancelReason.trim() || undefined,
      });
      setCancelModalVisible(false);
      setSelectedRedemption(null);
      setCancelReason('');
      Alert.alert(t('common.done'), t('admin.redemptions.cancelSuccess'));
    } catch (err) {
      Alert.alert(t('common.error'), apiErrorMessage(err));
    }
  };

  const RedemptionCard = ({ redemption }: { redemption: any }) => (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.id}>{redemption.redemption_reference}</Text>
        <Text style={styles.date}>{formatDate(redemption.redeemed_at)}</Text>
      </View>
      <Text style={styles.customer}>{redemption.customers?.profiles?.full_name || t('common.unknown')}</Text>
      <Text style={styles.customerId}>{redemption.customers?.customer_code || t('common.unknown')}</Text>
      <View style={styles.pointsRow}>
        <Text style={styles.points}>-{redemption.points_redeemed} {t('common.pts')}</Text>
        <View style={[styles.statusBadge, redemption.status === 'completed' ? styles.statusCompleted : redemption.status === 'pending' ? styles.statusPending : styles.statusCancelled]}>
          <Text style={[styles.statusText, redemption.status === 'completed' ? styles.statusTextCompleted : redemption.status === 'pending' ? styles.statusTextPending : styles.statusTextCancelled]}>
            {redemption.status === 'completed' ? t('admin.redemptions.completed') : redemption.status === 'pending' ? t('admin.redemptions.pending') : t('admin.redemptions.cancelled')}
          </Text>
        </View>
      </View>
      <Text style={styles.reference}>Ref: {redemption.redemption_reference}</Text>
      {redemption.processed_by && (
        <Text style={styles.processedBy}>{t('admin.redemptions.processedBy')}: {redemption.processed_by}</Text>
      )}
      {redemption.status === 'pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => handleComplete(redemption)}
          >
            <Text style={styles.actionButtonText}>{t('admin.redemptions.complete')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => handleCancel(redemption)}
          >
            <Text style={styles.actionButtonText}>{t('admin.redemptions.cancel')}</Text>
          </TouchableOpacity>
        </View>
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
        <Text style={styles.errorText}>{t('admin.redemptions.failedLoad')}</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={redemptions}
        renderItem={({ item }) => <RedemptionCard redemption={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('admin.redemptions.empty')}</Text>
          </View>
        }
      />
      
      {/* Cancel Redemption Modal */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('admin.redemptions.cancelRedemption')}</Text>
            <Text style={styles.modalSubtitle}>
              {t('admin.redemptions.points')}: {selectedRedemption?.points_redeemed}
            </Text>
            <Text style={styles.modalLabel}>{t('admin.purchases.voidReason')}:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="..."
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setCancelModalVisible(false)}
                disabled={cancelMutation.isPending}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, cancelMutation.isPending && styles.buttonDisabled]}
                onPress={confirmCancel}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>{t('admin.redemptions.cancel')}</Text>
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
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  points: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C62828',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusApproved: {
    backgroundColor: '#E8F5E9',
  },
  statusCompleted: {
    backgroundColor: '#E8F5E9',
  },
  statusPending: {
    backgroundColor: '#FFF3E0',
  },
  statusRejected: {
    backgroundColor: '#FFEBEE',
  },
  statusCancelled: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextApproved: {
    color: '#2E7D32',
  },
  statusTextCompleted: {
    color: '#2E7D32',
  },
  statusTextPending: {
    color: '#F57C00',
  },
  statusTextRejected: {
    color: '#C62828',
  },
  statusTextCancelled: {
    color: '#C62828',
  },
  reference: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 4,
  },
  processedBy: {
    fontSize: 12,
    color: '#777777',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButton: {
    backgroundColor: '#2E7D32',
  },
  cancelButton: {
    backgroundColor: '#C62828',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#777777',
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
    minWidth: 120,
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
