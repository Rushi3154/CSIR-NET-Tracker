package com.csirtracker.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Update home screen widget on app startup
        CountdownWidgetProvider.updateAllWidgets(this);

        // Inject JS bridge for real-time widget synchronization
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new WidgetBridge(this), "AndroidWidgetBridge");
        }
    }

    public static class WidgetBridge {
        private final Context context;

        public WidgetBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void syncCountdown(String deadline, String lectureDeadline, float coveragePct, int remainingLectures) {
            if (context == null) return;
            SharedPreferences prefs = context.getSharedPreferences("csir_widget_prefs", Context.MODE_PRIVATE);
            prefs.edit()
                .putString("exam_deadline", deadline)
                .putString("lecture_deadline", lectureDeadline)
                .putFloat("coverage_pct", coveragePct)
                .putInt("remaining_lectures", remainingLectures)
                .apply();

            CountdownWidgetProvider.updateAllWidgets(context);
        }
    }
}
