import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ChunkyCard } from '@/components/chunky-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { describePinProblem, PIN_LENGTH } from '@/domain/caregiver-pin';
import type { CaregiverPinService, PinStatus } from '@/services/caregiver-pin';

import { ApprovalsPanel } from './approvals-panel';
import { describeGuessFailure } from './messages';
import { CAREGIVER_SECTIONS, type CaregiverSectionId } from './caregiver-sections';
import { ChoreEditor } from './chore-editor';
import { EventsPanel } from './events-panel';
import { MenuTile } from './menu-tile';
import { MetricsView } from './metrics-view';
import { QuestsPanel } from './quests-panel';
import { RemindersPanel } from './reminders-panel';
import { RoutinesPanel } from './routines-panel';
import { RewardEditor } from './reward-editor';
import { RewardsPanel } from './rewards-panel';
import { PinField } from './pin-field';
import { useCaregiverSession } from './session-context';
import { usePinService } from './use-pin-service';

type Loaded = PinStatus | { state: 'loading' } | { state: 'error' };

export function CaregiverScreen() {
  const service = usePinService();
  const { unlocked, unlock, lock, touch } = useCaregiverSession();
  const [status, setStatus] = useState<Loaded>({ state: 'loading' });
  const [mode, setMode] = useState<'default' | 'forgot' | 'newCode'>('default');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [editingChoresId, setEditingChoresId] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  // The page the caregiver is on: the menu (null) or one section. Metrics is a section too.
  const [section, setSection] = useState<CaregiverSectionId | null>(null);

  const refresh = useCallback(async () => {
    if (!service) return;
    try {
      setStatus(await service.status());
    } catch {
      setStatus({ state: 'error' });
    }
  }, [service]);

  // Leaving the Caregiver tab closes caregiver mode.
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        lock();
        setSection(null);
      };
    }, [refresh, lock]),
  );

  const finishSetup = (code: string) => {
    setRecoveryCode(code);
    setMode('default');
    setSection(null);
    unlock();
    void refresh();
  };

  let content;
  if (!service || status.state === 'loading') {
    content = <ThemedText themeColor="textSecondary">Loading…</ThemedText>;
  } else if (status.state === 'error') {
    content = (
      <>
        <ThemedText>We couldn&apos;t read the PIN settings on this phone.</ThemedText>
        <Button chunky label="Try again" onPress={() => void refresh()} />
      </>
    );
  } else if (recoveryCode !== null) {
    content = <RecoveryCodeNotice code={recoveryCode} onSaved={() => setRecoveryCode(null)} />;
  } else if (status.state === 'notSet') {
    content = <SetupForm service={service} onDone={finishSetup} />;
  } else if (status.state === 'damaged') {
    content = status.canRecover ? (
      <ForgotForm service={service} onDone={finishSetup} intro="The saved PIN couldn't be read. Use your recovery code to set a new one." />
    ) : (
      <Notice
        title="The saved PIN couldn't be read"
        body="There is no recovery code to fall back on. Removing and reinstalling the app clears it, but also clears the quests and progress stored on this phone."
      />
    );
  } else if (unlocked) {
    content =
      mode === 'newCode' ? (
        <NewCodeForm service={service} onDone={(code) => { setRecoveryCode(code); setMode('default'); }} onBack={() => setMode('default')} />
      ) : section === 'metrics' ? (
        <MetricsView onBack={() => setSection(null)} />
      ) : editingChoresId !== null ? (
        <ChoreEditor
          questId={editingChoresId}
          onDone={() => setEditingChoresId(null)}
        />
      ) : editingQuestId !== null ? (
        <RewardEditor
          questId={editingQuestId}
          onDone={(message) => {
            setSavedMessage(message);
            setEditingQuestId(null);
          }}
          onCancel={() => setEditingQuestId(null)}
        />
      ) : section !== null ? (
        <SectionPage
          section={section}
          onBack={() => setSection(null)}
          onEditQuest={(id) => {
            setSavedMessage(null);
            setEditingQuestId(id);
          }}
          onEditChores={(id) => {
            setSavedMessage(null);
            setEditingChoresId(id);
          }}
          savedMessage={savedMessage}
        />
      ) : (
        <Home onLock={lock} onNewCode={() => setMode('newCode')} onOpen={setSection} />
      );
  } else {
    content =
      mode === 'forgot' ? (
        <ForgotForm service={service} onDone={finishSetup} onBack={() => setMode('default')} />
      ) : (
        <EntryForm
          service={service}
          lock={status.lock}
          onUnlocked={() => {
            setSection(null);
            unlock();
          }}
          onForgot={() => setMode('forgot')}
          onChanged={() => void refresh()}
        />
      );
  }

  return (
    <Screen tone="caregiver">
      <View onTouchStart={touch} style={styles.stack}>
        <ThemedText type="display" accessibilityRole="header">
          Caregiver
        </ThemedText>
        {content}
      </View>
    </Screen>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <ChunkyCard style={styles.card}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {body}
      </ThemedText>
    </ChunkyCard>
  );
}

