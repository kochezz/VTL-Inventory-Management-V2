import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import api, { VendorWatchItem, ZeroStockProduct } from '../../services/api';
import { COLORS } from '../../constants/theme';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

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

function VendorRow({ item, last }: { item: VendorWatchItem; last: boolean }) {
  const ncrColor = item.open_ncr_count > 3 ? COLORS.red
    : item.open_ncr_count > 0 ? COLORS.amber
    : COLORS.green;
  return (
    <View style={[s.vendorRow, !last && s.rowDivider]}>
      <View style={s.vendorLeft}>
        <Text style={s.vendorName}>{item.supplier_name}</Text>
        <Text style={s.vendorMeta}>{item.supplier_code} · Last delivery: {formatDate(item.last_delivery_date)}</Text>
      </View>
      <View style={[s.ncrBadge, { borderColor: ncrColor }]}>
        <Text style={[s.ncrBadgeText, { color: ncrColor }]}>
          {item.open_ncr_count} NCR{item.open_ncr_count !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

function ZeroStockRow({ item, last }: { item: ZeroStockProduct; last: boolean }) {
  return (
    <View style={[s.zeroRow, !last && s.rowDivider]}>
      <View style={s.zeroLeft}>
        <Text style={s.zeroName}>{item.product_name}</Text>
        <Text style={s.zeroSku}>{item.sku || 'No SKU'}</Text>
      </View>
      <View style={s.zeroRight}>
        <View style={s.zeroPill}>
          <Text style={s.zeroPillText}>OUT</Text>
        </View>
        <Text style={s.zeroDate}>{formatDate(item.last_transaction_date)}</Text>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialScreen() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['commercial'],
    queryFn: api.getCommercial,
    staleTime: 60_000,
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
          <Text style={s.errorText}>Failed to load commercial data.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={COLORS.sky} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.screenTitle}>Commercial</Text>

        {/* Vendor Watch */}
        <SectionHeader title="Vendor Watch" count={data.vendor_watch.length} />
        {data.vendor_watch.length === 0 ? (
          <Text style={s.emptyText}>No vendors with open NCRs.</Text>
        ) : (
          <View style={s.card}>
            {data.vendor_watch.map((v, i) => (
              <VendorRow
                key={v.supplier_id}
                item={v}
                last={i === data.vendor_watch.length - 1}
              />
            ))}
          </View>
        )}

        {/* Zero Stock Impact */}
        <SectionHeader title="Zero Stock Impact" count={data.zero_stock_products.length} />
        {data.zero_stock_products.length === 0 ? (
          <Text style={s.emptyText}>All active products have stock.</Text>
        ) : (
          <View style={s.card}>
            {data.zero_stock_products.map((p, i) => (
              <ZeroStockRow
                key={p.product_id}
                item={p}
                last={i === data.zero_stock_products.length - 1}
              />
            ))}
          </View>
        )}

        {/* Sales Pipeline — Coming Soon */}
        <SectionHeader title="Sales Pipeline" />
        <View style={s.comingSoonCard}>
          <Text style={s.comingSoonIcon}>📈</Text>
          <Text style={s.comingSoonTitle}>Coming Soon</Text>
          <Text style={s.comingSoonSub}>
            Sales orders, revenue pipeline, and customer analytics will appear here.
          </Text>
        </View>

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
  rowDivider:{ borderBottomWidth: 1, borderBottomColor: COLORS.border },
  emptyText: { color: COLORS.muted, fontSize: 13, fontStyle: 'italic', marginBottom: 8 },

  vendorRow:    { flexDirection: 'row', alignItems: 'center', padding: 14 },
  vendorLeft:   { flex: 1, marginRight: 12 },
  vendorName:   { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  vendorMeta:   { color: COLORS.muted, fontSize: 12 },
  ncrBadge:     { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  ncrBadgeText: { fontSize: 11, fontWeight: '700' },

  zeroRow:     { flexDirection: 'row', alignItems: 'center', padding: 14 },
  zeroLeft:    { flex: 1 },
  zeroName:    { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  zeroSku:     { color: COLORS.muted, fontSize: 12 },
  zeroRight:   { alignItems: 'flex-end', gap: 4 },
  zeroPill:    { backgroundColor: COLORS.red + '22', borderWidth: 1, borderColor: COLORS.red, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  zeroPillText:{ color: COLORS.red, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  zeroDate:    { color: COLORS.muted, fontSize: 11 },

  comingSoonCard:  { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 32, alignItems: 'center' },
  comingSoonIcon:  { fontSize: 36, marginBottom: 12 },
  comingSoonTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  comingSoonSub:   { color: COLORS.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  errorText:   { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: COLORS.sky, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:{ color: '#fff', fontWeight: '700' },
});
