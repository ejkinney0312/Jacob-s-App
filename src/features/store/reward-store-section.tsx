import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { askForReward, listOpenRequests, withdrawRequest } from '@/db/reward-requests';
import { getBalances, listRewardItems } from '@/db/reward-store';
import {
  DEFAULT_REDEMPTION_POLICY,
  describeAffordability,
  describeAskOutcome,
  describeCost,
  describeDecideOutcome,
  describeRedemptionStatus,
  describeRequestStatus,
  type Balances,
  type RewardRequest,
} from '@/domain/reward-store';
import type { RewardItem } from '@/domain/types';

/** One key per tap. The same tap repeated (a double tap, a retry) reuses it, so it can only ask once. */
const newRequestKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * The reward store as the player sees it: what rewards there are and what they cost. The player ASKS for a reward and
 * a caregiver approves it; nothing is used until then. Asking is OFF until the real rewards are set up, and the screen
 * says so plainly instead of hiding the buttons.
 */
export function RewardStoreSection() {
  const db = useSQLiteContext();
  const [rewards, setRewards] = useState<RewardItem[] | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [pending, setPending] = useState<RewardRequest[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const status = describeRedemptionStatus(DEFAULT_REDEMPTION_POLICY);

  const load = useCallback(
    () => Promise.all([listRewardItems(db), getBalances(db), listOpenRequests(db)]),
    [db],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load()
        .then(([items, loaded, waiting]) => {
          if (!active) return;
          setFailed(false);
          setRewards(items.filter((r) => r.active));
          setBalances(loaded);
          setPending(waiting);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
      return () => {
        active = false;
      };
    }, [load]),
  );

  const act = async (run: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    try {
      setMessage(await run());
      const [items, loaded, waiting] = await load();
      setRewards(items.filter((r) => r.active));
      setBalances(loaded);
      setPending(waiting);
    } catch {
      setMessage("We couldn't save that. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const ask = (reward: RewardItem) =>
    act(async () => {
      const result = await askForReward(db, { rewardId: reward.id, requestKey: newRequestKey() });
      return describeAskOutcome(result.outcome, reward.title);
    });

  const takeBack = (request: RewardRequest) =>
    act(async () => describeDecideOutcome((await withdrawRequest(db, request.id)).outcome, request.rewardTitle, request.costEmeralds));

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

      {message && (
        <ThemedText type="small" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      )}

      {pending.map((request) => (
        <ThemedView key={request.id} type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{request.rewardTitle}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {describeRequestStatus(request)} · {describeCost(request.costEmeralds)}
          </ThemedText>
          {request.status === 'pending' && (
            <Button
              label="Take it back"
              variant="secondary"
              disabled={busy}
              hint={`Takes back your ask for ${request.rewardTitle}. No emeralds are used.`}
              onPress={() => void takeBack(request)}
            />
          )}
        </ThemedView>
      ))}

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
            label={DEFAULT_REDEMPTION_POLICY.enabled ? 'Ask for this reward' : 'Asking is turned off'}
            variant="secondary"
            disabled={busy || !DEFAULT_REDEMPTION_POLICY.enabled}
            hint={
              DEFAULT_REDEMPTION_POLICY.enabled
                ? `Asks a caregiver for ${reward.title}. Nothing is used until they say yes.`
                : 'Asking for rewards is switched off until the real rewards are set up'
            }
            onPress={() => void ask(reward)}
          />
        </ThemedView>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
});
