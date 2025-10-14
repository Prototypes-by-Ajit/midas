# MIDAS - Integrated Full-Stack System

## Multi-Modal Intelligent Dermoscopy Analysis System

A complete AI-powered skin cancer detection platform combining deep learning with a modern web interface.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  • Patient Dashboard  • Image Upload  • Analysis Results     │
│  • Doctor Portal      • AI Chat       • Admin Panel          │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/REST API
┌─────────────────────────┴───────────────────────────────────┐
│                   Backend (Python FastAPI)                   │
│  • ML Inference      • Image Processing  • Risk Assessment   │
│  • Model Management  • Data Pipeline     • API Endpoints     │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                    ML Models (PyTorch)                       │
│  • EfficientNet     • ResNet       • Vision Transformers     │
│  • Transfer Learning • Multi-class Classification            │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- CUDA (optional, for GPU acceleration)

### 1. Backend Setup

```bash
# Navigate to project root
cd midas

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the ML API server
python main.py --mode api
```

The backend will start at `http://localhost:8000`

API Documentation available at `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
# Navigate to frontend
cd frontend/midas-medical-app

# Install dependencies
npm install
# or
pnpm install

# Run development server
npm run dev
```

The frontend will start at `http://localhost:3000`

## Integration Points

### Frontend → Backend Communication

The frontend connects to the Python backend through the following endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | System info |
| `/health` | GET | Health check |
| `/classes` | GET | Get available classes |
| `/predict` | POST | Single image prediction |
| `/batch_predict` | POST | Multiple image predictions |

### Data Flow

1. **User uploads image** → Frontend
2. **Image sent to API** → Backend processes with ML model
3. **Prediction returned** → Frontend displays results
4. **Risk assessment** → Automatic categorization (HIGH/MEDIUM/LOW)

## Features

### Backend Features
- 7-class skin lesion classification
- Real-time inference with FastAPI
- Multiple model architectures support
- Automatic risk level assessment
- Batch processing capability
- Model checkpointing and versioning

### Frontend Features
- Patient dashboard
- Doctor review portal
- Admin analytics
- Real-time image analysis
- Historical analysis tracking
- AI-powered chat assistant
- Responsive design

### Integration Features
- Automatic fallback to mock data when backend unavailable
- Health monitoring
- CORS enabled for cross-origin requests
- Environment-based configuration

## Testing the Integration

### 1. Test Backend Only
```bash
python main.py --mode test
```

### 2. Test Full Stack
```bash
# Terminal 1: Start backend
python main.py --mode api

# Terminal 2: Start frontend
cd frontend/midas-medical-app
npm run dev

# Visit http://localhost:3000/dashboard
# Upload an image to test the full pipeline
```

### 3. API Testing with cURL
```bash
# Health check
curl http://localhost:8000/health

# Get classes
curl http://localhost:8000/classes

# Predict (with image)
curl -X POST "http://localhost:8000/predict" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@path/to/image.jpg"
```

## Project Structure

```
midas/
├── src/                      # Python backend source
│   ├── api/                  # FastAPI endpoints
│   ├── config/               # Configuration
│   ├── data/                 # Data loaders
│   ├── models/               # ML models
│   └── utils/                # Utilities
├── frontend/                 # Next.js frontend
│   └── midas-medical-app/
│       ├── app/              # Next.js app router
│       ├── components/       # React components
│       └── lib/              # Integration library
├── data/                     # Datasets (not included)
├── models/                   # Trained models
└── results/                  # Analysis outputs
```

## Configuration

### Backend Configuration
Edit `src/config/config.py`:
- Model architecture
- Batch size
- API settings
- Dataset paths

### Frontend Configuration
Edit `frontend/midas-medical-app/.env.local`:
- Backend API URL
- Feature flags
- Application settings

## Deployment

### Using Docker (Recommended)

```dockerfile
# Backend Dockerfile
FROM python:3.9
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "main.py", "--mode", "api"]
```

```dockerfile
# Frontend Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### Cloud Deployment
- Backend: Deploy to AWS Lambda, Google Cloud Run, or Azure Functions
- Frontend: Deploy to Vercel, Netlify, or AWS Amplify
- Model Storage: Use S3, GCS, or Azure Blob Storage

## Model Training

When you have the datasets:

```bash
# Download datasets to data/ham10000 and data/pad_ufes20

# Train model
python main.py --mode train --model efficientnet_b0 --epochs 50

# Trained model will be saved to models/trained/
```

## Monitoring

- Backend logs: `logs/MIDAS-V1_*.log`
- Frontend: Browser console + Vercel Analytics
- API metrics: `/docs` Swagger UI

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - see LICENSE file

## Acknowledgments

- HAM10000 Dataset
- PAD-UFES-20 Dataset
- PyTorch & Timm teams
- Next.js & Vercel teams

## Support

For issues or questions:
- Open an issue on GitHub
- Check the documentation at `/docs`
- Review integration tests in `src/tests/`

---

**Built for advancing medical AI**
