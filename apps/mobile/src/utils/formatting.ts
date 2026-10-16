import { useTranslation } from 'react-i18next';

export function useFormattedValues() {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';

  const formatTzs = (value: number): string => {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'TZS',
      maximumFractionDigits: 0,
    }).format(value);
    // Replace TZS with TSh for Tanzanian Shilling
    return formatted.replace('TZS', 'TSh');
  };

  const formatDate = (value: string | null | undefined): string => {
    if (!value) return i18n.language === 'sw' ? 'Kamwe' : 'Never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return i18n.language === 'sw' ? 'Kamwe' : 'Never';
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const formatDaysLeft = (days: number | null | undefined): string => {
    if (days === null || days === undefined) return '—';
    return i18n.language === 'sw' ? `Siku zilizosalia: ${days}` : `Days left: ${days}`;
  };

  return { formatTzs, formatDate, formatDaysLeft };
}
