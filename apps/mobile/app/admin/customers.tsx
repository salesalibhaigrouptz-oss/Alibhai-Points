import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { mockCustomers } from '@/services/mock-admin-data';

export default function CustomersList() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filteredCustomers = mockCustomers.filter(customer => {
    const matchesSearch =
      customer.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery);

    const matchesFilter =
      filter === 'all' || customer.status === filter;

    return matchesSearch && matchesFilter;
  });

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
      onPress={() => router.push(`/admin/customer-details?id=${customer.id}` as any)}
    >
      <View style={styles.customerHeader}>
        <View>
          <Text style={styles.customerName}>{customer.name}</Text>
          <Text style={styles.customerId}>{customer.id}</Text>
        </View>
        <View style={[styles.statusBadge, customer.status === 'active' ? styles.statusActive : styles.statusInactive]}>
          <Text style={[styles.statusText, customer.status === 'active' ? styles.statusTextActive : styles.statusTextInactive]}>
            {customer.status}
          </Text>
        </View>
      </View>
      <View style={styles.customerDetails}>
        <Text style={styles.detailText}>📱 {customer.phone}</Text>
        <Text style={styles.detailText}>💰 {customer.points} pts</Text>
      </View>
      <Text style={styles.lastTransaction}>
        Last: {customer.lastTransaction}
      </Text>
    </TouchableOpacity>
  );

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
        data={filteredCustomers}
        renderItem={({ item }) => <CustomerCard customer={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
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
});
