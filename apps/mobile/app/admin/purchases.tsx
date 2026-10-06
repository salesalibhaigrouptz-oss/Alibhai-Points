import { View, Text, StyleSheet, FlatList } from 'react-native';
import { mockPurchases } from '@/services/mock-admin-data';

export default function PurchasesList() {
  const PurchaseCard = ({ purchase }: { purchase: any }) => (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.id}>{purchase.id}</Text>
        <Text style={styles.date}>{purchase.date}</Text>
      </View>
      <Text style={styles.customer}>{purchase.customerName}</Text>
      <Text style={styles.customerId}>{purchase.customerId}</Text>
      <View style={styles.amountRow}>
        <Text style={styles.amount}>TZS {purchase.amount.toLocaleString()}</Text>
        <Text style={styles.points}>+{purchase.points} pts</Text>
      </View>
      <Text style={styles.recordedBy}>Recorded by: {purchase.recordedBy}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={mockPurchases}
        renderItem={({ item }) => <PurchaseCard purchase={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />
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
  recordedBy: {
    fontSize: 12,
    color: '#777777',
  },
});
