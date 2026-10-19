import type { ConfigContext, ExpoConfig } from 'expo/config';

// Set EXPO_BASE_URL when the web build is served from a sub-path (e.g. GitHub Pages at /new-chester-app).
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL || undefined },
});
