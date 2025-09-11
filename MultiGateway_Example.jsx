import React, { useState, useEffect } from 'react'
import { WebPlayerView } from 'unified-video-framework/web'

const MultiGatewayExample = () => {
    // OPTION 1: Use custom payment handlers (recommended for multiple providers)
    const getPaywallConfigWithCustomHandlers = () => ({
        enabled: true,
        apiBase: 'https://your-api.com',
        userId: null,
        videoId: 'video123',
        pricing: { amount: 100, currency: 'INR' },
        
        // Define multiple custom gateways
        gateways: [
            {
                id: 'cashfree',
                name: 'Cashfree',
                description: 'UPI, Cards, Net Banking',
                icon: '💳',
                color: '#00d4aa'
            },
            {
                id: 'stripe',
                name: 'Stripe', 
                description: 'Credit/Debit Cards',
                icon: '💳',
                color: '#6772e5'
            },
            {
                id: 'paypal',
                name: 'PayPal',
                description: 'PayPal Wallet', 
                icon: '🅿️',
                color: '#0070ba'
            },
            {
                id: 'razorpay',
                name: 'Razorpay',
                description: 'All Payment Methods',
                icon: '💰',
                color: '#3395ff'
            }
        ],
        
        // NO paymentLink config - use custom handlers instead
        // paymentLink: { ... }, // ❌ Don't use this with multiple providers
        
        // Custom payment handlers - each gateway can have different logic
        onPaymentRequested: async (gateway, paymentData) => {
            console.log(`🚀 Payment requested for ${gateway.id}:`, { gateway, paymentData })
            
            try {
                // Route to different endpoints based on gateway
                let endpoint = '';
                let requestBody = {};
                
                switch (gateway.id) {
                    case 'cashfree':
                        endpoint = '/api/payments/cashfree/create-link'
                        requestBody = {
                            link_id: `video_${paymentData.videoId}_${Date.now()}`,
                            link_amount: paymentData.amount.toFixed(2),
                            link_currency: paymentData.currency,
                            link_purpose: `Video Payment via ${gateway.name}`,
                            customer_details: {
                                customer_email: sessionStorage.getItem('uvf_user_email') || 'guest@example.com',
                                customer_phone: '9999999999'
                            }
                        }
                        break
                        
                    case 'stripe':
                        endpoint = '/api/payments/stripe/create-session'
                        requestBody = {
                            amount: paymentData.amount * 100, // Stripe uses cents
                            currency: paymentData.currency.toLowerCase(),
                            video_id: paymentData.videoId,
                            success_url: `${window.location.origin}${window.location.pathname}?payment=success&popup=1&gateway=stripe`,
                            cancel_url: `${window.location.origin}${window.location.pathname}?payment=failed&popup=1&gateway=stripe`
                        }
                        break
                        
                    case 'paypal':
                        endpoint = '/api/payments/paypal/create-order'
                        requestBody = {
                            intent: 'CAPTURE',
                            amount: {
                                currency_code: paymentData.currency,
                                value: paymentData.amount.toFixed(2)
                            },
                            video_id: paymentData.videoId,
                            return_url: `${window.location.origin}${window.location.pathname}?payment=success&popup=1&gateway=paypal`,
                            cancel_url: `${window.location.origin}${window.location.pathname}?payment=failed&popup=1&gateway=paypal`
                        }
                        break
                        
                    case 'razorpay':
                        endpoint = '/api/payments/razorpay/create-order'
                        requestBody = {
                            amount: paymentData.amount * 100, // Razorpay uses paisa
                            currency: paymentData.currency,
                            receipt: `video_${paymentData.videoId}_${Date.now()}`,
                            notes: {
                                video_id: paymentData.videoId,
                                gateway: 'razorpay'
                            }
                        }
                        break
                        
                    default:
                        throw new Error(`Unsupported gateway: ${gateway.id}`)
                }
                
                // Make API call to create payment
                const response = await fetch(`https://your-api.com${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                })
                
                const data = await response.json()
                
                if (!response.ok || !data.status) {
                    throw new Error(data.message || `${gateway.name} payment creation failed`)
                }
                
                // Open payment popup with provider-specific URL
                const paymentUrl = data.payment_url || data.url || data.checkout_url
                if (paymentUrl) {
                    const popup = window.open(
                        paymentUrl,
                        'payment-popup',
                        'width=800,height=600,scrollbars=yes,resizable=yes'
                    )
                    
                    // Monitor popup for completion
                    const checkClosed = setInterval(() => {
                        if (popup.closed) {
                            clearInterval(checkClosed)
                            console.log(`Payment popup closed for ${gateway.name}`)
                        }
                    }, 1000)
                } else {
                    throw new Error(`No payment URL received from ${gateway.name}`)
                }
                
            } catch (error) {
                console.error(`❌ ${gateway.name} payment error:`, error)
                alert(`Payment failed for ${gateway.name}: ${error.message}`)
            }
        },
        
        onPaymentSuccess: (gateway, result) => {
            console.log(`✅ Payment successful via ${gateway.name}:`, result)
            alert(`🎉 Payment successful via ${gateway.name}!\nTransaction: ${result.orderId || result.transactionId || 'completed'}`)
        },
        
        onPaymentError: (gateway, error) => {
            console.error(`❌ Payment error via ${gateway.name}:`, error)
            alert(`Payment failed via ${gateway.name}: ${error.message || 'Unknown error'}`)
        },
        
        onPaymentCancel: (gateway) => {
            console.log(`🚫 Payment cancelled via ${gateway.name}`)
            // User can try again with same or different gateway
        }
    })

    // OPTION 2: Multiple paymentLink configurations (if you want same endpoint for all)
    const getPaywallConfigWithUnifiedEndpoint = () => ({
        enabled: true,
        apiBase: 'https://your-api.com',
        
        gateways: [
            { id: 'cashfree', name: 'Cashfree', icon: '💳', color: '#00d4aa' },
            { id: 'stripe', name: 'Stripe', icon: '💳', color: '#6772e5' },
            { id: 'paypal', name: 'PayPal', icon: '🅿️', color: '#0070ba' }
        ],
        
        // Single endpoint that handles all gateways
        paymentLink: {
            endpoint: '/api/payments/unified/create-payment',
            method: 'POST',
            
            mapRequest: (paymentData) => ({
                // Gateway ID is passed to help backend route correctly
                gateway: paymentData.metadata.gateway, // 'cashfree', 'stripe', 'paypal'
                amount: paymentData.amount,
                currency: paymentData.currency,
                video_id: paymentData.videoId,
                user_id: paymentData.userId,
                return_url: `${window.location.origin}${window.location.pathname}?payment=success&popup=1&gateway=${paymentData.metadata.gateway}`,
                cancel_url: `${window.location.origin}${window.location.pathname}?payment=failed&popup=1&gateway=${paymentData.metadata.gateway}`
            }),
            
            mapResponse: (response) => ({
                url: response.payment_url,
                orderId: response.order_id
            })
        }
    })

    return (
        <div style={{ height: '100vh' }}>
            <WebPlayerView
                url="https://example.com/video.m3u8"
                freeDuration={30}
                
                // Use OPTION 1 for multiple providers with different endpoints
                paywall={getPaywallConfigWithCustomHandlers()}
                
                // OR use OPTION 2 for single unified endpoint
                // paywall={getPaywallConfigWithUnifiedEndpoint()}
                
                style={{ width: '100%', height: '100%' }}
                autoPlay={false}
                muted={false}
                
                onReady={(player) => console.log('Player ready:', player)}
                onError={(error) => console.error('Player error:', error)}
                
                // These will be called based on your payment handler choice
                onPaymentStart={(gateway, data) => {
                    console.log(`💳 Payment started: ${gateway.name}`, data)
                }}
                
                onPaymentSuccess={(gateway, result) => {
                    console.log(`✅ Payment completed: ${gateway.name}`, result)
                }}
                
                onPaymentError={(gateway, error) => {
                    console.error(`❌ Payment failed: ${gateway.name}`, error)
                }}
                
                onPaymentCancel={(gateway) => {
                    console.log(`🚫 Payment cancelled: ${gateway.name}`)
                }}
            />
        </div>
    )
}

export default MultiGatewayExample
