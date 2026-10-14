import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTiers, useUpdateTier } from '@/services/hooks';
import { apiErrorMessage, formatTzs } from '@/services/api';

export default function TiersManagement() {
  const { t } = useTranslation();
  const { data: tiers, isLoading, error, refetch } = useTiers();
  const updateMutation = useUpdateTier();

  const tierList = Array.isArray(tiers)
    ? tiers
    : Array.isArray((tiers as any)?.tiers)
    ? (tiers as any).tiers
    : [];

  const [editingTier, setEditingTier] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [minLifetimePurchases, setMinLifetimePurchases] = useState('');
  const [pointValueTzs, setPointValueTzs] = useState('');

  const handleEdit = (tier: any) => {
    setEditingTier(tier);
    setMinLifetimePurchases(tier.min_lifetime_purchases.toString());
    setPointValueTzs(tier.point_value_tzs.toString());
    setModalVisible(true);
  };

  const handleSave = () => {
    const minLifetime = parseFloat(minLifetimePurchases);
    const pointValue = parseFloat(pointValueTzs);

    if (isNaN(minLifetime) || minLifetime < 0) {
      Alert.alert(t('common.error'), 'Please enter a valid amount');
      return;
    }

    if (isNaN(pointValue) || pointValue < 0) {
      Alert.alert(t('common.error'), 'Please enter a valid point value');
      return;
    }

    Alert.alert(
      t('admin.tiers.confirmTitle'),
      t('admin.tiers.confirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.tiers.yesUpdate'),
          style: 'destructive',
          onPress: async () => {
            try {
              await updateMutation.mutateAsync({
                tierId: editingTier.id,
                minLifetimePurchases: minLifetime,
                pointValueTzs: pointValue,
              });
              setModalVisible(false);
              setEditingTier(null);
              Alert.alert(t('common.done'), t('admin.tiers.updateSuccess'));
            } catch (err) {
              Alert.alert(t('common.error'), apiErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  const TierCard = ({ tier }: { tier: any }) => (
    <View style={styles.tierCard}>
      <View style={styles.tierHeader}>
        <Text style={styles.tierName}>{tier.name}</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEdit(tier)}
        >
          <Text style={styles.editButtonText}>{t('admin.tiers.edit')}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tierDetails}>
        <View style={styles.tierDetail}>
          <Text style={styles.tierDetailLabel}>{t('admin.tiers.minLifetime')}</Text>
          <Text style={styles.tierDetailValue}>{formatTzs(tier.min_lifetime_purchases)}</Text>
        </View>
        <View style={styles.tierDetail}>
          <Text style={styles.tierDetailLabel}>{t('admin.tiers.pointValue')}</Text>
          <Text style={styles.tierDetailValue}>{formatTzs(tier.point_value_tzs)} {t('admin.tiers.perPoint')}</Text>
        </View>
      </View>
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
        <Text style={styles.errorText}>{t('admin.tiers.failedLoad')}</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} refreshControl={
      <RefreshControl refreshing={isLoading} onRefresh={refetch} />
    }>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('admin.tiers.title')}</Text>
        <Text style={styles.headerSubtitle}>{t('admin.tiers.subtitle')}</Text>
      </View>

      <View style={styles.content}>
        {tierList.map((tier: any) => (
          <TierCard key={tier.id} tier={tier} />
        ))}
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('admin.tiers.editTitle')}: {editingTier?.name}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('admin.tiers.minLifetime')} (TZS)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 100000"
                value={minLifetimePurchases}
                onChangeText={setMinLifetimePurchases}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('admin.tiers.pointValue')} (TZS {t('admin.tiers.perPoint')})</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 100"
                value={pointValueTzs}
                onChangeText={setPointValueTzs}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ {t('admin.tiers.confirmMessage')}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setModalVisible(false)}
                disabled={updateMutation.isPending}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveButton, updateMutation.isPending && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSaveButtonText}>{t('admin.tiers.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    padding: 20,
    backgroundColor: '#7A1F2B',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  content: {
    padding: 16,
  },
  tierCard: {
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
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tierName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#242424',
  },
  editButton: {
    backgroundColor: '#7A1F2B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tierDetails: {
    gap: 8,
  },
  tierDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tierDetailLabel: {
    fontSize: 14,
    color: '#777777',
  },
  tierDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#242424',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#242424',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
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
    color: '#242424',
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  warningText: {
    fontSize: 12,
    color: '#F57C00',
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
  modalSaveButton: {
    backgroundColor: '#7A1F2B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
