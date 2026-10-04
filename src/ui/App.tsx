import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { getActiveSession } from '../db/repo';
import { useSettings } from './hooks';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SessionScreen } from './screens/SessionScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SummaryScreen } from './screens/SummaryScreen';

export type Route =
  | { name: 'home' }
  | { name: 'session' }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'summary'; sessionId: number };

export function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const settings = useSettings();
  const active = useLiveQuery(async () => (await getActiveSession()) ?? null, [], 'loading' as const);

  if (!settings || active === 'loading') return <div className="screen center muted">Loading…</div>;

  switch (route.name) {
    case 'session':
      if (!active) return <HomeScreen active={null} go={setRoute} />;
      return <SessionScreen session={active} settings={settings} go={setRoute} />;
    case 'history':
      return <HistoryScreen settings={settings} go={setRoute} />;
    case 'settings':
      return <SettingsScreen settings={settings} go={setRoute} />;
    case 'summary':
      return <SummaryScreen sessionId={route.sessionId} settings={settings} go={setRoute} />;
    default:
      return <HomeScreen active={active} go={setRoute} />;
  }
}
