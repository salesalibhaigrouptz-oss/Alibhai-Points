import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Linking,
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
import { useErrorTranslation } from "@/services/error-translations";
import { useFormattedValues } from "@/utils/formatting";
import { LanguageToggle } from "@/components/language-toggle";
import { AppBuildInfo } from "@/components/app-release-manager";
import Constants from "expo-constants";
import { mobileEnv } from "@/config/env";
import {
  useCustomerPointsSummary,
  useCreateCustomerRedemption,
  useMyRedemptions,
  useMe,
  useRecentActivity,
  useMyAccountDeletionRequest,
} from "@/services/hooks";

type CustomerRedemption = {
  id: string;
  points?: number;
  status?: string;
  reference?: string;
  value_tzs?: number;
};

type PointsSummary = {
  customer_code?: string;
  status?: string;
  total_points?: number;
  redeemable_points?: number;
  waiting_points?: number;
  requested_points?: number;
  redeemed_points?: number;
  expired_points?: number;
  redeemable_value_tzs?: number;
  waiting_value_tzs?: number;
  point_value_tzs?: number;
  tier?: string;
  lifetime_purchases?: number;
  next_tier?: string | null;
  next_tier_remaining_tzs?: number | null;
  next_tier_point_value_tzs?: number | null;
  pending_request?: {
    points: number;
    value_tzs: number;
    reference: string;
  } | null;
  next_unlock_at?: string | null;
  activity_deadline?: string | null;
  days_left?: number | null;
};

const getGetCustomerDashboardQueryKey = () => ["customer", "points-summary"];
const getListCustomerRedemptionsQueryKey = () => ["customer", "redemptions"];

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
        value_tzs: result.value_tzs,
      };
    },
    isPending: mutation.isPending,
  };
};

function StatusPill({ active }: { active: boolean }) {
  const { t } = useTranslation();
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
        {active ? t('home.statusActive') : t('home.statusInactive')}
      </Text>
    </View>
  );
}


