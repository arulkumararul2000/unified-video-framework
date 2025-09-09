import { PaywallConfig } from '@unified-video/core';

export type EmailAuthControllerOptions = {
  getOverlayContainer: () => HTMLElement | null;
  onAuthSuccess: (userId: string, sessionToken: string, accessData?: any) => void;
  onAuthCancel: () => void;
  onShow?: () => void;
  onClose?: () => void;
};

export type AuthResponse = {
  success: boolean;
  message?: string;
  data?: {
    sessionToken?: string;
    refreshToken?: string;
    userId?: string;
    expiresIn?: number;
  };
  error?: string;
};

export type AuthStep = 'email' | 'otp' | 'loading' | 'error' | 'success';

export class EmailAuthController {
  private config: PaywallConfig | null = null;
  private opts: EmailAuthControllerOptions;
  private overlayEl: HTMLElement | null = null;
  private currentStep: AuthStep = 'email';
  private currentEmail: string = '';
  private resendTimer: number | null = null;
  private resendCooldown: number = 0;
  private otpAttempts: number = 0;
  private requestStartTime: number = 0;

  constructor(config: PaywallConfig | null, opts: EmailAuthControllerOptions) {
    this.config = config;
    this.opts = opts;
  }

  updateConfig(config: PaywallConfig | null) {
    this.config = config;
  }

  /**
   * Check if user is already authenticated
   */
  isAuthenticated(): boolean {
    if (!this.config?.emailAuth?.enabled) return true;
    
    const sessionKey = this.config.emailAuth.sessionStorage?.tokenKey || 'uvf_session_token';
    const userIdKey = this.config.emailAuth.sessionStorage?.userIdKey || 'uvf_user_id';
    
    try {
      const sessionToken = localStorage.getItem(sessionKey);
      const userId = localStorage.getItem(userIdKey);
      
      if (sessionToken && userId) {
        // TODO: Optionally validate token expiry or make a quick API call
        return true;
      }
    } catch (e) {
      console.warn('[UVF Auth] Failed to check localStorage:', e);
    }
    
    return false;
  }

  /**
   * Get stored user ID if authenticated
   */
  getAuthenticatedUserId(): string | null {
    if (!this.isAuthenticated()) return null;
    
    const userIdKey = this.config?.emailAuth?.sessionStorage?.userIdKey || 'uvf_user_id';
    try {
      return localStorage.getItem(userIdKey);
    } catch (e) {
      return null;
    }
  }

  /**
   * Open email authentication modal
   */
  openAuthModal() {
    if (!this.config?.emailAuth?.enabled) return;
    
    // Check if already authenticated and skip if configured to do so
    if (this.config.emailAuth.skipIfAuthenticated !== false && this.isAuthenticated()) {
      const userId = this.getAuthenticatedUserId();
      if (userId) {
        const sessionKey = this.config.emailAuth.sessionStorage?.tokenKey || 'uvf_session_token';
        const sessionToken = localStorage.getItem(sessionKey);
        this.opts.onAuthSuccess(userId, sessionToken || '');
        return;
      }
    }
    
    const root = this.ensureOverlay();
    if (!root) return;
    
    root.style.display = 'flex';
    root.classList.add('active');
    this.setStep('email');
    this.opts.onShow?.();
  }

  /**
   * Close authentication modal
   */
  closeAuthModal() {
    if (this.overlayEl) {
      this.overlayEl.classList.remove('active');
      this.overlayEl.style.display = 'none';
    }
    this.clearResendTimer();
    this.opts.onClose?.();
  }