function Message({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <ThemedText type="small" accessibilityLiveRegion="polite" accessibilityRole="alert">
      {text}
    </ThemedText>
  );
}

function SetupForm({ service, onDone }: { service: CaregiverPinService; onDone: (code: string) => void }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (pin !== confirm) {
      setMessage("The two PINs don't match.");
      return;
    }
    setBusy(true);
    try {
      const result = await service.setPin(pin);
      if (result.ok) {
        setPin('');
        setConfirm('');
        onDone(result.recoveryCode);
      } else {
        setMessage(result.reason === 'invalid' ? describePinProblem(result.problem) : 'A PIN is already set.');
      }
    } catch {
      setMessage("We couldn't save the PIN. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Notice
        title="Set a caregiver PIN"
        body={`Caregiver tools sit behind a ${PIN_LENGTH}-digit PIN. Choose one that is easy for you to remember and hard to guess.`}
      />
      <PinField label="New PIN" value={pin} onChangeText={setPin} />
      <PinField label="Type it again" value={confirm} onChangeText={setConfirm} onSubmitEditing={() => void submit()} />
      <Message text={message} />
      <Button chunky label="Set PIN" onPress={() => void submit()} disabled={busy} />
    </>
  );
}

function RecoveryCodeNotice({ code, onSaved }: { code: string; onSaved: () => void }) {
  return (
    <>
      <Notice
        title="Your recovery code"
        body="Write this down and keep it somewhere safe, not on this phone. It is the only way back in if you forget your PIN. It will not be shown again."
      />
      <ChunkyCard style={[styles.card, styles.codeBox]} accessible accessibilityLabel={`Recovery code: ${code.split('').join(' ')}`}>
        <ThemedText type="title" style={styles.code} selectable={false}>
          {code}
        </ThemedText>
      </ChunkyCard>
      <Button chunky label="I've saved it" onPress={onSaved} />
    </>
  );
}

function EntryForm({
  service,
  lock,
  onUnlocked,
  onForgot,
  onChanged,
}: {
  service: CaregiverPinService;
  lock: { locked: boolean; until: number | null; attemptsBeforeWait: number };
  onUnlocked: () => void;
  onForgot: () => void;
  onChanged: () => void;
}) {
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(
    lock.locked && lock.until !== null ? describeGuessFailure({ ok: false, reason: 'locked', until: lock.until }) : null,
  );
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || pin.length !== PIN_LENGTH) return;
    setBusy(true);
    try {
      const result = await service.verifyPin(pin);
      setPin('');
      if (result.ok) onUnlocked();
      else setMessage(describeGuessFailure(result));
      onChanged();
    } catch {
      setMessage("We couldn't check the PIN. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Notice title="Enter your PIN" body="Caregiver tools are locked." />
      <PinField label="PIN" value={pin} onChangeText={setPin} onSubmitEditing={() => void submit()} />
      <Message text={message} />
      <Button chunky label="Unlock" onPress={() => void submit()} disabled={busy || pin.length !== PIN_LENGTH} />
      <Button chunky label="Forgot PIN?" variant="secondary" onPress={onForgot} />
    </>
  );
}

function ForgotForm({
  service,
  onDone,
  onBack,
  intro = 'Enter the recovery code you wrote down, then choose a new PIN.',
}: {
  service: CaregiverPinService;
  onDone: (code: string) => void;
  onBack?: () => void;
  intro?: string;
}) {
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (pin !== confirm) {
      setMessage("The two PINs don't match.");
      return;
    }
    setBusy(true);
    try {
      const result = await service.resetWithRecoveryCode(code, pin);
      if (result.ok) {
        setCode('');
        setPin('');
        setConfirm('');
        onDone(result.recoveryCode);
      } else if (result.reason === 'invalid') {
        setMessage(describePinProblem(result.problem));
      } else if (result.reason === 'badCode') {
        setMessage("That doesn't look like a recovery code. It has 10 letters and numbers.");
      } else {
        setMessage(describeGuessFailure(result));
      }
    } catch {
      setMessage("We couldn't check the code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Notice title="Forgot your PIN?" body={intro} />
      <PinField label="Recovery code" kind="code" value={code} onChangeText={setCode} />
      <PinField label="New PIN" value={pin} onChangeText={setPin} />
      <PinField label="Type the new PIN again" value={confirm} onChangeText={setConfirm} onSubmitEditing={() => void submit()} />
      <Message text={message} />
      <Button chunky label="Set new PIN" onPress={() => void submit()} disabled={busy} />
      {onBack && <Button chunky label="Back" variant="secondary" onPress={onBack} />}
    </>
  );
}

function NewCodeForm({
  service,
  onDone,
  onBack,
}: {
  service: CaregiverPinService;
  onDone: (code: string) => void;
  onBack: () => void;
}) {
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || pin.length !== PIN_LENGTH) return;
    setBusy(true);
    try {
      const result = await service.regenerateRecoveryCode(pin);
      setPin('');
      if (result.ok) onDone(result.recoveryCode);
      else setMessage(describeGuessFailure(result));
    } catch {
      setMessage("We couldn't make a new code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Notice title="New recovery code" body="Enter your PIN to get a new recovery code. The old code will stop working." />
      <PinField label="PIN" value={pin} onChangeText={setPin} onSubmitEditing={() => void submit()} />
      <Message text={message} />
      <Button chunky label="Show new code" onPress={() => void submit()} disabled={busy || pin.length !== PIN_LENGTH} />
      <Button chunky label="Back" variant="secondary" onPress={onBack} />
    </>
  );
}

function Home({
  onLock,
  onNewCode,
  onOpen,
}: {
  onLock: () => void;
  onNewCode: () => void;
  onOpen: (section: CaregiverSectionId) => void;
}) {
  return (
    <>
      <Notice
        title="Caregiver mode is open"
        body="It locks when you leave this tab, when the app goes to the background, or after 5 minutes without a touch."
      />
      <Button chunky label="Lock now" onPress={onLock} />
      {/* Approvals stay here: they are the one thing that is waiting for you. */}
      <ApprovalsPanel />
      <View style={styles.tiles}>
        {CAREGIVER_SECTIONS.map((section) => (
          <MenuTile key={section.id} section={section} onPress={() => onOpen(section.id)} />
        ))}
      </View>
      <Button chunky label="New recovery code" variant="secondary" onPress={onNewCode} />
    </>
  );
}

/** One section's page: the same panel that used to sit on the long home page, with a way back. */
function SectionPage({
  section,
  onBack,
  onEditQuest,
  onEditChores,
  savedMessage,
}: {
  section: Exclude<CaregiverSectionId, 'metrics'>;
  onBack: () => void;
  onEditQuest: (questId: string) => void;
  onEditChores: (questId: string) => void;
  savedMessage: string | null;
}) {
  return (
    <>
      <Button chunky label="Back to Caregiver" variant="secondary" onPress={onBack} />
      {savedMessage && <Message text={savedMessage} />}
      {section === 'quests' && <QuestsPanel onEdit={onEditQuest} onEditChores={onEditChores} />}
      {section === 'reminders' && <RemindersPanel />}
      {section === 'routines' && <RoutinesPanel />}
      {section === 'events' && <EventsPanel />}
      {section === 'rewards' && <RewardsPanel />}
    </>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.three },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  codeBox: { alignItems: 'center' },
  code: { letterSpacing: 4, textAlign: 'center' },
});