function InactiveNotice({ expired }: { expired: boolean }) {
  const { t } = useTranslation();
  return (
    <InlineNotice
      tone="warning"
      message={
        expired
          ? t('home.inactiveNoticeExpired')
          : t('home.inactiveNotice')
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
  const { t } = useTranslation();
  const { translateError } = useErrorTranslation();
  const { data: me } = useMe();
  const summaryQuery = useCustomerPointsSummary();
  const recentActivityQuery = useRecentActivity();
  const summary = summaryQuery.data;
  const recentActivity = recentActivityQuery.data || [];
  const fullName = me?.profile?.full_name || "Customer";
  const customerId = summary?.customer_code || me?.customer?.customer_code || "—";
  const status = summary?.status || me?.customer?.status;
  const tier = summary?.tier;
  const pointValueTzs = summary?.point_value_tzs;
  const redeemablePoints = Number(summary?.redeemable_points) || 0;
  const redeemableValueTzs = Number(summary?.redeemable_value_tzs) || 0;
  const waitingPoints = Number(summary?.waiting_points) || 0;
  const waitingValueTzs = Number(summary?.waiting_value_tzs) || 0;
  const nextTier = summary?.next_tier;
  const nextTierRemainingTzs = summary?.next_tier_remaining_tzs;
  const nextTierPointValueTzs = summary?.next_tier_point_value_tzs;
  const pendingRequest = summary?.pending_request;
  const activityDeadline = summary?.activity_deadline;
  const daysLeft = summary?.days_left;

  return (
    <Page withTabs>
      <PageHeading eyebrow={t('home.brandEyebrow')} title={t('home.brandSubtitle')} />
      {summaryQuery.isPending ? <LoadingState /> : null}
      {summaryQuery.isError ? (
        <ErrorState
          message={translateError(apiErrorMessage(summaryQuery.error))}
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : null}
      {!summaryQuery.isPending && !summaryQuery.isError ? (
        <>
          <View style={styles.greetingRow}>
            <View style={styles.greetingText}>
              <Text style={[styles.greeting, { color: colors.foreground }]}>
                {t('home.greeting')}, {fullName.split(" ")[0]}
              </Text>
              <View style={styles.customerIdRow}>
                <Text style={[styles.customerId, { color: colors.mutedForeground }]}>
                  {t('home.customerId')} · {customerId}
                </Text>
                {tier ? (
                  <View style={[styles.tierBadge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.tierBadgeText, { color: colors.primary }]}>
                      {tier}
                    </Text>
                  </View>
                ) : null}
              </View>
              {pointValueTzs !== undefined ? (
                <Text style={[styles.pointValueText, { color: colors.mutedForeground }]}>
                  {t('home.pointValue', { value: pointValueTzs })}
                </Text>
              ) : null}
            </View>
            {status ? <StatusPill active={status === "active"} /> : null}
          </View>

          {pendingRequest ? (
            <Card style={styles.pendingBanner}>
              <View style={[styles.pendingIcon, { backgroundColor: colors.accent }]}>
                <Feather name="clock" size={18} color={colors.primary} />
              </View>
              <View style={styles.pendingContent}>
                <Text style={[styles.pendingTitle, { color: colors.foreground }]}>
                  {t('home.pendingWaitingOffice')}
                </Text>
                <Text style={[styles.pendingDetail, { color: colors.mutedForeground }]}>
                  {pendingRequest.points} points = {formatTzs(pendingRequest.value_tzs)}
                </Text>
                <Text style={[styles.pendingRef, { color: colors.mutedForeground }]}>
                  {t('home.pendingReference', { reference: pendingRequest.reference })}
                </Text>
              </View>
            </Card>
          ) : null}

          <Card style={styles.pointsCard}>
            <View style={styles.pointsRow}>
              <View style={styles.pointsColumn}>
                <Text style={[styles.pointsLabel, { color: colors.foreground }]}>
                  {t('points.redeemable')}
                </Text>
                <Text style={[styles.pointsValue, { color: colors.primary }]}>
                  {formatPoints(redeemablePoints)}
                </Text>
                <Text style={[styles.pointsTzs, { color: colors.mutedForeground }]}>
                  = {formatTzs(redeemableValueTzs)}
                </Text>
              </View>
              <View style={[styles.pointsDivider, { backgroundColor: colors.border }]} />
              <View style={styles.pointsColumn}>
                <Text style={[styles.pointsLabel, { color: colors.mutedForeground }]}>
                  {t('points.waiting')}
                </Text>
                <Text style={[styles.pointsValueSmall, { color: colors.mutedForeground }]}>
                  {formatPoints(waitingPoints)}
                </Text>
                <Text style={[styles.pointsTzsSmall, { color: colors.mutedForeground }]}>
                  = {formatTzs(waitingValueTzs)}
                </Text>
              </View>
            </View>
          </Card>

          {nextTier && nextTierRemainingTzs !== null ? (
            <Card style={styles.tierProgressCard}>
              <Text style={[styles.tierProgressTitle, { color: colors.foreground }]}>
                {t('home.progressTo', { tier: nextTier })}
              </Text>
              <Text style={[styles.tierProgressSubtitle, { color: colors.mutedForeground }]}>
                {t('home.spendMoreToReach', { amount: formatTzs(nextTierRemainingTzs || 0), tier: nextTier })}
                {nextTierPointValueTzs ? ` (1 point = ${formatTzs(nextTierPointValueTzs)})` : ''}
              </Text>
            </Card>
          ) : (
            <Card style={styles.tierProgressCard}>
              <Text style={[styles.tierProgressTitle, { color: colors.foreground }]}>
                {t('home.topLevelReached')}
              </Text>
              <Text style={[styles.tierProgressSubtitle, { color: colors.mutedForeground }]}>
                {t('home.topLevel')}
              </Text>
            </Card>
          )}

          {status === "inactive" ? (
            <InactiveNotice expired={false} />
          ) : null}

          {activityDeadline && daysLeft !== null ? (
            <Card style={styles.deadlineCard}>
              <View style={[styles.deadlineIcon, { backgroundColor: colors.accent }]}>
                <Feather name="calendar" size={18} color={colors.primary} />
              </View>
              <View style={styles.deadlineCopy}>
                <Text style={[styles.deadlineTitle, { color: colors.foreground }]}>
                  {t('home.stayActive')}
                </Text>
                <Text style={[styles.deadlineBody, { color: colors.mutedForeground }]}>
                  {t('home.activityDeadline', { date: formatDate(activityDeadline), days: daysLeft })}
                </Text>
              </View>
            </Card>
          ) : null}

          <Card style={styles.transactionsCard}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              {t('home.lastTransactions')}
            </Text>
            {recentActivity.length > 0 ? (
              recentActivity.map((item: any, index: number) => (
                <View key={index} style={[styles.transactionItem, index < recentActivity.length - 1 && { borderBottomColor: colors.border }]}>
                  <Text style={[styles.transactionType, { color: colors.foreground }]}>
                    {item.type === 'purchase' ? '+' : '-'}{item.points} points
                  </Text>
                  <Text style={[styles.transactionAmount, { color: colors.foreground }]}>
                    {item.amount_tzs ? formatTzs(item.amount_tzs) : item.value_tzs ? formatTzs(item.value_tzs) : '—'}
                  </Text>
                  <Text style={[styles.transactionStatus, { color: colors.mutedForeground }]}>
                    {item.status}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {t('home.noRecentActivity')}
              </Text>
            )}
            <Text style={[styles.officeNote, { color: colors.mutedForeground }]}>
              {t('home.officeNote')}
            </Text>
          </Card>

          <View style={styles.actionStack}>
            <PrimaryButton
              label={t('home.redeem')}
              onPress={() => router.push("/redeem")}
              disabled={status !== "active" || redeemablePoints <= 0}
              testID="home-redeem"
            />
            <TextButton
              label={t('home.viewTransactions')}
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
  const { t } = useTranslation();
  const { translateError } = useErrorTranslation();
  const { data: me } = useMe();
  const query = useCustomerPointsSummary();
  const summary = query.data;
  const tier = summary?.tier;
  const pointValueTzs = summary?.point_value_tzs;
  const totalPoints = Number(summary?.total_points) || 0;
  const redeemablePoints = Number(summary?.redeemable_points) || 0;
  const redeemableValueTzs = Number(summary?.redeemable_value_tzs) || 0;
  const waitingPoints = Number(summary?.waiting_points) || 0;
  const waitingValueTzs = Number(summary?.waiting_value_tzs) || 0;
  const requestedPoints = Number(summary?.requested_points) || 0;
  const redeemedPoints = Number(summary?.redeemed_points) || 0;
  const expiredPoints = Number(summary?.expired_points) || 0;
  const nextUnlockAt = summary?.next_unlock_at;
  const status = summary?.status || me?.customer?.status;

  return (
    <Page withTabs>
      <PageHeading
        eyebrow={t('points.title')}
        title={t('points.subtitle')}
      />
      {query.isPending ? <LoadingState /> : null}
      {query.isError ? (
        <ErrorState
          message={translateError(apiErrorMessage(query.error))}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {!query.isPending && !query.isError ? (
        <>
          {status === "inactive" ? (
            <InactiveNotice expired={expiredPoints > 0} />
          ) : null}
          <Card style={styles.tierInfoCard}>
            <View style={[styles.tierInfoIcon, { backgroundColor: colors.accent }]}>
              <Feather name="award" size={20} color={colors.primary} />
            </View>
            <View style={styles.tierInfoContent}>
              <Text style={[styles.tierInfoTitle, { color: colors.foreground }]}>
                {t('home.tier')}: {tier || "—"}
              </Text>
              <Text style={[styles.tierInfoText, { color: colors.mutedForeground }]}>
                {pointValueTzs !== undefined
                  ? t('home.pointValue', { value: pointValueTzs })
                  : "—"}
              </Text>
            </View>
          </Card>
          <Card style={styles.pointDetailCard}>
            <LabelValue
              label={t('points.totalPoints')}
              value={`${formatPoints(totalPoints)} points`}
              icon="award"
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <LabelValue
              label={t('points.redeemable')}
              value={`${formatPoints(redeemablePoints)} points`}
              subvalue={`≈ ${formatTzs(redeemableValueTzs)}`}
              icon="check-circle"
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <LabelValue
              label={t('points.waiting')}
              value={`${formatPoints(waitingPoints)} points`}
              subvalue={`≈ ${formatTzs(waitingValueTzs)}`}
              icon="clock"
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <LabelValue
              label={t('points.requested')}
              value={`${formatPoints(requestedPoints)} points`}
              icon="send"
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <LabelValue
              label={t('points.redeemed')}
              value={`${formatPoints(redeemedPoints)} points`}
              icon="repeat"
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <LabelValue
              label={t('points.expired')}
              value={`${formatPoints(expiredPoints)} points`}
              icon="alert-circle"
            />
            {nextUnlockAt ? (
              <>
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
                <LabelValue
                  label={t('points.nextUnlock')}
                  value={formatDate(nextUnlockAt)}
                  icon="calendar"
                />
              </>
            ) : null}
          </Card>
          <PrimaryButton
            label={t('points.redeemButton')}
            onPress={() => router.push("/redeem")}
            disabled={status !== "active" || redeemablePoints <= 0}
          />
          <TextButton
            label={t('points.viewHistory')}
            onPress={() => router.push("/transactions")}
          />
        </>
      ) : null}
    </Page>
  );
}

export function TransactionsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const query = useRecentActivity();
  const recentActivity = query.data || [];

  return (
    <Page>
      <PageHeading
        eyebrow={t('transactions.title')}
        title={t('transactions.subtitle')}
      />
      {query.isPending ? <LoadingState label={t('common.loading')} /> : null}
      {query.isError ? (
        <ErrorState
          message={apiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {recentActivity.length === 0 ? (
        <EmptyState
          icon="activity"
          title={t('transactions.empty')}
          description={t('transactions.officeNote')}
        />
      ) : null}
      {recentActivity.length > 0 ? (
        <Card style={styles.transactionsCard}>
          {recentActivity.map((item: any, index: number) => (
            <View
              key={index}
              style={[
                styles.transactionItem,
                index < recentActivity.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
              ]}
            >
              <View style={styles.transactionTypeColumn}>
                <Text style={[styles.transactionType, { color: colors.foreground }]}>
                  {item.type === 'purchase' ? t('transactions.purchase') : t('transactions.redemption')}
                </Text>
                <Text style={[styles.transactionReference, { color: colors.mutedForeground }]}>
                  Ref. {item.reference || '—'}
                </Text>
              </View>
              <View style={styles.transactionAmountColumn}>
                <Text style={[styles.transactionAmount, { color: colors.foreground }]}>
                  {item.type === 'purchase' ? '+' : '-'}{formatPoints(item.points || 0)} pts
                </Text>
                <Text style={[styles.transactionTzs, { color: colors.mutedForeground }]}>
                  {item.amount_tzs ? formatTzs(item.amount_tzs) : item.value_tzs ? formatTzs(item.value_tzs) : '—'}
                </Text>
              </View>
              <Text style={[styles.transactionStatus, { color: colors.mutedForeground }]}>
                {item.status || '—'}
              </Text>
            </View>
          ))}
          <Text style={[styles.officeNote, { color: colors.mutedForeground }]}>
            {t('transactions.officeNote')}
          </Text>
        </Card>
      ) : null}
    </Page>
  );
}

export function RedemptionHistoryScreen() {
  const { t } = useTranslation();
  const query = useMyRedemptions();
  const items = query.data?.redemptions?.map((r: any) => ({
    id: r.id,
    reference: r.redemption_reference,
    pointsRedeemed: r.points_redeemed,
    status: r.status,
    occurredAt: r.redeemed_at,
  })) || [];
  return (
    <Page withTabs>
      <PageHeading
        eyebrow={t('tabs.history')}
        title={t('admin.redemptions.title')}
      />
      {query.isPending ? <LoadingState label={t('common.loading')} /> : null}
      {query.isError ? (
        <ErrorState
          message={apiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {items.length === 0 ? (
        <EmptyState
          icon="repeat"
          title={t('admin.redemptions.empty')}
          description=""
        />
      ) : null}
      {items.map((item: any) => (
        <RecordCard
          key={item.id}
          title={t('home.redemption')}
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
  const { t } = useTranslation();
  const { data: me, isPending } = useMe();
  const summaryQuery = useCustomerPointsSummary();
  const { signOut } = useAuth();
  const { translateError } = useErrorTranslation();
  const deletionRequestQuery = useMyAccountDeletionRequest();
  const summary = summaryQuery.data;
  const fullName = me?.profile?.full_name || "Customer";
  const phoneNumber = me?.profile?.phone || "—";
  const customerId = summary?.customer_code || me?.customer?.customer_code || "—";
  const city = me?.customer?.city || "—";
  const status = summary?.status || me?.customer?.status;
  const unusedPointsExpired = (Number(summary?.expired_points) || 0) > 0;
  const privacyPolicyUrl = mobileEnv.EXPO_PUBLIC_PRIVACY_POLICY_URL;
  const accountDeletionUrl = mobileEnv.EXPO_PUBLIC_ACCOUNT_DELETION_URL;
  const openExternalLink = (url: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert(t("common.error"), t("profile.linkError"));
    });
  };

  return (
    <Page withTabs>
      <PageHeading
        eyebrow={t('profile.title')}
        title={t('profile.personalInfo')}
        description={t('profile.accountInfo')}
      />
      {isPending && !me ? <LoadingState label={t('common.loading')} /> : null}
      <Card style={styles.profileCard}>
        <View style={[styles.profileAvatar, { backgroundColor: colors.accent }]}>
          <Feather name="user" size={25} color={colors.primary} />
        </View>
        <Text style={[styles.profileName, { color: colors.foreground }]}>
          {fullName}
        </Text>
        {status ? <StatusPill active={status === "active"} /> : null}
      </Card>
      <Card style={styles.profileDetails}>
        <LabelValue label={t('profile.phone')} value={phoneNumber} icon="phone" />
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
        <LabelValue label={t('profile.city')} value={city} icon="map-pin" />
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
        <LabelValue label={t('profile.customerId')} value={customerId} icon="hash" />
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
        <LabelValue
          label={t('profile.status')}
          value={
            status
              ? status === "active"
                ? t('home.statusActive')
                : t('home.statusInactive')
              : "—"
          }
          icon="shield"
        />
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
        <LabelValue
          label={t('profile.version')}
          value={Constants.expoConfig?.version || "1.0.0"}
          icon="info"
        />
      </Card>
      <LanguageToggle />
      <Card>
        {deletionRequestQuery.isPending ? (
          <LoadingState label={t("common.loading")} />
        ) : deletionRequestQuery.isError ? (
          <ErrorState
            message={translateError(apiErrorMessage(deletionRequestQuery.error))}
            onRetry={() => void deletionRequestQuery.refetch()}
          />
        ) : deletionRequestQuery.data?.request ? (
          <Text style={{ color: colors.foreground }}>
            {t("deletion.pendingStatus")}
          </Text>
        ) : (
          <PrimaryButton
            label={t("deletion.request")}
            onPress={() => router.push("/deletion-request")}
            secondary
          />
        )}
        {privacyPolicyUrl ? (
          <TextButton
            label={t("profile.privacyPolicy")}
            onPress={() => openExternalLink(privacyPolicyUrl)}
          />
        ) : null}
        {accountDeletionUrl ? (
          <TextButton
            label={t("deletion.learnMore")}
            onPress={() => openExternalLink(accountDeletionUrl)}
          />
        ) : null}
      </Card>
      {status === "inactive" ? (
        <InactiveNotice expired={unusedPointsExpired} />
      ) : null}
      <View style={{ marginBottom: 150 }}>
        <PrimaryButton
          label={t('profile.logout')}
          onPress={() => void signOut().then(() => router.replace("/(auth)/welcome"))}
          secondary
          testID="profile-sign-out"
        />
      </View>
      <AppBuildInfo />
    </Page>
  );
}

const redemptionSchema = z.object({
  points: z.string().trim().regex(/^[1-9]\d*$/, "Enter a whole number of points."),
});
type RedemptionValues = z.infer<typeof redemptionSchema>;

export function RedeemScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { translateError } = useErrorTranslation();
  const { data: me } = useMe();
  const summaryQuery = useCustomerPointsSummary();
  const summary = summaryQuery.data;
  const redeem = useCreateRedemption();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestedPoints, setRequestedPoints] = useState<number | null>(null);
  const [redemptionResult, setRedemptionResult] =
    useState<CustomerRedemption | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState, reset, watch } =
    useForm<RedemptionValues>({
      resolver: zodResolver(redemptionSchema),
      defaultValues: { points: "" },
    });

  const pointsValue = watch("points");
  const pointValueTzs = summary?.point_value_tzs;
  const redeemablePoints = Number(summary?.redeemable_points) || 0;
  const redeemableValueTzs = Number(summary?.redeemable_value_tzs) || 0;
  const status = summary?.status || me?.customer?.status;

  const openConfirmation = handleSubmit(({ points }) => {
    const amount = Number(points);
    if (amount > redeemablePoints) {
      setError("points", {
        message: t('redeem.insufficientPoints'),
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
      const result = await redeem.mutateAsync(requestedPoints);
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
    status === "active" &&
    redeemablePoints > 0 &&
    pointValueTzs !== undefined;

  return (
    <Page>
      <PageHeading
        eyebrow={t('redeem.title')}
        title={t('redeem.subtitle')}
      />
      {summaryQuery.isPending ? <LoadingState label={t('common.loading')} /> : null}
      {summaryQuery.isError ? (
        <ErrorState
          message={translateError(apiErrorMessage(summaryQuery.error))}
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : null}
      {!summaryQuery.isPending && !summaryQuery.isError ? (
        <>
          {status === "inactive" ? (
            <InactiveNotice expired={(Number(summary?.expired_points) || 0) > 0} />
          ) : null}
          <Card style={styles.availableCard}>
            <Text style={[styles.availableLabel, { color: colors.mutedForeground }]}>
              {t('redeem.availableBalance')}
            </Text>
            <Text style={[styles.availableValue, { color: colors.foreground }]}>
              {formatPoints(redeemablePoints)}
            </Text>
            <Text style={[styles.availableUnit, { color: colors.mutedForeground }]}>
              points ≈ {formatTzs(redeemableValueTzs)}
            </Text>
          </Card>
          {!eligible ? (
            <InlineNotice
              tone="warning"
              message={status === "inactive" ? t('redeem.inactive') : t('redeem.insufficientPoints')}
            />
          ) : null}
          {redemptionResult ? (
            <InlineNotice
              tone="success"
              message={t('redeem.successMessage', { points: redemptionResult.points, value: formatTzs(redemptionResult.value_tzs || 0), reference: redemptionResult.reference })}
            />
          ) : null}
          {formError ? <InlineNotice message={formError} tone="warning" /> : null}
          <Controller
            control={control}
            name="points"
            render={({ field }) => (
              <TextField
                label={t('redeem.pointsToRedeem')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="number-pad"
                placeholder={t('redeem.enterPoints')}
                error={formState.errors.points?.message}
                testID="redeem-points-input"
              />
            )}
          />
          {pointValueTzs !== undefined &&
          pointsValue &&
          /^\d+$/.test(pointsValue) ? (
            <Text style={[styles.serverCheckNote, { color: colors.mutedForeground }]}>
              {t('redeem.approximateValue', { value: formatTzs(Number(pointsValue) * pointValueTzs) })}
            </Text>
          ) : null}
          <PrimaryButton
            label={t('redeem.confirm')}
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
              {t('redeem.confirmTitle', { points: requestedPoints === null ? '' : formatPoints(requestedPoints) })}
            </Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              {t('redeem.confirmMessage', {
                points:
                  requestedPoints === null ? '' : formatPoints(requestedPoints),
                value:
                  requestedPoints && pointValueTzs !== undefined
                    ? formatTzs(requestedPoints * pointValueTzs)
                    : "—",
              })}
            </Text>
            <PrimaryButton
              label={redeem.isPending ? t('common.loading') : t('common.confirm')}
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
                {t('common.cancel')}
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
  customerIdRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tierBadgeText: { fontSize: 11, fontWeight: "700" },
  pointValueText: { fontSize: 11 },
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
  pendingBanner: { flexDirection: "row", alignItems: "center", gap: 13, padding: 14 },
  pendingIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pendingContent: { flex: 1, gap: 3 },
  pendingTitle: { fontSize: 14, fontWeight: "700" },
  pendingDetail: { fontSize: 13 },
  pendingRef: { fontSize: 12 },
  pointsCard: { padding: 16 },
  pointsRow: { flexDirection: "row", alignItems: "center" },
  pointsColumn: { flex: 1, gap: 3 },
  pointsLabel: { fontSize: 13, fontWeight: "600" },
  pointsValue: { fontSize: 22, fontWeight: "700" },
  pointsTzs: { fontSize: 12 },
  pointsDivider: { width: 1, height: 40, marginHorizontal: 16 },
  pointsValueSmall: { fontSize: 18, fontWeight: "700" },
  pointsTzsSmall: { fontSize: 11 },
  tierProgressCard: { padding: 16, gap: 8 },
  tierProgressTitle: { fontSize: 14, fontWeight: "700" },
  tierProgressSubtitle: { fontSize: 12, lineHeight: 18 },
  transactionsCard: { padding: 16, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  transactionItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1 },
  transactionTypeColumn: { flex: 1, gap: 2 },
  transactionType: { fontSize: 14, fontWeight: "600" },
  transactionReference: { fontSize: 11 },
  transactionAmountColumn: { alignItems: "flex-end", gap: 2 },
  transactionAmount: { fontSize: 14, fontWeight: "700" },
  transactionTzs: { fontSize: 12 },
  transactionStatus: { fontSize: 12 },
  emptyText: { fontSize: 13, textAlign: "center", paddingVertical: 20 },
  officeNote: { fontSize: 11, textAlign: "center", marginTop: 8 },
  tierInfoCard: { flexDirection: "row", alignItems: "center", gap: 13, padding: 14 },
  tierInfoIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  tierInfoContent: { flex: 1, gap: 4 },
  tierInfoTitle: { fontSize: 14, fontWeight: "700" },
  tierInfoText: { fontSize: 12, lineHeight: 18 },
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
