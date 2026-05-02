import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOperations } from '../../hooks/useOperations';
import { COLORS, RADIUS } from '../../constants/theme';
import VTLAppHeader from '../../components/VTLAppHeader';
import { SkeletonCard } from '../../components/SkeletonLoader';
import type { Batch, LowStockItem, Transaction } from '../../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'production' | 'inventory';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const BATCH_STATUS_COLOR: Record<string, string> = {
  in_progress: COLORS.sky,
  awaiting_qa: COLORS.amber,
  completed:   COLORS.green,
  released:    COLORS.green,
  planned:     COLORS.teal,
  rejected:    COLORS.red,
  cancelled:   COLORS.muted,
};

const BATCH_STATUS_LABEL: Record<string, string> = {
  in_progress: 'IN PROGRESS',
  awaiting_qa: 'AWAITING QA',
  completed:   'COMPLETED',
  released:    'RELEASED',
  planned:     'PLANNED',
  rejected:    'REJECTED',
  cancelled:   'CANCELLED',
};

const TX_COLOR: Record<string, string> = {
  RECEIVE:    COLORS.green,
  RETURN:     COLORS.teal,
  ISSUE:      COLORS.amber,
  ADJUSTMENT: COLORS.purple,
  TRANSFER:   COLORS.sky,
};

