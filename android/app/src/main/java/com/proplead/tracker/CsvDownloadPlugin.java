package com.proplead.tracker;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Native Android CsvDownload Plugin for PropLead.
 * Implements Android Storage Access Framework (SAF) ACTION_CREATE_DOCUMENT
 * for normal Android "Save As" file downloads, writes to the exact user-chosen folder,
 * and displays a standard Android download notification with PendingIntent to open the CSV.
 */
@CapacitorPlugin(
    name = "CsvDownload",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { "android.permission.POST_NOTIFICATIONS" }
        )
    }
)
public class CsvDownloadPlugin extends Plugin {

    private static final String TAG = "CsvDownload";
    private static final String CHANNEL_ID = "proplead_downloads";
    private static final String CHANNEL_NAME = "PropLead Downloads";

    @PluginMethod
    public void saveCsvFile(PluginCall call) {
        String fileName = call.getString("fileName");
        String content = call.getString("content");
        String mimeType = call.getString("mimeType", "text/csv");

        if (fileName == null || fileName.trim().isEmpty()) {
            call.reject("INVALID_FILENAME", "File name is required.");
            return;
        }

        if (content == null) {
            call.reject("INVALID_CONTENT", "CSV content is required.");
            return;
        }

        Log.i(TAG, "Opening Android Storage Access Framework (Save As) dialog for: " + fileName);

        // Launch the Android system file picker / "Save As" screen
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType != null && !mimeType.isEmpty() ? mimeType : "text/csv");
        intent.putExtra(Intent.EXTRA_TITLE, fileName);

        startActivityForResult(call, intent, "saveCsvResult");
    }

    @ActivityCallback
    private void saveCsvResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        // Requirement 11: If the user cancels the Save As screen, do nothing and do not show a success message
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            Log.i(TAG, "User canceled Save As screen.");
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("canceled", true);
            call.resolve(ret);
            return;
        }

        Intent data = result.getData();
        Uri uri = data.getData();

        if (uri == null) {
            Log.i(TAG, "Save As screen returned null URI (canceled by user).");
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("canceled", true);
            call.resolve(ret);
            return;
        }

        Context context = getContext();
        if (context == null) {
            call.reject("NO_CONTEXT", "Application context is unavailable.");
            return;
        }

        try {
            // Take persistable URI permission if offered by the DocumentProvider
            try {
                final int takeFlags = data.getFlags()
                        & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                if (takeFlags != 0) {
                    context.getContentResolver().takePersistableUriPermission(uri, takeFlags);
                }
            } catch (Exception permEx) {
                Log.w(TAG, "Notice taking persistable URI permission: " + permEx.getMessage());
            }

            String content = call.getString("content", "");
            String fileName = call.getString("fileName", "PropLead_Leads.csv");

            // Prepare UTF-8 bytes with BOM (0xEF, 0xBB, 0xBF)
            byte[] textBytes = content.getBytes(StandardCharsets.UTF_8);
            byte[] bytesToWrite;
            if (textBytes.length >= 3 &&
                textBytes[0] == (byte) 0xEF &&
                textBytes[1] == (byte) 0xBB &&
                textBytes[2] == (byte) 0xBF) {
                bytesToWrite = textBytes;
            } else {
                byte[] bom = new byte[] { (byte) 0xEF, (byte) 0xBB, (byte) 0xBF };
                bytesToWrite = new byte[bom.length + textBytes.length];
                System.arraycopy(bom, 0, bytesToWrite, 0, bom.length);
                System.arraycopy(textBytes, 0, bytesToWrite, bom.length, textBytes.length);
            }

            // Write CSV to the exact user-chosen location
            try (OutputStream os = context.getContentResolver().openOutputStream(uri)) {
                if (os == null) {
                    call.reject("WRITE_FAILED", "Failed to open output stream for selected file location.");
                    return;
                }
                os.write(bytesToWrite);
                os.flush();
            }

            Log.i(TAG, "Successfully saved CSV to: " + uri.toString());

            // Display normal Android download notification with PendingIntent to open file
            showDownloadNotification(context, uri, fileName);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("canceled", false);
            ret.put("uri", uri.toString());
            ret.put("fileName", fileName);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Error writing CSV to chosen location: " + e.getMessage(), e);
            call.reject("WRITE_ERROR", "Error writing file: " + e.getMessage());
        }
    }

    /**
     * Posts a normal Android download notification.
     * Title: "PropLead CSV downloaded"
     * Text: CSV filename
     * Tapping notification opens the saved CSV using Android's normal file-opening system (ACTION_VIEW).
     */
    private void showDownloadNotification(Context context, Uri uri, String fileName) {
        try {
            NotificationManager notificationManager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) {
                Log.w(TAG, "NotificationManager is not available.");
                return;
            }

            // Create notification channel for Android 8.0 (API 26)+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("PropLead CSV download completion notifications");
                channel.enableLights(true);
                channel.setShowBadge(true);
                notificationManager.createNotificationChannel(channel);
            }

            // Create Intent to open the CSV file with Android's normal file-opening system
            Intent openIntent = new Intent(Intent.ACTION_VIEW);
            openIntent.setDataAndType(uri, "text/csv");
            openIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            openIntent.setClipData(ClipData.newRawUri(fileName, uri));

            // Grant read URI permission to resolved target apps (Excel, Sheets, CSV viewers)
            PackageManager pm = context.getPackageManager();
            List<ResolveInfo> resolved = pm.queryIntentActivities(openIntent, PackageManager.MATCH_DEFAULT_ONLY);
            if (resolved == null || resolved.isEmpty()) {
                resolved = pm.queryIntentActivities(openIntent, 0);
            }
            if (resolved == null || resolved.isEmpty()) {
                // Fallback to text/* if no app specifically registered for text/csv
                openIntent.setDataAndType(uri, "text/*");
                resolved = pm.queryIntentActivities(openIntent, 0);
            }
            if (resolved != null) {
                for (ResolveInfo ri : resolved) {
                    if (ri.activityInfo != null && ri.activityInfo.packageName != null) {
                        try {
                            context.grantUriPermission(
                                ri.activityInfo.packageName,
                                uri,
                                Intent.FLAG_GRANT_READ_URI_PERMISSION
                            );
                        } catch (Exception ignored) {
                        }
                    }
                }
            }

            int requestCode = (int) (System.currentTimeMillis() & 0x0FFFFFFF);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                requestCode,
                openIntent,
                flags
            );

            // Small download completion icon
            int smallIcon = android.R.drawable.stat_sys_download_done;
            try {
                if (context.getResources().getResourceName(smallIcon) == null) {
                    smallIcon = context.getApplicationInfo().icon;
                }
            } catch (Exception e) {
                smallIcon = context.getApplicationInfo().icon;
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(smallIcon)
                .setContentTitle("PropLead CSV downloaded")
                .setContentText(fileName)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(fileName))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

            int notificationId = (int) (System.currentTimeMillis() & 0x7FFFFFFF);
            notificationManager.notify(notificationId, builder.build());
            Log.i(TAG, "Posted download notification for: " + fileName + " (notificationId: " + notificationId + ")");

        } catch (Exception e) {
            Log.e(TAG, "Error showing download notification: " + e.getMessage(), e);
        }
    }
}
