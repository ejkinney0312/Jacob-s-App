import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getBalances, listRewardItems } from '@/db/reward-store';
import {
  DEFAULT_REDEMPTION_POLICY,
  describeAffordability,
  describeCost,
  describeRedemptionStatus,
  type Balances,
} from '@/domain/reward-store';
import type { RewardItem } from '@/domain/types';

/**
 * The reward store as the player sees it: what rewards there are and what they cost. Redeeming is OFF until
 * the household confirms how emeralds are spent, and the screen says so plainly instead of hiding the buttons.
 */
export function RewardStoreSection() {
  const db = useSQLiteContext();
  const [rewards, setRewards] = useState<RewardItem[] | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [failed, setFailed] = useState(false);
  const status = describeRedemptionStatus(DEFAULT_REDEMPTION_POLICY);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([listRewardItems(db), getBalances(db)])
        .then(([items, loaded]) => {
          if (!active) return;
          setFailed(false);
          setRewards(items.filter((r) => r.active));
          setBalances(loaded);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
      return () => {
        active = false;
      };
    }, [db]),
  );

  return (
    <>
      <ThemedText type="subtitle" accessibilityRole="header">
        Reward store
      </ThemedText>

      <ThemedView type="notice" style={styles.card}>
        <ThemedText type="smallBold" themeColor="onNotice">
          Demo rewards
        </ThemedText>
        <ThemedText type="small" themeColor="onNotice">
          {status.player} These rewards are samples.
        </ThemedText>
      </ThemedView>

      {failed && <ThemedText>We couldn&apos;t load the rewards. Nothing was lost.</ThemedText>}

      {balances && (
        <ThemedView type="backgroundElement" style={styles.card} accessible accessibilityLabel={`Emeralds available: ${balances.spendableEmeralds}. Earned in total: ${balances.earnedEmeralds}. This number never goes down.`}>
          <ThemedText type="smallBold">Emeralds available</ThemedText>
          <ThemedText type="subtitle">{balances.spendableEmeralds}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Earned in total: {balances.earnedEmeralds}. This number never goes down.
          </ThemedText>
        </ThemedView>
      )}

      {rewards?.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          No rewards to show right now.
        </ThemedText>
      )}

      {rewards?.map((reward) => (
        <ThemedView key={reward.id} type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{reward.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {describeCost(reward.costEmeralds)}
            {reward.isDemo ? ' · Demo reward' : ''}
          </ThemedText>
          {balances && <ThemedText type="small">{describeAffordability(reward.costEmeralds, balances.spendableEmeralds)}</ThemedText>}
          <Button
            label="Redeeming is turned off"
            variant="secondary"
            disabled={!DEFAULT_REDEMPTION_POLICY.enabled}
            hint="Redeeming rewards is switched off until your household decides how emeralds are spent"
            onPress={() => {}}
          />
        </ThemedView>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
});
