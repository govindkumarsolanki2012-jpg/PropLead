package com.proplead.tracker;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Android native plugin to open the system App Settings screen for PropLead,
 * and check/request live runtime permissions (Contacts, Microphone, etc.)
 */
@CapacitorPlugin(
    name = "AppSettings",
    permissions = {
        @Permission(
            strings = { Manifest.permission.READ_CONTACTS },
            alias = "contacts"
        ),
        @Permission(
            strings = { Manifest.permission.RECORD_AUDIO },
            alias = "microphone"
        )
    }
)
public class AppSettingsPlugin extends Plugin {

    private static final String TAG = "AppSettings";

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("NO_CONTEXT", "Application context is unavailable.");
            return;
        }

        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", context.getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);

            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error opening app settings: " + e.getMessage(), e);
            call.reject("OPEN_FAILED", "Failed to open application settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        String name = call.getString("name", "contacts");
        String androidPerm = Manifest.permission.READ_CONTACTS;
        if ("microphone".equalsIgnoreCase(name) || "record_audio".equalsIgnoreCase(name) || "mic".equalsIgnoreCase(name)) {
            androidPerm = Manifest.permission.RECORD_AUDIO;
        }

        Context context = getContext();
        if (context == null) {
            call.reject("NO_CONTEXT", "Application context is unavailable.");
            return;
        }

        int check = ContextCompat.checkSelfPermission(context, androidPerm);
        boolean granted = (check == PackageManager.PERMISSION_GRANTED);
        boolean shouldShowRationale = false;
        if (getActivity() != null && !granted) {
            shouldShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(getActivity(), androidPerm);
        }

        JSObject result = new JSObject();
        result.put("granted", granted);
        result.put("state", granted ? "granted" : (shouldShowRationale ? "prompt" : "denied"));
        result.put("isPermanentlyDenied", !granted && !shouldShowRationale);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        String name = call.getString("name", "contacts");
        String alias = "contacts";
        if ("microphone".equalsIgnoreCase(name) || "record_audio".equalsIgnoreCase(name) || "mic".equalsIgnoreCase(name)) {
            alias = "microphone";
        }

        // First check if already granted
        String androidPerm = "microphone".equals(alias) ? Manifest.permission.RECORD_AUDIO : Manifest.permission.READ_CONTACTS;
        Context context = getContext();
        if (context != null && ContextCompat.checkSelfPermission(context, androidPerm) == PackageManager.PERMISSION_GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            result.put("state", "granted");
            result.put("isPermanentlyDenied", false);
            call.resolve(result);
            return;
        }

        requestPermissionForAlias(alias, call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        String name = call.getString("name", "contacts");
        String androidPerm = Manifest.permission.READ_CONTACTS;
        if ("microphone".equalsIgnoreCase(name) || "record_audio".equalsIgnoreCase(name) || "mic".equalsIgnoreCase(name)) {
            androidPerm = Manifest.permission.RECORD_AUDIO;
        }

        Context context = getContext();
        int check = context != null ? ContextCompat.checkSelfPermission(context, androidPerm) : PackageManager.PERMISSION_DENIED;
        boolean granted = (check == PackageManager.PERMISSION_GRANTED);
        boolean shouldShowRationale = false;
        if (getActivity() != null && !granted) {
            shouldShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(getActivity(), androidPerm);
        }

        JSObject result = new JSObject();
        result.put("granted", granted);
        result.put("state", granted ? "granted" : (shouldShowRationale ? "prompt" : "denied"));
        result.put("isPermanentlyDenied", !granted && !shouldShowRationale);
        call.resolve(result);
    }
}
