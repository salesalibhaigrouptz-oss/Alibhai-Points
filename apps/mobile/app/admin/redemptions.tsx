import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { mockRedemptions } from '@/services/mock-admin-data';

export default function RedemptionsList() {
  const RedemptionCard = ({ redemption }: { redemption: any }) => (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.id}>{redemption.id}</Text>
        <Text style={styles.date}>{redemption.date}</Text>
      </View>
      <Text style={styles.customer}>{redemption.customerName}</Text>
      <Text style={styles.customerId}>{redemption.customerId}</Text>
      <View style={styles.pointsRow}>
        <Text style={styles.points}>-{redemption.points} pts</Text>
        <View style={[styles.statusBadge, redemption.status === 'approved' ? styles.statusApproved : redemption.status === 'pending' ? styles.statusPending : styles.statusRejected]}>
          <Text style={[styles.statusText, redemption.status === 'approved' ? styles.statusTextApproved : redemption.status === 'pending' ? styles.statusTextPending : styles.statusTextRejected]}>
            {redemption.status}
          </Text>
        </View>
      </View>
      <Text style={styles.reference}>Ref: {redemption.reference}</Text>
      {redemption.processedBy && (
        <Text style={styles.processedBy}>Processed by: {redemption.processedBy}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={mockRedemptions}
        renderItem={({ item }) => <RedemptionCard redemption={item} />}
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
  statusPending: {
    backgroundColor: '#FFF3E0',
  },
  statusRejected: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextApproved: {
    color: '#2E7D32',
  },
  statusTextPending: {
    color: '#F57C00',
  },
  statusTextRejected: {
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
});
