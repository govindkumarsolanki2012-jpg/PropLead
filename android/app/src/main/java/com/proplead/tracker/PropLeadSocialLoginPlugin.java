package com.proplead.tracker;

import android.app.Activity;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.util.concurrent.Executor;

/**
 * Android-only Google Sign-In bridge for PropLead.
 *
 * It deliberately uses the foreground Capacitor Activity for Credential Manager's
 * UI request and performs at most one account-reauth recovery attempt. Firebase owns the session;
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

        final GetGoogleIdOption googleOption = new GetGoogleIdOption.Builder()
            .setServerClientId(webClientId)
            .setFilterByAuthorizedAccounts(false)
            .setAutoSelectEnabled(false)
            .build();
        final GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(googleOption)
            .build();
        final CredentialManager credentialManager = CredentialManager.create(activity);
        final Executor mainExecutor = ContextCompat.getMainExecutor(activity);

        requestGoogleCredential(call, activity, credentialManager, request, mainExecutor, false, null);
    }

    private void requestGoogleCredential(
        PluginCall call,
        Activity activity,
        CredentialManager credentialManager,
        GetCredentialRequest request,
        Executor mainExecutor,
        boolean isReauthRetry,
        String initialAttemptFailure
    ) {
        String requestStage = isReauthRetry
            ? "RETRY_CREDENTIAL_REQUEST_STARTED"
            : "INITIAL_CREDENTIAL_REQUEST_STARTED";
        String attempt = isReauthRetry ? "ATTEMPT_2" : "ATTEMPT_1";
        Log.i(LOG_TAG, requestStage);
        diagnostic(3, "pending", requestStage, null, null);
        diagnostic(
            3,
            "info",
            attempt + " option=GetGoogleIdOption; activityValid=" + isActivityValid(activity),
            null,
            null
        );

        // Pass the foreground Activity, not the application Context: Credential
        // Manager may need to present account-selection or reauthentication UI.
        activity.runOnUiThread(() -> credentialManager.getCredentialAsync(
            activity,
            request,
            null,
            mainExecutor,
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(@NonNull GetCredentialResponse response) {
                    Log.i(LOG_TAG, "credential_success_callback");
                    if (isReauthRetry) {
                        diagnostic(3, "success", "RETRY_CREDENTIAL_SUCCESS", null, null);
                    }
                    diagnostic(3, "success", "Credential Manager callback received", null, null);
                    resolveGoogleCredential(call, response);
                }

                @Override
                public void onError(@NonNull GetCredentialException error) {
                    Log.i(LOG_TAG, "credential_error_callback: " + error.getClass().getSimpleName());
                    String attemptFailure = (isReauthRetry ? "A2" : "A1") + " cls="
                        + error.getClass().getSimpleName()
                        + ",[16]=" + containsStatus16(error)
                        + ",act=" + (isActivityValid(activity) ? "valid" : "invalid");
                    String diagnosticDetail = initialAttemptFailure == null
                        ? "opt=GetGoogleIdOption; " + attemptFailure
                        : initialAttemptFailure + "; " + attemptFailure;
                    diagnostic(
                        3,
                        "info",
                        diagnosticDetail,
                        null,
                        null
                    );
                    if (isAccountReauthFailed(error)) {
                        handleAccountReauthFailure(
                            call,
                            activity,
                            credentialManager,
                            request,
                            mainExecutor,
                            isReauthRetry,
                            diagnosticDetail,
                            error
                        );
                        return;
                    }

                    if (error instanceof GetCredentialCancellationException) {
                        diagnostic(3, "failed", "USER_CANCELLED", "USER_CANCELLED",
                            "Google Sign-In was cancelled.");
                        diagnostic(7, "failed", "Native Capacitor call rejected", "USER_CANCELLED",
                            "The native Google Sign-In request was cancelled.");
                        call.reject("Google Sign-In cancelled by user.", "USER_CANCELLED", error);
                        return;
                    }

                    String safeCode = error.getClass().getSimpleName();
                    diagnostic(3, "failed", "Credential Manager error callback received", safeCode,
                        "Credential Manager did not return a credential.");
                    diagnostic(7, "failed", "Native Capacitor call rejected", safeCode,
                        "The native Google Sign-In request was rejected.");
                    Log.e(LOG_TAG, "Credential Manager Google sign-in failed.", error);
                    call.reject("Google Sign-In failed.", safeCode, error);
                }
            }
        ));
    }

    private boolean isAccountReauthFailed(GetCredentialException error) {
        String message = error.getMessage();
        return message != null && message.toLowerCase(java.util.Locale.ROOT)
            .contains("account reauth failed");
    }

    private boolean containsStatus16(GetCredentialException error) {
        String message = error.getMessage();
        return message != null && message.contains("[16]");
    }

    private boolean isActivityValid(Activity activity) {
        return activity != null && !activity.isFinishing() && !activity.isDestroyed();
    }

    private void handleAccountReauthFailure(
        PluginCall call,
        Activity activity,
        CredentialManager credentialManager,
        GetCredentialRequest request,
        Executor mainExecutor,
        boolean isReauthRetry,
        String attemptDiagnostics,
        GetCredentialException error
    ) {
        if (isReauthRetry) {
            diagnostic(3, "failed", attemptDiagnostics,
                "ACCOUNT_REAUTH_FAILED",
                "RETRY_ACCOUNT_REAUTH_FAILED: Google account re-authentication failed after one retry.");
            diagnostic(7, "failed", "Native Capacitor call rejected", "ACCOUNT_REAUTH_FAILED",
                "Google account re-authentication failed after one retry.");
            call.reject(
                "Google Sign-In failed after the account re-authentication retry.",
                "ACCOUNT_REAUTH_FAILED",
                error
            );
            return;
        }

        diagnostic(3, "failed", attemptDiagnostics,
            "ACCOUNT_REAUTH_FAILED",
            "INITIAL_ACCOUNT_REAUTH_FAILED: Google account re-authentication failed on the initial request.");
        diagnostic(3, "pending", "CREDENTIAL_STATE_CLEAR_STARTED", null, null);
        Log.i(LOG_TAG, "CREDENTIAL_STATE_CLEAR_STARTED");

        credentialManager.clearCredentialStateAsync(
            new ClearCredentialStateRequest(),
            null,
            mainExecutor,
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void unused) {
                    Log.i(LOG_TAG, "CREDENTIAL_STATE_CLEAR_SUCCESS");
                    diagnostic(3, "success", "CREDENTIAL_STATE_CLEAR_SUCCESS", null, null);
                    requestGoogleCredential(
                        call,
                        activity,
                        credentialManager,
                        request,
                        mainExecutor,
                        true,
                        attemptDiagnostics
                    );
                }

                @Override
                public void onError(@NonNull ClearCredentialException clearError) {
                    Log.e(LOG_TAG, "Credential Manager state clear failed.", clearError);
                    diagnostic(3, "failed", "CREDENTIAL_STATE_CLEAR_FAILED",
                        "CREDENTIAL_STATE_CLEAR_FAILED", "Credential Manager state could not be cleared.");
                    diagnostic(7, "failed", "Native Capacitor call rejected",
                        "CREDENTIAL_STATE_CLEAR_FAILED", "Credential Manager recovery could not start.");
                    call.reject(
                        "Google Sign-In recovery failed while clearing credential state.",
                        "CREDENTIAL_STATE_CLEAR_FAILED",
                        clearError
                    );
                }
            }
        );
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
            diagnostic(6, "success", "ID_TOKEN_RECEIVED", null, null);

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
