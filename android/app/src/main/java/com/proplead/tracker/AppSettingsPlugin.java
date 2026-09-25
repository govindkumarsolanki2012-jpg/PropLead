package com.proplead.tracker;

import android.Manifest;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Android native plugin to open the system App Settings screen for PropLead,
 * check/request live runtime permissions (Contacts, Microphone),
 * and query device contacts natively using READ_CONTACTS.
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
    private static final String PREFS_NAME = "proplead_permission_prefs";

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

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean wasRequestedBefore = prefs.getBoolean("requested_" + androidPerm, false);

        boolean isPermanentlyDenied = false;
        String state = "granted";

        if (granted) {
            state = "granted";
            isPermanentlyDenied = false;
        } else if (shouldShowRationale) {
            state = "prompt";
            isPermanentlyDenied = false;
        } else if (wasRequestedBefore) {
            state = "denied";
            isPermanentlyDenied = true;
        } else {
            state = "prompt";
            isPermanentlyDenied = false;
        }

        Log.d(TAG, "checkPermission for " + androidPerm + " -> granted=" + granted + ", state=" + state + ", isPermanentlyDenied=" + isPermanentlyDenied);

        JSObject result = new JSObject();
        result.put("granted", granted);
        result.put("state", state);
        result.put("isPermanentlyDenied", isPermanentlyDenied);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        String name = call.getString("name", "contacts");
        String alias = "contacts";
        if ("microphone".equalsIgnoreCase(name) || "record_audio".equalsIgnoreCase(name) || "mic".equalsIgnoreCase(name)) {
            alias = "microphone";
        }

        String androidPerm = "microphone".equals(alias) ? Manifest.permission.RECORD_AUDIO : Manifest.permission.READ_CONTACTS;
        Context context = getContext();

        if (context != null) {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putBoolean("requested_" + androidPerm, true).apply();

            if (ContextCompat.checkSelfPermission(context, androidPerm) == PackageManager.PERMISSION_GRANTED) {
                JSObject result = new JSObject();
                result.put("granted", true);
                result.put("state", "granted");
                result.put("isPermanentlyDenied", false);
                call.resolve(result);
                return;
            }
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

        boolean isPermanentlyDenied = false;
        String state = "granted";

        if (granted) {
            state = "granted";
            isPermanentlyDenied = false;
        } else if (shouldShowRationale) {
            state = "prompt";
            isPermanentlyDenied = false;
        } else {
            state = "denied";
            isPermanentlyDenied = true;
        }

        Log.d(TAG, "permissionCallback for " + androidPerm + " -> granted=" + granted + ", state=" + state + ", isPermanentlyDenied=" + isPermanentlyDenied);

        JSObject result = new JSObject();
        result.put("granted", granted);
        result.put("state", state);
        result.put("isPermanentlyDenied", isPermanentlyDenied);
        call.resolve(result);
    }

    @PluginMethod
    public void getContacts(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("NO_CONTEXT", "Application context unavailable");
            return;
        }

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            call.reject("PERMISSION_DENIED", "READ_CONTACTS permission is not granted");
            return;
        }

        JSArray contactsList = new JSArray();
        ContentResolver cr = context.getContentResolver();
        Uri uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI;
        String[] projection = new String[] {
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
        };

        try (Cursor cursor = cr.query(uri, projection, null, null, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC")) {
            if (cursor != null) {
                int idIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID);
                int nameIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
                int numIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);

                while (cursor.moveToNext()) {
                    String id = idIdx >= 0 ? cursor.getString(idIdx) : "";
                    String displayName = nameIdx >= 0 ? cursor.getString(nameIdx) : "";
                    String number = numIdx >= 0 ? cursor.getString(numIdx) : "";

                    if (number != null && !number.trim().isEmpty()) {
                        JSObject c = new JSObject();
                        c.put("contactId", id != null ? id : "");
                        c.put("displayName", displayName != null ? displayName : "Client");
                        c.put("phoneNumber", number);
                        contactsList.put(c);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error querying contacts: " + e.getMessage(), e);
            call.reject("QUERY_FAILED", "Failed to query contacts: " + e.getMessage());
            return;
        }

        JSObject res = new JSObject();
        res.put("contacts", contactsList);
        call.resolve(res);
    }
}
