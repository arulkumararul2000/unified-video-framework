package com.unifiedvideo.player.overlay;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Shader;
import android.util.AttributeSet;
import android.view.View;

import java.util.Random;

/**
 * Semi-random moving watermark overlay similar to web watermark.
 */
public class WatermarkOverlayView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Random random = new Random();

    private int colorStart = 0xFFFF0000; // #ff0000
    private int colorEnd = 0xFFFF4D4F;   // #ff4d4f
    private float alpha = 0.3f;

    private String text = "PREMIUM";
    private float x = 50;
    private float y = 80;

    public WatermarkOverlayView(Context context) {
        super(context);
        init();
    }

    public WatermarkOverlayView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    public WatermarkOverlayView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init();
    }

    private void init() {
        paint.setTextSize(42f);
        paint.setStyle(Paint.Style.FILL);
        setClickable(false);
        setFocusable(false);
    }

    public void setAccentColors(int startColor, int endColor) {
        this.colorStart = startColor;
        this.colorEnd = endColor;
        invalidate();
    }

    public void setAlphaFactor(float alphaFactor) {
        this.alpha = Math.max(0f, Math.min(1f, alphaFactor));
        invalidate();
    }

    public void setText(String text) {
        this.text = text;
        invalidate();
    }

    /** Move watermark to a random position and redraw. */
    public void randomize() {
        int w = getWidth();
        int h = getHeight();
        if (w <= 0 || h <= 0) return;
        float margin = 20f;
        x = margin + random.nextFloat() * Math.max(1f, (w - margin * 2 - 200));
        y = margin + random.nextFloat() * Math.max(1f, (h - margin * 2 - 60));
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        int w = getWidth();
        Shader shader = new LinearGradient(0, 0, w, 0, colorStart, colorEnd, Shader.TileMode.CLAMP);
        paint.setShader(shader);
        paint.setAlpha((int) (alpha * 255));
        String content = text + " • " + System.currentTimeMillis() % 100000;
        canvas.drawText(content, x, y, paint);
    }
}

