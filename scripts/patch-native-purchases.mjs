import fs from 'node:fs';

const pluginPath =
  'node_modules/@capgo/native-purchases/android/src/main/java/ee/forgr/nativepurchases/NativePurchasesPlugin.java';

if (!fs.existsSync(pluginPath)) {
  throw new Error(`NativePurchases Android source not found at ${pluginPath}`);
}

let source = fs.readFileSync(pluginPath, 'utf8');

function replaceExact(before, after, label) {
  if (source.includes(after)) {
    console.log(`${label} is already applied.`);
    return;
  }
  if (!source.includes(before)) {
    throw new Error(
      `NativePurchases 8.7.0 source did not match the expected ${label} block; refusing to apply an unsafe patch.`
    );
  }
  source = source.replace(before, after);
  console.log(`Applied ${label}.`);
}

replaceExact(
`                                for (ProductDetails.SubscriptionOfferDetails offerDetails : productDetailsItem.getSubscriptionOfferDetails()) {
                                    Log.d(TAG, "Checking offer: " + offerDetails.getBasePlanId());
                                    if (offerDetails.getBasePlanId().equals(planIdentifier)) {
                                        selectedOfferDetails = offerDetails;
                                        Log.d(TAG, "Found matching plan: " + planIdentifier);
                                        break;
                                    }
                                }
                                if (selectedOfferDetails == null) {
                                    selectedOfferDetails = productDetailsItem.getSubscriptionOfferDetails().get(0);
                                    Log.d(TAG, "Using first available offer: " + selectedOfferDetails.getBasePlanId());
                                }`,
`                                for (ProductDetails.SubscriptionOfferDetails offerDetails : productDetailsItem.getSubscriptionOfferDetails()) {
                                    Log.d(TAG, "Checking offer: " + offerDetails.getBasePlanId());
                                    if (offerToken != null && !offerToken.isEmpty()) {
                                        if (offerToken.equals(offerDetails.getOfferToken())) {
                                            selectedOfferDetails = offerDetails;
                                            Log.d(TAG, "Found exact subscription offer token");
                                            break;
                                        }
                                    } else if (offerDetails.getBasePlanId().equals(planIdentifier)) {
                                        selectedOfferDetails = offerDetails;
                                        Log.d(TAG, "Found matching plan: " + planIdentifier);
                                        break;
                                    }
                                }
                                if (selectedOfferDetails == null && offerToken != null && !offerToken.isEmpty()) {
                                    Log.d(TAG, "Offer token not found for subscription product: " + productIdentifier);
                                    closeBillingClient();
                                    call.reject("Offer token not found for subscription product: " + productIdentifier);
                                    return;
                                }
                                if (selectedOfferDetails == null) {
                                    selectedOfferDetails = productDetailsItem.getSubscriptionOfferDetails().get(0);
                                    Log.d(TAG, "Using first available offer: " + selectedOfferDetails.getBasePlanId());
                                }`,
  'subscription offer-token patch'
);

replaceExact(
`                        BillingResult billingResult2 = billingClient.launchBillingFlow(getActivity(), billingFlowParams);
                        Log.d(
                            TAG,
                            "Billing flow launch result: " + billingResult2.getResponseCode() + " - " + billingResult2.getDebugMessage()
                        );
                        Log.i(NativePurchasesPlugin.TAG, "onProductDetailsResponse2" + billingResult2);`,
`                        BillingResult billingResult2 = billingClient.launchBillingFlow(getActivity(), billingFlowParams);
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
                        }`,
  'billing launch-result patch'
);

fs.writeFileSync(pluginPath, source, 'utf8');
