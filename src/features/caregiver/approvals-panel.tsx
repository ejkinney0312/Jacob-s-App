import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { approveMission, listWaitingApprovals, requestAnotherTry, type WaitingApproval } from '@/db/approvals';
import { formatLocalDate } from '@/domain/local-date';
import { describeReward } from '@/domain/rewards';

import { describeAnotherTryResult, describeApprovalResult } from './messages';

/** Key missions Jacob has finished that wait for a caregiver. Approving pays them, once. */
export function ApprovalsPanel() {
  const db = useSQLiteContext();
  const [items, setItems] = useState<WaitingApproval[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setItems(await listWaitingApprovals(db));
    } catch {
      setMessage("We couldn't load the approvals. Please try again.");
    }
  }, [db]);

  useEffect(() => {
    let active = true;
    listWaitingApprovals(db)
      .then((waiting) => {
        if (active) setItems(waiting);
      })
      .catch(() => {
        if (active) setMessage("We couldn't load the approvals. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [db]);

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
        Approvals
      </ThemedText>
      {message && (
        <ThemedText type="small" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      )}
      {items?.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Nothing is waiting for approval.
        </ThemedText>
      )}
      {items?.map((item) => (
        <ThemedView key={item.missionInstanceId} type="background" style={styles.card}>
          <ThemedText type="smallBold">{item.questTitle}</ThemedText>
          <ThemedText type="small">
            Mission {item.missionPosition}: {item.missionTitle}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Finished on {formatLocalDate(item.localDate)}
            {item.redoCount > 0 ? ` · another try asked ${item.redoCount} ${item.redoCount === 1 ? 'time' : 'times'}` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Approving adds {describeReward(item.reward)}.
          </ThemedText>
          <Button
            label="Approve"
            disabled={busy}
            hint={`Approves ${item.missionTitle} from ${item.questTitle}`}
            onPress={() => void act(async () => describeApprovalResult(await approveMission(db, item.missionInstanceId)))}
          />
          <Button
            label="Ask for another try"
            variant="secondary"
            disabled={busy}
            hint={`Sends ${item.missionTitle} back to be done again. Nothing is taken away.`}
            onPress={() => void act(async () => describeAnotherTryResult(await requestAnotherTry(db, item.missionInstanceId)))}
          />
        </ThemedView>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
});