  /**
   * Create and ensure overlay element exists
   */
  private ensureOverlay(): HTMLElement | null {
    if (this.overlayEl && document.body.contains(this.overlayEl)) return this.overlayEl;

    const container = this.opts.getOverlayContainer() || document.body;
    const overlay = document.createElement('div');
    overlay.className = 'uvf-auth-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 2147483001;
      display: none;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    `;

    // Close on overlay click (outside modal)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.handleCancel();
      }
    });

    const modal = document.createElement('div');
    modal.className = 'uvf-auth-modal';
    modal.style.cssText = `
      width: 90vw;
      max-width: 420px;
      background: #1a1a1b;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.8);
      animation: uvfAuthSlideIn 0.3s ease-out;
    `;

    // Add CSS animation keyframes
    if (!document.querySelector('#uvf-auth-styles')) {
      const style = document.createElement('style');
      style.id = 'uvf-auth-styles';
      style.textContent = `
        @keyframes uvfAuthSlideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (max-width: 768px) {
          .uvf-auth-modal {
            width: 95vw !important;
            margin: 20px;
          }
        }
        .uvf-auth-input {
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .uvf-auth-input:focus {
          border-color: #4f9eff;
          box-shadow: 0 0 0 3px rgba(79, 158, 255, 0.1);
        }
        .uvf-auth-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(79, 158, 255, 0.3);
        }
        .uvf-auth-button:active {
          transform: translateY(0);
        }
        .uvf-auth-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
      `;
      document.head.appendChild(style);
    }

    // Header
    const header = this.createHeader();
    modal.appendChild(header);

    // Content area
    const content = document.createElement('div');
    content.className = 'uvf-auth-content';
    content.style.cssText = `
      padding: 24px;
      min-height: 200px;
    `;
    modal.appendChild(content);

    overlay.appendChild(modal);
    container.appendChild(overlay);
    this.overlayEl = overlay;
    
    return overlay;
  }

  /**
   * Create modal header
   */
  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'uvf-auth-header';
    header.style.cssText = `
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background: linear-gradient(135deg, #2d2d30, #1a1a1b);
    `;

    const title = document.createElement('h2');
    title.style.cssText = `
      color: #ffffff;
      font-size: 20px;
      font-weight: 600;
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    const description = document.createElement('p');
    description.style.cssText = `
      color: rgba(255, 255, 255, 0.7);
      font-size: 14px;
      margin: 4px 0 0 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    header.appendChild(title);
    header.appendChild(description);
    
    return header;
  }

  /**
   * Set current authentication step and render appropriate UI
   */
  private setStep(step: AuthStep) {
    this.currentStep = step;
    
    if (!this.overlayEl) return;
    
    const content = this.overlayEl.querySelector('.uvf-auth-content');
    const header = this.overlayEl.querySelector('.uvf-auth-header');
    
    if (!content || !header) return;

    // Update header
    const title = header.querySelector('h2');
    const description = header.querySelector('p');
    const ui = this.config?.emailAuth?.ui || {};
    
    if (title && description) {
      switch (step) {
        case 'email':
          title.textContent = ui.title || 'Sign in to continue';
          description.textContent = ui.description || 'Enter your email to receive a verification code';
          break;
        case 'otp':
          title.textContent = 'Enter verification code';
          description.textContent = `We sent a code to ${this.currentEmail}`;
          break;
        case 'loading':
          title.textContent = 'Processing...';
          description.textContent = 'Please wait';
          break;
        case 'error':
          title.textContent = 'Authentication failed';
          description.textContent = 'Please try again';
          break;
        case 'success':
          title.textContent = 'Success!';
          description.textContent = 'You are now signed in';
          break;
      }
    }

    // Render step content
    content.innerHTML = '';
    
    switch (step) {
      case 'email':
        content.appendChild(this.renderEmailStep());
        break;
      case 'otp':
        content.appendChild(this.renderOtpStep());
        break;
      case 'loading':
        content.appendChild(this.renderLoadingStep());
        break;
      case 'error':
        content.appendChild(this.renderErrorStep());
        break;
      case 'success':
        content.appendChild(this.renderSuccessStep());
        break;
    }
  }

  /**
   * Render email input step
   */
  private renderEmailStep(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = this.config?.emailAuth?.ui?.emailPlaceholder || 'Enter your email';
    emailInput.className = 'uvf-auth-input';
    emailInput.style.cssText = `
      width: 100%;
      padding: 14px 16px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff;
      font-size: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-sizing: border-box;
    `;
    emailInput.value = this.currentEmail;

    const submitButton = document.createElement('button');
    submitButton.textContent = this.config?.emailAuth?.ui?.submitButtonText || 'Send Code';
    submitButton.className = 'uvf-auth-button';
    submitButton.style.cssText = `
      width: 100%;
      padding: 14px 16px;
      background: linear-gradient(135deg, #4f9eff, #2563eb);
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.2s ease;
    `;

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
      width: 100%;
      padding: 12px 16px;
      background: transparent;
      color: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.2s ease;
    `;

    // Event handlers
    const handleSubmit = () => {
      const email = emailInput.value.trim();
      if (email && this.isValidEmail(email)) {
        this.currentEmail = email;
        this.requestOtp(email);
      } else {
        this.showInputError(emailInput, 'Please enter a valid email address');
      }
    };

    emailInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSubmit();
      }
    });

