package com.proplead.tracker;

import android.app.Activity;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.util.concurrent.Executor;

/**
 * Android-only Google Sign-In bridge for PropLead.
 *
 * It deliberately uses the foreground Capacitor Activity for Credential Manager's
 * UI request and performs exactly one sign-in attempt. Firebase owns the session;
 * this bridge returns only the Google ID token needed by the web layer.
 */
@CapacitorPlugin(name = "PropLeadSocialLogin")
public class PropLeadSocialLoginPlugin extends Plugin {
    private static final String LOG_TAG = "PropLeadGoogleAuth";

    private String webClientId;

    // TEMPORARY INTERNAL-TESTING DIAGNOSTICS.
    // Emits only stage metadata; never tokens, account data, email addresses, or UIDs.
    // Remove with the login-screen diagnostic panel after Google Sign-In is fixed.
    private void diagnostic(
        int stage,
        String status,
        String detail,
        String errorCode,
        String errorMessage
    ) {
        JSObject event = new JSObject();
        event.put("stage", stage);
        event.put("status", status);
        if (detail != null) event.put("detail", detail);
        if (errorCode != null) event.put("errorCode", errorCode);
        if (errorMessage != null) event.put("errorMessage", errorMessage);
        notifyListeners("googleAuthDiagnostic", event, true);
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        JSObject google = call.getObject("google");
        String clientId = google == null ? null : google.getString("webClientId");

        if (clientId == null || clientId.trim().isEmpty()) {
            call.reject("Google Sign-In failed: webClientId is required.");
            return;
        }

        webClientId = clientId.trim();
        call.resolve();
    }

    @PluginMethod
    public void login(PluginCall call) {
        diagnostic(2, "success", "Native PropLeadSocialLogin called", null, null);
        String provider = call.getString("provider", "google");
        if (!"google".equals(provider)) {
            diagnostic(7, "failed", "Native Capacitor call rejected", "UNSUPPORTED_PROVIDER",
                "The native bridge rejected the requested provider.");
            call.reject("Only the Google provider is supported by PropLeadSocialLogin.");
            return;
        }

        if (webClientId == null || webClientId.isEmpty()) {
            diagnostic(7, "failed", "Native Capacitor call rejected", "NOT_INITIALIZED",
                "The native Google bridge was not initialized.");
            call.reject("Google Sign-In failed: initialize must be called before login.");
            return;
        }

        final Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            diagnostic(7, "failed", "Native Capacitor call rejected", "NO_FOREGROUND_ACTIVITY",
                "No foreground Android activity was available.");
            call.reject("Google Sign-In failed: no foreground Activity is available.");
            return;
        }

        final GetSignInWithGoogleOption googleOption =
            new GetSignInWithGoogleOption.Builder(webClientId).build();
        final GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(googleOption)
            .build();
        final CredentialManager credentialManager = CredentialManager.create(activity);
        final Executor mainExecutor = ContextCompat.getMainExecutor(activity);

        // Pass the foreground Activity, not the application Context: Credential
        // Manager may need to present account-selection or reauthentication UI.
        Log.i(LOG_TAG, "credential_request_started");
        activity.runOnUiThread(() -> credentialManager.getCredentialAsync(
            activity,
            request,
            null,
            mainExecutor,
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(@NonNull GetCredentialResponse response) {
                    Log.i(LOG_TAG, "credential_success_callback");
                    diagnostic(3, "success", "Credential Manager callback received", null, null);
                    resolveGoogleCredential(call, response);
                }

                @Override
                public void onError(@NonNull GetCredentialException error) {
                    Log.i(LOG_TAG, "credential_error_callback: " + error.getClass().getSimpleName());
                    String safeCode = error.getClass().getSimpleName();
                    diagnostic(3, "failed", "Credential Manager error callback received", safeCode,
                        "Credential Manager did not return a credential.");
                    diagnostic(7, "failed", "Native Capacitor call rejected", safeCode,
                        "The native Google Sign-In request was rejected.");
                    String message = error.getMessage();
                    if (message == null || message.isEmpty()) {
                        message = error.getClass().getSimpleName();
                    }

                    if (error instanceof GetCredentialCancellationException) {
                        call.reject("Google Sign-In cancelled by user.", "USER_CANCELLED", error);
                        return;
                    }

                    Log.e(LOG_TAG, "Credential Manager Google sign-in failed: " + message, error);
                    call.reject("Google Sign-In failed: " + message, error);
                }
            }
        ));
    }

    private void resolveGoogleCredential(PluginCall call, GetCredentialResponse response) {
        Credential credential = response.getCredential();
        Log.i(LOG_TAG, "credential_received: " + credential.getClass().getSimpleName()
            + ", type=" + credential.getType());
        diagnostic(4, "success", "Credential type: " + credential.getType(), null, null);
        if (!(credential instanceof CustomCredential)
            || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
            diagnostic(5, "failed", "Google credential parsing not started", "UNSUPPORTED_CREDENTIAL",
                "Credential Manager returned an unsupported credential type.");
            diagnostic(7, "failed", "Native Capacitor call rejected", "UNSUPPORTED_CREDENTIAL",
                "The native bridge rejected the credential type.");
            call.reject("Google Sign-In failed: Credential Manager returned an unsupported credential.");
            return;
        }

        try {
            GoogleIdTokenCredential googleCredential = GoogleIdTokenCredential.createFrom(
                ((CustomCredential) credential).getData()
            );
            Log.i(LOG_TAG, "google_credential_parsed");
            diagnostic(5, "success", "Google credential parsed successfully", null, null);
            String idToken = googleCredential.getIdToken();

            if (idToken == null || idToken.isEmpty()) {
                diagnostic(6, "failed", "ID token received: NO", "MISSING_ID_TOKEN",
                    "Google credential contained no ID token.");
                diagnostic(7, "failed", "Native Capacitor call rejected", "MISSING_ID_TOKEN",
                    "The native bridge returned no ID token.");
                call.reject("Google Sign-In failed: Credential Manager returned no ID token.");
                return;
            }
            diagnostic(6, "success", "ID token received: YES", null, null);

            JSObject result = new JSObject();
            result.put("idToken", idToken);
            JSObject payload = new JSObject();
            payload.put("result", result);
            // Never log the token, credential bundle, or account details.
            Log.i(LOG_TAG, "resolving_login: result.idToken present");
            diagnostic(7, "success", "Native Capacitor call resolved", null, null);
            call.resolve(payload);
            Log.i(LOG_TAG, "login_resolve_dispatched");
        } catch (Exception error) {
            Log.e(LOG_TAG, "Unable to read Google ID token from Credential Manager response.", error);
            diagnostic(5, "failed", "Google credential parsing failed", error.getClass().getSimpleName(),
                "The Google credential could not be parsed.");
            diagnostic(6, "failed", "ID token received: NO", "TOKEN_PARSE_FAILED",
                "No ID token was extracted.");
            diagnostic(7, "failed", "Native Capacitor call rejected", "TOKEN_PARSE_FAILED",
                "The native bridge could not parse the Google credential.");
            call.reject("Google Sign-In failed: unable to read Google ID token.", error);
        }
    }

    @PluginMethod
    public void logout(PluginCall call) {
        // Firebase owns the application session. Do not clear Credential Manager
        // state here or before a later sign-in attempt.
        call.resolve();
    }
}
