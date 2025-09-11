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
            
            // 🔥 CRITICAL FIX: Use gateway OBJECTS, NOT strings
            // ❌ WRONG: gateways: ['cashfree', 'stripe'] - This causes 404!
            // ✅ CORRECT: Use objects with paymentLink config
            gateways: [
                {
                    id: 'cashfree',
                    name: 'Cashfree Payment',
                    description: 'UPI, Cards, Net Banking',
                    icon: '💳',
                    color: '#00d4aa'
                }
                // Add more gateways as objects, not strings!
            ],
            
            // 🚀 Payment Link Configuration - This is the key to avoid 404s
            paymentLink: {
                // Use YOUR working API endpoint
                endpoint: `${baseURL}/Front-End/cashfree/ppv-payment`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                
                // Map to your API's request format
                mapRequest: (paymentData) => {
                    console.log('🔄 Mapping payment request:', paymentData);
                    
                    return {
                        unit_amount: Math.round(paymentData.amount || videoData?.price || 100),
                        source_type_id: 1,
                        source_id: paymentData.videoId || videoData?.id,
                        success_url: `${window.location.origin}${window.location.pathname}?payment=success&popup=1`,
                        failure_url: `${window.location.origin}${window.location.pathname}?payment=failed&popup=1`
                    };
                },
                
                // Map your API's response format
                mapResponse: (apiResponse) => {
                    console.log('✅ API Response:', apiResponse);
                    
                    if (!apiResponse.status) {
                        throw new Error(apiResponse.message || 'Failed to create payment link');
                    }
                    
                    return {
                        url: apiResponse.Payment_Link_URL,
                        orderId: apiResponse.order_id
                    };
                },
                
                popup: {
                    width: 900,
                    height: 700,
                    features: 'popup=1,scrollbars=1,resizable=1'
                }
            },
            
            branding: {
                title: 'Unlock Premium Content',
                description: `Pay ₹${videoData?.price || '100'} to watch "${videoData?.title || ''}" instantly!!`,
                brandColor: '#ff6b35',
                paymentTitle: 'Choose a payment method'
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

    return (
        <>
            {/* Enhanced CSS for better payment modal */}
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
                    background: linear-gradient(135deg, #00d4aa, #00b894) !important;
                    border: none !important;
                    color: white !important;
                    border-radius: 12px !important;
                    padding: 16px 20px !important;
                    cursor: pointer !important;
                    font-family: inherit !important;
                    min-width: 140px !important;
                }
                .uvf-gateway-btn:hover {
                    transform: translateY(-2px) !important;
                    box-shadow: 0 8px 20px rgba(0, 212, 170, 0.3) !important;
                }
                .uvf-btn-primary {
                    background: linear-gradient(135deg, #ff6b35, #ff8c42) !important;
                    color: white !important;
                    border: none !important;
                    padding: 12px 24px !important;
                    border-radius: 8px !important;
                    font-size: 16px !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                }
                .uvf-btn-primary:hover {
                    background: linear-gradient(135deg, #ff8c42, #ff6b35) !important;
                    transform: translateY(-1px) !important;
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
                    debug={true}

                    title={videoData?.title}
                    poster={videoData?.default_image}

                    watermark={{
                        text: videoData?.title || 'Video',
                        position: 'top-right',
                        opacity: 0.3,
                    }}

                    onReady={(player) => {
                        window.player = player
                        console.log('🎬 Player ready with Payment Link Configuration')
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
                    })
                    
                    onFreePreviewEnded={() => {
                        console.log('⏰ Free preview ended - Payment Link flow will trigger')
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

                    // Payment event handlers - these will now use Payment Link Configuration
                    onPaymentStart={(gateway, paymentData) => {
                        console.log('💳 Payment Link API called:', { 
                            gateway: gateway.name, 
                            endpoint: `${baseURL}/Front-End/cashfree/ppv-payment`,
                            amount: paymentData.amount 
                        })
                    }}
                    
                    onPaymentSuccess={(gateway, paymentResult) => {
                        console.log('💰 Payment successful via Payment Link:', paymentResult)
                        alert(`🎉 Payment successful!\n\nOrder ID: ${paymentResult.orderId}\nYou can now watch the full video!`)
                    }}
                    
                    onPaymentError={(gateway, error) => {
                        console.error('❌ Payment failed:', { gateway: gateway.name, error })
                        alert(`❌ Payment failed via ${gateway.name}\n\nError: ${error.message || error}\n\nPlease try again.`)
                    }}
                    
                    onPaymentCancel={(gateway) => {
                        console.log('🚫 Payment cancelled:', gateway.name)
                    }}
                />
            </div>
        </>
    )
}

export default UnifiedVideoPlayer
