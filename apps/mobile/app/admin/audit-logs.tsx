import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuditLogs } from '@/services/hooks';
import { apiErrorMessage } from '@/services/api';

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-TZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function AuditLogs() {
  const { data: logsData, isLoading, error, refetch } = useAuditLogs({ limit: 50 });
  const logs = logsData?.logs || [];

  const LogCard = ({ log }: { log: any }) => (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.action}>{log.action}</Text>
        <Text style={styles.date}>{formatDate(log.created_at)}</Text>
      </View>
      <Text style={styles.admin}>Admin: {log.profiles?.full_name || 'Unknown'}</Text>
      <Text style={styles.description}>{log.description}</Text>
      {log.entity_type && (
        <Text style={styles.entity}>Entity: {log.entity_type}</Text>
      )}
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
        <Text style={styles.errorText}>Failed to load audit logs. Tap to retry.</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={logs}
        renderItem={({ item }) => <LogCard log={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No audit logs found</Text>
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
  description: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 4,
  },
  entity: {
    fontSize: 12,
    color: '#999999',
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#777777',
  },
});
