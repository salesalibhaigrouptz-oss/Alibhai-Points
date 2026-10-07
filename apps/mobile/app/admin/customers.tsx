import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useCustomers } from '@/services/hooks';
import { apiErrorMessage } from '@/services/api';

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-TZ', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function CustomersList() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
  const params: any = {};
  if (filter !== 'all') {
    params.status = filter;
  }
  if (searchQuery) {
    params.search = searchQuery;
  }
  
  const { data: customersData, isLoading, error, refetch } = useCustomers(params);
  const customers = customersData?.customers || [];

  const FilterButton = ({ label, value }: { label: string; value: 'all' | 'active' | 'inactive' }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === value && styles.filterButtonActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterButtonText, filter === value && styles.filterButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const CustomerCard = ({ customer }: { customer: any }) => (
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
        <Text style={styles.detailText}>💰 {customer.points_balance || 0} pts</Text>
      </View>
      <Text style={styles.lastTransaction}>
        Last: {customer.last_transaction_at ? formatDate(customer.last_transaction_at) : 'Never'}
      </Text>
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
        <Text style={styles.errorText}>Failed to load customers. Tap to retry.</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by ID, name, or phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filtersContainer}>
        <FilterButton label="All" value="all" />
        <FilterButton label="Active" value="active" />
        <FilterButton label="Inactive" value="inactive" />
      </View>

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
            <Text style={styles.emptyText}>No customers found</Text>
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
