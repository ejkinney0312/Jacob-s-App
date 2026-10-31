import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { SwitchRow, SwitchRowText } from '@/components/switch-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { setRewardActive, updateRewardCost } from '@/db/caregiver-edits';
import { approveRequest, declineRequest, listOpenRequests, markGiven, refundRedemption } from '@/db/reward-requests';
import { getBalances, listRedemptions, listRewardItems } from '@/db/reward-store';
import { formatLocalDate, toLocalDate } from '@/domain/local-date';
import {
  DEFAULT_REDEMPTION_POLICY,
  MAX_REWARD_COST,
  describeCost,
  describeDecideOutcome,
  describeRedemptionStatus,
  describeRefundOutcome,
  describeRequestStatus,
  parseRewardCost,
  type Balances,
  type Redemption,
  type RewardRequest,
} from '@/domain/reward-store';
import type { RewardItem } from '@/domain/types';

import { NumberField } from './number-field';

interface Data {
  rewards: RewardItem[];
  balances: Balances;
  log: Redemption[];
  pending: RewardRequest[];
}

/** Caregiver view of the reward store: costs, what is shown, whether redeeming is on, and the log. */
export function RewardsPanel() {
  const db = useSQLiteContext();
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const status = describeRedemptionStatus(DEFAULT_REDEMPTION_POLICY);

  const load = useCallback(async (): Promise<Data> => {
    const [rewards, balances, log, pending] = await Promise.all([
      listRewardItems(db),
      getBalances(db),
      listRedemptions(db),
      listOpenRequests(db),
    ]);
    return { rewards, balances, log, pending };
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

  // One decision at a time, then a refresh. The database ignores a repeat, so a double tap can never spend twice.
  const act = async (run: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    try {
      setMessage(await run());
    } catch {
      setMessage("We couldn't save that. Nothing was changed.");
    } finally {
      await reload();
      setBusy(false);
    }
  };

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

      <ThemedText type="smallBold" accessibilityRole="header">
        Waiting for you
      </ThemedText>
      {data?.pending.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          No one is waiting for a reward.
        </ThemedText>
      )}
      {data?.pending.map((request) =>
        request.status === 'approved' ? (
          <ThemedView key={request.id} type="background" style={styles.card}>
            <ThemedText type="smallBold">{request.rewardTitle}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {describeRequestStatus(request)} · {describeCost(request.costEmeralds)} used
            </ThemedText>
            <Button
              label="Mark as given"
              disabled={busy}
              hint={`Records that ${request.rewardTitle} was handed over. No more emeralds are used.`}
              onPress={() =>
                void act(async () =>
                  describeDecideOutcome((await markGiven(db, request.id)).outcome, request.rewardTitle, request.costEmeralds),
                )
              }
            />
          </ThemedView>
        ) : (
        <ThemedView key={request.id} type="background" style={styles.card}>
          <ThemedText type="smallBold">{request.rewardTitle}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {describeCost(request.costEmeralds)} · asked {formatLocalDate(toLocalDate(new Date(request.requestedAt)))}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Approving uses {describeCost(request.costEmeralds)}. You mark it given after you hand it over.
          </ThemedText>
          <Button
            label="Approve"
            disabled={busy || !DEFAULT_REDEMPTION_POLICY.enabled}
            hint={`Approves ${request.rewardTitle} and uses ${describeCost(request.costEmeralds)}`}
            onPress={() =>
              void act(async () =>
                describeDecideOutcome((await approveRequest(db, request.id)).outcome, request.rewardTitle, request.costEmeralds),
              )
            }
          />
          <Button
            label="Not this time"
            variant="secondary"
            disabled={busy}
            hint={`Declines ${request.rewardTitle}. No emeralds are used.`}
            onPress={() =>
              void act(async () =>
                describeDecideOutcome((await declineRequest(db, request.id)).outcome, request.rewardTitle, request.costEmeralds),
              )
            }
          />
        </ThemedView>
        ),
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
            {entry.refundedAt ? ` · Refunded ${formatLocalDate(toLocalDate(new Date(entry.refundedAt)))}` : ''}
          </ThemedText>
          {!entry.refundedAt && (
            <Button
              label="Refund"
              variant="secondary"
              disabled={busy}
              hint={`Gives ${describeCost(entry.costEmeralds)} back for ${entry.rewardTitle}. The entry stays in the log.`}
              onPress={() =>
                void act(async () =>
                  describeRefundOutcome((await refundRedemption(db, entry.id)).outcome, entry.rewardTitle, entry.costEmeralds),
                )
              }
            />
          )}
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
