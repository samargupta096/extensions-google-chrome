/**
 * Chart Utilities — Lightweight Canvas-based charting
 * No external dependencies. Used across all extension dashboards.
 */

class ChartUtils {
  /**
   * Create a bar chart on a canvas element
   */
  static barChart(canvas, data, options = {}) {
    const {
      labels = [],
      values = [],
      colors = null,
      title = '',
      barColor = '#6C5CE7',
      barHoverColor = '#A29BFE',
      gridColor = 'rgba(255,255,255,0.06)',
      textColor = 'rgba(255,255,255,0.7)',
      titleColor = 'rgba(255,255,255,0.9)',
      animate = true,
      formatValue = (v) => v.toString(),
      barRadius = 6,
      barGap = 0.35
    } = options;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const padding = { top: title ? 40 : 20, right: 20, bottom: 50, left: 55 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    const maxVal = Math.max(...values, 1);
    const barW = chartW / values.length;
    const innerBarW = barW * (1 - barGap);

    function draw(progress = 1) {
      ctx.clearRect(0, 0, W, H);

      // Title
      if (title) {
        ctx.fillStyle = titleColor;
        ctx.font = '600 14px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(title, padding.left, 24);
      }

      // Y-axis grid lines
      const gridLines = 5;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.fillStyle = textColor;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';

      for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + chartH - (i / gridLines) * chartH;
        const val = (maxVal * i) / gridLines;

        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(W - padding.right, y);
        ctx.stroke();

        ctx.fillText(formatValue(val), padding.left - 8, y + 4);
      }

      // Bars
      for (let i = 0; i < values.length; i++) {
        const barH = (values[i] / maxVal) * chartH * progress;
        const x = padding.left + i * barW + (barW - innerBarW) / 2;
        const y = padding.top + chartH - barH;
        const color = colors ? colors[i % colors.length] : barColor;

        // Draw rounded bar
        ctx.fillStyle = color;
        ctx.beginPath();
        if (barH > barRadius * 2) {
          ctx.moveTo(x, y + barRadius);
          ctx.arcTo(x, y, x + barRadius, y, barRadius);
          ctx.arcTo(x + innerBarW, y, x + innerBarW, y + barRadius, barRadius);
          ctx.lineTo(x + innerBarW, padding.top + chartH);
          ctx.lineTo(x, padding.top + chartH);
        } else if (barH > 0) {
          ctx.rect(x, y, innerBarW, barH);
        }
        ctx.closePath();
        ctx.fill();

        // Bar glow
        const gradient = ctx.createLinearGradient(x, y, x, y + barH);
        gradient.addColorStop(0, color + '80');
        gradient.addColorStop(1, color + '10');
        ctx.fillStyle = gradient;
        ctx.fill();

        // X-axis labels
        ctx.fillStyle = textColor;
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          labels[i] || '',
          padding.left + i * barW + barW / 2,
          H - padding.bottom + 18
        );
      }
    }

    if (animate) {
      let start = null;
      function step(ts) {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / 600, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        draw(eased);
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    } else {
      draw(1);
    }
  }

