package com.proplead.tracker;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebView;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.util.Arrays;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(DocumentOpenerPlugin.class);
        registerPlugin(CsvDownloadPlugin.class);
        registerPlugin(PropLeadSocialLoginPlugin.class);
        registerPlugin(AppSettingsPlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge != null) {
            bridge.registerPlugin(PropLeadSocialLoginPlugin.class);
            bridge.registerPlugin(AppSettingsPlugin.class);

            WebView webView = bridge.getWebView();
            if (webView != null) {
                webView.setWebChromeClient(new BridgeWebChromeClient(bridge) {
                    @Override
                    public void onPermissionRequest(final PermissionRequest request) {
                        if (request == null) return;
                        runOnUiThread(() -> {
                            boolean hasAudio = Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
                            if (hasAudio) {
                                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                                    request.grant(request.getResources());
                                    return;
                                }
                            }
                            super.onPermissionRequest(request);
                        });
                    }
                });
            }
        }
    }
}

