package com.quickledger.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class QuickLedgerWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_ledger);

            setupVoicePendingIntent(context, views, R.id.btn_voice);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    private void setupVoicePendingIntent(Context context, RemoteViews views, int viewId) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("quickledger://voice"));
        intent.setPackage(context.getPackageName());
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            "voice".hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(viewId, pendingIntent);
    }
}
