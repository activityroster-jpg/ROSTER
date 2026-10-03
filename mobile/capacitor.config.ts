import type { CapacitorConfig } from "@capacitor/cli";

/**
 * ActivityRoster instructor app — a native shell (Capacitor) around the
 * instructor portal served from activityroster.com. The app loads the live
 * site, so every portal update ships to phones automatically; native plugins
 * (push, biometrics) are available because everything the app shows lives on
 * the one apex origin (see /app and the selected-centre cookie).
 */
const APEX = "activityroster.com";

const config: CapacitorConfig = {
  appId: "com.activityroster.app",
  appName: "ActivityRoster",
  webDir: "www",
  server: {
    url: `https://${APEX}/app`,
    // Pages the app may open in-place. Anything else opens in the system browser.
    allowNavigation: [APEX, `*.${APEX}`],
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    scheme: "ActivityRoster",
    backgroundColor: "#0A2E52",
  },
  android: {
    backgroundColor: "#0A2E52",
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
    SplashScreen: { launchAutoHide: true, backgroundColor: "#0A2E52", showSpinner: false },
  },
};

export default config;