    submitButton.addEventListener('click', handleSubmit);
    cancelButton.addEventListener('click', () => this.handleCancel());

    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
      cancelButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    });
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.backgroundColor = 'transparent';
      cancelButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });

    container.appendChild(emailInput);
    container.appendChild(submitButton);
    container.appendChild(cancelButton);

    // Auto-focus email input
    setTimeout(() => emailInput.focus(), 100);

    return container;
  }

  /**
   * Render OTP input step
   */
  private renderOtpStep(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    const otpInput = document.createElement('input');
    otpInput.type = 'text';
    otpInput.placeholder = this.config?.emailAuth?.ui?.otpPlaceholder || 'Enter 6-digit code';
    otpInput.className = 'uvf-auth-input';
    otpInput.maxLength = this.config?.emailAuth?.validation?.otpLength || 6;
    otpInput.style.cssText = `
      width: 100%;
      padding: 14px 16px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff;
      font-size: 18px;
      text-align: center;
      letter-spacing: 4px;
      font-family: 'Courier New', monospace;
      box-sizing: border-box;
    `;

    // Only allow digits
    otpInput.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      target.value = target.value.replace(/[^0-9]/g, '');
    });

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Verify Code';
    submitButton.className = 'uvf-auth-button';
    submitButton.style.cssText = `
      width: 100%;
      padding: 14px 16px;
      background: linear-gradient(135deg, #4f9eff, #2563eb);
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.2s ease;
    `;

    const resendButton = document.createElement('button');
    resendButton.className = 'uvf-auth-resend-button';
    resendButton.style.cssText = `
      width: 100%;
      padding: 12px 16px;
      background: transparent;
      color: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.2s ease;
    `;

    const backButton = document.createElement('button');
    backButton.textContent = 'Back to Email';
    backButton.style.cssText = `
      color: rgba(255, 255, 255, 0.5);
      background: none;
      border: none;
      font-size: 14px;
      cursor: pointer;
      text-decoration: underline;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Event handlers
    const handleSubmit = () => {
      const otp = otpInput.value.trim();
      const expectedLength = this.config?.emailAuth?.validation?.otpLength || 6;
      
      if (otp.length === expectedLength) {
        this.verifyOtp(this.currentEmail, otp);
      } else {
        this.showInputError(otpInput, `Please enter a ${expectedLength}-digit code`);
      }
    };

    otpInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSubmit();
      }
    });

    submitButton.addEventListener('click', handleSubmit);
    backButton.addEventListener('click', () => this.setStep('email'));
    
    resendButton.addEventListener('click', () => {
      if (this.resendCooldown === 0) {
        this.requestOtp(this.currentEmail, true);
      }
    });

    container.appendChild(otpInput);
    container.appendChild(submitButton);
    container.appendChild(resendButton);
    container.appendChild(backButton);

    // Auto-focus OTP input
    setTimeout(() => otpInput.focus(), 100);
    
    // Start resend cooldown
    this.startResendCooldown(resendButton);

    return container;
  }

  /**
   * Render loading step
   */
  private renderLoadingStep(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      padding: 40px 20px;
    `;

    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.2);
      border-top: 3px solid #4f9eff;
      border-radius: 50%;
      animation: uvfAuthSpin 1s linear infinite;
    `;

    // Add spinner animation
    if (!document.querySelector('#uvf-auth-spinner-styles')) {
      const style = document.createElement('style');
      style.id = 'uvf-auth-spinner-styles';
      style.textContent = `
        @keyframes uvfAuthSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    const message = document.createElement('div');
    message.textContent = 'Processing your request...';
    message.style.cssText = `
      color: rgba(255, 255, 255, 0.8);
      font-size: 16px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    container.appendChild(spinner);
    container.appendChild(message);

    return container;
  }

  /**
   * Render error step
   */
  private renderErrorStep(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    const errorMessage = document.createElement('div');
    errorMessage.style.cssText = `
      padding: 16px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 8px;
      color: #fca5a5;
      font-size: 14px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    errorMessage.textContent = 'Authentication failed. Please try again.';

    const retryButton = document.createElement('button');
    retryButton.textContent = 'Try Again';
    retryButton.style.cssText = `
      width: 100%;
      padding: 14px 16px;
      background: linear-gradient(135deg, #4f9eff, #2563eb);
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    retryButton.addEventListener('click', () => this.setStep('email'));

    container.appendChild(errorMessage);
    container.appendChild(retryButton);

    return container;
  }

  /**
   * Render success step
   */
  private renderSuccessStep(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      padding: 40px 20px;
    `;

    const checkmark = document.createElement('div');
    checkmark.innerHTML = '✓';
    checkmark.style.cssText = `
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #10b981, #047857);
      color: #ffffff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 30px;
      font-weight: bold;
    `;

    const message = document.createElement('div');
    message.textContent = 'Successfully signed in!';
    message.style.cssText = `
      color: #ffffff;
      font-size: 18px;
      font-weight: 600;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    container.appendChild(checkmark);
    container.appendChild(message);

    // Auto-close after success
    setTimeout(() => {
      this.closeAuthModal();
    }, 1500);

    return container;
  }

  /**
   * Request OTP for email
   */
  private async requestOtp(email: string, isResend: boolean = false) {
    if (!this.config?.emailAuth?.api?.requestOtp) return;

    this.setStep('loading');
    this.requestStartTime = Date.now();

    try {
      // Build request body with email and video context
      const requestBody: any = { email };
      
      // Add slug from paywall metadata if available
      const configWithMetadata = this.config as any;
      if (configWithMetadata?.metadata?.slug) {
        requestBody.slug = configWithMetadata.metadata.slug;
        console.log('[UVF Auth] Including slug in OTP request:', configWithMetadata.metadata.slug);
      }
      
      // Add videoId from paywall config
      if (this.config?.videoId) {
        requestBody.videoId = this.config.videoId;
        console.log('[UVF Auth] Including videoId in OTP request:', this.config.videoId);
      } else if (configWithMetadata?.videoId) {
        requestBody.videoId = configWithMetadata.videoId;
        console.log('[UVF Auth] Including videoId in OTP request:', configWithMetadata.videoId);
      }
      
      if (!requestBody.slug && !requestBody.videoId) {
        console.log('[UVF Auth] No video context (slug/videoId) in config - sending email only');
      }

      const response = await fetch(`${this.config.apiBase}${this.config.emailAuth.api.requestOtp}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.status) {
        // Store session token for OTP verification
        this.storeSessionToken(data.data.session_token);
        
        this.setStep('otp');
        if (isResend) {
          this.showSuccessMessage('Code sent again!');
        }
      } else {
        this.setStep('error');
        this.showErrorMessage(data.message || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('[UVF Auth] Failed to request OTP:', error);
      this.setStep('error');
      this.showErrorMessage('Network error. Please check your connection.');
    }
  }

  /**
   * Verify OTP
   */
  private async verifyOtp(email: string, otp: string) {
    if (!this.config?.emailAuth?.api?.verifyOtp) return;

    this.setStep('loading');

    try {
      // Get stored session token
      const sessionToken = this.getStoredSessionToken();
      
      const response = await fetch(`${this.config.apiBase}${this.config.emailAuth.api.verifyOtp}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          session_token: sessionToken,
          email, 
          otp 
        }),
      });

      const data = await response.json();

      if (data.status && data.data) {
        // Store updated session information
        this.storeAuthTokens({
          sessionToken: data.data.session_token,
          userId: data.data.email, // Use email as userId
          videoId: data.data.video_id,
          videoSlug: data.data.video_slug,
          emailVerified: data.data.email_verified,
          accessGranted: data.data.access_granted,
          requiresPayment: data.data.requires_payment,
          accessType: data.data.access_type,
          price: data.data.price
        });
        
        this.setStep('success');
        
        // Call success callback with access information
        setTimeout(() => {
          this.opts.onAuthSuccess(data.data.email, data.data.session_token, {
            accessGranted: data.data.access_granted,
            requiresPayment: data.data.requires_payment,
            videoId: data.data.video_id,
            videoSlug: data.data.video_slug,
            price: data.data.price,
            accessType: data.data.access_type
          });
        }, 1500);
        
      } else {
        this.setStep('error');
        this.showErrorMessage(data.message || 'Invalid verification code');
      }
    } catch (error) {
      console.error('[UVF Auth] Failed to verify OTP:', error);
      this.setStep('error');
      this.showErrorMessage('Network error. Please try again.');
    }
  }

  /**
   * Store session token temporarily for OTP verification
   */
  private storeSessionToken(token: string) {
    try {
      sessionStorage.setItem('uvf_temp_session_token', token);
    } catch (error) {
      console.warn('[UVF Auth] Failed to store session token:', error);
    }
  }

  /**
   * Get stored session token
   */
  private getStoredSessionToken(): string | null {
    try {
      return sessionStorage.getItem('uvf_temp_session_token');
    } catch (error) {
      console.warn('[UVF Auth] Failed to get session token:', error);
      return null;
    }
  }

  /**
   * Store authentication tokens in localStorage
   */
  private storeAuthTokens(authData: any) {
    try {
      const storage = this.config?.emailAuth?.sessionStorage || {};
      const sessionKey = storage.tokenKey || 'uvf_session_token';
      const userIdKey = storage.userIdKey || 'uvf_user_id';

      localStorage.setItem(sessionKey, authData.sessionToken);
      localStorage.setItem(userIdKey, authData.userId);
      
      // Store additional video access information
      localStorage.setItem('uvf_video_access', JSON.stringify({
        videoId: authData.videoId,
        videoSlug: authData.videoSlug,
        emailVerified: authData.emailVerified,
        accessGranted: authData.accessGranted,
        requiresPayment: authData.requiresPayment,
        accessType: authData.accessType,
        price: authData.price
      }));

      // Clear temporary session token
      sessionStorage.removeItem('uvf_temp_session_token');
    } catch (error) {
      console.warn('[UVF Auth] Failed to store auth tokens:', error);
    }
  }

  /**
   * Start resend cooldown timer
   */
  private startResendCooldown(resendButton: HTMLButtonElement) {
    const cooldownSeconds = this.config?.emailAuth?.ui?.resendCooldown || 30;
    this.resendCooldown = cooldownSeconds;
    
    const updateButton = () => {
      if (this.resendCooldown > 0) {
        resendButton.textContent = `Resend code (${this.resendCooldown}s)`;
        resendButton.disabled = true;
        resendButton.style.opacity = '0.6';
        resendButton.style.cursor = 'not-allowed';
      } else {
        resendButton.textContent = this.config?.emailAuth?.ui?.resendButtonText || 'Resend Code';
        resendButton.disabled = false;
        resendButton.style.opacity = '1';
        resendButton.style.cursor = 'pointer';
      }
    };
    
    updateButton();
    
    this.resendTimer = window.setInterval(() => {
      this.resendCooldown--;
      updateButton();
      
      if (this.resendCooldown <= 0) {
        this.clearResendTimer();
      }
    }, 1000);
  }

  /**
   * Clear resend timer
   */
  private clearResendTimer() {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
      this.resendTimer = null;
    }
    this.resendCooldown = 0;
  }

  /**
   * Handle cancel action
   */
  private handleCancel() {
    this.closeAuthModal();
    this.opts.onAuthCancel();
  }

  /**
   * Show input error
   */
  private showInputError(input: HTMLInputElement, message: string) {
    input.style.borderColor = '#ef4444';
    input.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
    
    // Remove existing error message
    const existingError = input.parentElement?.querySelector('.uvf-auth-error');
    if (existingError) {
      existingError.remove();
    }
    
    const errorEl = document.createElement('div');
    errorEl.className = 'uvf-auth-error';
    errorEl.textContent = message;
    errorEl.style.cssText = `
      color: #fca5a5;
      font-size: 14px;
      margin-top: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    input.parentElement?.insertBefore(errorEl, input.nextSibling);
    
    // Clear error on input
    const clearError = () => {
      input.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      input.style.boxShadow = '';
      errorEl.remove();
      input.removeEventListener('input', clearError);
    };
    
    input.addEventListener('input', clearError);
  }

  /**
   * Show success message
   */
  private showSuccessMessage(message: string) {
    // Implementation for showing success toast/message
    console.log('[UVF Auth] Success:', message);
  }

  /**
   * Show error message
   */
  private showErrorMessage(message: string) {
    // Implementation for showing error toast/message
    console.error('[UVF Auth] Error:', message);
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      const storage = this.config?.emailAuth?.sessionStorage || {};
      const sessionKey = storage.tokenKey || 'uvf_session_token';
      const refreshKey = storage.refreshTokenKey || 'uvf_refresh_token';
      const userIdKey = storage.userIdKey || 'uvf_user_id';

      // Call logout API if available
      if (this.config?.emailAuth?.api?.logout) {
        const sessionToken = localStorage.getItem(sessionKey);
        if (sessionToken) {
          await fetch(`${this.config.apiBase}${this.config.emailAuth.api.logout}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`,
            },
          });
        }
      }

      // Clear local storage
      localStorage.removeItem(sessionKey);
      localStorage.removeItem(refreshKey);
      localStorage.removeItem(userIdKey);
      localStorage.removeItem(`${sessionKey}_expires`);

    } catch (error) {
      console.warn('[UVF Auth] Logout error:', error);
    }
  }

  /**
   * Cleanup on destroy
   */
  destroy() {
    this.clearResendTimer();
    if (this.overlayEl && this.overlayEl.parentElement) {
      this.overlayEl.parentElement.removeChild(this.overlayEl);
    }
    this.overlayEl = null;
  }
}
