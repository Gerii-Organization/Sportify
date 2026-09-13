const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * Strips the push entitlement expo-notifications always adds.
 *
 * `expo-notifications`' own config plugin writes `aps-environment`
 * unconditionally — there is no option to turn it off — because the module
 * supports remote push as well as the local scheduling this app actually uses
 * (rest timer alerts, streak and water reminders, none of which need it).
 *
 * The problem is Apple, not Expo: a personal, non-paid developer team cannot
 * create a provisioning profile for an app carrying that entitlement at all,
 * which is a dead end for building on a device with a free Apple ID —
 * "Personal development teams ... do not support the Push Notifications
 * capability." Every local scheduled notification still works without it;
 * only remote push would need it back, alongside a paid membership.
 *
 * Runs after expo-notifications in the plugins list (order matters — a
 * plugin can only remove what an earlier one added).
 */
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};
