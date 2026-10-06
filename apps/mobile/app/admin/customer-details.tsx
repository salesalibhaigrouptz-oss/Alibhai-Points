import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { mockCustomers, mockPurchases, mockRedemptions } from '@/services/mock-admin-data';

export default function CustomerDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = mockCustomers.find(c => c.id === id);
  const [activeTab, setActiveTab] = useState<'overview' | 'purchases' | 'points' | 'redemptions'>('overview');

  if (!customer) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Customer not found</Text>
      </View>
    );
  }

  const customerPurchases = mockPurchases.filter(p => p.customerId === id);
  const customerRedemptions = mockRedemptions.filter(r => r.customerId === id);

  const Tab = ({ label, value }: { label: string; value: typeof activeTab }) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === value && styles.tabActive]}
      onPress={() => setActiveTab(value)}
    >
      <Text style={[styles.tabText, activeTab === value && styles.tabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderOverview = () => (
    <View style={styles.content}>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Customer ID</Text>
        <Text style={styles.infoValue}>{customer.id}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Name</Text>
        <Text style={styles.infoValue}>{customer.name}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Phone</Text>
        <Text style={styles.infoValue}>{customer.phone}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Status</Text>
        <View style={[styles.statusBadge, customer.status === 'active' ? styles.statusActive : styles.statusInactive]}>
          <Text style={[styles.statusText, customer.status === 'active' ? styles.statusTextActive : styles.statusTextInactive]}>
            {customer.status}
          </Text>
        </View>
      </View>

      <View style={styles.pointsCard}>
        <Text style={styles.pointsTitle}>Points Summary</Text>
        <View style={styles.pointsRow}>
          <View style={styles.pointsItem}>
            <Text style={styles.pointsLabel}>Total</Text>
            <Text style={styles.pointsValue}>{customer.points}</Text>
          </View>
          <View style={styles.pointsItem}>
            <Text style={styles.pointsLabel}>Redeemable</Text>
            <Text style={[styles.pointsValue, styles.redeemable]}>{customer.redeemablePoints}</Text>
          </View>
          <View style={styles.pointsItem}>
            <Text style={styles.pointsLabel}>Pending</Text>
            <Text style={[styles.pointsValue, styles.pending]}>{customer.pendingPoints}</Text>
          </View>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Last Transaction</Text>
        <Text style={styles.infoValue}>{customer.lastTransaction}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Activity Deadline</Text>
        <Text style={styles.infoValue}>{customer.activityDeadline}</Text>
      </View>
    </View>
  );

  const renderPurchases = () => (
    <View style={styles.content}>
      {customerPurchases.map(purchase => (
        <View key={purchase.id} style={styles.transactionCard}>
          <View style={styles.transactionHeader}>
            <Text style={styles.transactionId}>{purchase.id}</Text>
            <Text style={styles.transactionDate}>{purchase.date}</Text>
          </View>
          <Text style={styles.transactionAmount}>TZS {purchase.amount.toLocaleString()}</Text>
          <Text style={styles.transactionPoints}>+{purchase.points} points</Text>
          <Text style={styles.transactionRecordedBy}>Recorded by: {purchase.recordedBy}</Text>
        </View>
      ))}
      {customerPurchases.length === 0 && (
        <Text style={styles.emptyText}>No purchases found</Text>
      )}
    </View>
  );

  const renderRedemptions = () => (
    <View style={styles.content}>
      {customerRedemptions.map(redemption => (
        <View key={redemption.id} style={styles.transactionCard}>
          <View style={styles.transactionHeader}>
            <Text style={styles.transactionId}>{redemption.id}</Text>
            <Text style={styles.transactionDate}>{redemption.date}</Text>
          </View>
          <Text style={styles.transactionPoints}>-{redemption.points} points</Text>
          <Text style={styles.transactionReference}>Ref: {redemption.reference}</Text>
          <View style={[styles.statusBadge, redemption.status === 'approved' ? styles.statusActive : redemption.status === 'pending' ? styles.statusPending : styles.statusInactive]}>
            <Text style={[styles.statusText, redemption.status === 'approved' ? styles.statusTextActive : redemption.status === 'pending' ? styles.statusTextPending : styles.statusTextInactive]}>
              {redemption.status}
            </Text>
          </View>
        </View>
      ))}
      {customerRedemptions.length === 0 && (
        <Text style={styles.emptyText}>No redemptions found</Text>
      )}
    </View>
  );

  const renderPoints = () => (
    <View style={styles.content}>
      <View style={styles.pointsCard}>
        <Text style={styles.pointsTitle}>Points Breakdown</Text>
        <View style={styles.pointsRow}>
          <View style={styles.pointsItem}>
            <Text style={styles.pointsLabel}>Redeemable</Text>
            <Text style={[styles.pointsValue, styles.redeemable]}>{customer.redeemablePoints}</Text>
          </View>
          <View style={styles.pointsItem}>
            <Text style={styles.pointsLabel}>Pending</Text>
            <Text style={[styles.pointsValue, styles.pending]}>{customer.pendingPoints}</Text>
          </View>
        </View>
        <Text style={styles.pointsNote}>
          Pending points become redeemable after 90 days
        </Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{customer.name}</Text>
        <Text style={styles.headerSubtitle}>{customer.id}</Text>
      </View>

      <View style={styles.tabsContainer}>
        <Tab label="Overview" value="overview" />
        <Tab label="Purchases" value="purchases" />
        <Tab label="Points" value="points" />
        <Tab label="Redemptions" value="redemptions" />
      </View>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'purchases' && renderPurchases()}
      {activeTab === 'points' && renderPoints()}
      {activeTab === 'redemptions' && renderRedemptions()}
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 4,
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#7A1F2B',
  },
  tabText: {
    fontSize: 14,
    color: '#777777',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  content: {
    padding: 16,
  },
  infoCard: {
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
  infoLabel: {
    fontSize: 12,
    color: '#777777',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#242424',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusActive: {
    backgroundColor: '#E8F5E9',
  },
  statusInactive: {
    backgroundColor: '#FFEBEE',
  },
  statusPending: {
    backgroundColor: '#FFF3E0',
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
  statusTextPending: {
    color: '#F57C00',
  },
  pointsCard: {
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
  pointsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#242424',
    marginBottom: 16,
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  pointsItem: {
    alignItems: 'center',
  },
  pointsLabel: {
    fontSize: 12,
    color: '#777777',
    marginBottom: 4,
  },
  pointsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#242424',
  },
  redeemable: {
    color: '#2E7D32',
  },
  pending: {
    color: '#F57C00',
  },
  pointsNote: {
    fontSize: 12,
    color: '#777777',
    marginTop: 12,
    textAlign: 'center',
  },
  transactionCard: {
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
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  transactionId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#242424',
  },
  transactionDate: {
    fontSize: 12,
    color: '#777777',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#242424',
    marginBottom: 4,
  },
  transactionPoints: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  transactionReference: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 4,
  },
  transactionRecordedBy: {
    fontSize: 12,
    color: '#777777',
  },
  emptyText: {
    fontSize: 16,
    color: '#777777',
    textAlign: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#C62828',
    textAlign: 'center',
    padding: 40,
  },
});
