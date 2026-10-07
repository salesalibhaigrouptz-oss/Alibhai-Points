import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { z } from "zod";
import { useAuth } from "@/services/auth-context";
import { useColors } from "@/hooks/useColors";
import {
  Card,
  EmptyState,
  ErrorState,
  InlineNotice,
  LabelValue,
  LoadingState,
  Page,
  PageHeading,
  PrimaryButton,
  TextButton,
  TextField,
} from "@/components/primitives";
import {
  apiErrorMessage,
  formatDate,
  formatPoints,
  formatTzs,
} from "@/services/api";
import {
  useCustomerPointsSummary,
  useCreateCustomerRedemption,
  useMyPurchases,
  useMyRedemptions,
  useMe,
} from "@/services/hooks";

type CustomerRedemption = {
  id: string;
  points?: number;
  status?: string;
  reference?: string;
};

const getGetCustomerDashboardQueryKey = () => ['customer-points-summary'];
const getListCustomerRedemptionsQueryKey = () => ['customer-redemptions'];

const useGetCustomerDashboard = (meData: any) => {
  const query = useCustomerPointsSummary();
  
  return {
    data: query.data ? {
      totalPoints: query.data.total_points,
      redeemablePoints: query.data.redeemable_points,
      pendingPoints: query.data.waiting_points,
      customer: {
        fullName: meData?.profile?.full_name || 'Customer',
        customerId: query.data.customer_code,
        phoneNumber: meData?.profile?.phone || '',
        status: query.data.status,
        unusedPointsExpired: query.data.expired_points > 0,
      },
      fullName: meData?.profile?.full_name || 'Customer',
      customerId: query.data.customer_code,
      phoneNumber: meData?.profile?.phone || '',
      status: query.data.status,
      unusedPointsExpired: query.data.expired_points > 0,
      activityDeadline: query.data.activity_deadline,
      redemptionEligible: query.data.redeemable_points > 0 && query.data.status === 'active',
      redemptionBlockedReason: query.data.status === 'inactive' ? 'Account is inactive' : null,
      nextPointsAvailableAt: query.data.next_unlock_at,
    } : null,
    isLoading: query.isLoading,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};

const useGetCustomerProfile = (meData: any) => {
  const query = useCustomerPointsSummary();
  
  return {
    data: meData && query.data ? {
      customer: {
        fullName: meData.profile?.full_name || 'Customer',
        customerId: query.data.customer_code,
        phoneNumber: meData.profile?.phone || '',
        status: query.data.status,
        unusedPointsExpired: query.data.expired_points > 0,
      },
      fullName: meData.profile?.full_name || 'Customer',
      customerId: query.data.customer_code,
      phoneNumber: meData.profile?.phone || '',
      status: query.data.status,
      unusedPointsExpired: query.data.expired_points > 0,
    } : null,
    isLoading: query.isLoading,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};

const useListCustomerTransactions = () => {
  const query = useMyPurchases();
  
  return {
    data: { 
      items: query.data?.purchases.map((p: any) => ({
        id: p.id,
        reference: p.transaction_reference,
        purchaseAmount: p.purchase_amount,
        pointsEarned: p.points_earned,
        occurredAt: p.purchased_at,
      })) || []
    },
    isLoading: query.isLoading,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};

const useListCustomerRedemptions = () => {
  const query = useMyRedemptions();
  
  return {
    data: { 
      items: query.data?.redemptions.map((r: any) => ({
        id: r.id,
        reference: r.redemption_reference,
        pointsRedeemed: r.points_redeemed,
        status: r.status,
        occurredAt: r.redeemed_at,
      })) || []
    },
    isLoading: query.isLoading,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};

const useCreateRedemption = () => {
  const mutation = useCreateCustomerRedemption();
  
  return {
    mutateAsync: async (params: any) => {
      const result = await mutation.mutateAsync(params.data?.points || params);
      return {
        id: result.redemption_id,
        reference: result.reference,
        status: result.status,
        points: result.points,
      };
    },
    isPending: mutation.isPending,
  };
};

function StatusPill({ active }: { active: boolean }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statusPill,
        {
          backgroundColor: active ? colors.successSurface : colors.warningSurface,
        },
      ]}
    >
      <View
        style={[
          styles.statusDot,
          { backgroundColor: active ? colors.success : colors.destructive },
        ]}
      />
      <Text
        style={[
          styles.statusLabel,
          { color: active ? colors.success : colors.destructive },
        ]}
      >
        {active ? "Active" : "Inactive"}
      </Text>
    </View>
  );
}

function PointsHero({
  total,
  redeemable,
  pending,
}: {
  total: number;
  redeemable: number;
  pending: number;
}) {
  const colors = useColors();
  return (
    <View style={[styles.pointsHero, { backgroundColor: colors.primary }]}>
      <View style={styles.heroTopline}>
        <Text
          style={[
            styles.heroLabel,
            { color: colors.primaryForeground, opacity: 0.82 },
          ]}
        >
          Total points
        </Text>
        <Feather name="award" size={21} color={colors.primaryForeground} />
      </View>
      <Text style={[styles.heroTotal, { color: colors.primaryForeground }]}>
        {formatPoints(total)}
      </Text>
      <View
        style={[
          styles.heroDivider,
          { backgroundColor: colors.primaryForeground, opacity: 0.25 },
        ]}
      />
      <View style={styles.heroStats}>
        <View style={styles.heroStat}>
          <Text
            style={[styles.heroStatValue, { color: colors.primaryForeground }]}
          >
            {formatPoints(redeemable)}
          </Text>
          <Text
            style={[
              styles.heroStatLabel,
              { color: colors.primaryForeground, opacity: 0.82 },
            ]}
          >
            Redeemable
          </Text>
        </View>
        <View
          style={[
            styles.heroStatSeparator,
            { backgroundColor: colors.primaryForeground, opacity: 0.25 },
          ]}
        />
        <View style={styles.heroStat}>
          <Text
            style={[styles.heroStatValue, { color: colors.primaryForeground }]}
          >
            {formatPoints(pending)}
          </Text>
          <Text
            style={[
              styles.heroStatLabel,
              { color: colors.primaryForeground, opacity: 0.82 },
            ]}
          >
            Pending
          </Text>
        </View>
      </View>
    </View>
  );
}

function InactiveNotice({ expired }: { expired: boolean }) {
  return (
    <InlineNotice
      tone="warning"
      message={
        expired
          ? "This account is inactive. Previously unused points have expired."
          : "This account is inactive. Contact Alibhai for help with your account."
      }
    />
  );
}

function RecordCard({
  title,
  subtitle,
  amount,
  detail,
  reference,
  status,
}: {
  title: string;
  subtitle: string;
  amount: string;
  detail: string;
  reference: string;
  status?: string;
}) {
  const colors = useColors();
  return (
    <Card style={styles.recordCard}>
      <View style={styles.recordTop}>
        <View style={[styles.recordIcon, { backgroundColor: colors.accent }]}>
          <Feather
            name={title === "Purchase" ? "shopping-bag" : "repeat"}
            size={17}
            color={colors.primary}
          />
        </View>
        <View style={styles.recordHeading}>
          <Text style={[styles.recordTitle, { color: colors.foreground }]}>
            {title}
          </Text>
          <Text style={[styles.recordSubtitle, { color: colors.mutedForeground }]}>
            {subtitle}
          </Text>
        </View>
        <Text style={[styles.recordAmount, { color: colors.foreground }]}>
          {amount}
        </Text>
      </View>
      <View style={[styles.recordFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.recordDetail, { color: colors.primary }]}>{detail}</Text>
        {status ? (
          <Text style={[styles.recordStatus, { color: colors.mutedForeground }]}>
            {status}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.reference, { color: colors.mutedForeground }]}>
        Ref. {reference}
      </Text>
    </Card>
  );
}

export function HomeScreen() {
  const colors = useColors();
  const { data: me } = useMe();
  const query = useGetCustomerDashboard(me);
  const data = query.data;

  return (
    <Page withTabs>
      <PageHeading eyebrow="Alibhai Points" title="Your rewards at a glance" />
      {query.isPending ? <LoadingState /> : null}
      {query.isError ? (
        <ErrorState
          message={apiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {data ? (
        <>
          <View style={styles.greetingRow}>
            <View style={styles.greetingText}>
              <Text style={[styles.greeting, { color: colors.foreground }]}>
                Habari, {data.customer.fullName.split(" ")[0]}
              </Text>
              <Text style={[styles.customerId, { color: colors.mutedForeground }]}>
                Customer ID · {data.customer.customerId}
              </Text>
            </View>
            <StatusPill active={data.customer.status === "active"} />
          </View>
          {data.customer.status === "inactive" ? (
            <InactiveNotice expired={data.customer.unusedPointsExpired} />
          ) : null}
          <PointsHero
            total={data.totalPoints}
            redeemable={data.redeemablePoints}
            pending={data.pendingPoints}
          />
          <Card style={styles.deadlineCard}>
            <View style={[styles.deadlineIcon, { backgroundColor: colors.accent }]}>
              <Feather name="calendar" size={18} color={colors.primary} />
            </View>
            <View style={styles.deadlineCopy}>
              <Text style={[styles.deadlineTitle, { color: colors.foreground }]}>
                Stay active
              </Text>
              <Text style={[styles.deadlineBody, { color: colors.mutedForeground }]}>
                {data.activityDeadline
                  ? `Your activity deadline is ${formatDate(data.activityDeadline)}.`
                  : "Your activity deadline will appear here when provided by Alibhai."}
              </Text>
            </View>
          </Card>
          {data.redemptionEligible ? null : data.redemptionBlockedReason ? (
            <InlineNotice message={data.redemptionBlockedReason} />
          ) : null}
          <View style={styles.actionStack}>
            <PrimaryButton
              label="Redeem points"
              onPress={() => router.push("/redeem")}
              disabled={
                !data.redemptionEligible ||
                data.customer.status !== "active" ||
                data.redeemablePoints <= 0
              }
              testID="home-redeem"
            />
            <TextButton
              label="View purchase transactions"
              onPress={() => router.push("/transactions")}
              testID="home-transactions"
            />
          </View>
        </>
      ) : null}
    </Page>
  );
}

export function PointsScreen() {
  const colors = useColors();
  const { data: me } = useMe();
  const query = useGetCustomerDashboard(me);
  const data = query.data;
  return (
    <Page withTabs>
      <PageHeading
        eyebrow="Points"
        title="Your balance"
        description="See which points are ready and which are still pending."
      />
      {query.isPending ? <LoadingState /> : null}
      {query.isError ? (
        <ErrorState
          message={apiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {data ? (
        <>
          {data.customer.status === "inactive" ? (
            <InactiveNotice expired={data.customer.unusedPointsExpired} />
          ) : null}
          <PointsHero
            total={data.totalPoints}
            redeemable={data.redeemablePoints}
            pending={data.pendingPoints}
          />
          <Card style={styles.pointDetailCard}>
            <LabelValue
              label="Available to redeem"
              value={`${formatPoints(data.redeemablePoints)} points`}
              icon="check-circle"
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <LabelValue
              label="Pending"
              value={`${formatPoints(data.pendingPoints)} points`}
              icon="clock"
            />
            <Text style={[styles.pointNote, { color: colors.mutedForeground }]}>
              Pending points become available after 90 days, according to the
              program rules.
            </Text>
            <LabelValue
              label="Next points available"
              value={formatDate(data.nextPointsAvailableAt)}
              icon="calendar"
            />
          </Card>
          {data.redemptionEligible ? null : data.redemptionBlockedReason ? (
            <InlineNotice message={data.redemptionBlockedReason} />
          ) : null}
          <PrimaryButton
            label="Redeem points"
            onPress={() => router.push("/redeem")}
            disabled={
              !data.redemptionEligible ||
              data.customer.status !== "active" ||
              data.redeemablePoints <= 0
            }
          />
          <TextButton
            label="View purchase transactions"
            onPress={() => router.push("/transactions")}
          />
        </>
      ) : null}
    </Page>
  );

}

export function TransactionsScreen() {
  const query = useListCustomerTransactions();
  return (
    <Page>
      <PageHeading
        eyebrow="Transactions"
        title="Your purchases"
        description="Purchases and points earned on your Alibhai account."
      />
      {query.isPending ? <LoadingState label="Loading transactions" /> : null}
      {query.isError ? (
        <ErrorState
          message={apiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data?.items.length === 0 ? (
        <EmptyState
          icon="shopping-bag"
          title="No transactions yet"
          description="Your Alibhai purchases and earned points will appear here."
        />
      ) : null}
      {query.data?.items.map((item: any) => (
        <RecordCard
          key={item.id}
          title="Purchase"
          subtitle={formatDate(item.occurredAt)}
          amount={formatTzs(item.purchaseAmount)}
          detail={`+${formatPoints(item.pointsEarned)} points`}
          reference={item.reference}
        />
      ))}
    </Page>
  );
}

export function RedemptionHistoryScreen() {
  const query = useListCustomerRedemptions();
  return (
    <Page withTabs>
      <PageHeading
        eyebrow="History"
        title="Redemptions"
        description="A record of points you’ve used."
      />
      {query.isPending ? <LoadingState label="Loading redemption history" /> : null}
      {query.isError ? (
        <ErrorState
          message={apiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data?.items.length === 0 ? (
        <EmptyState
          icon="repeat"
          title="No redemptions yet"
          description="When you redeem points, the reference and details will appear here."
        />
      ) : null}
      {query.data?.items.map((item: any) => (
        <RecordCard
          key={item.id}
          title="Points redeemed"
          subtitle={formatDate(item.occurredAt)}
          amount={`−${formatPoints(item.pointsRedeemed)}`}
          detail={`${formatPoints(item.pointsRedeemed)} points`}
          reference={item.reference}
          status={item.status}
        />
      ))}
    </Page>
  );
}

export function ProfileScreen() {
  const colors = useColors();
  const { data: me } = useMe();
  const query = useGetCustomerProfile(me);
  const { signOut } = useAuth();
  const profile = query.data;
  return (
    <Page withTabs>
      <PageHeading
        eyebrow="Profile"
        title="Your account"
        description="Your Alibhai Points customer details."
      />
      {query.isPending ? <LoadingState label="Loading your profile" /> : null}
      {query.isError ? (
        <ErrorState
          message={apiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {profile ? (
        <>
          <Card style={styles.profileCard}>
            <View style={[styles.profileAvatar, { backgroundColor: colors.accent }]}>
              <Feather name="user" size={25} color={colors.primary} />
            </View>
            <Text style={[styles.profileName, { color: colors.foreground }]}>
              {profile.fullName}
            </Text>
            <StatusPill active={profile.status === "active"} />
          </Card>
          <Card style={styles.profileDetails}>
            <LabelValue label="Phone number" value={profile.phoneNumber} icon="phone" />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <LabelValue label="Customer ID" value={profile.customerId} icon="hash" />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <LabelValue
              label="Account status"
              value={profile.status === "active" ? "Active" : "Inactive"}
              icon="shield"
            />
          </Card>
          {profile.status === "inactive" ? (
            <InactiveNotice expired={profile.unusedPointsExpired} />
          ) : null}
          <PrimaryButton
            label="Sign out"
            onPress={() => void signOut().then(() => router.replace("/(auth)/welcome"))}
            secondary
            testID="profile-sign-out"
          />
        </>
      ) : null}
    </Page>
  );
}

const redemptionSchema = z.object({
  points: z.string().trim().regex(/^[1-9]\d*$/, "Enter a whole number of points."),
});
type RedemptionValues = z.infer<typeof redemptionSchema>;

export function RedeemScreen() {
  const colors = useColors();
  const { data: me } = useMe();
  const dashboard = useGetCustomerDashboard(me);
  const redeem = useCreateRedemption();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestedPoints, setRequestedPoints] = useState<number | null>(null);
  const [redemptionResult, setRedemptionResult] =
    useState<CustomerRedemption | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState, reset } =
    useForm<RedemptionValues>({
      resolver: zodResolver(redemptionSchema),
      defaultValues: { points: "" },
    });

  const openConfirmation = handleSubmit(({ points }) => {
    const amount = Number(points);
    const available = dashboard.data?.redeemablePoints;
    if (available === undefined) {
      setFormError("Your available balance could not be confirmed. Try again.");
      return;
    }
    if (amount > available) {
      setError("points", {
        message: "Enter an amount no higher than your redeemable balance.",
      });
      return;
    }
    setFormError(null);
    setRequestedPoints(amount);
    setConfirmOpen(true);
  });

  const confirmRedemption = async () => {
    if (requestedPoints === null) return;
    setFormError(null);
    try {
      const result = await redeem.mutateAsync({
        data: { points: requestedPoints },
      });
      setRedemptionResult(result);
      setConfirmOpen(false);
      reset({ points: "" });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetCustomerDashboardQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getListCustomerRedemptionsQueryKey(),
        }),
      ]);
    } catch (error) {
      setConfirmOpen(false);
      setFormError(apiErrorMessage(error));
    }
  };

  const eligible =
    dashboard.data?.redemptionEligible === true &&
    dashboard.data.customer.status === "active" &&
    dashboard.data.redeemablePoints > 0;

  return (
    <Page>
      <PageHeading
        eyebrow="Redeem"
        title="Use your points"
        description="Choose how many available points you want to redeem."
      />
      {dashboard.isPending ? <LoadingState label="Checking your balance" /> : null}
      {dashboard.isError ? (
        <ErrorState
          message={apiErrorMessage(dashboard.error)}
          onRetry={() => void dashboard.refetch()}
        />
      ) : null}
      {dashboard.data ? (
        <>
          {dashboard.data.customer.status === "inactive" ? (
            <InactiveNotice
              expired={dashboard.data.customer.unusedPointsExpired}
            />
          ) : null}
          <Card style={styles.availableCard}>
            <Text style={[styles.availableLabel, { color: colors.mutedForeground }]}>
              Redeemable balance
            </Text>
            <Text style={[styles.availableValue, { color: colors.foreground }]}>
              {formatPoints(dashboard.data.redeemablePoints)}
            </Text>
            <Text style={[styles.availableUnit, { color: colors.mutedForeground }]}>
              points available
            </Text>
          </Card>
          {dashboard.data.redemptionEligible ? null : (
            <InlineNotice
              tone="warning"
              message={
                dashboard.data.redemptionBlockedReason ||
                "Redemption is not currently available for this account."
              }
            />
          )}
          {redemptionResult ? (
            <InlineNotice
              tone="success"
              message={`Redemption submitted. Reference: ${redemptionResult.reference}`}
            />
          ) : null}
          {formError ? <InlineNotice message={formError} tone="warning" /> : null}
          <Controller
            control={control}
            name="points"
            render={({ field }) => (
              <TextField
                label="Points to redeem"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="number-pad"
                placeholder="Enter points"
                error={formState.errors.points?.message}
                testID="redeem-points-input"
              />
            )}
          />
          <PrimaryButton
            label="Review redemption"
            onPress={() => void openConfirmation()}
            disabled={!eligible}
            testID="redeem-review"
          />
          <Text style={[styles.serverCheckNote, { color: colors.mutedForeground }]}>
            Alibhai confirms the final balance and eligibility when you submit.
          </Text>
        </>
      ) : null}
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={[styles.modalIcon, { backgroundColor: colors.accent }]}>
              <Feather name="repeat" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Confirm redemption
            </Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              Redeem {requestedPoints === null ? "" : formatPoints(requestedPoints)}{" "}
              points? Alibhai will confirm eligibility and return a reference.
            </Text>
            <PrimaryButton
              label={redeem.isPending ? "Submitting…" : "Confirm"}
              onPress={() => void confirmRedemption()}
              disabled={redeem.isPending}
              loading={redeem.isPending}
              testID="redeem-confirm"
            />
            <Pressable
              accessibilityRole="button"
              testID="redeem-cancel"
              onPress={() => setConfirmOpen(false)}
              style={({ pressed }) => [
                styles.modalCancel,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Text style={[styles.modalCancelText, { color: colors.primary }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  greetingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  greetingText: { flex: 1, gap: 3 },
  greeting: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
  customerId: { fontSize: 12 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 100,
    paddingHorizontal: 11,
    paddingVertical: 7,
    gap: 7,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: "700" },
  pointsHero: { borderRadius: 23, padding: 22, gap: 10 },
  heroTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroLabel: { fontSize: 13, fontWeight: "600" },
  heroTotal: { fontSize: 38, lineHeight: 46, fontWeight: "700", letterSpacing: -0.7 },
  heroDivider: { height: 1, marginVertical: 2 },
  heroStats: { flexDirection: "row", alignItems: "center", gap: 18 },
  heroStat: { flex: 1, gap: 5 },
  heroStatValue: { fontSize: 18, fontWeight: "700" },
  heroStatLabel: { fontSize: 12 },
  heroStatSeparator: { width: 1, height: 32 },
  deadlineCard: { flexDirection: "row", alignItems: "center", gap: 13 },
  deadlineIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  deadlineCopy: { flex: 1, gap: 4 },
  deadlineTitle: { fontSize: 14, fontWeight: "700" },
  deadlineBody: { fontSize: 12, lineHeight: 18 },
  actionStack: { gap: 8, alignItems: "center" },
  pointDetailCard: { gap: 17 },
  separator: { height: 1 },
  pointNote: { fontSize: 13, lineHeight: 19, marginTop: -4 },
  recordCard: { gap: 12 },
  recordTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  recordIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  recordHeading: { flex: 1, gap: 4 },
  recordTitle: { fontSize: 14, fontWeight: "700" },
  recordSubtitle: { fontSize: 12 },
  recordAmount: { fontSize: 14, fontWeight: "700" },
  recordFooter: { borderTopWidth: 1, paddingTop: 10, flexDirection: "row", justifyContent: "space-between", gap: 8 },
  recordDetail: { fontSize: 13, fontWeight: "700" },
  recordStatus: { fontSize: 12, textTransform: "capitalize" },
  reference: { fontSize: 11 },
  profileCard: { alignItems: "center", gap: 12, paddingVertical: 23 },
  profileAvatar: { width: 66, height: 66, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  profileName: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  profileDetails: { gap: 16 },
  availableCard: { alignItems: "center", gap: 4, paddingVertical: 24 },
  availableLabel: { fontSize: 13 },
  availableValue: { fontSize: 42, lineHeight: 50, fontWeight: "700", letterSpacing: -1 },
  availableUnit: { fontSize: 12 },
  serverCheckNote: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 22 },
  modalCard: { width: "100%", maxWidth: 420, borderWidth: 1, borderRadius: 24, padding: 22, gap: 14 },
  modalIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 21, fontWeight: "700" },
  modalBody: { fontSize: 14, lineHeight: 21 },
  modalCancel: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  modalCancelText: { fontSize: 15, fontWeight: "700" },
});
