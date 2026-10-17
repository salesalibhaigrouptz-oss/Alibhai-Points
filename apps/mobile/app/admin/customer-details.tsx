import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView as HorizontalScrollView,
} from "react-native";
import { useTranslation } from "react-i18next";
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { useAuth } from "@/services/auth-context";
import { apiClient, apiErrorMessage, formatPoints, formatTzs } from "@/services/api";
import {
  useCustomer,
  useCustomerPurchases,
  useAdminCustomerRedemptions,
  useCustomerStatement,
  useResetCustomerPin,
} from "@/services/hooks";

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-TZ', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function CustomerDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useAuth();
  const { t } = useTranslation();

  const { data: customer, isLoading, error, refetch } = useCustomer(id || '');
  const { data: purchasesData, isError: purchasesError, error: purchasesLoadError } = useCustomerPurchases(id || '', { limit: 20 });
  const purchases = purchasesData?.purchases || [];
  const { data: redemptionsData, isError: redemptionsError, error: redemptionsLoadError } = useAdminCustomerRedemptions(id || '', { limit: 20 });
  const redemptions = redemptionsData?.redemptions || [];

  const [activeTab, setActiveTab] = useState<
    "overview" | "purchases" | "points" | "redemptions" | "statement"
  >("overview");

  // Statement state
  const [dateRange, setDateRange] = useState<'this_month' | 'last_3_months' | 'all' | 'custom'>('this_month');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'this_month':
        return {
          from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
          to: now.toISOString().split('T')[0],
        };
      case 'last_3_months':
        return {
          from: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0],
          to: now.toISOString().split('T')[0],
        };
      case 'all':
        return { from: undefined, to: undefined };
      case 'custom':
        return {
          from: customFromDate || undefined,
          to: customToDate || undefined,
        };
      default:
        return { from: undefined, to: undefined };
    }
  };

  const { from, to } = getDateRange();
  const { data: statementData, isLoading: loadingStatement, isError: statementError, error: statementLoadError } = useCustomerStatement(id || '', from, to, 'json');

  const handleExportCSV = async () => {
    if (!id) return;
    try {
      const { from: csvFrom, to: csvTo } = getDateRange();
      const response = await apiClient.get<string>(
        `/api/admin/customers/${encodeURIComponent(id)}/statement`,
        {
          params: { from: csvFrom, to: csvTo, format: "csv" },
          responseType: "text",
        }
      );
      const csvText = response.data;

      if (Platform.OS === 'web') {
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', `statement_${id}_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        return;
      }

      const file = new File(Paths.cache, `statement_${id}_${Date.now()}.csv`);
      file.create({ overwrite: true });
      file.write(csvText);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: t('admin.customerDetails.shareCsv'),
        });
      } else {
        Alert.alert(t('common.done'), `CSV generated successfully at ${file.uri}`);
      }
    } catch (error) {
      Alert.alert(t('common.error'), apiErrorMessage(error));
    }
  };

  // Reset PIN state
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [newPin, setNewPin] = useState("");

  const resetMutation = useResetCustomerPin();

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#7A1F2B" />
      </View>
    );
  }

  if (error || !customer) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.errorText}>Customer not found</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleOpenResetModal = () => {
    setNewPin("");
    setResetModalVisible(true);
  };

  const handleConfirmResetPin = () => {
    const trimmedPin = newPin.trim();
    if (!/^\d{6}$/.test(trimmedPin)) {
      Alert.alert(
        "Hitilafu / Error",
        "PIN lazima iwe na tarakimu 6 kamili / PIN must be exactly 6 digits."
      );
      return;
    }

    Alert.alert(
      "Thibitisha / Confirm",
      `Una uhakika unataka kubadili PIN ya mteja ${customer.customer_code} (${customer.profiles?.full_name})?\n\nAre you sure you want to reset the PIN for customer ${customer.customer_code}?`,
      [
        { text: "Ghairi / Cancel", style: "cancel" },
        {
          text: "Ndio, Badili / Yes, Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await resetMutation.mutateAsync({
                customerCode: customer.customer_code,
                newPin: trimmedPin,
              });
              setResetModalVisible(false);
              setNewPin("");
              Alert.alert(
                "Mafanikio / Success",
                `PIN ya mteja ${customer.customer_code} imebadilishwa kikamilifu.\nCustomer PIN has been reset successfully.`
              );
            } catch (err) {
              Alert.alert("Hitilafu / Error", apiErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  const Tab = ({
    label,
    value,
  }: {
    label: string;
    value: typeof activeTab;
  }) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === value && styles.tabActive]}
      onPress={() => setActiveTab(value)}
    >
      <Text
        style={[
          styles.tabText,
          activeTab === value && styles.tabTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderOverview = () => (
    <View style={styles.content}>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>{t('admin.customerDetails.customerId')}</Text>
        <Text style={styles.infoValue}>{customer.customer_code}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>{t('admin.customerDetails.name')}</Text>
        <Text style={styles.infoValue}>{customer.profiles?.full_name || t('common.unknown')}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>{t('admin.customerDetails.phone')}</Text>
        <Text style={styles.infoValue}>{customer.profiles?.phone || 'N/A'}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>{t('admin.customerDetails.city')}</Text>
        <Text style={styles.infoValue}>{customer.city || 'N/A'}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>{t('admin.customerDetails.tier')}</Text>
        <Text style={styles.infoValue}>{typeof customer.tier === 'string' ? customer.tier : customer.tier?.name || 'N/A'}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>{t('admin.customerDetails.status')}</Text>
        <View
          style={[
            styles.statusBadge,
            customer.status === "active"
              ? styles.statusActive
              : styles.statusInactive,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              customer.status === "active"
                ? styles.statusTextActive
                : styles.statusTextInactive,
            ]}
          >
            {customer.status}
          </Text>
        </View>
      </View>

      <View style={styles.pointsCard}>
        <Text style={styles.pointsTitle}>Points Summary</Text>
        <View style={styles.pointsRow}>
          <View style={styles.pointsItem}>
            <Text style={styles.pointsLabel}>Total</Text>
            <Text style={styles.pointsValue}>{formatPoints(customer.points_balance || 0)}</Text>
          </View>
          <View style={styles.pointsItem}>
            <Text style={styles.pointsLabel}>Value</Text>
            <Text style={[styles.pointsValue, styles.redeemable]}>
              {formatTzs((customer.points_balance || 0) * (customer.point_value_tzs || 0))}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Lifetime Purchases</Text>
        <Text style={styles.infoValue}>{formatTzs(customer.lifetime_purchases || 0)}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Last Transaction</Text>
        <Text style={styles.infoValue}>{customer.last_transaction_at ? formatDate(customer.last_transaction_at) : 'Never'}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Activity Deadline</Text>
        <Text style={styles.infoValue}>{customer.activity_deadline ? formatDate(customer.activity_deadline) : 'N/A'}</Text>
      </View>

      {/* Admin Actions: Reset PIN button */}
      {role === "admin" && (
        <View style={styles.adminActionCard}>
          <Text style={styles.adminActionTitle}>{t('admin.customerDetails.adminActions')}</Text>
          <TouchableOpacity
            style={styles.resetPinButton}
            onPress={handleOpenResetModal}
          >
            <Text style={styles.resetPinButtonText}>
              {t('admin.customerDetails.resetPin')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderPurchases = () => (
    <View style={styles.content}>
      {purchasesError ? (
        <Text style={styles.emptyText}>{apiErrorMessage(purchasesLoadError)}</Text>
      ) : (
        <>
          {purchases.map((purchase) => (
            <View key={purchase.id} style={styles.transactionCard}>
              <View style={styles.transactionHeader}>
                <Text style={styles.transactionId}>{purchase.transaction_reference}</Text>
                <Text style={styles.transactionDate}>{formatDate(purchase.purchased_at)}</Text>
              </View>
              <Text style={styles.transactionAmount}>
                TZS {Number(purchase.purchase_amount || 0).toLocaleString()}
              </Text>
              <Text style={styles.transactionPoints}>+{purchase.points_earned} {t('common.pts')}</Text>
            </View>
          ))}
          {purchases.length === 0 && (
            <Text style={styles.emptyText}>{t('admin.customerDetails.noPurchases')}</Text>
          )}
        </>
      )}
    </View>
  );

  const renderRedemptions = () => (
    <View style={styles.content}>
      {redemptionsError ? (
        <Text style={styles.emptyText}>{apiErrorMessage(redemptionsLoadError)}</Text>
      ) : (
        <>
          {redemptions.map((redemption: any) => (
            <View key={redemption.id} style={styles.transactionCard}>
              <View style={styles.transactionHeader}>
                <Text style={styles.transactionId}>{redemption.redemption_reference}</Text>
                <Text style={styles.transactionDate}>{formatDate(redemption.redeemed_at)}</Text>
              </View>
              <Text style={styles.transactionPoints}>-{redemption.points_redeemed} {t('common.pts')}</Text>
              <Text style={styles.transactionAmount}>{redemption.status}</Text>
            </View>
          ))}
          {redemptions.length === 0 && (
            <Text style={styles.emptyText}>{t('admin.customerDetails.noRedemptions')}</Text>
          )}
        </>
      )}
    </View>
  );

  const renderPoints = () => (
    <View style={styles.content}>
      <View style={styles.pointsCard}>
        <Text style={styles.pointsTitle}>{t('admin.customerDetails.pointsBreakdown')}</Text>
        <View style={styles.pointsRow}>
          <View style={styles.pointsItem}>
            <Text style={styles.pointsLabel}>{t('admin.customerDetails.redeemable')}</Text>
            <Text style={[styles.pointsValue, styles.redeemable]}>
              {formatPoints(customer.points_balance || 0)}
            </Text>
          </View>
          <View style={styles.pointsItem}>
            <Text style={styles.pointsLabel}>{t('admin.customerDetails.valueTzs')}</Text>
            <Text style={[styles.pointsValue, styles.redeemable]}>
              {formatTzs((customer.points_balance || 0) * (customer.point_value_tzs || 0))}
            </Text>
          </View>
        </View>
        <Text style={styles.pointsNote}>
          {t('admin.customerDetails.pointValueNote', { value: formatTzs(customer.point_value_tzs || 0) })}
        </Text>
      </View>
    </View>
  );

  const renderStatement = () => {
    const statementEntries = (statementData as any)?.entries || (statementData as any)?.transactions || [];
    return (
      <View style={styles.content}>
        <View style={styles.statementControls}>
          <Text style={styles.statementLabel}>{t('admin.customerDetails.dateRange')}</Text>
          <View style={styles.dateRangeButtons}>
            <TouchableOpacity
              style={[styles.dateRangeButton, dateRange === 'this_month' && styles.dateRangeButtonActive]}
              onPress={() => setDateRange('this_month')}
            >
              <Text style={[styles.dateRangeButtonText, dateRange === 'this_month' && styles.dateRangeButtonTextActive]}>
                {t('admin.customerDetails.thisMonth')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateRangeButton, dateRange === 'last_3_months' && styles.dateRangeButtonActive]}
              onPress={() => setDateRange('last_3_months')}
            >
              <Text style={[styles.dateRangeButtonText, dateRange === 'last_3_months' && styles.dateRangeButtonTextActive]}>
                {t('admin.customerDetails.last3Months')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateRangeButton, dateRange === 'all' && styles.dateRangeButtonActive]}
              onPress={() => setDateRange('all')}
            >
              <Text style={[styles.dateRangeButtonText, dateRange === 'all' && styles.dateRangeButtonTextActive]}>
                {t('admin.customerDetails.all')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateRangeButton, dateRange === 'custom' && styles.dateRangeButtonActive]}
              onPress={() => setDateRange('custom')}
            >
              <Text style={[styles.dateRangeButtonText, dateRange === 'custom' && styles.dateRangeButtonTextActive]}>
                {t('admin.customerDetails.custom')}
              </Text>
            </TouchableOpacity>
          </View>

          {dateRange === 'custom' && (
            <View style={styles.customDateInputs}>
              <TextInput
                style={styles.dateInput}
                placeholder={t('admin.customerDetails.fromPlaceholder')}
                value={customFromDate}
                onChangeText={setCustomFromDate}
              />
              <TextInput
                style={styles.dateInput}
                placeholder={t('admin.customerDetails.toPlaceholder')}
                value={customToDate}
                onChangeText={setCustomToDate}
              />
            </View>
          )}

          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExportCSV}
          >
            <Text style={styles.exportButtonText}>{t('admin.customerDetails.shareCsv')}</Text>
          </TouchableOpacity>
        </View>

        {loadingStatement ? (
          <ActivityIndicator size="large" color="#7A1F2B" style={styles.loadingIndicator} />
        ) : statementError ? (
          <Text style={styles.emptyText}>{apiErrorMessage(statementLoadError)}</Text>
        ) : Array.isArray(statementEntries) && statementEntries.length > 0 ? (
          <View>
            {statementEntries.map((entry: any, index: number) => {
              const pointsChange = entry.points_change ?? entry.points ?? 0;
              const desc = entry.description || `${(entry.type || '').toUpperCase()}: ${entry.reference || ''}`;
              return (
                <View key={index} style={styles.transactionCard}>
                  <View style={styles.transactionHeader}>
                    <Text style={styles.transactionType}>{entry.type}</Text>
                    <Text style={styles.transactionDate}>{formatDate(entry.date)}</Text>
                  </View>
                  <Text style={styles.transactionDescription}>{desc}</Text>
                  <View style={styles.transactionAmountRow}>
                    <Text style={styles.transactionPoints}>
                      {pointsChange >= 0 ? '+' : ''}{formatPoints(pointsChange)} {t('common.pts')}
                    </Text>
                    {entry.value_tzs ? (
                      <Text style={styles.transactionValue}>
                        {formatTzs(entry.value_tzs)}
                      </Text>
                    ) : null}
                  </View>
                  {entry.voided ? (
                    <View style={styles.voidedBadge}>
                      <Text style={styles.voidedText}>VOIDED</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}

            <View style={styles.statementTotals}>
              <Text style={styles.totalsTitle}>{t('admin.customerDetails.totals')}</Text>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('admin.customerDetails.totalPointsEarned')}</Text>
                <Text style={styles.totalValue}>+{formatPoints((statementData as any)?.totals?.points_earned ?? (statementData as any)?.totals?.total_points_earned ?? 0)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('admin.customerDetails.totalPointsRedeemed')}</Text>
                <Text style={styles.totalValue}>-{formatPoints((statementData as any)?.totals?.points_redeemed ?? (statementData as any)?.totals?.total_points_redeemed ?? 0)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('admin.customerDetails.totalPurchaseValue')}</Text>
                <Text style={styles.totalValue}>{formatTzs((statementData as any)?.totals?.total_purchase_value ?? (statementData as any)?.totals?.total_value ?? 0)}</Text>
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>{t('admin.customerDetails.noTransactions')}</Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} refreshControl={
      <RefreshControl refreshing={isLoading} onRefresh={refetch} />
    }>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{customer.profiles?.full_name || 'Unknown'}</Text>
        <Text style={styles.headerSubtitle}>{customer.customer_code}</Text>
      </View>

      <HorizontalScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        <Tab label={t('admin.customerDetails.overview')} value="overview" />
        <Tab label={t('admin.customerDetails.purchases')} value="purchases" />
        <Tab label={t('admin.customerDetails.points')} value="points" />
        <Tab label={t('admin.customerDetails.statement')} value="statement" />
        <Tab label={t('admin.customerDetails.redemptions')} value="redemptions" />
      </HorizontalScrollView>

      {activeTab === "overview" && renderOverview()}
      {activeTab === "purchases" && renderPurchases()}
      {activeTab === "points" && renderPoints()}
      {activeTab === "statement" && renderStatement()}
      {activeTab === "redemptions" && renderRedemptions()}

      {/* Reset PIN Modal */}
      <Modal
        visible={resetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reset Customer PIN</Text>
            <Text style={styles.modalSubtitle}>
              Weka PIN mpya ya tarakimu 6 kwa mteja {customer.customer_code} ({customer.profiles?.full_name})
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="PIN mpya (tarakimu 6)"
              placeholderTextColor="#999999"
              value={newPin}
              onChangeText={(text) =>
                setNewPin(text.replace(/\D/g, "").slice(0, 6))
              }
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setResetModalVisible(false)}
                disabled={resetMutation.isPending}
              >
                <Text style={styles.modalCancelButtonText}>Ghairi / Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  (newPin.length !== 6 || resetMutation.isPending) &&
                    styles.buttonDisabled,
                ]}
                onPress={handleConfirmResetPin}
                disabled={newPin.length !== 6 || resetMutation.isPending}
              >
                {resetMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>
                    Badili / Reset
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  header: {
    padding: 20,
    backgroundColor: "#7A1F2B",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#FFFFFF",
    opacity: 0.9,
  },
  tabsContainer: {
    backgroundColor: "#FFFFFF",
    padding: 4,
  },
  tabsContent: {
    flexDirection: "row",
  },
  tab: {
    padding: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    borderRadius: 8,
    minWidth: 80,
  },
  tabActive: {
    backgroundColor: "#7A1F2B",
  },
  tabText: {
    fontSize: 14,
    color: "#777777",
    fontWeight: "600",
    flexShrink: 0,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  content: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoLabel: {
    fontSize: 12,
    color: "#777777",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#242424",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  statusActive: {
    backgroundColor: "#E8F5E9",
  },
  statusInactive: {
    backgroundColor: "#FFEBEE",
  },
  statusPending: {
    backgroundColor: "#FFF3E0",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statusTextActive: {
    color: "#2E7D32",
  },
  statusTextInactive: {
    color: "#C62828",
  },
  statusTextPending: {
    color: "#F57C00",
  },
  pointsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pointsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#242424",
    marginBottom: 16,
  },
  pointsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  pointsItem: {
    alignItems: "center",
  },
  pointsLabel: {
    fontSize: 12,
    color: "#777777",
    marginBottom: 4,
  },
  pointsValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#242424",
  },
  redeemable: {
    color: "#2E7D32",
  },
  pending: {
    color: "#F57C00",
  },
  pointsNote: {
    fontSize: 12,
    color: "#777777",
    marginTop: 12,
    textAlign: "center",
  },
  adminActionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  adminActionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#7A1F2B",
    marginBottom: 12,
    textTransform: "uppercase",
  },
  resetPinButton: {
    backgroundColor: "#7A1F2B",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  resetPinButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  transactionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  transactionId: {
    fontSize: 14,
    fontWeight: "600",
    color: "#242424",
  },
  transactionDate: {
    fontSize: 12,
    color: "#777777",
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#242424",
    marginBottom: 4,
  },
  transactionPoints: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2E7D32",
    marginBottom: 4,
  },
  transactionReference: {
    fontSize: 14,
    color: "#777777",
    marginBottom: 4,
  },
  transactionRecordedBy: {
    fontSize: 12,
    color: "#777777",
  },
  emptyText: {
    fontSize: 16,
    color: "#777777",
    textAlign: "center",
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: "#C62828",
    textAlign: "center",
    padding: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#242424",
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#777777",
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 8,
    padding: 14,
    fontSize: 20,
    letterSpacing: 4,
    textAlign: "center",
    color: "#242424",
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelButtonText: {
    color: "#777777",
    fontSize: 15,
    fontWeight: "600",
  },
  modalConfirmButton: {
    backgroundColor: "#7A1F2B",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 90,
    alignItems: "center",
  },
  modalConfirmButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryText: {
    fontSize: 16,
    color: '#7A1F2B',
    fontWeight: '600',
    marginTop: 16,
  },
  statementControls: {
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
  statementLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#242424',
    marginBottom: 12,
  },
  dateRangeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  dateRangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F3F3',
  },
  dateRangeButtonActive: {
    backgroundColor: '#7A1F2B',
  },
  dateRangeButtonText: {
    fontSize: 12,
    color: '#242424',
    fontWeight: '600',
  },
  dateRangeButtonTextActive: {
    color: '#FFFFFF',
  },
  customDateInputs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dateInput: {
    flex: 1,
    backgroundColor: '#F3F3F3',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  exportButton: {
    backgroundColor: '#7A1F2B',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingIndicator: {
    marginVertical: 40,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#242424',
  },
  transactionDescription: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 4,
  },
  transactionAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#242424',
  },
  voidedBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  voidedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#C62828',
  },
  statementTotals: {
    backgroundColor: '#F3F3F3',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  totalsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#242424',
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#777777',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#242424',
  },
});
