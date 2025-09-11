import { PaywallConfig } from '@unified-video/core';
import { EmailAuthController, EmailAuthControllerOptions } from './EmailAuthController';

export type PaywallGateway = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
};

export type PaymentLinkConfig = {
  endpoint: string;
  method?: 'POST' | 'GET';
  headers?: Record<string, string>;
  mapRequest?: (paymentData: any) => any;
  mapResponse?: (response: any) => { url: string; orderId?: string; };
  popup?: {
    width?: number;
    height?: number;
    features?: string;
  };
};

export type PaywallControllerOptions = {
  getOverlayContainer: () => HTMLElement | null;
  onResume: () => void;
  onShow?: () => void;
  onClose?: () => void;
  // Custom payment handlers
  onPaymentRequested?: (gateway: PaywallGateway, paymentData: any) => Promise<void> | void;
  onPaymentSuccess?: (gateway: PaywallGateway, result: any) => void;
  onPaymentError?: (gateway: PaywallGateway, error: any) => void;
  onPaymentCancel?: (gateway: PaywallGateway) => void;
};

export class PaywallController {
  private config: PaywallConfig | null = null;
  private opts: PaywallControllerOptions;
  private overlayEl: HTMLElement | null = null;
  private gatewayStepEl: HTMLElement | null = null;
  private popup: Window | null = null;
  private emailAuth: EmailAuthController | null = null;
  private authenticatedUserId: string | null = null;
  private sessionToken: string | null = null;
  private currentGateway: PaywallGateway | null = null; // Track current payment gateway

  constructor(config: PaywallConfig | null, opts: PaywallControllerOptions) {
    this.config = config;
    this.opts = opts;
    
    // Initialize EmailAuthController if email auth is enabled
    this.initializeEmailAuth();
    
    // Don't check authentication immediately - allow free preview first
    // Authentication will be triggered when free preview ends
    
    try {
      window.addEventListener('message', this.onMessage, false);
    } catch (_) {}
  }

  updateConfig(config: PaywallConfig | null) {
    // Defensive logic: if new config is null/undefined but we have a working email auth,
    // preserve the email auth instance to prevent destruction during re-initialization
    const hadWorkingEmailAuth = this.config?.emailAuth?.enabled && !!this.emailAuth;
    const newConfigLacksEmailAuth = !config?.emailAuth?.enabled;
    
    if (hadWorkingEmailAuth && newConfigLacksEmailAuth) {
      console.log('[PaywallController] Preserving email auth instance during config update');
      // Only update non-email auth related config, keep the email auth part
      this.config = {
        ...config,
        emailAuth: this.config?.emailAuth // Preserve existing email auth config
      };
      
      if (this.emailAuth) {
        this.emailAuth.updateConfig(this.config);
      }
    } else {
      // Normal config update
      this.config = config;
      this.initializeEmailAuth();
      if (this.emailAuth) {
        this.emailAuth.updateConfig(config);
      }
    }
  }

