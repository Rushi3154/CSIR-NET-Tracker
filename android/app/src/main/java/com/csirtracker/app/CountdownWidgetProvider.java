package com.csirtracker.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Android Home Screen Widget showing days countdown until the CSIR-NET Exam.
 */
public class CountdownWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_WIDGET = "com.csirtracker.app.ACTION_UPDATE_WIDGET";
    private static final String PREFS_NAME = "csir_widget_prefs";
    private static final String DEFAULT_DEADLINE = "2026-12-19";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_UPDATE_WIDGET.equals(intent.getAction())
                || Intent.ACTION_TIME_CHANGED.equals(intent.getAction())
                || Intent.ACTION_DATE_CHANGED.equals(intent.getAction())
                || Intent.ACTION_TIMEZONE_CHANGED.equals(intent.getAction())) {
            updateAllWidgets(context);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String examDeadline = prefs.getString("exam_deadline", DEFAULT_DEADLINE);
        float coveragePct = prefs.getFloat("coverage_pct", -1f);

        String daysCount = "0";
        String daysLabel = "DAYS";
        String statusLabel = "REMAINING";
        String displayDate = "Dec 19, 2026";

        try {
            SimpleDateFormat parser = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            Date targetDate = parser.parse(examDeadline);

            if (targetDate != null) {
                SimpleDateFormat displayFormatter = new SimpleDateFormat("MMM d, yyyy", Locale.US);
                displayDate = displayFormatter.format(targetDate);

                Calendar today = Calendar.getInstance();
                today.set(Calendar.HOUR_OF_DAY, 0);
                today.set(Calendar.MINUTE, 0);
                today.set(Calendar.SECOND, 0);
                today.set(Calendar.MILLISECOND, 0);

                Calendar target = Calendar.getInstance();
                target.setTime(targetDate);
                target.set(Calendar.HOUR_OF_DAY, 0);
                target.set(Calendar.MINUTE, 0);
                target.set(Calendar.SECOND, 0);
                target.set(Calendar.MILLISECOND, 0);

                long diffMillis = target.getTimeInMillis() - today.getTimeInMillis();
                long days = diffMillis / (1000 * 60 * 60 * 24);

                if (days > 1) {
                    daysCount = String.valueOf(days);
                    daysLabel = "DAYS";
                    statusLabel = "REMAINING";
                } else if (days == 1) {
                    daysCount = "1";
                    daysLabel = "DAY";
                    statusLabel = "LEFT!";
                } else if (days == 0) {
                    daysCount = "0";
                    daysLabel = "EXAM";
                    statusLabel = "TODAY!";
                } else {
                    daysCount = "0";
                    daysLabel = "EXAM";
                    statusLabel = "CONCLUDED";
                }
            }
        } catch (Exception e) {
            daysCount = "--";
            daysLabel = "DAYS";
            statusLabel = "REMAINING";
        }

        String footerText = "Tap to open tracker";
        if (coveragePct >= 0) {
            footerText = String.format(Locale.US, "Coverage: %.1f%% · Tap to open", coveragePct);
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_countdown);
        views.setTextViewText(R.id.widget_days_count, daysCount);
        views.setTextViewText(R.id.widget_days_label, daysLabel);
        views.setTextViewText(R.id.widget_status_label, statusLabel);
        views.setTextViewText(R.id.widget_target_date, displayDate);
        views.setTextViewText(R.id.widget_footer_text, footerText);

        // Click on widget opens MainActivity
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, launchIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, CountdownWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(component);
        if (ids != null && ids.length > 0) {
            for (int id : ids) {
                updateAppWidget(context, manager, id);
            }
        }
    }
}
