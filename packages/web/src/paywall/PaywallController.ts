import { PaywallConfig } from '@unified-video/core';

export type PaywallControllerOptions = {
  getOverlayContainer: () => HTMLElement | null;
  onResume: () => void;
  onShow?: () => void;
  onClose?: () => void;
};

export class PaywallController {
  private config: PaywallConfig | null = null;
  private opts: PaywallControllerOptions;
  private overlayEl: HTMLElement | null = null;
  private gatewayStepEl: HTMLElement | null = null;
  private popup: Window | null = null;

  constructor(config: PaywallConfig | null, opts: PaywallControllerOptions) {
    this.config = config;
    this.opts = opts;
    try {
      window.addEventListener('message', this.onMessage, false);
    } catch (_) {}
  }

  updateConfig(config: PaywallConfig | null) {
    this.config = config;
  }

  openOverlay() {
    if (!this.config?.enabled) return;
    const root = this.ensureOverlay();
    if (!root) return;
    root.style.display = 'flex';
    root.classList.add('active');
    this.opts.onShow?.();
  }

  closeOverlay() {
    if (this.overlayEl) {
      this.overlayEl.classList.remove('active');
      this.overlayEl.style.display = 'none';
    }
    this.opts.onClose?.();
  }

  private ensureOverlay(): HTMLElement | null {
    if (this.overlayEl && document.body.contains(this.overlayEl)) return this.overlayEl;

    const container = this.opts.getOverlayContainer() || document.body;
    const ov = document.createElement('div');
    ov.className = 'uvf-paywall-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.85);z-index:2147483000;display:none;align-items:center;justify-content:center;';

    const modal = document.createElement('div');
    modal.className = 'uvf-paywall-modal';
    modal.style.cssText = 'width:80vw;height:80vh;max-width:1100px;max-height:800px;background:#0f0f10;border:1px solid rgba(255,255,255,0.15);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.7)';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;gap:16px;align-items:center;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.1)';
    const hTitle = document.createElement('div');
    hTitle.textContent = (this.config?.branding?.title || 'Continue watching');
    hTitle.style.cssText = 'color:#fff;font-size:18px;font-weight:700';
    const hDesc = document.createElement('div');
    hDesc.textContent = (this.config?.branding?.description || 'Rent to continue watching this video.');
    hDesc.style.cssText = 'color:rgba(255,255,255,0.75);font-size:14px;margin-top:4px';
    const headerTextWrap = document.createElement('div');
    headerTextWrap.appendChild(hTitle); headerTextWrap.appendChild(hDesc);

    header.appendChild(headerTextWrap);

    const content = document.createElement('div');
    content.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;padding:20px;';

    const intro = document.createElement('div');
    intro.style.cssText = 'display:flex;flex-direction:column;gap:16px;align-items:center;justify-content:center;';
    const msg = document.createElement('div');
    msg.textContent = 'Free preview ended. Rent to continue watching.';
    msg.style.cssText = 'color:#fff;font-size:16px;';
    const rentBtn = document.createElement('button');
    rentBtn.textContent = 'Rent Now';
    rentBtn.className = 'uvf-btn-primary';
    rentBtn.style.cssText = 'background:linear-gradient(135deg,#ff4d4f,#d9363e);color:#fff;border:1px solid rgba(255,77,79,0.6);border-radius:999px;padding:10px 18px;cursor:pointer;';
    rentBtn.addEventListener('click', () => this.showGateways());
    intro.appendChild(msg); intro.appendChild(rentBtn);

    const step = document.createElement('div');
    step.style.cssText = 'display:none;flex-direction:column;gap:16px;align-items:center;justify-content:center;';
    this.gatewayStepEl = step;

