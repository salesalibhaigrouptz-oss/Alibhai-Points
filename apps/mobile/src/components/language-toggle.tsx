import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { saveLanguage, LANGUAGE_SW, LANGUAGE_EN } from '@/i18n';

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const colors = useColors();
  const currentLang = i18n.language || LANGUAGE_SW;
  const isSwahili = currentLang === LANGUAGE_SW || currentLang.startsWith('sw');

  const toggleLanguage = async () => {
    const newLanguage = isSwahili ? LANGUAGE_EN : LANGUAGE_SW;
    await saveLanguage(newLanguage);
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={toggleLanguage}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.language')}
        </Text>
        <View style={[styles.toggle, { backgroundColor: isSwahili ? colors.primary : colors.muted }]}>
          <View
            style={[
              styles.toggleKnob,
              {
                backgroundColor: '#FFFFFF',
                transform: [{ translateX: isSwahili ? 24 : 0 }],
              },
            ]}
          />
        </View>
      </View>
      <Text style={[styles.languageLabel, { color: colors.mutedForeground }]}>
        {isSwahili ? 'Kiswahili' : 'English'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggle: {
    width: 52,
    height: 28,
    borderRadius: 14,
    padding: 2,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  languageLabel: {
    fontSize: 13,
    marginTop: 8,
  },
});
