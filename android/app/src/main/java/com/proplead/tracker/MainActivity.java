package com.proplead.tracker;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;
import java.security.MessageDigest;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    private static final String TAG = "PropLeadAuth";
    private static final String EXPECTED_PACKAGE = "com.proplead.tracker";
    private static final String EXPECTED_SHA1 = "71:21:34:6A:91:F9:31:7D:FB:E7:99:7B:53:96:31:CF:FC:ED:A5:06";
    private static final String WEB_CLIENT_ID = "36803800158-f1e83pmo78ge5gpiosi9buukrbi6if7m.apps.googleusercontent.com";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        logAuthDiagnostics();
    }

    private void logAuthDiagnostics() {
        String runtimeSha1 = getSigningSha1(this);
        Log.i(TAG, "================ [GoogleAuth Diagnostics] ================");
        Log.i(TAG, "Package Name: " + getPackageName() + " (Expected: " + EXPECTED_PACKAGE + ")");
        Log.i(TAG, "Runtime Signing SHA-1: " + (runtimeSha1 != null ? runtimeSha1 : "UNKNOWN"));
        Log.i(TAG, "Expected Play Signing SHA-1: " + EXPECTED_SHA1);
        Log.i(TAG, "Web Client ID: " + WEB_CLIENT_ID);
        Log.i(TAG, "SHA-1 Matches Expected: " + EXPECTED_SHA1.equalsIgnoreCase(runtimeSha1));
        Log.i(TAG, "==========================================================");
    }

    private static String getSigningSha1(Context context) {
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

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN &&
            requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            PluginHandle handle = getBridge() != null ? getBridge().getPlugin("SocialLogin") : null;
            if (handle != null) {
                Plugin plugin = handle.getInstance();
                if (plugin instanceof SocialLoginPlugin) {
                    ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
                }
            }
        }
    }
}
