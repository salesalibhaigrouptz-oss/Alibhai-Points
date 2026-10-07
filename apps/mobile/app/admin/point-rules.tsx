import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { usePointRules, useUpdatePointRules } from '@/services/hooks';
import { apiErrorMessage } from '@/services/api';

export default function PointRules() {
  const [tzsPerPoint, setTzsPerPoint] = useState('1000');
  const [redemptionWaitDays, setRedemptionWaitDays] = useState('90');
  const [activityPeriodDays, setActivityPeriodDays] = useState('25');
  const [editing, setEditing] = useState(false);
  
  const { data: rules, isLoading, error, refetch } = usePointRules();
  const updateMutation = useUpdatePointRules();

  useEffect(() => {
    if (!rules || editing) return;
    setTzsPerPoint(rules.tzsPerPoint.toString());
    setRedemptionWaitDays(rules.redemptionWaitDays.toString());
    setActivityPeriodDays(rules.activityPeriodDays.toString());
  }, [rules, editing]);

  const handleSave = async () => {
    Alert.alert(
      'Confirm Changes',
      'This will change point rules for future transactions only. Current transactions will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            try {
              await updateMutation.mutateAsync({
                tzsPerPoint: parseInt(tzsPerPoint, 10),
                redemptionWaitDays: parseInt(redemptionWaitDays, 10),
                activityPeriodDays: parseInt(activityPeriodDays, 10),
              });
              Alert.alert('Success', 'Point rules updated successfully');
              setEditing(false);
              await refetch();
            } catch (error) {
              Alert.alert('Error', apiErrorMessage(error));
            }
          },
        },
      ]
    );
  };

  const RuleCard = ({ title, value, description, editable, onChange }: any) => (
    <View style={styles.ruleCard}>
      <Text style={styles.ruleTitle}>{title}</Text>
      {editing && editable ? (
        <TextInput
          style={styles.ruleInput}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
        />
      ) : (
        <Text style={styles.ruleValue}>{value}</Text>
      )}
      <Text style={styles.ruleDescription}>{description}</Text>
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
        <Text style={styles.errorText}>Failed to load point rules. Tap to retry.</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} refreshControl={
      <RefreshControl refreshing={isLoading} onRefresh={refetch} />
    }>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Point Rules</Text>
        <Text style={styles.headerSubtitle}>Configure loyalty point calculations</Text>
      </View>

      <View style={styles.content}>
        <RuleCard
          title="TZS per Point"
          value={tzsPerPoint}
          description="Amount in Tanzanian Shillings required to earn 1 point"
          editable
          onChange={setTzsPerPoint}
        />

        <RuleCard
          title="Redemption Wait Period"
          value={`${redemptionWaitDays} days`}
          description="Time before points become redeemable after purchase"
          editable
          onChange={setRedemptionWaitDays}
        />

        <RuleCard
          title="Activity Period"
          value={`${activityPeriodDays} days`}
          description="Time before customer status becomes inactive without activity"
          editable
          onChange={setActivityPeriodDays}
        />

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ Important Notes</Text>
          <Text style={styles.infoText}>
            • Rule changes only affect future transactions
          </Text>
          <Text style={styles.infoText}>
            • Existing points are calculated based on rules at time of purchase
          </Text>
          <Text style={styles.infoText}>
            • Customers must make a purchase within the activity period to remain active
          </Text>
        </View>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setEditing(!editing)}
        >
          <Text style={styles.actionButtonText}>
            {editing ? 'Cancel' : 'Edit Rules'}
          </Text>
        </TouchableOpacity>

        {editing && (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={updateMutation.isPending}
          >
            <Text style={styles.saveButtonText}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
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
    padding: 20,
  },
  ruleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#242424',
    marginBottom: 8,
  },
  ruleValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7A1F2B',
    marginBottom: 8,
  },
  ruleInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7A1F2B',
    marginBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#7A1F2B',
    paddingBottom: 4,
  },
  ruleDescription: {
    fontSize: 14,
    color: '#777777',
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    marginBottom: 4,
  },
  actionButton: {
    backgroundColor: '#242424',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#7A1F2B',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
});
