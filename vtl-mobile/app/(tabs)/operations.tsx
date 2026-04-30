import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';

export default function OperationsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>Operations</Text>
        <Text style={styles.sub}>Production batches, stock levels & transactions — coming in Phase 2</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title:     { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  sub:       { fontSize: 14, color: COLORS.muted, textAlign: 'center' },
});
