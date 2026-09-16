import fs from 'node:fs';

const pluginPath =
  'node_modules/@capgo/native-purchases/android/src/main/java/ee/forgr/nativepurchases/NativePurchasesPlugin.java';

if (!fs.existsSync(pluginPath)) {
  throw new Error(`NativePurchases Android source not found at ${pluginPath}`);
}

const source = fs.readFileSync(pluginPath, 'utf8');
const before = `                        BillingResult billingResult2 = billingClient.launchBillingFlow(getActivity(), billingFlowParams);
                        Log.d(
                            TAG,
                            "Billing flow launch result: " + billingResult2.getResponseCode() + " - " + billingResult2.getDebugMessage()
                        );
                        Log.i(NativePurchasesPlugin.TAG, "onProductDetailsResponse2" + billingResult2);`;

const after = `                        BillingResult billingResult2 = billingClient.launchBillingFlow(getActivity(), billingFlowParams);
                        Log.d(
                            TAG,
                            "Billing flow launch result: " + billingResult2.getResponseCode() + " - " + billingResult2.getDebugMessage()
                        );
                        Log.i(NativePurchasesPlugin.TAG, "onProductDetailsResponse2" + billingResult2);
                        if (billingResult2.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                            String message = "Google Play Billing could not start: " + billingResult2.getDebugMessage();
                            Log.e(TAG, message);
                            closeBillingClient();
                            call.reject(message, "BILLING_FLOW_LAUNCH_FAILED");
                        }`;

if (source.includes(after)) {
  console.log('NativePurchases billing launch-result patch is already applied.');
} else if (source.includes(before)) {
  fs.writeFileSync(pluginPath, source.replace(before, after), 'utf8');
  console.log('Applied NativePurchases billing launch-result patch.');
} else {
  throw new Error(
    'NativePurchases 8.7.0 source did not match the expected purchase launch block; refusing to apply an unsafe patch.'
  );
}