  /**
   * Create a doughnut/pie chart on a canvas element
   */
  static doughnutChart(canvas, data, options = {}) {
    const {
      labels = [],
      values = [],
      colors = ['#6C5CE7', '#00CEC9', '#FD79A8', '#FDCB6E', '#00B894', '#E17055', '#74B9FF', '#A29BFE'],
      title = '',
      textColor = 'rgba(255,255,255,0.8)',
      titleColor = 'rgba(255,255,255,0.9)',
      centerText = '',
      centerSubText = '',
      animate = true,
      lineWidth = 28
    } = options;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const centerX = W / 2;
    const titleOffset = title ? 30 : 0;
    const centerY = (H + titleOffset) / 2;
    const radius = Math.min(W, H - titleOffset) / 2 - lineWidth / 2 - 10;
    const total = values.reduce((a, b) => a + b, 0) || 1;

    function draw(progress = 1) {
      ctx.clearRect(0, 0, W, H);

      if (title) {
        ctx.fillStyle = titleColor;
        ctx.font = '600 14px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, centerX, 24);
      }

      // Background ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // Segments
      let currentAngle = -Math.PI / 2;
      const totalAngle = Math.PI * 2 * progress;

      for (let i = 0; i < values.length; i++) {
        const sliceAngle = (values[i] / total) * totalAngle;
        if (sliceAngle <= 0) continue;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.strokeStyle = colors[i % colors.length];
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        currentAngle += sliceAngle;
      }

      // Center text
      if (centerText) {
        ctx.fillStyle = titleColor;
        ctx.font = '700 22px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(centerText, centerX, centerY - (centerSubText ? 10 : 0));
      }
      if (centerSubText) {
        ctx.fillStyle = textColor;
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(centerSubText, centerX, centerY + 14);
      }
    }

    if (animate) {
      let start = null;
      function step(ts) {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / 800, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        draw(eased);
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    } else {
      draw(1);
    }
  }

  /**
   * Create a line chart on a canvas element
   */
  static lineChart(canvas, data, options = {}) {
    const {
      labels = [],
      datasets = [], // [{ values, color, label, fill }]
      title = '',
      gridColor = 'rgba(255,255,255,0.06)',
      textColor = 'rgba(255,255,255,0.7)',
      titleColor = 'rgba(255,255,255,0.9)',
      animate = true,
      formatValue = (v) => v.toString(),
      showDots = true,
      dotRadius = 4,
      lineWidth = 2.5
    } = options;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const padding = { top: title ? 40 : 20, right: 20, bottom: 50, left: 55 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    const allValues = datasets.flatMap(d => d.values);
    const maxVal = Math.max(...allValues, 1);

    function draw(progress = 1) {
      ctx.clearRect(0, 0, W, H);

      if (title) {
        ctx.fillStyle = titleColor;
        ctx.font = '600 14px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(title, padding.left, 24);
      }

      // Grid
      const gridLines = 5;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.fillStyle = textColor;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';

      for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + chartH - (i / gridLines) * chartH;
        const val = (maxVal * i) / gridLines;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(W - padding.right, y);
        ctx.stroke();
        ctx.fillText(formatValue(val), padding.left - 8, y + 4);
      }

      // X labels
      const step = chartW / Math.max(labels.length - 1, 1);
      ctx.textAlign = 'center';
      for (let i = 0; i < labels.length; i++) {
        ctx.fillStyle = textColor;
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.fillText(labels[i], padding.left + i * step, H - padding.bottom + 18);
      }

      // Datasets
      for (const dataset of datasets) {
        const { values, color = '#6C5CE7', fill = true } = dataset;
        const pointCount = Math.ceil(values.length * progress);
        const pts = [];

        for (let i = 0; i < pointCount; i++) {
          const x = padding.left + i * step;
          const y = padding.top + chartH - (values[i] / maxVal) * chartH;
          pts.push({ x, y });
        }

        if (pts.length < 2) continue;

        // Fill area
        if (fill) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, padding.top + chartH);
          ctx.lineTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.lineTo(pts[pts.length - 1].x, padding.top + chartH);
          ctx.closePath();
          const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
          gradient.addColorStop(0, color + '30');
          gradient.addColorStop(1, color + '05');
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Line
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        // Dots
        if (showDots) {
          for (const pt of pts) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, dotRadius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, dotRadius - 1.5, 0, Math.PI * 2);
            ctx.fillStyle = '#1a1a2e';
            ctx.fill();
          }
        }
      }
    }

    if (animate) {
      let start = null;
      function animStep(ts) {
        if (!start) start = ts;
        const prog = Math.min((ts - start) / 800, 1);
        draw(1 - Math.pow(1 - prog, 3));
        if (prog < 1) requestAnimationFrame(animStep);
      }
      requestAnimationFrame(animStep);
    } else {
      draw(1);
    }
  }

  /**
   * Create a horizontal bar chart
   */
  static horizontalBarChart(canvas, data, options = {}) {
    const {
      labels = [],
      values = [],
      colors = null,
      title = '',
      barColor = '#6C5CE7',
      gridColor = 'rgba(255,255,255,0.06)',
      textColor = 'rgba(255,255,255,0.7)',
      titleColor = 'rgba(255,255,255,0.9)',
      animate = true,
      formatValue = (v) => v.toString(),
      barHeight = 24,
      barGap = 8,
      barRadius = 6
    } = options;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const padding = { top: title ? 40 : 15, right: 60, bottom: 10, left: 100 };
    const chartW = W - padding.left - padding.right;
    const maxVal = Math.max(...values, 1);

    function draw(progress = 1) {
      ctx.clearRect(0, 0, W, H);

      if (title) {
        ctx.fillStyle = titleColor;
        ctx.font = '600 14px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(title, padding.left, 24);
      }

      for (let i = 0; i < values.length; i++) {
        const y = padding.top + i * (barHeight + barGap);
        const barW = (values[i] / maxVal) * chartW * progress;
        const color = colors ? colors[i % colors.length] : barColor;

        // Label
        ctx.fillStyle = textColor;
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const labelText = labels[i] || '';
        ctx.fillText(
          labelText.length > 14 ? labelText.slice(0, 13) + '…' : labelText,
          padding.left - 10,
          y + barHeight / 2
        );

        // Background bar
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ChartUtils._roundedRect(ctx, padding.left, y, chartW, barHeight, barRadius);
        ctx.fill();

        // Value bar
        if (barW > 0) {
          ctx.fillStyle = color;
          ChartUtils._roundedRect(ctx, padding.left, y, Math.max(barW, barRadius * 2), barHeight, barRadius);
          ctx.fill();

          // Glow
          const gradient = ctx.createLinearGradient(padding.left, y, padding.left + barW, y);
          gradient.addColorStop(0, color + '60');
          gradient.addColorStop(1, color + '20');
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Value text
        ctx.fillStyle = textColor;
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(formatValue(values[i]), padding.left + chartW + 8, y + barHeight / 2);
      }
    }

    if (animate) {
      let start = null;
      function step(ts) {
        if (!start) start = ts;
        const p = Math.min((ts - start) / 600, 1);
        draw(1 - Math.pow(1 - p, 3));
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    } else {
      draw(1);
    }
  }

  /**
   * Helper: draw rounded rectangle
   */
  static _roundedRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
