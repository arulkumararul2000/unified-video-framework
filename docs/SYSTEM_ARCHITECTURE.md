# VdoCipher Clone - System Architecture

## High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Client Applications                        │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│     Web      │   iOS/Android │   Smart TV   │   OTT Devices        │
│   (React)    │   (Native)    │  (Tizen/webOS)│  (Roku/FireTV)      │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬────────────────┘
       │              │              │              │
       └──────────────┴──────────────┴──────────────┘
                             │
                    ┌────────▼────────┐
                    │   CDN Layer      │
                    │ (CloudFront)     │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼────────┐
│  API Gateway   │  │  Video Delivery │  │  DRM License   │
│   (Kong/AWS)   │  │   (HLS/DASH)    │  │    Server      │
└───────┬────────┘  └────────┬────────┘  └───────┬────────┘
        │                    │                    │
┌───────▼────────────────────▼────────────────────▼────────┐
│                   Microservices Layer                     │
├────────────┬───────────┬──────────┬───────────┬─────────┤
│   Auth     │  Video    │ Analytics│  Billing  │ Admin   │
│  Service   │ Processing│  Service │  Service  │ Service │
└────────────┴───────────┴──────────┴───────────┴─────────┘
                             │
┌────────────────────────────▼──────────────────────────────┐
│                    Data Layer                              │
├──────────────┬──────────────┬──────────────┬─────────────┤
│  PostgreSQL  │    Redis     │  ClickHouse  │     S3      │
│  (Metadata)  │   (Cache)    │ (Analytics)  │  (Storage)  │
└──────────────┴──────────────┴──────────────┴─────────────┘
```

## Component Architecture

### 1. Client SDKs Architecture

```typescript
// Core Player Interface
interface VdoCipherPlayer {
  // Initialization
  init(config: PlayerConfig): Promise<void>;
  
  // Playback Control
  load(videoId: string, otp: string): Promise<void>;
  play(): void;
  pause(): void;
  seek(time: number): void;
  
  // DRM
  configureDRM(license: DRMConfig): void;
  
  // Analytics
  trackEvent(event: AnalyticsEvent): void;
  
  // Watermarking
  setWatermark(config: WatermarkConfig): void;
  
  // Events
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
}
```

### 2. Backend Services Architecture

#### 2.1 Authentication Service
```yaml
Service: auth-service
Technology: Node.js + Express
Database: PostgreSQL + Redis
Features:
  - JWT token generation
  - OAuth 2.0 support
  - SSO integration
  - API key management
  - Session management
  
Endpoints:
  POST /auth/login
  POST /auth/refresh
  POST /auth/logout
  GET  /auth/verify
  POST /auth/otp/generate
```

#### 2.2 Video Processing Service
```yaml
Service: video-processor
Technology: Python + FFmpeg + Celery
Storage: S3 + CloudFront
Queue: RabbitMQ

Pipeline:
  1. Upload Handler
     - Chunked upload support
     - Resume capability
     - Virus scanning
     
  2. Transcoding Pipeline
     - Multi-resolution encoding
     - Adaptive bitrate variants
     - Thumbnail generation
     - Subtitle extraction
     
  3. DRM Packaging
     - Widevine encryption
     - FairPlay packaging
     - PlayReady support
     
  4. CDN Distribution
     - S3 upload
     - CloudFront invalidation
     - Multi-region replication
```

#### 2.3 DRM License Service
```yaml
Service: drm-license-server
Technology: Node.js + Express
Providers: 
  - Widevine (Google)
  - FairPlay (Apple)
  - PlayReady (Microsoft)
  
Flow:
  1. Client requests license with token
  2. Validate token and permissions
  3. Check device limits
  4. Generate license with restrictions
  5. Return encrypted license
  6. Log license issuance
```

#### 2.4 Analytics Service
```yaml
Service: analytics-engine
Technology: Node.js + Kafka + ClickHouse
Processing: Apache Spark

Data Pipeline:
  1. Event Collection
     - Client SDK events
     - Server-side events
     - CDN logs
     
  2. Real-time Processing
     - Kafka streams
     - Event aggregation
     - Anomaly detection
     
  3. Storage
     - ClickHouse for time-series
     - PostgreSQL for metadata
     - S3 for raw logs
     
  4. Reporting
     - Real-time dashboards
     - Historical analysis
     - Custom reports
```

### 3. Database Schema

#### 3.1 Core Tables
```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50),
    subscription_id UUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Videos table