  openOverlay() {
    console.log('[PaywallController] openOverlay called');
    console.log('[PaywallController] config enabled:', this.config?.enabled);
    console.log('[PaywallController] email auth enabled:', this.config?.emailAuth?.enabled);
    console.log('[PaywallController] emailAuth instance:', !!this.emailAuth);
    
    if (!this.config?.enabled) {
      console.log('[PaywallController] Paywall disabled, exiting');
      return;
    }
    
    // Check authentication first if email auth is enabled
    if (this.config.emailAuth?.enabled) {
      console.log('[PaywallController] Email auth is enabled, checking authentication');
      
      // If email auth is enabled but instance doesn't exist, try to initialize it
      if (!this.emailAuth) {
        console.log('[PaywallController] Email auth enabled but no instance found, initializing now');
        this.initializeEmailAuth();
      }
      
      // If still no instance after initialization, show error
      if (!this.emailAuth) {
        console.error('[PaywallController] Failed to initialize email auth, proceeding to payment overlay');
        // Continue to payment overlay as fallback
      } else {
        const isAuthenticated = this.emailAuth.isAuthenticated();
        console.log('[PaywallController] User authenticated:', isAuthenticated);
        
        if (!isAuthenticated) {
          console.log('[PaywallController] User not authenticated, opening email auth modal');
          // Show email authentication modal first
          this.emailAuth.openAuthModal();
          return;
        } else {
          console.log('[PaywallController] User already authenticated, proceeding to payment overlay');
          // Update userId for authenticated user
          this.authenticatedUserId = this.emailAuth.getAuthenticatedUserId() || this.config.userId || null;
          // Update config with authenticated userId for API calls
          if (this.authenticatedUserId && this.config) {
            this.config.userId = this.authenticatedUserId;
          }
        }
      }
    }
    
    // Show payment overlay
    console.log('[PaywallController] Showing payment overlay');
    const root = this.ensureOverlay();
    if (!root) {
      console.log('[PaywallController] Failed to create overlay');
      return;
    }
    
    // Show overlay with proper animation
    root.style.display = 'flex';
    root.classList.add('active');
    
    // Force reflow then fade in with animation
    void root.offsetWidth;
    root.style.opacity = '1';
    
    // Also animate the modal inside
    const modal = root.querySelector('.uvf-paywall-modal') as HTMLElement;
    if (modal) {
      modal.style.transform = 'translateY(0)';
      modal.style.opacity = '1';
    }
    
    console.log('[PaywallController] Payment overlay displayed successfully');
    this.opts.onShow?.();
  }

  closeOverlay() {
    if (this.overlayEl) {
      // Animate out
      this.overlayEl.style.opacity = '0';
      const modal = this.overlayEl.querySelector('.uvf-paywall-modal') as HTMLElement;
      if (modal) {
        modal.style.transform = 'translateY(20px)';
        modal.style.opacity = '0';
      }
      
      // Hide after animation
      setTimeout(() => {
        if (this.overlayEl) {
          this.overlayEl.classList.remove('active');
          this.overlayEl.style.display = 'none';
        }
      }, 300); // Match the CSS transition duration
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
    ov.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.95);
      z-index: 2147483647;
      display: none;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    const modal = document.createElement('div');
    modal.className = 'uvf-paywall-modal';
    modal.style.cssText = `
      width: 90vw;
      height: 85vh;
      max-width: 1000px;
      max-height: 700px;
      background: #0f0f10;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 
        0 20px 60px rgba(0, 0, 0, 0.7),
        0 0 0 1px rgba(255, 255, 255, 0.1);
      transform: translateY(20px);
      opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
    `;

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
    title.textContent = this.config.branding?.paymentTitle || 'Choose a payment method';
    title.style.cssText = 'color:#fff;font-size:16px;margin-bottom:20px;';
    
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center;';

    // Support both legacy string array and new gateway objects
    const gateways = this.getGateways();
    
    for (const gateway of gateways) {
      const btn = this.createGatewayButton(gateway);
      btn.addEventListener('click', () => this.handleGatewayClick(gateway));
      wrap.appendChild(btn);
    }
    
    this.gatewayStepEl!.appendChild(title);
    this.gatewayStepEl!.appendChild(wrap);
  }

  private getGateways(): PaywallGateway[] {
    if (!this.config?.gateways) return [];
    
    return this.config.gateways.map((g: any) => {
      if (typeof g === 'string') {
        // Legacy support for string arrays
        return this.getLegacyGateway(g);
      }
      // New gateway object format
      return g as PaywallGateway;
    });
  }
  
  private getLegacyGateway(id: string): PaywallGateway {
    const legacyGateways: Record<string, PaywallGateway> = {
      stripe: {
        id: 'stripe',
        name: 'Credit/Debit Card',
        description: 'Pay with Stripe',
        color: '#6772e5'
      },
      cashfree: {
        id: 'cashfree',
        name: 'UPI/Netbanking',
        description: 'Pay with Cashfree',
        color: '#00d4aa'
      },
      custom: {
        id: 'custom',
        name: 'Pay Now',
        description: 'Secure Payment',
        color: '#4f9eff'
      }
    };
    
    return legacyGateways[id] || {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      description: `Pay with ${id}`,
      color: '#666666'
    };
  }
  
  private createGatewayButton(gateway: PaywallGateway): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'uvf-gateway-btn';
    
    // Create button content
    const content = document.createElement('div');
    content.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;';
    
