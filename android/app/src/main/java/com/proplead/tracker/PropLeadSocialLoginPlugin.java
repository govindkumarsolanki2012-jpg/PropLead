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
        String provider = call.getString("provider", "google");
        if (!"google".equals(provider)) {
            call.reject("Only the Google provider is supported by PropLeadSocialLogin.");
            return;
        }

        if (webClientId == null || webClientId.isEmpty()) {
            call.reject("Google Sign-In failed: initialize must be called before login.");
            return;
        }

        final Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
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
                    resolveGoogleCredential(call, response);
                }

                @Override
                public void onError(@NonNull GetCredentialException error) {
                    Log.i(LOG_TAG, "credential_error_callback: " + error.getClass().getSimpleName());
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
        if (!(credential instanceof CustomCredential)
            || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
            call.reject("Google Sign-In failed: Credential Manager returned an unsupported credential.");
            return;
        }

        try {
            GoogleIdTokenCredential googleCredential = GoogleIdTokenCredential.createFrom(
                ((CustomCredential) credential).getData()
            );
            Log.i(LOG_TAG, "google_credential_parsed");
            String idToken = googleCredential.getIdToken();

            if (idToken == null || idToken.isEmpty()) {
                call.reject("Google Sign-In failed: Credential Manager returned no ID token.");
                return;
            }

            JSObject result = new JSObject();
            result.put("idToken", idToken);
            JSObject payload = new JSObject();
            payload.put("result", result);
            // Never log the token, credential bundle, or account details.
            Log.i(LOG_TAG, "resolving_login: result.idToken present");
            call.resolve(payload);
            Log.i(LOG_TAG, "login_resolve_dispatched");
        } catch (Exception error) {
            Log.e(LOG_TAG, "Unable to read Google ID token from Credential Manager response.", error);
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
