import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { SwitchRow, SwitchRowText } from '@/components/switch-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { setRewardActive, updateRewardCost } from '@/db/caregiver-edits';
import { getBalances, listRedemptions, listRewardItems } from '@/db/reward-store';
import { formatLocalDate, toLocalDate } from '@/domain/local-date';
import {
  DEFAULT_REDEMPTION_POLICY,
  MAX_REWARD_COST,
  describeCost,
  describeRedemptionStatus,
  parseRewardCost,
  type Balances,
  type Redemption,
} from '@/domain/reward-store';
import type { RewardItem } from '@/domain/types';

import { NumberField } from './number-field';

interface Data {
  rewards: RewardItem[];
  balances: Balances;
  log: Redemption[];
}

/** Caregiver view of the reward store: costs, what is shown, whether redeeming is on, and the log. */
export function RewardsPanel() {
  const db = useSQLiteContext();
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const status = describeRedemptionStatus(DEFAULT_REDEMPTION_POLICY);

  const load = useCallback(async (): Promise<Data> => {
    const [rewards, balances, log] = await Promise.all([listRewardItems(db), getBalances(db), listRedemptions(db)]);
    return { rewards, balances, log };
  }, [db]);

  useEffect(() => {
    let active = true;
    load()
      .then((loaded) => {
        if (active) setData(loaded);
      })
      .catch(() => {
        if (active) setMessage("We couldn't load the reward store. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [load]);

  const reload = useCallback(async () => {
    try {
      setData(await load());
    } catch {
      setMessage("We couldn't refresh the reward store.");
    }
  }, [load]);

  return (
    <ThemedView type="backgroundElement" style={styles.panel}>
      <ThemedText type="subtitle" accessibilityRole="header">
        Reward store
      </ThemedText>

      <ThemedView type="background" style={styles.card}>
        <ThemedText type="smallBold">Redeeming: {DEFAULT_REDEMPTION_POLICY.enabled ? 'On' : 'Off'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {status.caregiver}
        </ThemedText>
      </ThemedView>

      {message && (
        <ThemedText type="small" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      )}

      {data && (
        <ThemedText type="small" themeColor="textSecondary">
          Emeralds earned in total: {data.balances.earnedEmeralds} (never goes down) · Available: {data.balances.spendableEmeralds}
        </ThemedText>
      )}

      {data?.rewards.map((reward) => (
        <RewardRow
          key={reward.id}
          reward={reward}
          onMessage={setMessage}
          onChanged={reload}
          db={db}
        />
      ))}

      <ThemedText type="smallBold" accessibilityRole="header">
        Redemption log
      </ThemedText>
      {data?.log.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Nothing has been redeemed.
        </ThemedText>
      )}
      {data?.log.map((entry) => (
        <ThemedView key={entry.id} type="background" style={styles.card}>
          <ThemedText type="smallBold">{entry.rewardTitle}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {describeCost(entry.costEmeralds)} · {formatLocalDate(toLocalDate(new Date(entry.redeemedAt)))}
          </ThemedText>
        </ThemedView>
      ))}
    </ThemedView>
  );
}

function RewardRow({
  reward,
  db,
  onMessage,
  onChanged,
}: {
  reward: RewardItem;
  db: ReturnType<typeof useSQLiteContext>;
  onMessage: (message: string | null) => void;
  onChanged: () => Promise<void>;
}) {
  const [cost, setCost] = useState(String(reward.costEmeralds));
  const [busy, setBusy] = useState(false);

  const saveCost = async () => {
    if (busy) return;
    const parsed = parseRewardCost(cost);
    if (parsed === null) {
      onMessage(`Use a whole number of emeralds from 1 to ${MAX_REWARD_COST}.`);
      return;
    }
    setBusy(true);
    try {
      await updateRewardCost(db, reward.id, parsed);
      onMessage(`${reward.title} now costs ${describeCost(parsed)}. This applies from now on.`);
      await onChanged();
    } catch {
      onMessage("We couldn't save that. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (active: boolean) => {
    try {
      await setRewardActive(db, reward.id, active);
      onMessage(active ? `${reward.title} is shown in the store.` : `${reward.title} is hidden from the store.`);
      await onChanged();
    } catch {
      onMessage("We couldn't save that. Nothing was changed.");
    }
  };

  return (
    <ThemedView type="background" style={styles.card}>
      <SwitchRow label={`Show ${reward.title} in the store`} value={reward.active} onChange={(v) => void toggle(v)}>
        <SwitchRowText
          title={reward.title}
          caption={`${reward.active ? 'Shown' : 'Hidden'}${reward.isDemo ? ' · Demo reward' : ''}`}
        />
      </SwitchRow>
      <NumberField label="Cost in emeralds" value={cost} onChangeText={setCost} />
      <Button label="Save cost" variant="secondary" disabled={busy} hint={`Saves the cost of ${reward.title}`} onPress={() => void saveCost()} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
});
