# MIDAS - Multi-class Skin Cancer Detection & Classification System
## App Requirement Document v1.0

---

## 1. Executive Summary

MIDAS is a medical diagnostic application that leverages machine learning to detect and classify multiple types of skin cancer from uploaded images. The system provides detailed diagnostic reports and supports three distinct user roles: patients, doctors, and hospital administrators.

### Core Capabilities
- Multi-class skin cancer classification using pre-trained ML model
- Automated report generation with confidence scores
- Role-based access control for patients, doctors, and hospitals
- Image analysis history and tracking
- Collaborative diagnosis features
- HIPAA-compliant data handling

---

## 2. System Architecture Overview

### 2.1 High-Level Architecture
\`\`\`
┌─────────────────────────────────────────────────────────┐
│                   Frontend Application                   │
│              (React + TypeScript + Tailwind)            │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS/REST API
┌────────────────────────┴────────────────────────────────┐
│                    API Gateway (Nginx)                   │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                 Backend Services Layer                   │
│                  (FastAPI + Python)                      │
├──────────────────────────────────────────────────────────┤
│  • Authentication Service    • ML Inference Service      │
│  • User Management           • Report Generation         │
│  • Image Processing          • Notification Service      │
└────────────┬──────────────────────────┬─────────────────┘
             │                          │
┌────────────┴──────────┐   ┌──────────┴─────────────────┐
│   PostgreSQL Database │   │   Object Storage (S3)       │
│   • User Data         │   │   • Medical Images          │
│   • Reports           │   │   • Analysis Results        │
│   • Audit Logs        │   │   • Model Files             │
└───────────────────────┘   └──────────────────────────────┘
\`\`\`

### 2.2 Tech Stack

#### Frontend
- **Framework**: React 18+ with TypeScript
- **UI Library**: Tailwind CSS + Shadcn/ui components
- **State Management**: Redux Toolkit / Zustand
- **Form Handling**: React Hook Form + Zod validation
- **Charts/Visualization**: Recharts / D3.js
- **Image Handling**: React Dropzone, Canvas API
- **HTTP Client**: Axios with interceptors
- **Routing**: React Router v6
- **PWA Support**: Workbox

#### Backend
- **Framework**: FastAPI (Python 3.10+)
- **ML Framework**: PyTorch/TensorFlow (for model loading)
- **Image Processing**: OpenCV, Pillow
- **Authentication**: JWT with refresh tokens
- **Database ORM**: SQLAlchemy 2.0
- **Task Queue**: Celery + Redis
- **API Documentation**: OpenAPI/Swagger
- **File Storage**: MinIO/AWS S3
- **Email Service**: SendGrid/AWS SES

#### Infrastructure
- **Database**: PostgreSQL 15+
- **Cache**: Redis
- **Message Queue**: RabbitMQ/Redis
- **Container**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)

---

## 3. User Roles & Permissions

### 3.1 Patient Role
**Permissions:**
- Upload skin lesion images
- View own analysis history
- Download personal reports
- Share reports with doctors
- Manage profile and preferences
- Book consultations (optional)

### 3.2 Doctor Role
**Permissions:**
- All patient permissions
- View assigned patient records
- Add clinical notes to reports
- Override/confirm AI diagnoses
- Generate detailed medical reports
- Access patient history
- Refer patients to specialists
- Bulk analysis capabilities

### 3.3 Hospital Administrator Role
**Permissions:**
- Manage doctor accounts
- View hospital-wide analytics
- Generate compliance reports
- Manage department settings
- Access audit logs
- Configure automated workflows
- Export data for research (anonymized)

---

## 4. Functional Requirements

### 4.1 Authentication & Authorization
- Multi-factor authentication (MFA)
- Role-based access control (RBAC)
- Session management with refresh tokens
- Password reset via email
- Account verification
- OAuth2 integration (optional)

### 4.2 Image Upload & Processing
- **Supported Formats**: JPEG, PNG, DICOM
- **Max File Size**: 50MB per image
- **Batch Upload**: Up to 10 images simultaneously
- **Image Requirements**:
  - Minimum resolution: 224x224 pixels
  - Maximum resolution: 4096x4096 pixels
  - Auto-rotation based on EXIF data
  - Image quality validation

### 4.3 ML Model Integration
- **Model Loading**: Pickle file deserialization
- **Preprocessing Pipeline**:
  - Image resizing/cropping
  - Normalization
  - Data augmentation (if needed)
- **Classification Classes**:
  - Melanoma
  - Basal Cell Carcinoma
  - Squamous Cell Carcinoma
  - Actinic Keratosis
  - Benign Keratosis
  - Dermatofibroma
  - Vascular Lesion
  - Benign Nevus
- **Output Format**:
  - Class probabilities
  - Top-3 predictions
  - Confidence scores
  - Heatmap/attention visualization

### 4.4 Report Generation
**Report Components:**
- Patient information
- Image metadata
- AI prediction results
- Confidence scores
- Risk assessment
- Recommended actions
- Clinical notes (if added by doctor)
- Timestamp and version tracking
- Digital signature for authenticity

**Export Formats:**
- PDF (with embedded images)
- DICOM SR
- HL7 FHIR format
- CSV (for bulk exports)

### 4.5 Notification System
- Email notifications for:
  - Analysis completion
  - Doctor review completion
  - Urgent findings
  - Follow-up reminders
- In-app notifications
- SMS alerts (optional)

---

## 5. User Interface Layouts

### 5.1 Patient View

#### Dashboard
\`\`\`
┌─────────────────────────────────────────────────────────────┐
│  MIDAS    [Dashboard] [History] [Profile] [Help]    [Logout]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Welcome back, [Patient Name]                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Quick Skin Check                        │  │
│  │                                                      │  │
│  │         [📷 Upload Image]  [📸 Take Photo]          │  │
│  │                                                      │  │
│  │         Drag & drop image or click to browse        │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Recent Analyses                                           │
│  ┌──────────┬──────────┬──────────┬──────────┐          │
│  │ [Image]  │ [Image]  │ [Image]  │ [Image]  │          │
│  │ Date:... │ Date:... │ Date:... │ Date:... │          │
│  │ Status:..│ Status:..│ Status:..│ Status:..│          │
│  └──────────┴──────────┴──────────┴──────────┘          │
│                                                             │
│  Quick Stats                                               │
│  • Total Scans: 12                                         │
│  • Last Check: 2 days ago                                  │
│  • Next Recommended: In 28 days                            │
└─────────────────────────────────────────────────────────────┘
\`\`\`

#### Analysis Result Page
\`\`\`
┌─────────────────────────────────────────────────────────────┐
│  MIDAS    [← Back to Dashboard]                   [Export] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Analysis Results - ID: #AN2024001                         │
│                                                             │
│  ┌─────────────────┬───────────────────────────────────┐  │
│  │                 │  Classification Results           │  │
│  │   [Original     │                                   │  │
│  │    Image]       │  Primary Prediction:              │  │
│  │                 │  🔴 Melanoma (87% confidence)     │  │
│  │   [Heatmap      │                                   │  │
│  │    Overlay]     │  Other Possibilities:             │  │
│  │                 │  • Benign Nevus (8%)              │  │
│  │                 │  • Dysplastic Nevus (5%)          │  │
│  └─────────────────┴───────────────────────────────────┘  │
│                                                             │
│  ⚠️ Important Notice                                       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ This analysis suggests potential melanoma.          │  │
│  │ Immediate consultation with a dermatologist is      │  │
│  │ strongly recommended.                                │  │
│  │                                                      │  │
│  │ [📅 Book Appointment] [👨‍⚕️ Share with Doctor]      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Detailed Information                                      │
│  • Analysis Date: 2024-12-XX XX:XX                        │
│  • Processing Time: 2.3 seconds                           │
│  • Image Quality: Good                                     │
│  • Model Version: MIDAS-v2.1                              │
│                                                             │
│  [Download Full Report PDF]                                │
└─────────────────────────────────────────────────────────────┘
\`\`\`

### 5.2 Doctor View

#### Doctor Dashboard
\`\`\`
┌─────────────────────────────────────────────────────────────┐
│  MIDAS Doctor Portal   [Patients] [Queue] [Reports]        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Dr. [Name] - Dermatology Department                       │
│                                                             │
│  ┌──────────────────┬──────────────────────────────────┐  │
│  │ Pending Reviews  │  Today's Statistics               │  │
│  │                  │                                   │  │
│  │ 🔴 Urgent: 3    │  • Patients Seen: 12             │  │
│  │ 🟡 Regular: 8   │  • Reports Generated: 15         │  │
│  │ 🟢 Follow-up: 5 │  • Avg. Review Time: 4.2 min     │  │
│  └──────────────────┴──────────────────────────────────┘  │
│                                                             │
│  Recent Patient Submissions                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Patient ID │ Name    │ Image │ AI Result │ Action  │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ P001234   │ J.Smith │ [img] │ Melanoma  │[Review] │  │
│  │ P001235   │ M.Jones │ [img] │ Benign    │[Review] │  │
│  │ P001236   │ K.Brown │ [img] │ BCC       │[Review] │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Quick Actions                                             │
│  [🔍 Search Patient] [📊 Generate Report] [📈 Analytics]  │
└─────────────────────────────────────────────────────────────┘
\`\`\`

#### Clinical Review Interface
\`\`\`
┌─────────────────────────────────────────────────────────────┐
│  MIDAS - Clinical Review                          [Save]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Patient: John Smith (ID: P001234) | Age: 45 | M          │
│                                                             │
│  ┌──────────────┬──────────────┬─────────────────────┐   │
│  │ Original     │ Enhanced     │ AI Analysis         │   │
│  │ [Image]      │ [Image]      │                     │   │
│  │              │              │ Melanoma: 87%       │   │
│  │ [Zoom +/-]   │ [Filters]    │ Nevus: 8%          │   │
│  │              │              │ Other: 5%          │   │
│  └──────────────┴──────────────┴─────────────────────┘   │
│                                                             │
│  Clinical Assessment                                       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ ☑ Agree with AI diagnosis                          │  │
│  │ ☐ Disagree - Override diagnosis                    │  │
│  │                                                      │  │
│  │ Clinical Notes:                                     │  │
│  │ ┌─────────────────────────────────────────────┐   │  │
│  │ │ Asymmetric lesion with irregular borders.    │   │  │
│  │ │ Multiple colors present. ABCDE criteria met. │   │  │
│  │ │ Recommend immediate biopsy.                  │   │  │
│  │ └─────────────────────────────────────────────┘   │  │
│  │                                                      │  │
│  │ Recommended Action:                                 │  │
│  │ [▼ Immediate Referral to Oncology         ]       │  │
│  │                                                      │  │
│  │ Follow-up Period: [▼ 1 week    ]                  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  [Generate Report] [Request Second Opinion] [Next Patient] │
└─────────────────────────────────────────────────────────────┘
\`\`\`

### 5.3 Hospital Administrator View

#### Analytics Dashboard
\`\`\`
┌─────────────────────────────────────────────────────────────┐
│  MIDAS Hospital Admin    [Analytics] [Staff] [Settings]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Hospital Name] - Administrative Dashboard                │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                  Monthly Overview                      │ │
│  │                                                        │ │
│  │  Total Scans: 1,247    Positive Cases: 89            │ │
│  │  Avg. Detection Time: 3.2 min    Accuracy: 94.3%     │ │
│  │                                                        │ │
│  │  [Chart: Cases by Type]    [Chart: Daily Volume]     │ │
│  │  [====Melanoma====]        [Line graph showing       │ │
│  │  [===BCC==========]         daily scan volumes]      │ │
│  │  [==SCC===========]                                   │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Department Performance                                    │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Dept.        │ Doctors │ Scans │ Avg Time │ Rating │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ Dermatology  │ 12      │ 847   │ 4.1 min  │ 4.8/5  │  │
│  │ Oncology     │ 8       │ 289   │ 6.3 min  │ 4.7/5  │  │
│  │ Primary Care │ 15      │ 111   │ 3.8 min  │ 4.6/5  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  System Health                                             │
│  • Model Accuracy: 94.3% (Last 30 days)                   │
│  • System Uptime: 99.97%                                   │
│  • Storage Used: 2.4TB / 5TB                              │
│  • Active Users: 187                                       │
│                                                             │
│  [Export Report] [Audit Logs] [System Configuration]       │
└─────────────────────────────────────────────────────────────┘
\`\`\`

---

## 6. Database Schema

### 6.1 Core Tables

\`\`\`sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('patient', 'doctor', 'admin') NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    date_of_birth DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    mfa_enabled BOOLEAN DEFAULT false
);

-- Patient profiles
CREATE TABLE patient_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    medical_record_number VARCHAR(50),
    blood_type VARCHAR(5),
    allergies TEXT[],
    medical_history JSONB,
    emergency_contact JSONB
);

-- Doctor profiles
CREATE TABLE doctor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    specialization VARCHAR(100),
    department_id UUID REFERENCES departments(id),
    years_experience INTEGER,
    verification_status ENUM('pending', 'verified', 'suspended')
);

-- Skin analyses
CREATE TABLE skin_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES users(id),
    doctor_id UUID REFERENCES users(id),
    image_url VARCHAR(500) NOT NULL,
    image_metadata JSONB,
    model_version VARCHAR(50),
    predictions JSONB NOT NULL,
    confidence_scores JSONB NOT NULL,
    analysis_status ENUM('pending', 'completed', 'reviewed', 'failed'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    processing_time_ms INTEGER
);

-- Clinical reports
CREATE TABLE clinical_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID REFERENCES skin_analyses(id),
    doctor_id UUID REFERENCES users(id),
    diagnosis VARCHAR(255),
    clinical_notes TEXT,
    recommendations TEXT,
    severity_level ENUM('benign', 'low', 'moderate', 'high', 'critical'),
    follow_up_date DATE,
    report_pdf_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_final BOOLEAN DEFAULT false
);

-- Audit logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

---

## 7. API Endpoints

### 7.1 Authentication Endpoints
\`\`\`
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/verify-email
POST   /api/auth/enable-mfa
\`\`\`

### 7.2 Analysis Endpoints
\`\`\`
POST   /api/analysis/upload
GET    /api/analysis/{id}
GET    /api/analysis/history
POST   /api/analysis/{id}/review
DELETE /api/analysis/{id}
GET    /api/analysis/{id}/report
POST   /api/analysis/batch
\`\`\`

### 7.3 User Management
\`\`\`
GET    /api/users/profile
PUT    /api/users/profile
GET    /api/users/patients (doctor only)
POST   /api/users/assign-doctor
GET    /api/users/notifications
PUT    /api/users/preferences
\`\`\`

### 7.4 Reports
\`\`\`
POST   /api/reports/generate
GET    /api/reports/{id}
GET    /api/reports/list
PUT    /api/reports/{id}
POST   /api/reports/{id}/share
GET    /api/reports/{id}/pdf
\`\`\`

### 7.5 Admin Endpoints
\`\`\`
GET    /api/admin/analytics
GET    /api/admin/users
PUT    /api/admin/users/{id}
GET    /api/admin/audit-logs
POST   /api/admin/export-data
PUT    /api/admin/settings
GET    /api/admin/system-health
\`\`\`

---

## 8. Security Requirements

### 8.1 Data Protection
- **Encryption at Rest**: AES-256 for database and file storage
- **Encryption in Transit**: TLS 1.3 for all communications
- **PII Handling**: Tokenization of sensitive data
- **Data Retention**: Configurable retention policies
- **Right to Delete**: GDPR compliance for data deletion

### 8.2 Authentication Security
- **Password Policy**:
  - Minimum 12 characters
  - Uppercase, lowercase, numbers, special characters
  - Password history (last 5 passwords)
  - Password expiry (90 days for healthcare staff)
- **Session Management**:
  - JWT with 15-minute access token expiry
  - Refresh tokens with 7-day expiry
  - Session invalidation on suspicious activity
- **MFA Options**:
  - TOTP (Time-based One-Time Password)
  - SMS verification
  - Email verification

### 8.3 HIPAA Compliance
- **Access Controls**: Role-based permissions
- **Audit Trails**: Complete logging of all data access
- **Data Integrity**: Checksums for stored images
- **Transmission Security**: Encrypted channels only
- **Business Associate Agreements**: For third-party services

### 8.4 Security Headers
\`\`\`
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000
X-XSS-Protection: 1; mode=block
\`\`\`

---

## 9. ML Model Integration Details

### 9.1 Model Deployment
\`\`\`python
# Model loading service
class ModelService:
    def __init__(self):
        self.model = self.load_model()
        self.preprocessing = self.setup_preprocessing()
    
    def load_model(self):
        with open('models/skin_cancer_model.pkl', 'rb') as f:
            return pickle.load(f)
    
    def predict(self, image_path):
        # Preprocessing
        image = self.preprocess_image(image_path)
        
        # Inference
        predictions = self.model.predict(image)
        
        # Post-processing
        return self.format_predictions(predictions)
\`\`\`

### 9.2 Preprocessing Pipeline
- Resize to 224x224 (or model's expected input)
- Normalize pixel values [0, 1]
- Apply necessary transforms
- Handle different image formats

### 9.3 Model Versioning
- Track model versions in database
- A/B testing capability
- Rollback mechanism
- Performance metrics per version

---

## 10. Performance Requirements

### 10.1 Response Times
- **Image Upload**: < 2 seconds
- **ML Inference**: < 3 seconds
- **Report Generation**: < 5 seconds
- **Page Load**: < 1.5 seconds
- **API Response**: < 500ms (non-ML endpoints)

### 10.2 Scalability
- Support 10,000 concurrent users
- Process 1,000 images per minute
- 99.9% uptime SLA
- Horizontal scaling capability

### 10.3 Storage
- 1TB initial storage
- Auto-scaling storage
- CDN for static assets
- Image compression without quality loss

---

## 11. Monitoring & Logging

### 11.1 Application Metrics
- Request/response times
- Error rates
- Model prediction confidence distribution
- User activity patterns
- Resource utilization

### 11.2 Business Metrics
- Daily active users
- Analysis volume
- Detection accuracy
- Doctor review times
- Patient satisfaction scores

### 11.3 Alerts
- System downtime
- High error rates
- Unusual prediction patterns
- Security incidents
- Storage threshold warnings

---

## 12. Development Phases

### Phase 1: Core MVP (Weeks 1-6)
- Basic authentication system
- Single image upload and analysis
- Simple result display
- Patient view only
- Basic report generation

### Phase 2: Multi-Role Support (Weeks 7-10)
- Doctor portal implementation
- Clinical review features
- Enhanced reporting
- Notification system
- Audit logging

### Phase 3: Advanced Features (Weeks 11-14)
- Hospital admin dashboard
- Batch processing
- Analytics and insights
- Advanced security features
- Performance optimization

### Phase 4: Polish & Deployment (Weeks 15-16)
- UI/UX refinements
- Comprehensive testing
- Documentation
- Deployment setup
- Production monitoring

---

## 13. Testing Requirements

### 13.1 Test Coverage
- Unit tests: 80% minimum coverage
- Integration tests for all API endpoints
- E2E tests for critical user flows
- Performance testing
- Security penetration testing

### 13.2 Test Data
- Synthetic skin lesion images
- Various lighting conditions
- Different skin types
- Edge cases (blurry, partial images)

### 13.3 Validation Strategy
- Clinical validation with dermatologists
- Model accuracy benchmarking
- User acceptance testing
- HIPAA compliance audit

---

## 14. Non-Functional Requirements

### 14.1 Accessibility
- WCAG 2.1 AA compliance
- Screen reader support
- Keyboard navigation
- High contrast mode
- Multi-language support (initially English)

### 14.2 Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

### 14.3 Mobile Responsiveness
- Responsive design for all screen sizes
- Touch-optimized interfaces
- Camera integration for mobile devices
- Progressive Web App capabilities

---

## 15. Error Handling & Recovery

### 15.1 Error Scenarios
- Network failures
- Invalid image formats
- Model inference failures
- Database connection issues
- Storage quota exceeded

### 15.2 Recovery Mechanisms
- Automatic retry with exponential backoff
- Graceful degradation
- Offline mode with sync
- Transaction rollback
- Data recovery procedures

---

## 16. Documentation Requirements

### 16.1 Technical Documentation
- API documentation (OpenAPI/Swagger)
- Database schema documentation
- Deployment guides
- Architecture diagrams
- Security procedures

### 16.2 User Documentation
- User manuals for each role
- Video tutorials
- FAQ section
- Troubleshooting guides
- Best practices for image capture

---

## Appendix A: Skin Cancer Classification Details

### Supported Cancer Types
1. **Melanoma**: Most dangerous, requires immediate attention
2. **Basal Cell Carcinoma (BCC)**: Most common, slow-growing
3. **Squamous Cell Carcinoma (SCC)**: Second most common
4. **Actinic Keratosis**: Precancerous condition
5. **Benign Keratosis**: Non-cancerous growth
6. **Dermatofibroma**: Benign skin nodule
7. **Vascular Lesion**: Blood vessel abnormalities
8. **Benign Nevus**: Common mole

### Risk Levels
- **Critical**: Immediate medical attention required
- **High**: Consultation within 48 hours
- **Moderate**: Consultation within 1 week
- **Low**: Regular monitoring recommended
- **Benign**: No immediate action required

---

## Appendix B: Compliance Checklist

- [ ] HIPAA compliance certification
- [ ] GDPR compliance for EU users
- [ ] FDA medical device classification (if applicable)
- [ ] State medical board requirements
- [ ] Data residency requirements
- [ ] Consent management system
- [ ] Privacy policy and terms of service
- [ ] Security audit certification

---

*End of Requirements Document*
