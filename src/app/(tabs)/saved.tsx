import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function SavedScreen() {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.groupedBackground }]}>
      <View style={styles.center}>
        <SymbolView name="bookmark" size={40} tintColor={theme.textTertiary} />
        <Text style={[styles.title, { color: theme.text }]}>Saved</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Specialists you bookmark will show up here.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40 },
  title: { fontSize: 20, fontWeight: '700', marginTop: 8, fontFamily: Fonts.sans },
  subtitle: { fontSize: 15, textAlign: 'center', fontFamily: Fonts.sans },
});
