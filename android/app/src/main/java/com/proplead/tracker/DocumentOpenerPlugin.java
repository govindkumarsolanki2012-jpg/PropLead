package com.proplead.tracker;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.util.Base64;
import android.util.Log;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;

/**
 * Android native DocumentOpener Plugin for Capacitor.
 * Handles opening PDFs, Images, DOC/DOCX, XLS/XLSX, PPT/PPTX via Android ACTION_VIEW intents
 * with proper FileProvider content URIs and explicit MIME types.
 */
@CapacitorPlugin(name = "DocumentOpener")
public class DocumentOpenerPlugin extends Plugin {

    private static final String TAG = "DocumentOpener";

    @PluginMethod
    public void openDocument(PluginCall call) {
        String dataUrl = call.getString("dataUrl");
        String fileName = call.getString("fileName", "document");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (dataUrl == null || dataUrl.trim().isEmpty()) {
            call.reject("INVALID_DATA", "Document data URL or file path is required.");
            return;
        }

        Context context = getContext();
        if (context == null) {
            call.reject("NO_CONTEXT", "Application context is unavailable.");
            return;
        }

        try {
            File cacheDir = new File(context.getCacheDir(), "lead_documents");
            if (!cacheDir.exists()) {
                cacheDir.mkdirs();
            }

            // Sanitize file name
            String safeFileName = fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
            if (!safeFileName.contains(".")) {
                safeFileName += getExtensionFromMime(mimeType);
            }

            File targetFile = new File(cacheDir, safeFileName);

            if (dataUrl.startsWith("data:")) {
                int commaIdx = dataUrl.indexOf(',');
                String base64Data = commaIdx != -1 ? dataUrl.substring(commaIdx + 1) : dataUrl;
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                    fos.write(bytes);
                    fos.flush();
                }
            } else if (dataUrl.startsWith("http://") || dataUrl.startsWith("https://")) {
                URL url = new URL(dataUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(15000);
                conn.connect();
                try (InputStream is = conn.getInputStream(); FileOutputStream fos = new FileOutputStream(targetFile)) {
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = is.read(buffer)) != -1) {
                        fos.write(buffer, 0, read);
                    }
                    fos.flush();
                }
            } else if (dataUrl.startsWith("file://")) {
                targetFile = new File(Uri.parse(dataUrl).getPath());
            } else if (dataUrl.startsWith("content://")) {
                Uri contentUri = Uri.parse(dataUrl);
                launchIntent(context, contentUri, mimeType, call);
                return;
            } else {
                try {
                    byte[] bytes = Base64.decode(dataUrl, Base64.DEFAULT);
                    try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                        fos.write(bytes);
                        fos.flush();
                    }
                } catch (Exception ignored) {
                    targetFile = new File(dataUrl);
                }
            }

            if (!targetFile.exists() || targetFile.length() == 0) {
                call.reject("FILE_NOT_FOUND", "Could not prepare file for opening.");
                return;
            }

            String authority = context.getPackageName() + ".fileprovider";
            Uri contentUri = FileProvider.getUriForFile(context, authority, targetFile);

            launchIntent(context, contentUri, mimeType, call);

        } catch (ActivityNotFoundException e) {
            Log.w(TAG, "No app available for MIME type: " + mimeType);
            call.reject("NO_APP", "No app available to open this file.");
        } catch (SecurityException e) {
            Log.e(TAG, "Security exception while launching ACTION_VIEW intent", e);
            call.reject("SECURITY_ERROR", "Permission denied opening file.");
        } catch (Exception e) {
            Log.e(TAG, "Error opening document: " + e.getMessage(), e);
            call.reject("ERROR", "Unable to open file: " + e.getMessage());
        }
    }

    private void launchIntent(Context context, Uri contentUri, String mimeType, PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(contentUri, mimeType);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        PackageManager pm = context.getPackageManager();
        List<ResolveInfo> resolved = pm.queryIntentActivities(intent, 0);

        if (resolved == null || resolved.isEmpty()) {
            Log.w(TAG, "No activity found to handle MIME type: " + mimeType);
            call.reject("NO_APP", "No app available to open this file.");
            return;
        }

        try {
            context.startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (ActivityNotFoundException e) {
            Log.w(TAG, "ActivityNotFoundException opening intent", e);
            call.reject("NO_APP", "No app available to open this file.");
        }
    }

    private String getExtensionFromMime(String mimeType) {
        if (mimeType == null) return ".bin";
        switch (mimeType.toLowerCase()) {
            case "application/pdf": return ".pdf";
            case "image/jpeg": return ".jpg";
            case "image/png": return ".png";
            case "image/webp": return ".webp";
            case "application/msword": return ".doc";
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": return ".docx";
            case "application/vnd.ms-excel": return ".xls";
            case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": return ".xlsx";
            case "application/vnd.ms-powerpoint": return ".ppt";
            case "application/vnd.openxmlformats-officedocument.presentationml.presentation": return ".pptx";
            default: return ".bin";
        }
    }
}
