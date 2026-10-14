import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCustomers, useCustomerCities } from '@/services/hooks';
import { apiErrorMessage } from '@/services/api';

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-TZ', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function CustomersList() {
  const router = useRouter();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [nearDeadline, setNearDeadline] = useState<boolean>(false);

  const { data: cities } = useCustomerCities();

  const cityList: string[] = Array.isArray(cities)
    ? (cities as any[]).map((c) => (typeof c === 'string' ? c : c?.city)).filter(Boolean)
    : Array.isArray((cities as any)?.cities)
    ? (cities as any).cities.map((c: any) => (typeof c === 'string' ? c : c?.city)).filter(Boolean)
    : [];

  const params: any = {};
  if (statusFilter !== 'all') {
    params.status = statusFilter;
  }
  if (cityFilter !== 'all') {
    params.city = cityFilter;
  }
  if (tierFilter !== 'all') {
    params.tier = tierFilter;
  }
  if (nearDeadline) {
    params.near_deadline = 'true';
  }
  if (searchQuery) {
    params.search = searchQuery;
  }

  const { data: customersData, isLoading, error, refetch } = useCustomers(params);
  const customers = customersData?.customers || [];

  const FilterButton = ({ label, value, active }: { label: string; value: string; active: boolean }) => (
    <TouchableOpacity
      style={[styles.filterButton, active && styles.filterButtonActive]}
      onPress={() => setStatusFilter(value as 'all' | 'active' | 'inactive')}
    >
      <Text style={[styles.filterButtonText, active && styles.filterButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const CustomerCard = ({ customer }: { customer: any }) => {
    const tierName = typeof customer.tier === 'string' ? customer.tier : customer.tier?.name || 'N/A';
    return (
      <TouchableOpacity
        style={styles.customerCard}
        onPress={() => router.push(`/admin/customer-details?id=${customer.customer_code}` as any)}
      >
        <View style={styles.customerHeader}>
          <View>
            <Text style={styles.customerName}>{customer.profiles?.full_name || 'Unknown'}</Text>
            <Text style={styles.customerId}>{customer.customer_code}</Text>
          </View>
          <View style={[styles.statusBadge, customer.status === 'active' ? styles.statusActive : styles.statusInactive]}>
            <Text style={[styles.statusText, customer.status === 'active' ? styles.statusTextActive : styles.statusTextInactive]}>
              {customer.status}
            </Text>
          </View>
        </View>
        <View style={styles.customerDetails}>
          <Text style={styles.detailText}>📱 {customer.profiles?.phone || 'N/A'}</Text>
          <Text style={styles.detailText}>🏙️ {customer.city || 'N/A'}</Text>
          <Text style={styles.detailText}>⭐ {tierName}</Text>
          <Text style={styles.detailText}>💰 {customer.points_balance || 0} pts</Text>
        </View>
        <Text style={styles.lastTransaction}>
          Last: {customer.last_transaction_at ? formatDate(customer.last_transaction_at) : 'Never'}
        </Text>
      </TouchableOpacity>
    );
  };

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
        <Text style={styles.errorText}>{t('admin.customers.failedLoad') || apiErrorMessage(error)}</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('admin.customers.search')}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filtersContainer}>
        <FilterButton label={t('admin.customers.all')} value="all" active={statusFilter === 'all'} />
        <FilterButton label={t('admin.customers.active')} value="active" active={statusFilter === 'active'} />
        <FilterButton label={t('admin.customers.inactive')} value="inactive" active={statusFilter === 'inactive'} />
      </View>

      <View style={styles.filterRow}>
        <View style={styles.filterSelect}>
          <Text style={styles.filterLabel}>{t('admin.customers.filterCity')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollFilter}>
            <TouchableOpacity
              style={[styles.filterChip, cityFilter === 'all' && styles.filterChipActive]}
              onPress={() => setCityFilter('all')}
            >
              <Text style={[styles.filterChipText, cityFilter === 'all' && styles.filterChipTextActive]}>{t('admin.customers.all')}</Text>
            </TouchableOpacity>
            {cityList.map((city: string) => (
              <TouchableOpacity
                key={city}
                style={[styles.filterChip, cityFilter === city && styles.filterChipActive]}
                onPress={() => setCityFilter(city)}
              >
                <Text style={[styles.filterChipText, cityFilter === city && styles.filterChipTextActive]}>{city}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <View style={styles.filterRow}>
        <View style={styles.filterSelect}>
          <Text style={styles.filterLabel}>{t('admin.customers.filterTier')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollFilter}>
            <TouchableOpacity
              style={[styles.filterChip, tierFilter === 'all' && styles.filterChipActive]}
              onPress={() => setTierFilter('all')}
            >
              <Text style={[styles.filterChipText, tierFilter === 'all' && styles.filterChipTextActive]}>{t('admin.customers.all')}</Text>
            </TouchableOpacity>
            {['Bronze', 'Silver', 'Gold', 'Platinum'].map((tier) => (
              <TouchableOpacity
                key={tier}
                style={[styles.filterChip, tierFilter === tier && styles.filterChipActive]}
                onPress={() => setTierFilter(tier)}
              >
                <Text style={[styles.filterChipText, tierFilter === tier && styles.filterChipTextActive]}>{tier}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.nearDeadlineButton, nearDeadline && styles.nearDeadlineButtonActive]}
        onPress={() => setNearDeadline(!nearDeadline)}
      >
        <Text style={[styles.nearDeadlineButtonText, nearDeadline && styles.nearDeadlineButtonTextActive]}>
          {nearDeadline ? t('admin.customers.nearDeadlineActive') : t('admin.customers.nearDeadline')}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={customers}
        renderItem={({ item }) => <CustomerCard customer={item} />}
        keyExtractor={(item) => item.customer_code}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('admin.customers.empty')}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    backgroundColor: '#F3F3F3',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
  },
  filtersContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F3F3F3',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#7A1F2B',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#242424',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  filterRow: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  filterSelect: {
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 12,
    color: '#777777',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  scrollFilter: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F3F3',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#7A1F2B',
  },
  filterChipText: {
    fontSize: 14,
    color: '#242424',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  nearDeadlineButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  nearDeadlineButtonActive: {
    backgroundColor: '#FFF3E0',
  },
  nearDeadlineButtonText: {
    fontSize: 14,
    color: '#777777',
  },
  nearDeadlineButtonTextActive: {
    fontSize: 14,
    color: '#F57C00',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  customerCard: {
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
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#242424',
    marginBottom: 4,
  },
  customerId: {
    fontSize: 14,
    color: '#777777',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
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
  customerDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#777777',
  },
  lastTransaction: {
    fontSize: 12,
    color: '#777777',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
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
});