const TX_SIGN: Record<string, string> = {
  RECEIVE:    '+',
  RETURN:     '+',
  ISSUE:      '−',
  ADJUSTMENT: '±',
  TRANSFER:   '→',
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
  const color = BATCH_STATUS_COLOR[status] ?? COLORS.muted;
  const label = BATCH_STATUS_LABEL[status] ?? (status ?? '').toUpperCase();
  return (
    <View style={[s.badge, { borderColor: color }]}>
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function BatchCard({ batch, onPress, index }: { batch: Batch; onPress: () => void; index: number }) {
  const leftColor = BATCH_STATUS_COLOR[batch.status] ?? COLORS.border;
  return (
    <TouchableOpacity
      style={[s.batchCard, { borderLeftColor: leftColor }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={s.batchRow}>
        <Text style={s.batchNumber}>{batch.batch_number}</Text>
        <StatusBadge status={batch.status} />
      </View>
      <Text style={s.batchProduct}>{batch.product_name}</Text>
      <Text style={s.batchMeta}>By {batch.created_by_name ?? 'Unknown'} · {timeAgo(batch.created_at)}</Text>
    </TouchableOpacity>
  );
}

function StockCard({ item }: { item: LowStockItem }) {
  const ratio = item.reorder_level > 0 ? item.quantity / item.reorder_level : 1;
  const fillPct = Math.min(ratio * 100, 100);
  const barColor = ratio < 0.25 ? COLORS.red : ratio < 0.5 ? COLORS.amber : COLORS.green;
  return (
    <View style={s.stockCard}>
      <Text style={s.stockName}>{item.product_name}</Text>
      <Text style={s.stockQtyRow}>
        {item.quantity} remaining · Reorder at {item.reorder_level}
      </Text>
      <View style={s.stockBarBg}>
        <View style={[s.stockBarFill, { width: `${fillPct}%` as any, backgroundColor: barColor }]} />
      </View>
      {item.warehouse_location ? (
        <View style={s.locationChip}>
          <Text style={s.locationText}>{item.warehouse_location}</Text>
        </View>
      ) : null}
    </View>
  );
}

function TxRow({ tx, last }: { tx: Transaction; last: boolean }) {
  const color = TX_COLOR[tx.transaction_type] ?? COLORS.muted;
  const sign  = TX_SIGN[tx.transaction_type] ?? '';
  const isPositive = sign === '+';
  return (
    <View style={[s.txRow, !last && s.txBorder]}>
      <View style={[s.txTypeBadge, { backgroundColor: color + '22', borderColor: color }]}>
        <Text style={[s.txTypeText, { color }]}>{tx.transaction_type}</Text>
      </View>
      <View style={s.txMid}>
        <Text style={s.txProduct} numberOfLines={1}>{tx.product_name}</Text>
        <Text style={s.txMeta}>{tx.operator_name ?? 'System'} · {timeAgo(tx.created_at)}</Text>
      </View>
      <Text style={[s.txQty, { color: isPositive ? COLORS.green : COLORS.red }]}>
        {sign}{tx.quantity}
      </Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function OperationsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('production');
  const { data, isLoading, isError, refetch, isFetching } = useOperations();

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <VTLAppHeader title="Operations" subtitle="Production & Inventory" />
        <View style={s.skeletons}>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} style={{ marginBottom: 10 }} />)}
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <VTLAppHeader title="Operations" subtitle="Production & Inventory" />
        <View style={s.center}>
          <Text style={s.errorText}>Failed to load operations data.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const today          = new Date().toDateString();
  const activeBatches  = data.batches.filter((b) => b.status === 'in_progress');
  const qaBatches      = data.batches.filter((b) => b.status === 'awaiting_qa');
  const doneTodayBatches = data.batches.filter(
    (b) => b.status === 'completed' && new Date(b.created_at).toDateString() === today,
  );

  const zeroStock     = data.low_stock.filter((i) => i.quantity === 0);
  const lowStockItems = data.low_stock.filter((i) => i.quantity > 0);

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <VTLAppHeader title="Operations" subtitle="Production & Inventory" />

      {/* Sub-tab pills */}
      <View style={s.tabRow}>
        {(['production', 'inventory'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.tabPill, tab === t && s.tabPillActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>
              {t === 'production' ? '🏭 Production' : '📦 Inventory'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={COLORS.sky} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Production Tab ── */}
        {tab === 'production' && (
          <>
            {/* Summary chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipsRow}
            >
              <View style={s.summaryChip}>
                <Text style={[s.chipNum, { color: COLORS.sky }]}>{activeBatches.length}</Text>
                <Text style={s.chipLabel}>Active</Text>
              </View>
              <View style={s.summaryChip}>
                <Text style={[s.chipNum, { color: COLORS.amber }]}>{qaBatches.length}</Text>
                <Text style={s.chipLabel}>QA Pending</Text>
              </View>
              <View style={s.summaryChip}>
                <Text style={[s.chipNum, { color: COLORS.green }]}>{doneTodayBatches.length}</Text>
                <Text style={s.chipLabel}>Done Today</Text>
              </View>
            </ScrollView>

            {/* Batch list */}
            <SectionHeader title="Batches" count={data.batches.length} />
            {data.batches.length === 0 ? (
              <Text style={s.emptyText}>No batches found.</Text>
            ) : (
              data.batches.map((b, i) => (
                <BatchCard
                  key={b.batch_id}
                  batch={b}
                  onPress={() => router.push(`/batch/${b.batch_id}` as any)}
                  index={i}
                />
              ))
            )}
          </>
        )}

        {/* ── Inventory Tab ── */}
        {tab === 'inventory' && (
          <>
            {/* Health row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipsRow}
            >
              <View style={s.summaryChip}>
                <Text style={[s.chipNum, { color: COLORS.text }]}>{data.low_stock.length}</Text>
                <Text style={s.chipLabel}>Total SKUs</Text>
              </View>
              <View style={s.summaryChip}>
                <Text style={[s.chipNum, { color: COLORS.amber }]}>{lowStockItems.length}</Text>
                <Text style={s.chipLabel}>Low Stock</Text>
              </View>
              <View style={s.summaryChip}>
                <Text style={[s.chipNum, { color: COLORS.red }]}>{zeroStock.length}</Text>
                <Text style={s.chipLabel}>Zero Stock</Text>
              </View>
            </ScrollView>

            {/* Low stock list */}
            <SectionHeader title="Low Stock Alert" count={data.low_stock.length} />
            {data.low_stock.length === 0 ? (
              <Text style={s.emptyText}>All items above reorder level.</Text>
            ) : (
              data.low_stock.map((item) => (
                <StockCard key={item.product_id} item={item} />
              ))
            )}

            {/* Recent transactions */}
            <SectionHeader title="Recent Transactions" />
            {data.recent_transactions.length === 0 ? (
              <Text style={s.emptyText}>No recent transactions.</Text>
            ) : (
              <View style={s.card}>
                {data.recent_transactions.map((tx, i) => (
                  <TxRow
                    key={i}
                    tx={tx}
                    last={i === data.recent_transactions.length - 1}
                  />
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: COLORS.bg },
  scroll:   { flex: 1 },
  content:  { paddingHorizontal: 16, paddingBottom: 16 },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  skeletons:{ padding: 16 },

  tabRow:         { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tabPill:        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  tabPillActive:  { backgroundColor: COLORS.sky + '22', borderColor: COLORS.sky },
  tabLabel:       { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: COLORS.sky },

  chipsRow: { gap: 8, paddingBottom: 4, marginBottom: 4 },
  summaryChip:{ backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' },
  chipNum:  { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  chipLabel:{ color: COLORS.muted, fontSize: 11, fontWeight: '600' },

  sectionHeader:    { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 10 },
  sectionTitle:     { color: COLORS.text, fontSize: 14, fontWeight: '700', flex: 1 },
  sectionBadge:     { backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sectionBadgeText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },

  badge:    { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText:{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  card:      { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  emptyText: { color: COLORS.muted, fontSize: 13, fontStyle: 'italic', marginBottom: 8 },

  batchCard:   { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10 },
  batchRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  batchNumber: { color: COLORS.sky, fontFamily: 'monospace', fontSize: 13, fontWeight: '700' },
  batchProduct:{ color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  batchMeta:   { color: COLORS.textMuted, fontSize: 11 },

  stockCard:    { backgroundColor: COLORS.surface, borderLeftWidth: 3, borderLeftColor: COLORS.amber, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 8 },
  stockName:    { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  stockQtyRow:  { color: COLORS.textMuted, fontSize: 12, marginBottom: 8 },
  stockBarBg:   { height: 4, backgroundColor: COLORS.surfaceAlt, borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  stockBarFill: { height: 4, borderRadius: 2 },
  locationChip: { backgroundColor: COLORS.surfaceAlt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  locationText: { color: COLORS.muted, fontSize: 10, fontWeight: '600' },

  txRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, gap: 10 },
  txBorder:   { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  txTypeBadge:{ borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  txTypeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  txMid:      { flex: 1 },
  txProduct:  { color: COLORS.text, fontSize: 13, fontWeight: '500' },
  txMeta:     { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  txQty:      { fontSize: 15, fontWeight: '700', minWidth: 40, textAlign: 'right' },

  errorText:   { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: COLORS.sky, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:{ color: '#fff', fontWeight: '700' },
});
