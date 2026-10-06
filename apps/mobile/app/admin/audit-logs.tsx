import { View, Text, StyleSheet, FlatList } from 'react-native';
import { mockAuditLogs } from '@/services/mock-admin-data';

export default function AuditLogs() {
  const LogCard = ({ log }: { log: any }) => (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.action}>{log.action}</Text>
        <Text style={styles.date}>{log.date}</Text>
      </View>
      <Text style={styles.admin}>Admin: {log.admin}</Text>
      <Text style={styles.customer}>Customer: {log.customer}</Text>
      <Text style={styles.description}>{log.description}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={mockAuditLogs}
        renderItem={({ item }) => <LogCard log={item} />}
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
  action: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#7A1F2B',
  },
  date: {
    fontSize: 12,
    color: '#777777',
  },
  admin: {
    fontSize: 14,
    color: '#242424',
    marginBottom: 4,
  },
  customer: {
    fontSize: 14,
    color: '#242424',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#777777',
  },
});
