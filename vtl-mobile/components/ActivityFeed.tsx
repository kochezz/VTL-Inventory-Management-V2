import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

export interface FeedItem {
  title: string;
  description?: string;
  time: string;
  type: string;
}

const TYPE_COLOR: Record<string, string> = {
  NCR:          COLORS.red,
  CAPA_OVERDUE: COLORS.red,
  ZERO_STOCK:   COLORS.amber,
  DOC_REVIEW:   COLORS.blue,
};

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface ActivityFeedProps {
  items: FeedItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (!items.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No recent activity</Text>
      </View>
    );
  }

  return (
    <View>
      {items.map((item, idx) => {
        const dotColor = TYPE_COLOR[item.type] ?? COLORS.muted;
        const isLast   = idx === items.length - 1;
        return (
          <View key={idx} style={styles.row}>
            {/* Timeline track */}
            <View style={styles.track}>
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
              {!isLast && <View style={styles.line} />}
            </View>

            {/* Content */}
            <View style={[styles.content, !isLast && styles.contentBorder]}>
              <View style={styles.contentHeader}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.time}>{relativeTime(item.time)}</Text>
              </View>
              {item.description
                ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
                : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  track: {
    width: 24,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: COLORS.border,
    marginTop: 4,
    marginBottom: -4,
  },
  content: {
    flex: 1,
    paddingBottom: 16,
    paddingLeft: 10,
  },
  contentBorder: {
    // subtle separator managed by the timeline line instead
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  time: {
    fontSize: 11,
    color: COLORS.muted,
    flexShrink: 0,
  },
  desc: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  empty: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 13,
  },
});
