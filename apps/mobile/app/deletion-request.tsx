import { useState } from "react";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Card,
  ErrorState,
  InlineNotice,
  LoadingState,
  Page,
  PageHeading,
  PrimaryButton,
  TextButton,
  TextField,
} from "@/components/primitives";
import { useColors } from "@/hooks/useColors";
import { apiErrorMessage } from "@/services/api";
import { useErrorTranslation } from "@/services/error-translations";
import {
  useCreateAccountDeletionRequest,
  useMyAccountDeletionRequest,
} from "@/services/hooks";

type Stage = "form" | "confirmation" | "sent";

export default function DeletionRequestScreen() {
  const colors = useColors();
  const router = useRouter();
  const { t } = useTranslation();
  const { translateError } = useErrorTranslation();
  const requestQuery = useMyAccountDeletionRequest();
  const createRequest = useCreateAccountDeletionRequest();
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitError(null);
    try {
      await createRequest.mutateAsync(reason.trim() || undefined);
      setStage("sent");
    } catch (error) {
      const message = apiErrorMessage(error);
      if (message === "DELETION_ALREADY_REQUESTED") {
        await requestQuery.refetch();
        return;
      }
      setSubmitError(translateError(message));
    }
  };

  if (requestQuery.isPending) {
    return (
      <Page>
        <LoadingState label={t("common.loading")} />
      </Page>
    );
  }

  if (requestQuery.isError) {
    return (
      <Page>
        <ErrorState
          message={translateError(apiErrorMessage(requestQuery.error))}
          onRetry={() => void requestQuery.refetch()}
        />
      </Page>
    );
  }

  if (requestQuery.data.request && stage !== "sent") {
    return (
      <Page>
        <PageHeading title={t("deletion.title")} />
        <Card>
          <InlineNotice message={t("deletion.pendingStatus")} tone="warning" />
        </Card>
        <TextButton label={t("common.back")} onPress={() => router.back()} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeading
        title={t("deletion.title")}
        description={t("deletion.explanation")}
      />
      {stage === "form" ? (
        <>
          <TextField
            label={t("deletion.reason")}
            value={reason}
            onChangeText={setReason}
            placeholder={t("deletion.reasonOptional")}
            multiline
            maxLength={500}
            textAlignVertical="top"
            inputStyle={{ minHeight: 120 }}
            accessibilityLabel={t("deletion.reason")}
          />
          <PrimaryButton
            label={t("deletion.continue")}
            onPress={() => setStage("confirmation")}
          />
        </>
      ) : null}
      {stage === "confirmation" ? (
        <Card>
          <Text style={{ color: colors.foreground, marginBottom: 16 }}>
            {t("deletion.confirmation")}
          </Text>
          {submitError ? (
            <InlineNotice message={submitError} tone="warning" />
          ) : null}
          <PrimaryButton
            label={t("deletion.sendRequest")}
            onPress={() => void submit()}
            loading={createRequest.isPending}
          />
          <TextButton
            label={t("common.back")}
            onPress={() => setStage("form")}
            disabled={createRequest.isPending}
          />
        </Card>
      ) : null}
      {stage === "sent" ? (
        <>
          <InlineNotice message={t("deletion.sent")} tone="success" />
          <Text style={{ color: colors.mutedForeground }}>
            {t("deletion.manualProcessing")}
          </Text>
          <PrimaryButton
            label={t("common.done")}
            onPress={() => router.back()}
          />
        </>
      ) : null}
    </Page>
  );
}
