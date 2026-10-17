import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Card,
  EmptyState,
  ErrorState,
  InlineNotice,
  LoadingState,
  Page,
  PageHeading,
  PrimaryButton,
} from "@/components/primitives";
import { useColors } from "@/hooks/useColors";
import { apiErrorMessage } from "@/services/api";
import { useErrorTranslation } from "@/services/error-translations";
import {
  useAdminAccountDeletionRequests,
  useReviewAccountDeletionRequest,
} from "@/services/hooks";

export default function AdminDeletionRequestsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { translateError } = useErrorTranslation();
  const query = useAdminAccountDeletionRequests();
  const review = useReviewAccountDeletionRequest();
  const [actionError, setActionError] = useState<string | null>(null);

  const runAction = (id: string, action: "done" | "reject") => {
    const isReject = action === "reject";
    Alert.alert(
      t(isReject ? "admin.deletion.confirmRejectTitle" : "admin.deletion.confirmDoneTitle"),
      t(isReject ? "admin.deletion.confirmRejectMessage" : "admin.deletion.confirmDoneMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t(isReject ? "admin.deletion.reject" : "admin.deletion.done"),
          style: isReject ? "destructive" : "default",
          onPress: () => void saveAction(id, action),
        },
      ]
    );
  };

  const saveAction = async (id: string, action: "done" | "reject") => {
    setActionError(null);
    try {
      await review.mutateAsync({ id, action });
    } catch (error) {
      setActionError(translateError(apiErrorMessage(error)));
    }
  };

  return (
    <Page>
      <PageHeading
        title={t("admin.deletion.title")}
        description={t("admin.deletion.subtitle")}
      />
      {actionError ? <InlineNotice tone="warning" message={actionError} /> : null}
      {query.isPending ? <LoadingState label={t("common.loading")} /> : null}
      {query.isError ? (
        <ErrorState
          message={translateError(apiErrorMessage(query.error))}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data?.requests.length === 0 ? (
        <EmptyState
          icon="user-x"
          title={t("admin.deletion.empty")}
          description=""
        />
      ) : null}
      {query.data?.requests.map((request) => (
        <Card key={request.id}>
          <Text style={{ color: colors.foreground, fontWeight: "700" }}>
            {request.customer_code || request.customer_id}
          </Text>
          {request.customer_name ? (
            <Text style={{ color: colors.foreground }}>
              {request.customer_name}
            </Text>
          ) : null}
          {request.customer_phone ? (
            <Text style={{ color: colors.mutedForeground }}>
              {t("admin.deletion.phone")}: {request.customer_phone}
            </Text>
          ) : null}
          {request.customer_city ? (
            <Text style={{ color: colors.mutedForeground }}>
              {t("admin.deletion.city")}: {request.customer_city}
            </Text>
          ) : null}
          <Text style={{ color: colors.mutedForeground }}>
            {t("admin.deletion.requested")}:{" "}
            {new Date(request.requested_at || request.created_at).toLocaleString()}
          </Text>
          <Text style={{ color: colors.mutedForeground }}>
            {t("admin.deletion.status")}: {t(`admin.deletion.${request.status}`)}
          </Text>
          {request.reason ? (
            <Text style={{ color: colors.foreground }}>{request.reason}</Text>
          ) : null}
          {request.status === "pending" ? (
            <View style={{ gap: 8, marginTop: 12 }}>
              <PrimaryButton
                label={t("admin.deletion.done")}
                onPress={() => void runAction(request.id, "done")}
                loading={review.isPending}
              />
              <PrimaryButton
                label={t("admin.deletion.reject")}
                onPress={() => void runAction(request.id, "reject")}
                secondary
                loading={review.isPending}
              />
            </View>
          ) : null}
        </Card>
      ))}
    </Page>
  );
}
