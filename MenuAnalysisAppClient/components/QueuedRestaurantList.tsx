import React, { useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import { API } from '../config/apiConfig';
import { QueueItem } from '../hooks/useAnalysisQueue';

const C = {
  cream:     '#F2EDE2',
  green:     '#4A7C4E',
  greenLight:'#EAF2EB',
  orange:    '#E07B39',
  text:      '#1C1C1A',
  textMuted: '#7A7570',
  textLight: '#ADA89F',
  white:     '#FFFFFF',
  border:    '#E0D8CC',
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  queue: QueueItem[];
  onMarkComplete: (placeId: string) => Promise<void>;
  onDismiss: (placeId: string) => Promise<void>;
  onOpenRestaurant: (placeId: string, name: string, address: string) => void;
}

export default function QueuedRestaurantList({ queue, onMarkComplete, onDismiss, onOpenRestaurant }: Props) {
  // On mount (each time the Queued tab is opened): poll any "analyzing" items
  // against the DB to catch analyses that completed while the app was closed.
  useEffect(() => {
    const analyzing = queue.filter(i => i.status === 'analyzing');
    analyzing.forEach(async (item) => {
      try {
        const res = await axios.post(API.queryRestaurants, { placeId: item.placeId });
        if (res.data?.length > 0) await onMarkComplete(item.placeId);
      } catch {
        // non-fatal — stale status is fine, push notification will update it
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (queue.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyIcon}>⏳</Text>
        <Text style={s.emptyTitle}>No analyses queued</Text>
        <Text style={s.emptySubtitle}>
          Search for a restaurant and submit its menu to see it here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={queue}
      keyExtractor={item => item.placeId}
      contentContainerStyle={s.list}
      renderItem={({ item }) => {
        const done = item.status === 'complete';
        return (
          <TouchableOpacity
            style={s.card}
            activeOpacity={done ? 0.75 : 1}
            onPress={() => done && onOpenRestaurant(item.placeId, item.name, item.address)}
          >
            <View style={[s.iconWrap, done && s.iconWrapDone]}>
              {done
                ? <Text style={s.checkmark}>✓</Text>
                : <ActivityIndicator size="small" color={C.green} />
              }
            </View>

            <View style={s.body}>
              <Text style={s.name} numberOfLines={1}>{item.name}</Text>
              <Text style={s.address} numberOfLines={1}>{item.address}</Text>
              <Text style={[s.status, done && s.statusDone]}>
                {done ? 'Done — tap to view' : 'Analyzing…'}
              </Text>
            </View>

            <View style={s.right}>
              <Text style={s.time}>{timeAgo(item.submittedAt)}</Text>
              {done && (
                <TouchableOpacity
                  onPress={() => onDismiss(item.placeId)}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  style={s.dismissBtn}
                >
                  <Text style={s.dismissText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 100,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.greenLight,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconWrapDone: {
    backgroundColor: C.greenLight,
  },
  checkmark: {
    fontSize: 18,
    color: C.green,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  address: {
    fontSize: 12,
    color: C.textMuted,
  },
  status: {
    fontSize: 12,
    color: C.textLight,
    marginTop: 2,
  },
  statusDone: {
    color: C.green,
    fontWeight: '600',
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  time: {
    fontSize: 11,
    color: C.textLight,
  },
  dismissBtn: {
    padding: 2,
  },
  dismissText: {
    fontSize: 12,
    color: C.textLight,
  },
});
