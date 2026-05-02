import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import api, { Batch, LowStockItem, Transaction } from '../../services/api';
import { COLORS } from '../../constants/theme';
import VTLAppHeader from '../../components/VTLAppHeader';

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const BATCH_STATUS: Record<string, { label: string; color: string }> = {
  in_progress:  { label: 'IN PROGRESS',  color: COLORS.sky   },
  awaiting_qa:  { label: 'AWAITING QA',  color: COLORS.amber },
  completed:    { label: 'COMPLETED',    color: COLORS.green },
  planned:      { label: 'PLANNED',      color: COLORS.teal  },
  rejected:     { label: 'REJECTED',     color: COLORS.red   },
  cancelled:    { label: 'CANCELLED',    color: COLORS.muted },
};

const TX_TYPE: Record<string, { color: string; sign: string }> = {
  RECEIVE:    { color: COLORS.green, sign: '+' },
  RETURN:     { color: COLORS.teal,  sign: '+' },
  ISSUE:      { color: COLORS.red,   sign: '−' },
  ADJUSTMENT: { color: COLORS.amber, sign: '±' },
  TRANSFER:   { color: COLORS.sky,   sign: '→' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {count !== undefined && (
        <View style={s.sectionBadge}>
          <Text style={s.sectionBadgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = BATCH_STATUS[status] ?? { label: status.toUpperCase(), color: COLORS.muted };
  return (
    <View style={[s.badge, { borderColor: cfg.color }]}>
      <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function BatchCard({ batch, onPress }: { batch: Batch; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.batchCard} onPress={onPress} activeOpacity={0.75}>
      <View style={s.batchRow}>
        <Text style={s.batchNumber}>{batch.batch_number}</Text>
        <StatusBadge status={batch.status} />
      </View>
      <Text style={s.batchProduct}>{batch.product_name}</Text>
      <View style={s.batchMeta}>
        <Text style={s.metaText}>
          {batch.created_by_name ?? 'Unknown'} · {timeAgo(batch.created_at)}
        </Text>
        <Text style={s.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function StockRow({ item }: { item: LowStockItem }) {
  const pct = item.reorder_level > 0
    ? Math.min((item.quantity / item.reorder_level) * 100, 100)
    : 100;
  const isZero = item.quantity === 0;
  return (
    <View style={s.stockRow}>
      <View style={s.stockLeft}>
        <Text style={s.stockName}>{item.product_name}</Text>
        <Text style={s.stockSku}>{item.sku} · {item.warehouse_location ?? 'No location'}</Text>
        <View style={s.stockBarBg}>
          <View style={[s.stockBarFill, {
            width: `${pct}%` as any,
            backgroundColor: isZero ? COLORS.red : COLORS.amber,
          }]} />
        </View>
      </View>
      <View style={s.stockRight}>
        <Text style={[s.stockQty, { color: isZero ? COLORS.red : COLORS.amber }]}>
          {item.quantity}
        </Text>
        <Text style={s.stockReorder}>/ {item.reorder_level}</Text>
      </View>
    </View>
  );
}

function TxRow({ tx }: { tx: Transaction }) {
  const cfg = TX_TYPE[tx.transaction_type] ?? { color: COLORS.muted, sign: '' };
  return (
    <View style={s.txRow}>
      <View style={[s.txPill, { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}>
        <Text style={[s.txPillText, { color: cfg.color }]}>{tx.transaction_type}</Text>
      </View>
      <View style={s.txMid}>
        <Text style={s.txProduct} numberOfLines={1}>{tx.product_name}</Text>
        <Text style={s.txMeta}>
          {tx.operator_name ?? 'System'} · {tx.location} · {timeAgo(tx.created_at)}
        </Text>
      </View>
      <Text style={[s.txQty, { color: cfg.color }]}>
        {cfg.sign}{tx.quantity}
      </Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function OperationsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['operations'],
    queryFn: api.getOperations,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator color={COLORS.sky} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}>
          <Text style={s.errorText}>Failed to load operations data.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <VTLAppHeader title="Operations" subtitle="Production & Inventory" />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={COLORS.sky} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Active Production Batches */}
        <SectionHeader title="Active Production Batches" count={data.batches.length} />
        {data.batches.length === 0 ? (
          <Text style={s.emptyText}>No active batches.</Text>
        ) : (
          <FlatList
            data={data.batches}
            keyExtractor={(b) => b.batch_id}
            renderItem={({ item }) => (
              <BatchCard
                batch={item}
                onPress={() => router.push(`/batch/${item.batch_id}` as any)}
              />
            )}
            scrollEnabled={false}
          />
        )}

        {/* Low Stock Alert */}
        <SectionHeader title="Low Stock Alert" count={data.low_stock.length} />
        {data.low_stock.length === 0 ? (
          <Text style={s.emptyText}>All items above reorder level.</Text>
        ) : (
          <View style={s.card}>
            {data.low_stock.map((item, i) => (
              <View key={item.product_id}>
                {i > 0 && <View style={s.divider} />}
                <StockRow item={item} />
              </View>
            ))}
          </View>
        )}

        {/* Recent Transactions */}
        <SectionHeader title="Recent Transactions" count={data.recent_transactions.length} />
        {data.recent_transactions.length === 0 ? (
          <Text style={s.emptyText}>No recent transactions.</Text>
        ) : (
          <View style={s.card}>
            {data.recent_transactions.map((tx, i) => (
              <View key={i}>
                {i > 0 && <View style={s.divider} />}
                <TxRow tx={tx} />
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.bg },
  scroll:      { flex: 1 },
  content:     { paddingHorizontal: 16, paddingTop: 16 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  screenTitle: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: 4 },

  sectionHeader:    { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  sectionTitle:     { color: COLORS.text, fontSize: 15, fontWeight: '700', flex: 1 },
  sectionBadge:     { backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sectionBadgeText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },

  card:      { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  divider:   { height: 1, backgroundColor: COLORS.border },
  emptyText: { color: COLORS.muted, fontSize: 13, fontStyle: 'italic', marginBottom: 8 },

  badge:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  batchCard:    { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 10 },
  batchRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  batchNumber:  { color: COLORS.sky, fontFamily: 'monospace', fontSize: 15, fontWeight: '700' },
  batchProduct: { color: COLORS.text, fontSize: 14, fontWeight: '500', marginBottom: 10 },
  batchMeta:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText:     { color: COLORS.muted, fontSize: 12 },
  chevron:      { color: COLORS.muted, fontSize: 20 },

  stockRow:    { flexDirection: 'row', alignItems: 'center', padding: 14 },
  stockLeft:   { flex: 1, marginRight: 12 },
  stockName:   { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  stockSku:    { color: COLORS.muted, fontSize: 12, marginBottom: 6 },
  stockBarBg:  { height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: 'hidden' },
  stockBarFill:{ height: 4, borderRadius: 2 },
  stockRight:  { alignItems: 'flex-end' },
  stockQty:    { fontSize: 22, fontWeight: '800' },
  stockReorder:{ color: COLORS.muted, fontSize: 11 },

  txRow:      { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  txPill:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  txPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  txMid:      { flex: 1 },
  txProduct:  { color: COLORS.text, fontSize: 13, fontWeight: '500' },
  txMeta:     { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  txQty:      { fontSize: 16, fontWeight: '700', minWidth: 40, textAlign: 'right' },

  errorText:   { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: COLORS.sky, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:{ color: '#fff', fontWeight: '700' },
});