    content.appendChild(intro);
    content.appendChild(step);
    modal.appendChild(header); modal.appendChild(content);
    ov.appendChild(modal);
    container.appendChild(ov);
    this.overlayEl = ov;
    return ov;
  }

  private showGateways() {
    if (!this.config) return;
    this.gatewayStepEl!.innerHTML = '';
    this.gatewayStepEl!.style.display = 'flex';

    const title = document.createElement('div');
    title.textContent = 'Choose a payment method';
    title.style.cssText = 'color:#fff;font-size:16px;';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center;';

    for (const g of this.config.gateways) {
      const btn = document.createElement('button');
      btn.textContent = g === 'cashfree' ? 'Cashfree' : 'Stripe';
      btn.style.cssText = 'background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:12px 16px;cursor:pointer;min-width:120px;';
      btn.addEventListener('click', () => this.openGateway(g));
      wrap.appendChild(btn);
    }
    this.gatewayStepEl!.appendChild(title);
    this.gatewayStepEl!.appendChild(wrap);
  }

  private async openGateway(gateway: 'stripe' | 'cashfree') {
    try {
      if (!this.config) return;
      const { apiBase, userId, videoId } = this.config;
      const w = Math.min(window.screen.width - 100, this.config.popup?.width || 1000);
      const h = Math.min(window.screen.height - 100, this.config.popup?.height || 800);
      const left = Math.max(0, Math.round((window.screen.width - w) / 2));
      const top = Math.max(0, Math.round((window.screen.height - h) / 2));

      if (gateway === 'stripe') {
        const res = await fetch(`${apiBase}/api/rentals/stripe/checkout-session`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId, videoId,
            successUrl: window.location.origin + window.location.pathname + '?rental=success&popup=1',
            cancelUrl: window.location.origin + window.location.pathname + '?rental=cancel&popup=1'
          })
        });
        const data = await res.json();
        if (data?.url) {
          try { this.popup && !this.popup.closed && this.popup.close(); } catch (_) {}
          this.popup = window.open(data.url, 'uvfCheckout', `popup=1,width=${w},height=${h},left=${left},top=${top}`);
          this.startPolling();
        }
        return;
      }

      if (gateway === 'cashfree') {
        const features = `popup=1,width=${w},height=${h},left=${left},top=${top}`;
        // Pre-open a blank popup in direct response to the click to avoid popup blockers
        let pre: Window | null = null;
        try { pre = window.open('', 'uvfCheckout', features); } catch(_) { pre = null; }
        const res = await fetch(`${apiBase}/api/rentals/cashfree/order`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, videoId, returnUrl: window.location.origin + window.location.pathname })
        });
        const data = await res.json();
        if (data?.paymentLink && data?.orderId) {
          try { this.popup && !this.popup.closed && this.popup.close(); } catch (_) {}
          this.popup = pre && !pre.closed ? pre : window.open('', 'uvfCheckout', features);
          try { if (this.popup) this.popup.location.href = data.paymentLink; } catch(_) {}
          (window as any)._uvf_cfOrderId = data.orderId;
          this.startPolling();
        } else {
          // Close the pre-opened popup if we didn't get a link
          try { pre && !pre.closed && pre.close(); } catch(_) {}
        }
        return;
      }
    } catch (_) {
      // noop
    }
  }

  private startPolling() {
    // basic polling to detect entitlement or popup closed; the host page should also listen to postMessage
    const timer = setInterval(async () => {
      if (!this.config) { clearInterval(timer); return; }
      if (this.popup && this.popup.closed) {
        clearInterval(timer);
        // user cancelled; leave overlay open at gateway selection
        this.showGateways();
        return;
      }
    }, 3000);
  }

  private onMessage = async (ev: MessageEvent) => {
    const d: any = ev?.data || {};
    if (!d || d.type !== 'uvfCheckout') return;
    try { if (this.popup && !this.popup.closed) this.popup.close(); } catch (_) {}
    this.popup = null;
    if (d.status === 'cancel') {
      this.showGateways();
      return;
    }
    if (d.status === 'success') {
      try {
        if (d.sessionId && this.config) {
          await fetch(`${this.config.apiBase}/api/rentals/stripe/confirm`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: d.sessionId })
          });
        }
        if (d.orderId && this.config) {
          await fetch(`${this.config.apiBase}/api/rentals/cashfree/verify?orderId=${encodeURIComponent(d.orderId)}&userId=${encodeURIComponent(this.config.userId)}&videoId=${encodeURIComponent(this.config.videoId)}`);
        }
      } catch (_) {}
      this.closeOverlay();
      this.opts.onResume();
    }
  };
}
