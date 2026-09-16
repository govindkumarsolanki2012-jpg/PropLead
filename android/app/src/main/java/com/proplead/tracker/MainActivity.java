package com.proplead.tracker;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(DocumentOpenerPlugin.class);
        registerPlugin(CsvDownloadPlugin.class);
        registerPlugin(PropLeadSocialLoginPlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge != null) {
            bridge.registerPlugin(PropLeadSocialLoginPlugin.class);
        }
    }
}

