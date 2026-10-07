import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/services/auth-context';
import { useDashboardMetrics } from '@/services/hooks';
import { apiErrorMessage } from '@/services/api';

export default function AdminDashboard() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { data: metrics, isLoading, error, refetch } = useDashboardMetrics();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/welcome');
          },
        },
      ]
    );
  };

  const MetricCard = ({ title, value, subtitle, color }: { title: string; value: string | number; subtitle?: string; color: string }) => (
    <View style={[styles.metricCard, { borderLeftColor: color }]}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
    </View>
  );

  const ActionButton = ({ title, route, icon }: { title: string; route: string; icon: string }) => (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={() => router.push(route as any)}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionTitle}>{title}</Text>
    </TouchableOpacity>
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
        <Text style={styles.errorText}>Failed to load dashboard. Tap to retry.</Text>
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
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>Alibhai Points Management</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.metricsGrid}>
          <MetricCard
            title="Total Customers"
            value={metrics?.customers?.total || 0}
            color="#7A1F2B"
          />
          <MetricCard
            title="Active Customers"
            value={metrics?.customers?.active || 0}
            subtitle={`${metrics?.customers?.inactive || 0} inactive`}
            color="#242424"
          />
          <MetricCard
            title="Near Deadline"
            value={metrics?.customers?.near_deadline || 0}
            subtitle="within 5 days"
            color="#F57C00"
          />
          <MetricCard
            title="Points Issued"
            value={metrics?.points?.total_issued || 0}
            color="#7A1F2B"
          />
          <MetricCard
            title="Redeemable Points"
            value={metrics?.points?.redeemable || 0}
            color="#242424"
          />
          <MetricCard
            title="Waiting Points"
            value={metrics?.points?.waiting || 0}
            subtitle="not yet redeemable"
            color="#F57C00"
          />
          <MetricCard
            title="Redeemed Points"
            value={metrics?.points?.redeemed || 0}
            color="#7A1F2B"
          />
          <MetricCard
            title="Expired Points"
            value={metrics?.points?.expired || 0}
            color="#C62828"
          />
          <MetricCard
            title="Today's Purchases"
            value={metrics?.purchases?.today?.count || 0}
            subtitle={`TZS ${(metrics?.purchases?.today?.value || 0).toLocaleString()}`}
            color="#242424"
          />
          <MetricCard
            title="This Month"
            value={metrics?.purchases?.this_month?.count || 0}
            subtitle={`TZS ${(metrics?.purchases?.this_month?.value || 0).toLocaleString()}`}
            color="#7A1F2B"
          />
          <MetricCard
            title="Pending Requests"
            value={metrics?.redemptions?.pending_count || 0}
            subtitle="redemptions"
            color="#F57C00"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <ActionButton
            title="Record Purchase"
            route="/admin/record-purchase"
            icon="📝"
          />
          <ActionButton
            title="View Customers"
            route="/admin/customers"
            icon="👥"
          />
          <ActionButton
            title="Purchases"
            route="/admin/purchases"
            icon="🛒"
          />
          <ActionButton
            title="Redemptions"
            route="/admin/redemptions"
            icon="🎁"
          />
          <ActionButton
            title="Point Rules"
            route="/admin/point-rules"
            icon="⚙️"
          />
          <ActionButton
            title="Audit Logs"
            route="/admin/audit-logs"
            icon="📋"
          />
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#242424',
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: '1%',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 100,
  },
  metricTitle: {
    fontSize: 12,
    color: '#777777',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#242424',
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 12,
    color: '#777777',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  actionButton: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    margin: '1%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#242424',
    textAlign: 'center',
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