    // Icon or emoji
    if (gateway.icon) {
      const icon = document.createElement('div');
      icon.innerHTML = gateway.icon;
      icon.style.cssText = 'font-size:24px;';
      content.appendChild(icon);
    }
    
    // Gateway name
    const name = document.createElement('div');
    name.textContent = gateway.name;
    name.style.cssText = 'font-weight:600;font-size:14px;';
    content.appendChild(name);
    
    // Description (optional)
    if (gateway.description) {
      const desc = document.createElement('div');
      desc.textContent = gateway.description;
      desc.style.cssText = 'font-size:12px;opacity:0.8;';
      content.appendChild(desc);
    }
    
    btn.appendChild(content);
    
    // Styling
    const bgColor = gateway.color || '#4f9eff';
    btn.style.cssText = `
      background: linear-gradient(135deg, ${bgColor}, ${this.adjustBrightness(bgColor, -20)});
      color: #fff;
      border: none;
      border-radius: 12px;
      padding: 16px 20px;
      cursor: pointer;
      min-width: 140px;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      font-family: inherit;
    `;
    
    // Hover effects
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = `0 8px 20px rgba(0,0,0,0.3), 0 4px 8px ${bgColor}40`;
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = 'none';
    });
    
    return btn;
  }
  
  private adjustBrightness(color: string, amount: number): string {
    // Simple color brightness adjustment
    if (!color.startsWith('#')) return color;
    
    const num = parseInt(color.slice(1), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
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

  // Handle gateway button clicks with flexible routing
  private async handleGatewayClick(gateway: PaywallGateway) {
    try {
      // Track current gateway for message handling
      this.currentGateway = gateway;
      
      console.log(`[PaywallController] Processing payment for gateway: ${gateway.id}`);
      
      // Check if user provided a custom payment handler
      if (this.opts.onPaymentRequested) {
        console.log(`[PaywallController] Using custom handler for gateway: ${gateway.id}`);
        const paymentData = {
          userId: this.authenticatedUserId || this.config?.userId,
          videoId: this.config?.videoId,
          amount: this.config?.pricing?.amount,
          currency: this.config?.pricing?.currency || 'INR',
          gateway: gateway.id,
          sessionToken: this.sessionToken
        };
        
        await this.opts.onPaymentRequested(gateway, paymentData);
        return;
      }
      
      // PRIORITY: Check for payment link configuration first
      // This allows users to override built-in gateways with their own APIs
      const paymentLinkConfig = (this.config as any)?.paymentLink;
      if (paymentLinkConfig?.endpoint) {
        console.log(`[PaywallController] Using payment link configuration for: ${gateway.id}`);
        await this.handlePaymentLink(gateway);
        return;
      }
      
      // Fallback: Handle built-in gateways (Stripe, Cashfree) only if no payment link config
      if (gateway.id === 'stripe' || gateway.id === 'cashfree') {
        console.log(`[PaywallController] Using built-in handler for: ${gateway.id}`);
        await this.openGateway(gateway.id);
        return;
      }
      
      // No handler available
      console.error(`[PaywallController] No payment handler configured for gateway: ${gateway.id}`);
      alert('Payment method not configured. Please contact support.');
      
    } catch (error) {
      console.error(`[PaywallController] Payment error for ${gateway.id}:`, error);
      
      // Notify user of payment error via callback
      if (this.opts.onPaymentError) {
        this.opts.onPaymentError(gateway, error);
      } else {
        alert('Payment failed. Please try again or contact support.');
      }
      
      // Return to gateway selection
      this.showGateways();
    }
  }

  // Option B: config-only payment link handler
  private async handlePaymentLink(gateway: PaywallGateway) {
    const cfg = (this.config as any).paymentLink as PaymentLinkConfig | undefined;
    if (!cfg?.endpoint) throw new Error('paymentLink.endpoint is required');

    const w = Math.min(window.screen.width - 100, cfg.popup?.width || this.config?.popup?.width || 1000);
    const h = Math.min(window.screen.height - 100, cfg.popup?.height || this.config?.popup?.height || 800);
    const left = Math.max(0, Math.round((window.screen.width - w) / 2));
    const top = Math.max(0, Math.round((window.screen.height - h) / 2));
    const features = cfg.popup?.features || `popup=1,width=${w},height=${h},left=${left},top=${top}`;

    // Pre-open popup to avoid blockers
    let pre: Window | null = null;
    try { pre = window.open('', 'uvfCheckout', features); } catch (_) { pre = null; }

    const paymentData = {
      userId: this.config?.userId,
      videoId: this.config?.videoId,
      amount: this.config?.pricing?.amount,
      currency: this.config?.pricing?.currency || 'INR',
      metadata: { gateway: gateway.id, sessionToken: this.sessionToken, authenticatedUserId: this.authenticatedUserId }
    };

    const body = cfg.mapRequest ? cfg.mapRequest(paymentData) : {
      unit_amount: Math.round(paymentData.amount || 0),
      source_type_id: 1,
      source_id: paymentData.videoId,
      success_url: window.location.origin + window.location.pathname + '?rental=success&popup=1',
      failure_url: window.location.origin + window.location.pathname + '?rental=cancel&popup=1'
    };

    const res = await fetch(cfg.endpoint, {
      method: cfg.method || 'POST',
      headers: { 'Content-Type': 'application/json', ...(cfg.headers || {}) },
      body: (cfg.method || 'POST') === 'POST' ? JSON.stringify(body) : undefined
    });

    const raw = await res.json();
    const mapped = cfg.mapResponse ? cfg.mapResponse(raw) : {
      url: raw?.Payment_Link_URL || raw?.paymentLink || raw?.link_url,
      orderId: raw?.order_id || raw?.orderId
    };

    if (!mapped?.url) {
      // Close pre-opened popup if failed
      try { pre && !pre.closed && pre.close(); } catch (_) {}
      throw new Error(raw?.message || 'Failed to create payment link');
    }

    try { this.popup && !this.popup.closed && this.popup.close(); } catch (_) {}
    this.popup = pre && !pre.closed ? pre : window.open('', 'uvfCheckout', features);
    try { if (this.popup) this.popup.location.href = mapped.url; } catch(_) {}

    // Store orderId and gateway context for later confirmation if needed
    (window as any)._uvf_orderId = mapped.orderId || null;
    (window as any)._uvf_gatewayId = gateway.id;

    // Rely on success_url page to postMessage back with { type:'uvfCheckout', status:'success', orderId, gatewayId }
    this.startPolling();
  }

  private onMessage = async (ev: MessageEvent) => {
    const d: any = ev?.data || {};
    if (!d || d.type !== 'uvfCheckout') return;
    
    try { if (this.popup && !this.popup.closed) this.popup.close(); } catch (_) {}
    this.popup = null;
    
    // Determine which gateway was used based on the message data
    const gateway = this.findGatewayById(d.gatewayId) || this.currentGateway || {
      id: 'unknown',
      name: 'Payment Gateway'
    };
    
    // Clear current gateway after processing
    if (d.status === 'success' || d.status === 'cancel' || d.status === 'error') {
      this.currentGateway = null;
    }
    
    if (d.status === 'cancel') {
      console.log(`[PaywallController] Payment cancelled for gateway: ${gateway.id}`);
      
      // Notify user callback of cancellation
      if (this.opts.onPaymentCancel) {
        this.opts.onPaymentCancel(gateway);
      }
      
      // Return to gateway selection
      this.showGateways();
      return;
    }
    
    if (d.status === 'success') {
      console.log(`[PaywallController] Payment successful for gateway: ${gateway.id}`);
      
      try {
        // Handle built-in gateway verification
        if (d.sessionId && this.config) {
          console.log('[PaywallController] Verifying Stripe session');
          await fetch(`${this.config.apiBase}/api/rentals/stripe/confirm`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              sessionId: d.sessionId,
              userId: this.authenticatedUserId || this.config.userId,
              videoId: this.config.videoId
            })
          });
        }
        
        if (d.orderId && this.config) {
          console.log('[PaywallController] Verifying Cashfree order');
          await fetch(`${this.config.apiBase}/api/rentals/cashfree/verify?orderId=${encodeURIComponent(d.orderId)}&userId=${encodeURIComponent(this.authenticatedUserId || this.config.userId || '')}&videoId=${encodeURIComponent(this.config.videoId || '')}`);
        }
        
        // For custom payment links or other gateways, verification might be handled differently
        // The success callback will be triggered regardless
        
      } catch (error) {
        console.error('[PaywallController] Payment verification failed:', error);
        
        // Notify error callback
        if (this.opts.onPaymentError) {
          this.opts.onPaymentError(gateway, error);
          return;
        }
      }
      
      // Notify success callback
      if (this.opts.onPaymentSuccess) {
        this.opts.onPaymentSuccess(gateway, {
          sessionId: d.sessionId,
          orderId: d.orderId,
          transactionId: d.transactionId,
          ...d // Pass all data from the message
        });
      }
      
      // Close overlay and resume playback
      this.closeOverlay();
      this.opts.onResume();
      return;
    }
    
    // Handle error status
    if (d.status === 'error') {
      console.error(`[PaywallController] Payment error for gateway: ${gateway.id}`, d.error);
      
      if (this.opts.onPaymentError) {
        this.opts.onPaymentError(gateway, d.error || 'Payment failed');
      }
      
      // Return to gateway selection
      this.showGateways();
    }
  };
  
  // Helper method to find gateway by ID
  private findGatewayById(gatewayId?: string): PaywallGateway | null {
    if (!gatewayId) return null;
    
    const gateways = this.getGateways();
    return gateways.find(g => g.id === gatewayId) || null;
  }


  /**
   * Initialize EmailAuthController if email authentication is enabled
   */
  private initializeEmailAuth() {
    console.log('[PaywallController] initializeEmailAuth called');
    console.log('[PaywallController] email auth config:', this.config?.emailAuth);
    console.log('[PaywallController] config enabled:', this.config?.enabled);
    
    // If paywall is disabled entirely, clean up everything
    if (!this.config?.enabled) {
      console.log('[PaywallController] Paywall completely disabled, cleaning up email auth');
      if (this.emailAuth) {
        this.emailAuth.destroy();
        this.emailAuth = null;
      }
      return;
    }
    
    // If email auth specifically is disabled, clean up only email auth
    if (!this.config?.emailAuth?.enabled) {
      console.log('[PaywallController] Email auth disabled, cleaning up existing instance');
      if (this.emailAuth) {
        this.emailAuth.destroy();
        this.emailAuth = null;
      }
      return;
    }

    console.log('[PaywallController] Email auth enabled, checking for existing instance:', !!this.emailAuth);
    if (!this.emailAuth) {
      console.log('[PaywallController] Creating new EmailAuthController');
      const emailAuthOptions: EmailAuthControllerOptions = {
        getOverlayContainer: this.opts.getOverlayContainer,
        onAuthSuccess: (userId: string, sessionToken: string, accessData?: any) => {
          this.authenticatedUserId = userId;
          this.sessionToken = sessionToken;
          
          // Update config with authenticated userId
          if (this.config) {
            this.config.userId = userId;
          }
          
          // Close auth modal
          this.emailAuth?.closeAuthModal();
          
          // Handle access logic based on server response
          // Handle access logic based on server response
          if (accessData) {
            const { 
              access_granted = false,
              requires_payment = false, 
              free_duration = 0,
              price = null
            } = accessData;
            
            // Update price from server response if provided
            if (price && this.config) {
              this.config.pricing = {
                ...this.config.pricing,
                amount: parseFloat(price.toString().replace(/[^\d.]/g, ''))
              };
            }

            console.log('[PaywallController] Auth response:', { access_granted, requires_payment, free_duration });
            
            if (access_granted) {
              // Full access - play immediately
              console.log('[PaywallController] Access granted, playing video');
              this.opts.onResume();
            }
            else if (!access_granted && requires_payment) {
              if (free_duration > 0) {
                // Start free preview, show paywall after duration
                console.log(`[PaywallController] Starting ${free_duration}s preview`);
                this.opts.onResume();
                
                // Let preview play, WebPlayer will handle showing paywall
                // after free_duration via onFreePreviewEnded event
              } else {
                // No preview available - show paywall immediately
                console.log('[PaywallController] No preview available, showing paywall');
                setTimeout(() => {
                  this.openPaymentOverlay();
                }, 100);
              }
            } 
            else {
              // Default behavior - resume playback
              console.log('[PaywallController] Default behavior, resuming playback');
              this.opts.onResume();
            }
          } else {
            // Backward compatibility - use configured free duration
            console.log('[PaywallController] No access data, resuming with default preview');
            this.opts.onResume();
          }
        },
        onAuthCancel: () => {
          // User cancelled authentication, close everything
          this.emailAuth?.closeAuthModal();
          this.opts.onShow?.(); // Let parent know modal was shown (for cleanup)
        },
        onShow: this.opts.onShow,
        onClose: this.opts.onClose,
      };
      
      this.emailAuth = new EmailAuthController(this.config, emailAuthOptions);
      console.log('[PaywallController] EmailAuthController created successfully');
    }
  }

  /**
   * Open payment overlay directly (bypassing auth check)
   */
  private openPaymentOverlay() {
    console.log('[PaywallController] Opening payment overlay');
    const root = this.ensureOverlay();
    if (!root) {
      console.error('[PaywallController] Failed to create overlay');
      return;
    }

    try {
      root.style.display = 'flex';
      root.classList.add('active');
      
      // Force reflow then fade in with animation
      void root.offsetWidth;
      root.style.opacity = '1';
      
      // Also animate the modal inside
      const modal = root.querySelector('.uvf-paywall-modal') as HTMLElement;
      if (modal) {
        modal.style.transform = 'translateY(0)';
        modal.style.opacity = '1';
      }
      
      this.opts.onShow?.();
      console.log('[PaywallController] Payment overlay shown');
    } catch (err) {
      console.error('[PaywallController] Error showing overlay:', err);
    }
  }

  /**
   * Check if user is authenticated (for external use)
   */
  isAuthenticated(): boolean {
    if (!this.config?.emailAuth?.enabled) return true;
    return this.emailAuth?.isAuthenticated() || false;
  }

  /**
   * Get authenticated user ID (for external use)
   */
  getAuthenticatedUserId(): string | null {
    if (!this.config?.emailAuth?.enabled) return this.config?.userId || null;
    return this.emailAuth?.getAuthenticatedUserId() || this.config?.userId || null;
  }

  /**
   * Logout user (for external use)
   */
  async logout(): Promise<void> {
    if (this.emailAuth) {
      await this.emailAuth.logout();
    }
    this.authenticatedUserId = null;
    this.sessionToken = null;
  }

  /**
   * Add a custom payment gateway dynamically
   */
  addGateway(gateway: PaywallGateway) {
    if (!this.config) {
      console.warn('[PaywallController] Cannot add gateway: config is null');
      return;
    }
    
    if (!this.config.gateways) {
      this.config.gateways = [];
    }
    
    // Remove existing gateway with same ID
    this.config.gateways = this.config.gateways.filter((g: any) => {
      const id = typeof g === 'string' ? g : g.id;
      return id !== gateway.id;
    });
    
    // Add new gateway
    this.config.gateways.push(gateway);
    
    console.log(`[PaywallController] Added gateway: ${gateway.id}`);
  }
  
  /**
   * Remove a payment gateway by ID
   */
  removeGateway(gatewayId: string) {
    if (!this.config?.gateways) return;
    
    this.config.gateways = this.config.gateways.filter((g: any) => {
      const id = typeof g === 'string' ? g : g.id;
      return id !== gatewayId;
    });
    
    console.log(`[PaywallController] Removed gateway: ${gatewayId}`);
  }
  
  /**
   * Get all configured gateways (for external use)
   */
  getConfiguredGateways(): PaywallGateway[] {
    return this.getGateways();
  }

  /**
   * Cleanup on destroy
   */
  destroy() {
    if (this.emailAuth) {
      this.emailAuth.destroy();
      this.emailAuth = null;
    }
    
    if (this.overlayEl && this.overlayEl.parentElement) {
      this.overlayEl.parentElement.removeChild(this.overlayEl);
    }
    this.overlayEl = null;
    
    // Close any open popup
    try {
      if (this.popup && !this.popup.closed) {
        this.popup.close();
      }
    } catch (_) {}
    this.popup = null;
    
    // Clean up gateway tracking
    this.currentGateway = null;
    
    try {
      window.removeEventListener('message', this.onMessage, false);
    } catch (_) {}
  }
}
