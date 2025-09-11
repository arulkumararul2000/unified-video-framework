import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useParams } from 'react-router-dom'
import { WebPlayerView } from 'unified-video-framework/web'
import MessageBox from '../../components/CommonComponents/MessageBox.jsx'
import Defaultloadinggif from '../../layout/Others/Defaultloadinggif.js'
import './UnifiedVideoPlayer.css'

const UnifiedVideoPlayer = () => {
    const { slug } = useParams()
    const baseURL = process.env.REACT_APP_Baseurl

    const [videoData, setVideoData] = useState({
        state: "loading",
        error: null,
    })

    const [loading, setLoading] = useState(true)

    const timeToSeconds = (timeString) => {
        if (!timeString) return null;

        const parts = timeString.split(":").map(Number);

        if (parts.length === 3) {
            const [hh, mm, ss] = parts;
            return hh * 3600 + mm * 60 + ss;
        } else if (parts.length === 2) {
            const [mm, ss] = parts;
            return mm * 60 + ss;
        } else if (parts.length === 1) {
            return parts[0];
        }

        return null;
    };

    useEffect(() => {
        if (slug) {
            const fetchVideoBySlug = async () => {
                try {
                    setLoading(true)

                    const response = await axios.get(`${baseURL}/api/video/${slug}`, {
                        headers: {
                            "Content-Type": "application/json",
                            Accept: "application/json",
                        }
                    })

                    if (response?.data?.status) {
                        setVideoData(response.data.data)
                    } else {
                        setVideoData((prev) => ({
                            ...prev,
                            error: response.data?.message || "Video not found or not available for sharing"
                        }))
                    }
                } catch (error) {
                    console.error('Error fetching video:', error)
                    setVideoData((prev) => ({
                        ...prev,
                        error: error?.response?.data?.message || error?.message || "Failed to load video"
                    }))
                } finally {
                    setLoading(false)
                }
            }

            fetchVideoBySlug()
        }
    }, [slug, baseURL])

    if (loading) {
        return (
            <div className="player-loading-container" style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Defaultloadinggif />
            </div>
        )
    }

    if (videoData?.error) {
        return (
            <div className="player-error-container" style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                padding: '20px'
            }}>
                <MessageBox
                    text={`Error: ${videoData?.error}`}
                    classname="warningColor text-center my-5 d-block"
                />
            </div>
        )
    }

    const getPaywallConfig = () => {
        return {
            enabled: true,
            apiBase: baseURL,
            userId: null,
            videoId: videoData?.id,
            videoSlug: slug,
            metadata: { slug: slug },
            pricing: {
                amount: videoData?.price,
                currency: 'INR',
                description: `Watch "${videoData?.title || ''}"`,
            },
            
            // OPTION 2: Payment Link Configuration with your Cashfree API
            gateways: [
                // Remove hardcoded 'stripe' and 'cashfree' strings that cause 404
                // Use custom gateway objects instead
                {
                    id: 'cashfree',
                    name: 'Cashfree',
                    description: 'UPI, Cards, Wallets',
                    icon: '💳',
                    color: '#00d4aa'
                },
                {
                    id: 'razorpay',
                    name: 'Razorpay',
                    description: 'UPI, Netbanking',
                    icon: '🏦',
                    color: '#3395ff'
                },
                {
                    id: 'phonepe',
                    name: 'PhonePe',
                    description: 'UPI Payments',
                    icon: '📱',
                    color: '#5f2d91'
                },
                {
                    id: 'payu',
                    name: 'PayU',
                    description: 'Credit/Debit Cards',
                    icon: '💰',
                    color: '#17bf43'
                }
            ],
            
            // Payment Link Configuration using your existing Cashfree API
            paymentLink: {
                // Your existing Cashfree PPV payment endpoint
                endpoint: `${baseURL}/Front-End/cashfree/ppv-payment`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                
                // Map the payment data to your API's expected format
                mapRequest: (paymentData) => {
                    console.log('🔄 Mapping payment request for Cashfree:', paymentData);
                    
                    // Get the current page URL for success/failure redirects
                    const currentUrl = window.location.origin + window.location.pathname;
                    
                    return {
                        // Map to your API's expected fields
                        unit_amount: Math.round(paymentData.amount || 0), // Your API expects whole number
                        source_type_id: 1, // Assuming 1 for video content
                        source_id: paymentData.videoId || videoData?.id, // Use videoId from payment data or videoData
                        success_url: `${currentUrl}?payment=success&popup=1&gateway=${paymentData.gateway}`,
                        failure_url: `${currentUrl}?payment=failed&popup=1&gateway=${paymentData.gateway}`
                    };
                },
                
                // Map your API's response to the expected format
                mapResponse: (apiResponse) => {
                    console.log('🔄 Mapping Cashfree API response:', apiResponse);
                    
                    // Your API returns:
                    // {
                    //   "status": true,
                    //   "message": "Payment Link created Successfully", 
                    //   "Payment_Link_URL": "https://payments-test.cashfree.com/links/U95gstng2b7g",
                    //   "order_id": "cf_ppv_1757586777903_i0h1d94qx"
                    // }
                    
                    if (!apiResponse.status) {
                        throw new Error(apiResponse.message || 'Failed to create payment link');
                    }
                    
                    return {
                        url: apiResponse.Payment_Link_URL,
                        orderId: apiResponse.order_id
                    };
                },
                
                // Popup window configuration
                popup: {
                    width: 900,
                    height: 700,
                    features: 'popup=1,scrollbars=1,resizable=1,location=1'
                }
            },
            
            branding: {
                title: 'Unlock Premium Content',
                description: `Pay ₹${videoData?.price || '100'} to watch "${videoData?.title || ''}" instantly!!`,
                brandColor: '#ff6b35',
                paymentTitle: 'Choose your preferred payment method'
            },
            
            ui: {
                theme: 'dark',
                modal: {
                    backdrop: true,
                    closeOnBackdrop: false,
                    showCloseButton: true,
                    zIndex: 10000,
                    overlay: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        backdropFilter: 'blur(4px)'
                    }
                },
            },
            
            emailAuth: {
                enabled: true,
                skipIfAuthenticated: true,
                api: {
                    requestOtp: `/api/unified-video/send-email-otp`,
                    verifyOtp: `/api/unified-video/verify-email-otp`,
                },
                sessionStorage: {
                    tokenKey: 'uvf_session_token',
                    userIdKey: 'uvf_user_id',
                    emailKey: 'uvf_user_email',
                },
                requestPayload: {
                    video_slug: slug,
                },
                ui: {
                    title: "Sign in to continue watching",
                    description: `Enter your email to receive a verification code and unlock "${videoData?.title || 'this video'}"`,
                    emailPlaceholder: "Enter your email address",
                    otpPlaceholder: "Enter 6-digit verification code",
                    submitButtonText: "Send Verification Code",
                    resendButtonText: "Resend Code",
                    resendCooldown: 30,
                    verifyButtonText: "Verify & Watch",
                    brandColor: "#ff6b35",
                },
                validation: {
                    otpLength: 6,
                    otpTimeout: 600,
                    rateLimiting: {
                        maxAttempts: 5,
                        windowMinutes: 60,
                    },
                },
            }
        };
    };

    // Handle URL parameters for payment success/failure (from popup redirects)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentStatus = urlParams.get('payment');
        const isPopup = urlParams.get('popup');
        const gateway = urlParams.get('gateway');
        const orderId = urlParams.get('order_id');

        if (paymentStatus && isPopup) {
            // This page is loaded in a popup window after payment
            console.log(`🔔 Payment ${paymentStatus} in popup`, { gateway, orderId });

            // Send message to parent window
            if (window.opener) {
                window.opener.postMessage({
                    type: 'uvfCheckout',
                    status: paymentStatus, // 'success', 'failed', 'cancel'
                    orderId: orderId,
                    gatewayId: gateway
                }, '*');
                
                // Close the popup
                window.close();
            }
        }
    }, []);

    return (
        <>
            {/* Ensure payment modal CSS is available */}
            <style>{`
                .uvf-paywall-overlay {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    z-index: 99999 !important;
                    background: rgba(0, 0, 0, 0.8) !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .uvf-paywall-modal {
                    background: #1a1a1a !important;
                    border-radius: 12px !important;
                    padding: 24px !important;
                    max-width: 500px !important;
                    width: 90% !important;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
                    color: white !important;
                }
                .uvf-gateway-btn {
                    transition: all 0.2s ease !important;
                }
                .uvf-gateway-btn:hover {
                    transform: translateY(-2px) !important;
                    box-shadow: 0 8px 20px rgba(0,0,0,0.3) !important;
                }
                .uvf-payment-button {
                    background: #ff6b35 !important;
                    color: white !important;
                    border: none !important;
                    padding: 12px 24px !important;
                    border-radius: 8px !important;
                    font-size: 16px !important;
                    cursor: pointer !important;
                    width: 100% !important;
                    margin-top: 16px !important;
                    transition: background 0.2s ease !important;
                }
                .uvf-payment-button:hover {
                    background: #ff8c42 !important;
                }
            `}</style>
            
            <div className="video-player-page" style={{ 
                height: '100vh', 
                maxHeight: '100vh', 
                backgroundColor: '#000', 
                display: 'flex', 
                flexDirection: 'column', 
                overflow: 'hidden' 
            }}>
                <WebPlayerView
                    // url={videoData?.video_url || 'https://storageservice.flicknexs.com/storage/node-org/hls/593c63f7-9646-4a62-9e44-ea5345591652/master.m3u8'}
                    url={'https://storageservice.flicknexs.com/storage/node-org/hls/593c63f7-9646-4a62-9e44-ea5345591652/master.m3u8'}
                    freeDuration={timeToSeconds(videoData?.free_duration)}

                    responsive={{
                        enabled: true,
                        aspectRatio: 16 / 9,
                        maxWidth: '100vw',
                        maxHeight: '100vh',
                    }}

                    style={{
                        width: '100%',
                        height: '100%',
                        maxWidth: '100vw',
                        maxHeight: '100vh',
                        borderRadius: 0
                    }}

                    paywall={getPaywallConfig()}

                    playerTheme={{
                        accent: '#ff6b35',
                        accent2: '#ff8c42',
                        iconColor: '#ffffff',
                        textPrimary: '#ffffff',
                        textSecondary: '#cccccc',
                        overlayStrong: 'rgba(0,0,0,0.95)',
                    }}

                    autoPlay={false}
                    muted={false}
                    enableAdaptiveBitrate={true}
                    debug={true} // Keep debug enabled to see flow logs

                    title={videoData?.title}
                    poster={videoData?.default_image}

                    watermark={{
                        text: videoData?.title || 'Video',
                        position: 'top-right',
                        opacity: 0.3,
                    }}

                    onReady={(player) => {
                        window.player = player
                        console.log('🎬 Player ready:', player)
                    }}
                    
                    onError={(error) => {
                        console.error('❌ Player error:', error)
                    }}
                    
                    onVideoStart={() => {
                        console.log('▶️ Video playback started')
                    }}
                    
                    onVideoEnd={() => {
                        console.log('⏹️ Video playback ended')
                    }}
                    
                    onPlay={() => {
                        console.log('▶️ Video play event')
                    }}
                    
                    onPause={() => {
                        console.log('⏸️ Video pause event')
                    }}
                    
                    onFreePreviewEnded={() => {
                        console.log('⏰ Free preview ended - email auth + paywall should trigger automatically')
                    }}

                    // Email auth event handlers
                    onAuthStart={(email) => {
                        console.log('🔐 Email auth started for:', email)
                    }}
                    
                    onOtpSent={(response) => {
                        console.log('📧 OTP sent successfully:', response)
                    }}
                    
                    onAuthSuccess={(userData) => {
                        console.log('✅ Email auth successful:', userData)
                        if (userData) {
                            sessionStorage.setItem('uvf_user_id', userData.id || userData.user_id)
                            sessionStorage.setItem('uvf_user_email', userData.email)
                            if (userData.token) {
                                sessionStorage.setItem('uvf_session_token', userData.token)
                            }
                        }
                    }}
                    
                    onAuthError={(error) => {
                        console.error('❌ Email auth error:', error)
                    }}

                    // Payment event handlers using the new payment link system
                    onPaymentStart={(gateway, paymentData) => {
                        console.log('💳 Payment started via Payment Link API:', { gateway, paymentData })
                    }}
                    
                    onPaymentSuccess={(gateway, paymentResult) => {
                        console.log('💰 Payment successful via Payment Link:', { gateway, paymentResult })
                        
                        // Handle successful payment
                        alert(`🎉 Payment successful via ${gateway.name}!\n\nOrder ID: ${paymentResult.orderId}\nYou can now watch the full video!`)
                        
                        // Optionally refresh user access or update UI
                        // You might want to call an API to verify the payment on your backend
                    }}
                    
                    onPaymentError={(gateway, error) => {
                        console.error('❌ Payment failed:', { gateway, error })
                        
                        // Handle payment error
                        const errorMessage = error?.message || error || 'Unknown error';
                        alert(`❌ Payment failed via ${gateway.name}\n\nError: ${errorMessage}\n\nPlease try again or contact support.`)
                    }}
                    
                    onPaymentCancel={(gateway) => {
                        console.log('🚫 Payment cancelled by user:', gateway)
                        
                        // Handle payment cancellation - user can try again
                        console.log(`User cancelled ${gateway.name} payment - returning to gateway selection`)
                    }}
                />
            </div>
        </>
    )
}

export default UnifiedVideoPlayer
