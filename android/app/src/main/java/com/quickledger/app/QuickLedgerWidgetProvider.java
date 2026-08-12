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

            setupPendingIntent(context, views, R.id.btn_q1, "NECESSARY_DAILY");
            setupPendingIntent(context, views, R.id.btn_q2, "NECESSARY_URGENT");
            setupPendingIntent(context, views, R.id.btn_q3, "UNNECESSARY_DAILY");
            setupPendingIntent(context, views, R.id.btn_q4, "UNNECESSARY_URGENT");

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    private void setupPendingIntent(Context context, RemoteViews views, int viewId, String quadrant) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("quickledger://add?quadrant=" + quadrant));
        intent.setPackage(context.getPackageName());
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            quadrant.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(viewId, pendingIntent);
    }
}
