import { routeForNotification } from '../notification-route';

describe('where a tapped notification goes', () => {
  it('opens Health for a routine reminder and Today for a quest reminder', () => {
    expect(routeForNotification({ type: 'routine-reminder' })).toBe('/health');
    expect(routeForNotification({ type: 'quest-reminder' })).toBe('/');
  });

  it('does nothing for anything it does not recognize', () => {
    expect(routeForNotification({ type: 'something-else' })).toBeNull();
    expect(routeForNotification({ type: 7 })).toBeNull();
    expect(routeForNotification({})).toBeNull();
    expect(routeForNotification(null)).toBeNull();
    expect(routeForNotification(undefined)).toBeNull();
    expect(routeForNotification('routine-reminder')).toBeNull();
  });

  it('ignores a route smuggled into the data, so a notification cannot send the app anywhere else', () => {
    expect(routeForNotification({ type: 'other', url: '/caregiver' })).toBeNull();
    expect(routeForNotification({ type: 'routine-reminder', url: '/caregiver' })).toBe('/health');
  });
});
