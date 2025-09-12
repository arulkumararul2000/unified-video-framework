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
        const urlParams = new URLSearchParams(window.location.search);
        const paymentStatus = urlParams.get('payment');
        const isPopup = urlParams.get('popup');
        const gateway = urlParams.get('gateway');
        const orderId = urlParams.get('order_id');

        if (paymentStatus && isPopup) {
            console.log(`🔔 Payment ${paymentStatus} in popup`, { gateway, orderId });
            if (window.opener) {
                window.opener.postMessage({
                    type: 'uvfCheckout',
                    status: paymentStatus,
                    orderId: orderId,
                    gatewayId: gateway
                }, '*');
                window.close();
            }
        }
    }, []);
    
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
                height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <Defaultloadinggif />
            </div>
        )
    }

    if (videoData?.error) {
        return (
            <div className="player-error-container" style={{
                height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', padding: '20px'
            }}>
                <MessageBox text={`Error: ${videoData?.error}`} classname="warningColor text-center my-5 d-block" />
            </div>
        )
    }

    const access_token = localStorage.getItem("access_token");
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
            
            gateways: [
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
                }
            ],
            
            // ✅ CORRECT FORMAT - What your backend actually expects (based on 400 error)
            paymentLink: {
                endpoint: `${baseURL}/Front-End/cashfree/ppv-payment`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${access_token}`
                },
                
                // ✅ Maps to YOUR BACKEND'S expected format (OLD FORMAT)
                mapRequest: (paymentData) => {
                    console.log('🔄 FINAL WORKING - OLD FORMAT mapping:', paymentData);
                    
                    const currentUrl = window.location.origin + window.location.pathname;
                    const amount = Math.round(paymentData.amount || videoData?.price || 100);
                    
                    // ✅ EXACT field names your backend validation requires
                    const requestBody = {
                        // Required fields from 400 error messages
                        unit_amount: amount, // ✅ "Unit Amount is required" 
                        source_type_id: 1, // ✅ "Source type is required"
                        source_id: String(paymentData.videoId || videoData?.id), // ✅ "Source ID is required"
                        success_url: `${currentUrl}?payment=success&popup=1&gateway=${paymentData.metadata?.gateway || 'cashfree'}&order_id={order_id}`, // ✅ "Success URL is required"
                        failure_url: `${currentUrl}?payment=failed&popup=1&gateway=${paymentData.metadata?.gateway || 'cashfree'}&order_id={order_id}`, // ✅ "Failure URL is required"
                        
                        // Additional fields your backend might use
                        currency: paymentData.currency || 'INR',
                        video_id: paymentData.videoId || videoData?.id,
                        video_slug: slug,
                        user_email: sessionStorage.getItem('uvf_user_email') || paymentData.userId || 'guest@example.com',
                        user_id: sessionStorage.getItem('uvf_user_id') || paymentData.userId || 'guest',
                        gateway: paymentData.metadata?.gateway || 'cashfree',
                        description: `Payment for ${videoData?.title || 'Premium Video'}`,
                        
                        // Customer details if backend expects them
                        customer_name: sessionStorage.getItem('uvf_user_email')?.split('@')[0] || 'Guest User',
                        customer_email: sessionStorage.getItem('uvf_user_email') || paymentData.userId || 'guest@example.com',
                        customer_phone: '9999999999'
                    };
                    
                    console.log('📤 FINAL request body to backend:', requestBody);
                    return requestBody;
                },
                
                mapResponse: (apiResponse) => {
                    console.log('🔄 FINAL - API response:', apiResponse);
                    
                    if (!apiResponse.status) {
                        const errorMsg = apiResponse.message || 
                                       (apiResponse.errors && apiResponse.errors.map(e => `${e.path}: ${e.msg}`).join(', ')) ||
                                       'Failed to create payment link';
                        throw new Error(errorMsg);
                    }
                    
                    return {
                        url: apiResponse.Payment_Link_URL || apiResponse.payment_url || apiResponse.link_url,
                        orderId: apiResponse.order_id || apiResponse.orderId || apiResponse.link_id
                    };
                },
                
                popup: { width: 900, height: 700, features: 'popup=1,scrollbars=1,resizable=1,location=1' }
            },
            
            branding: {
                title: 'Unlock Premium Content',
                description: `Pay ₹${videoData?.price || '100'} to watch "${videoData?.title || ''}" instantly!`,
                brandColor: '#ff6b35',
                paymentTitle: 'Choose your preferred payment method'
            },
            
            ui: { theme: 'dark', modal: { backdrop: true, closeOnBackdrop: false, showCloseButton: true, zIndex: 10000 } },
            
            emailAuth: {
                enabled: true,
                skipIfAuthenticated: true,
                api: { requestOtp: `/api/unified-video/send-email-otp`, verifyOtp: `/api/unified-video/verify-email-otp` },
                sessionStorage: { tokenKey: 'uvf_session_token', userIdKey: 'uvf_user_id', emailKey: 'uvf_user_email' },
                requestPayload: { video_slug: slug },
                ui: {
                    title: "Sign in to continue watching",
                    description: `Enter your email to receive a verification code and unlock "${videoData?.title || 'this video'}"`,
                    emailPlaceholder: "Enter your email address",
                    otpPlaceholder: "Enter 6-digit verification code",
                    submitButtonText: "Send Verification Code",
                    resendButtonText: "Resend Code",
                    resendCooldown: 30,
                    verifyButtonText: "Verify & Watch",
                    brandColor: "#ff6b35"
                },
                validation: { otpLength: 6, otpTimeout: 600, rateLimiting: { maxAttempts: 5, windowMinutes: 60 } }
            }
        };
    };

    return (
        <>
            <style>{`
                .uvf-paywall-overlay {
                    position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important;
                    z-index: 99999 !important; background: rgba(0, 0, 0, 0.8) !important; display: flex !important;
                    align-items: center !important; justify-content: center !important;
                }
                .uvf-paywall-modal {
                    background: #1a1a1a !important; border-radius: 12px !important; padding: 24px !important;
                    max-width: 500px !important; width: 90% !important; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
                    color: white !important;
                }
                .uvf-gateway-btn { transition: all 0.2s ease !important; }
                .uvf-gateway-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 20px rgba(0,0,0,0.3) !important; }
            `}</style>
            
            <div className="video-player-page" style={{ height: '100vh', maxHeight: '100vh', backgroundColor: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <WebPlayerView
                    url={'https://storageservice.flicknexs.com/storage/node-org/hls/593c63f7-9646-4a62-9e44-ea5345591652/master.m3u8'}
                    freeDuration={timeToSeconds(videoData?.free_duration)}
                    responsive={{ enabled: true, aspectRatio: 16 / 9, maxWidth: '100vw', maxHeight: '100vh' }}
                    style={{ width: '100%', height: '100%', maxWidth: '100vw', maxHeight: '100vh', borderRadius: 0 }}
                    paywall={getPaywallConfig()}
                    playerTheme={{ accent: '#ff6b35', accent2: '#ff8c42', iconColor: '#ffffff', textPrimary: '#ffffff', textSecondary: '#cccccc', overlayStrong: 'rgba(0,0,0,0.95)' }}
                    autoPlay={false}
                    muted={false}
                    enableAdaptiveBitrate={true}
                    debug={true}
                    title={videoData?.title}
                    poster={videoData?.default_image}
                    watermark={{ text: videoData?.title || 'Video', position: 'top-right', opacity: 0.3 }}
                    
                    onReady={(player) => { window.player = player; console.log('🎬 Player ready:', player) }}
                    onError={(error) => console.error('❌ Player error:', error)}
                    onFreePreviewEnded={() => console.log('⏰ Free preview ended')}
                    
                    onAuthStart={(email) => console.log('🔐 Email auth started for:', email)}
                    onOtpSent={(response) => console.log('📧 OTP sent successfully:', response)}
                    onAuthSuccess={(userData) => {
                        console.log('✅ Email auth successful:', userData)
                        if (userData) {
                            sessionStorage.setItem('uvf_user_id', userData.id || userData.user_id)
                            sessionStorage.setItem('uvf_user_email', userData.email)
                            if (userData.token) sessionStorage.setItem('uvf_session_token', userData.token)
                        }
                    }}
                    onAuthError={(error) => console.error('❌ Email auth error:', error)}
                    
                    onPaymentStart={(gateway, paymentData) => console.log('💳 FINAL WORKING - Payment started:', { gateway, paymentData })}
                    onPaymentSuccess={(gateway, paymentResult) => {
                        console.log('💰 FINAL WORKING - Payment successful:', { gateway, paymentResult })
                        alert(`🎉 Payment successful via ${gateway.name}!\n\nOrder ID: ${paymentResult.orderId}\nYou can now watch the full video!`)
                    }}
                    onPaymentError={(gateway, error) => {
                        console.error('❌ FINAL WORKING - Payment failed:', { gateway, error })
                        const errorMessage = error?.message || error || 'Unknown error';
                        alert(`❌ Payment failed via ${gateway.name}\n\nError: ${errorMessage}\n\nPlease try again or contact support.`)
                    }}
                    onPaymentCancel={(gateway) => console.log('🚫 FINAL WORKING - Payment cancelled:', gateway)}
                />
            </div>
        </>
    )
}

export default UnifiedVideoPlayer