CREATE TABLE videos (
    id UUID PRIMARY KEY,
    title VARCHAR(500),
    description TEXT,
    duration INTEGER,
    status VARCHAR(50), -- processing, ready, error
    drm_enabled BOOLEAN,
    watermark_config JSONB,
    metadata JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Video Variants table
CREATE TABLE video_variants (
    id UUID PRIMARY KEY,
    video_id UUID REFERENCES videos(id),
    resolution VARCHAR(20), -- 240p, 480p, 720p, 1080p
    bitrate INTEGER,
    codec VARCHAR(50),
    file_url TEXT,
    file_size BIGINT,
    created_at TIMESTAMP
);

-- Playback Sessions table
CREATE TABLE playback_sessions (
    id UUID PRIMARY KEY,
    video_id UUID REFERENCES videos(id),
    user_id UUID REFERENCES users(id),
    otp VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    watch_duration INTEGER,
    events JSONB
);

-- DRM Licenses table
CREATE TABLE drm_licenses (
    id UUID PRIMARY KEY,
    video_id UUID REFERENCES videos(id),
    user_id UUID REFERENCES users(id),
    device_id VARCHAR(255),
    license_type VARCHAR(50), -- widevine, fairplay, playready
    issued_at TIMESTAMP,
    expires_at TIMESTAMP,
    restrictions JSONB
);
```

### 4. Security Architecture

#### 4.1 Video Security Layers
```
┌─────────────────────────────────────────┐
│         Application Layer               │
│  - JWT Authentication                   │
│  - API Rate Limiting                    │
│  - CORS Policies                        │
├─────────────────────────────────────────┤
│         Content Protection              │
│  - DRM Encryption                       │
│  - Dynamic Watermarking                 │
│  - Screen Recording Block               │
├─────────────────────────────────────────┤
│         Network Security                │
│  - HTTPS/TLS 1.3                       │
│  - Signed URLs                         │
│  - IP Whitelisting                     │
├─────────────────────────────────────────┤
│         Infrastructure Security         │
│  - VPC Isolation                       │
│  - Security Groups                     │
│  - WAF Rules                           │
└─────────────────────────────────────────┘
```

#### 4.2 Token-Based Access Flow
```
Client                API Gateway            Auth Service         Video Service
  │                       │                       │                     │
  ├──Login Request───────▶│                       │                     │
  │                       ├──Validate─────────────▶│                     │
  │                       │                       ├─Generate JWT/OTP────▶│
  │◀──JWT + OTP───────────┤◀──────────────────────┤                     │
  │                       │                       │                     │
  ├──Play Video + OTP────▶│                       │                     │
  │                       ├──Verify OTP───────────────────────────────▶│
  │                       │                       │                     ├─Generate Signed URL
  │◀──Video URL───────────┤◀──────────────────────────────────────────┤
  │                       │                       │                     │
```

### 5. Watermarking Implementation

#### 5.1 Client-Side Watermarking
```javascript
class DynamicWatermark {
  constructor(player, config) {
    this.player = player;
    this.config = config;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }
  
  render() {
    // Position calculation
    const position = this.calculatePosition();
    
    // Draw watermark
    this.ctx.fillStyle = `rgba(255,255,255,${this.config.opacity})`;
    this.ctx.font = `${this.config.fontSize}px Arial`;
    this.ctx.fillText(this.config.text, position.x, position.y);
    
    // Apply to video
    this.overlay();
    
    // Schedule next position change
    if (this.config.moving) {
      setTimeout(() => this.render(), this.config.interval);
    }
  }
  
  calculatePosition() {
    // Random or fixed position based on config
    if (this.config.random) {
      return {
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height
      };
    }
    return this.config.position;
  }
}
```

#### 5.2 Server-Side Watermarking
```python
import ffmpeg
from PIL import Image, ImageDraw, ImageFont

class ServerWatermark:
    def add_watermark(self, video_path, watermark_text, user_info):
        """Add forensic watermark to video"""
        
        # Create watermark image
        watermark = self.create_watermark_image(
            text=f"{watermark_text}\n{user_info['email']}\n{user_info['ip']}",
            size=(300, 100),
            opacity=0.3
        )
        
        # Apply watermark using FFmpeg
        output = ffmpeg.input(video_path).overlay(
            ffmpeg.input(watermark),
            x='random(0,W-w)',  # Random X position
            y='random(0,H-h)',  # Random Y position
            enable=f'lt(mod(t,10),5)'  # Show for 5 seconds every 10 seconds
        )
        
        return output.output('watermarked.mp4').run()
```

### 6. Analytics Architecture

#### 6.1 Event Collection Schema
```typescript
interface VideoAnalyticsEvent {
  // Event metadata
  eventId: string;
  timestamp: number;
  sessionId: string;
  
  // User info
  userId: string;
  deviceId: string;
  
  // Video info
  videoId: string;
  videoTitle: string;
  
  // Event details
  eventType: 'play' | 'pause' | 'seek' | 'end' | 'error' | 'quality_change';
  eventData: {
    currentTime?: number;
    duration?: number;
    seekFrom?: number;
    seekTo?: number;
    quality?: string;
    bandwidth?: number;
    bufferLength?: number;
    droppedFrames?: number;
    errorCode?: string;
    errorMessage?: string;
  };
  
  // Context
  context: {
    userAgent: string;
    platform: string;
    browser?: string;
    os: string;
    ip: string;
    country?: string;
    isp?: string;
  };
}
```

#### 6.2 Real-time Analytics Pipeline
```yaml
Pipeline:
  1. Event Ingestion:
     - SDK sends events to API
     - API Gateway validates
     - Push to Kafka topic
     
  2. Stream Processing:
     - Kafka Streams aggregation
     - Calculate metrics:
       * Concurrent viewers
       * Average watch time
       * Buffer ratio
       * Error rate
     
  3. Storage:
     - ClickHouse for time-series
     - Redis for real-time counters
     - S3 for raw events
     
  4. Visualization:
     - WebSocket for real-time updates
     - Grafana dashboards
     - Custom React dashboard
```

### 7. Infrastructure as Code

#### 7.1 Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: video-api-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: video-api
  template:
    metadata:
      labels:
        app: video-api
    spec:
      containers:
      - name: api
        image: vdocipher-clone/api:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: video-api-service
spec:
  selector:
    app: video-api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
```

#### 7.2 Auto-scaling Configuration
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: video-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: video-api-deployment
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 8. Monitoring & Observability

#### 8.1 Metrics Collection
```yaml
Metrics:
  Application:
    - API response times
    - Request throughput
    - Error rates
    - Active sessions
    
  Video Streaming:
    - Buffering ratio
    - Startup time
    - Bitrate switches
    - CDN cache hit ratio
    
  Infrastructure:
    - CPU/Memory usage
    - Network I/O
    - Disk usage
    - Database connections
    
  Business:
    - User engagement
    - Video completion rate
    - Revenue metrics
    - License issuance
```

#### 8.2 Alerting Rules
```yaml
Alerts:
  Critical:
    - API error rate > 5%
    - Database connection pool exhausted
    - DRM license server down
    - CDN origin errors > 1%
    
  Warning:
    - API p95 latency > 500ms
    - Buffering ratio > 2%
    - Disk usage > 80%
    - Concurrent viewers > 80% capacity
    
  Info:
    - New user registration
    - Large video upload completed
    - Scheduled maintenance reminder
```

## Deployment Strategy

### Phase 1: Development Environment
- Docker Compose setup
- Local development tools
- Mock services for testing

### Phase 2: Staging Environment
- Kubernetes cluster (EKS/GKE)
- Full service deployment
- Load testing setup
- Security scanning

### Phase 3: Production Deployment
- Multi-region setup
- Blue-green deployment
- Database replication
- CDN configuration
- Monitoring setup

### Phase 4: Scaling & Optimization
- Auto-scaling policies
- Performance tuning
- Cost optimization
- Disaster recovery

## Technology Stack Summary

### Frontend
- **Web Player**: Video.js/Shaka Player + Custom UI
- **Admin Dashboard**: React + TypeScript + Material-UI
- **Mobile SDKs**: Swift (iOS), Kotlin/Java (Android)
- **TV Apps**: JavaScript (Tizen/webOS), BrightScript (Roku)

### Backend
- **API Layer**: Node.js + Express + GraphQL
- **Microservices**: Node.js, Python, Go
- **Message Queue**: Kafka, RabbitMQ
- **Cache**: Redis, Memcached

### Data
- **Primary DB**: PostgreSQL
- **Analytics DB**: ClickHouse
- **Search**: Elasticsearch
- **Object Storage**: AWS S3

### Infrastructure
- **Container**: Docker
- **Orchestration**: Kubernetes
- **CI/CD**: GitLab CI / GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack
