import { Alert, Platform } from 'react-native';

// Alert has no UI on web, so the web app uses the browser's own dialogs.

export function showMessage(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n${message}` : title);
  else Alert.alert(title, message);
}

export function showError(title: string, e: unknown) {
  showMessage(title, (e as Error)?.message ?? String(e));
}

/** Asks before an action that can't be taken back. */
export function confirm(title: string, message: string, ok: string, back: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: back, style: 'cancel' },
    { text: ok, style: 'destructive', onPress: onOk },
  ]);
}
