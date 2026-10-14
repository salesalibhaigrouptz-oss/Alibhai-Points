import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuth } from '@/services/auth-context';
import { useDashboardMetrics, useCustomerCities } from '@/services/hooks';
import { apiErrorMessage } from '@/services/api';
import { LanguageToggle } from '@/components/language-toggle';

export default function AdminDashboard() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const [cityFilter, setCityFilter] = useState<string>('all');
  const { data: cities } = useCustomerCities();
  const { data: metrics, isLoading, error, refetch } = useDashboardMetrics(cityFilter === 'all' ? undefined : cityFilter);

  const cityList: string[] = Array.isArray(cities)
    ? (cities as any[]).map((c) => (typeof c === 'string' ? c : c?.city)).filter(Boolean)
    : Array.isArray((cities as any)?.cities)
    ? (cities as any).cities.map((c: any) => (typeof c === 'string' ? c : c?.city)).filter(Boolean)
    : [];

  const handleLogout = () => {
    Alert.alert(
      t('admin.dashboard.logout'),
      t('admin.dashboard.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.dashboard.logout'),
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
          <Text style={styles.headerTitle}>{t('admin.dashboard.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('admin.dashboard.subtitle')}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>{t('admin.dashboard.logout')}</Text>
        </TouchableOpacity>
      </View>

      <LanguageToggle />

      <View style={styles.cityFilterContainer}>
        <Text style={styles.cityFilterLabel}>{t('admin.dashboard.filterByCity')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cityFilterScroll}>
          <TouchableOpacity
            style={[styles.cityFilterChip, cityFilter === 'all' && styles.cityFilterChipActive]}
            onPress={() => setCityFilter('all')}
          >
            <Text style={[styles.cityFilterChipText, cityFilter === 'all' && styles.cityFilterChipTextActive]}>{t('admin.dashboard.allCities')}</Text>
          </TouchableOpacity>
          {cityList.map((city: string) => (
            <TouchableOpacity
              key={city}
              style={[styles.cityFilterChip, cityFilter === city && styles.cityFilterChipActive]}
              onPress={() => setCityFilter(city)}
            >
              <Text style={[styles.cityFilterChipText, cityFilter === city && styles.cityFilterChipTextActive]}>{city}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.dashboard.overview')}</Text>
        <View style={styles.metricsGrid}>
          <MetricCard
            title={t('admin.dashboard.totalCustomers')}
            value={metrics?.customers?.total || 0}
            color="#7A1F2B"
          />
          <MetricCard
            title={t('admin.dashboard.activeCustomers')}
            value={metrics?.customers?.active || 0}
            subtitle={`${metrics?.customers?.inactive || 0} ${t('admin.dashboard.inactive')}`}
            color="#242424"
          />
          <MetricCard
            title={t('admin.dashboard.nearDeadline')}
            value={metrics?.customers?.near_deadline || 0}
            subtitle={t('admin.dashboard.within5Days')}
            color="#F57C00"
          />
          <MetricCard
            title={t('admin.dashboard.pointsIssued')}
            value={metrics?.points?.total_issued || 0}
            color="#7A1F2B"
          />
          <MetricCard
            title={t('admin.dashboard.redeemablePoints')}
            value={metrics?.points?.redeemable || 0}
            color="#242424"
          />
          <MetricCard
            title={t('admin.dashboard.waitingPoints')}
            value={metrics?.points?.waiting || 0}
            subtitle={t('admin.dashboard.notYetRedeemable')}
            color="#F57C00"
          />
          <MetricCard
            title={t('admin.dashboard.redeemedPoints')}
            value={metrics?.points?.redeemed || 0}
            color="#7A1F2B"
          />
          <MetricCard
            title={t('admin.dashboard.expiredPoints')}
            value={metrics?.points?.expired || 0}
            color="#C62828"
          />
          <MetricCard
            title={t('admin.dashboard.todayPurchases')}
            value={metrics?.purchases?.today?.count || 0}
            subtitle={`TZS ${(metrics?.purchases?.today?.value || 0).toLocaleString()}`}
            color="#242424"
          />
          <MetricCard
            title={t('admin.dashboard.thisMonth')}
            value={metrics?.purchases?.this_month?.count || 0}
            subtitle={`TZS ${(metrics?.purchases?.this_month?.value || 0).toLocaleString()}`}
            color="#7A1F2B"
          />
          <MetricCard
            title={t('admin.dashboard.pendingRequests')}
            value={metrics?.redemptions?.pending_count || 0}
            subtitle={t('admin.dashboard.pendingSubtitle')}
            color="#F57C00"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.dashboard.quickActions')}</Text>
        <View style={styles.actionsGrid}>
          <ActionButton
            title={t('admin.dashboard.recordPurchase')}
            route="/admin/record-purchase"
            icon="📝"
          />
          <ActionButton
            title={t('admin.dashboard.viewCustomers')}
            route="/admin/customers"
            icon="👥"
          />
          <ActionButton
            title={t('admin.dashboard.purchases')}
            route="/admin/purchases"
            icon="🛒"
          />
          <ActionButton
            title={t('admin.dashboard.redemptions')}
            route="/admin/redemptions"
            icon="🎁"
          />
          <ActionButton
            title={t('admin.dashboard.pointRules')}
            route="/admin/point-rules"
            icon="⚙️"
          />
          <ActionButton
            title={t('admin.dashboard.auditLogs')}
            route="/admin/audit-logs"
            icon="📋"
          />
          <ActionButton
            title={t('admin.dashboard.tiers')}
            route="/admin/tiers"
            icon="⭐"
          />
        </View>
      </View>

      {((metrics?.city_breakdown && metrics.city_breakdown.length > 0) || ((metrics as any)?.by_city && (metrics as any).by_city.length > 0)) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.dashboard.cityBreakdown')}</Text>
          <View style={styles.breakdownContainer}>
            {(metrics?.city_breakdown || (metrics as any)?.by_city || []).map((item: any) => (
              <View key={item.city} style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>{item.city}</Text>
                <Text style={styles.breakdownValue}>{t('admin.dashboard.customersCount', { count: item.count ?? item.customers ?? 0 })}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {((metrics?.tier_counts && metrics.tier_counts.length > 0) || ((metrics as any)?.by_tier && (metrics as any).by_tier.length > 0)) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.dashboard.tierDistribution')}</Text>
          <View style={styles.breakdownContainer}>
            {(metrics?.tier_counts || (metrics as any)?.by_tier || []).map((item: any) => (
              <View key={item.tier} style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>{item.tier}</Text>
                <Text style={styles.breakdownValue}>{t('admin.dashboard.customersCount', { count: item.count ?? item.customer_count ?? 0 })}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
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
  cityFilterContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  cityFilterLabel: {
    fontSize: 12,
    color: '#777777',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  cityFilterScroll: {
    flexDirection: 'row',
  },
  cityFilterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F3F3',
    marginRight: 8,
  },
  cityFilterChipActive: {
    backgroundColor: '#7A1F2B',
  },
  cityFilterChipText: {
    fontSize: 14,
    color: '#242424',
    fontWeight: '600',
  },
  cityFilterChipTextActive: {
    color: '#FFFFFF',
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
  breakdownContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#242424',
    fontWeight: '600',
  },
  breakdownValue: {
    fontSize: 14,
    color: '#777777',
  },
});
