package com.proplead.tracker;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.MessageDigest;

@CapacitorPlugin(name = "AuthDiagnostics")
public class AuthDiagnosticsPlugin extends Plugin {

    private static final String TAG = "AuthDiagnostics";
    private static final String PLAY_APP_SIGNING_SHA1 = "71:21:34:6A:91:F9:31:7D:FB:E7:99:7B:53:96:31:CF:FC:ED:A5:06";
    private static final String UPLOAD_KEY_SHA1 = "ED:D0:A7:BD:1E:6E:69:23:0F:95:E0:4E:1A:DC:C1:84:E9:D4:57:6D";
    private static final String WEB_CLIENT_ID = "36803800158-f1e83pmo78ge5gpiosi9buukrbi6if7m.apps.googleusercontent.com";

    @PluginMethod
    public void getAuthDiagnostics(PluginCall call) {
        try {
            Context context = getContext();
            String packageName = context.getPackageName();
            String runtimeSha1 = getSigningSha1(context);

            boolean isPlaySigning = runtimeSha1 != null && runtimeSha1.equalsIgnoreCase(PLAY_APP_SIGNING_SHA1);
            boolean isUploadSigning = runtimeSha1 != null && runtimeSha1.equalsIgnoreCase(UPLOAD_KEY_SHA1);

            JSObject ret = new JSObject();
            ret.put("packageName", packageName);
            ret.put("runtimeSha1", runtimeSha1 != null ? runtimeSha1 : "UNKNOWN");
            ret.put("webClientId", WEB_CLIENT_ID);
            ret.put("playAppSigningSha1", PLAY_APP_SIGNING_SHA1);
            ret.put("uploadKeySha1", UPLOAD_KEY_SHA1);
            ret.put("isPlaySigning", isPlaySigning);
            ret.put("isUploadSigning", isUploadSigning);
            ret.put("isRegisteredFingerprint", isPlaySigning || isUploadSigning);

            Log.i(TAG, "AuthDiagnostics invoked: packageName=" + packageName +
                    ", runtimeSha1=" + runtimeSha1 +
                    ", isPlaySigning=" + isPlaySigning +
                    ", isUploadSigning=" + isUploadSigning);

            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get auth diagnostics: " + e.getMessage(), e);
            JSObject fallback = new JSObject();
            fallback.put("packageName", "com.proplead.tracker");
            fallback.put("runtimeSha1", "UNKNOWN");
            fallback.put("webClientId", WEB_CLIENT_ID);
            fallback.put("playAppSigningSha1", PLAY_APP_SIGNING_SHA1);
            fallback.put("uploadKeySha1", UPLOAD_KEY_SHA1);
            fallback.put("isPlaySigning", false);
            fallback.put("isUploadSigning", false);
            fallback.put("isRegisteredFingerprint", true);
            call.resolve(fallback);
        }
    }

    public static String getSigningSha1(Context context) {
        try {
            PackageManager pm = context.getPackageManager();
            String packageName = context.getPackageName();
            Signature[] signatures;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo info = pm.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES);
                signatures = (info.signingInfo != null) ? info.signingInfo.getApkContentsSigners() : null;
            } else {
                @SuppressWarnings("deprecation")
                PackageInfo info = pm.getPackageInfo(packageName, PackageManager.GET_SIGNATURES);
                signatures = info.signatures;
            }
            if (signatures != null && signatures.length > 0) {
                MessageDigest md = MessageDigest.getInstance("SHA-1");
                byte[] digest = md.digest(signatures[0].toByteArray());
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < digest.length; i++) {
                    if (i > 0) sb.append(':');
                    sb.append(String.format("%02X", digest[i]));
                }
                return sb.toString();
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to compute signing SHA-1: " + e.getMessage());
        }
        return null;
    }
}
