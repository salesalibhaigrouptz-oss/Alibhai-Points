import { useTranslation } from 'react-i18next';

export function useErrorTranslation() {
  const { t } = useTranslation();

  const translateError = (code: string | undefined): string => {
    if (!code) return t('errors.generic');

    const errorMap: Record<string, string> = {
      CUSTOMER_INACTIVE: 'errors.CUSTOMER_INACTIVE',
      INSUFFICIENT_REDEEMABLE_POINTS: 'errors.INSUFFICIENT_REDEEMABLE_POINTS',
      PENDING_REQUEST_EXISTS: 'errors.PENDING_REQUEST_EXISTS',
      REDEMPTION_NOT_PENDING: 'errors.REDEMPTION_NOT_PENDING',
      REDEMPTION_ALREADY_CANCELLED: 'errors.REDEMPTION_ALREADY_CANCELLED',
      CUSTOMER_NOT_FOUND: 'errors.CUSTOMER_NOT_FOUND',
      INVALID_AMOUNT: 'errors.INVALID_AMOUNT',
      INVALID_POINTS: 'errors.INVALID_POINTS',
      INVALID_CITY: 'errors.INVALID_CITY',
      INVALID_PHONE: 'errors.INVALID_PHONE',
      INVALID_NAME: 'errors.INVALID_NAME',
      NOT_ADMIN: 'errors.NOT_ADMIN',
      DELETION_ALREADY_REQUESTED: 'errors.DELETION_ALREADY_REQUESTED',
      POINTS_ALREADY_USED_OR_EXPIRED: 'errors.POINTS_ALREADY_USED_OR_EXPIRED',
      ALREADY_VOIDED: 'errors.ALREADY_VOIDED',
      INVALID_TOKEN: 'errors.INVALID_TOKEN',
      FORBIDDEN: 'errors.FORBIDDEN',
      NOT_FOUND: 'errors.CUSTOMER_NOT_FOUND',
      CONFLICT: 'errors.generic',
      RATE_LIMIT_EXCEEDED: 'errors.server',
      NETWORK_ERROR: 'errors.network',
      TIMEOUT_ERROR: 'errors.timeout',
      SERVER_ERROR: 'errors.server',
      REQUEST_NOT_PENDING: 'errors.generic',
      GENERIC_ERROR: 'errors.generic',
    };

    const translationKey = errorMap[code];
    if (translationKey) {
      return t(translationKey);
    }

    if (code.includes(" / ")) {
      return code;
    }

    return t('errors.generic');
  };

  return { translateError };
}
