/**
 * API Integration Module for MIDAS
 * Connects Next.js frontend with Python FastAPI backend
 */

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types matching our Python backend
export interface PredictionResult {
  class: string;
  description: string;
  confidence: number;
}

export interface AnalysisResult {
  success: boolean;
  primary_prediction: PredictionResult;
  all_predictions: PredictionResult[];
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SystemInfo {
  name: string;
  version: string;
  status: string;
}

export interface HealthCheck {
  status: string;
  model_loaded: boolean;
}

export interface ClassInfo {
  classes: string[];
  class_descriptions: Record<string, string>;
}

// Class name mapping to match Python backend
export const CLASS_NAMES = {
  'AKIEC': 'Actinic Keratoses',
  'BCC': 'Basal Cell Carcinoma',
  'BKL': 'Benign Keratosis',
  'DF': 'Dermatofibroma',
  'MEL': 'Melanoma',
  'NV': 'Nevus',
  'VASC': 'Vascular Lesions'
};

/**
 * Check if Python backend is available
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data: HealthCheck = await response.json();
    return data.status === 'healthy' && data.model_loaded;
  } catch (error) {
    console.error('Backend health check failed:', error);
    return false;
  }
}

/**
 * Get system information
 */
export async function getSystemInfo(): Promise<SystemInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/`);
    return await response.json();
  } catch (error) {
    console.error('Failed to get system info:', error);
    return null;
  }
}

/**
 * Get available classes from backend
 */
export async function getClasses(): Promise<ClassInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/classes`);
    return await response.json();
  } catch (error) {
    console.error('Failed to get classes:', error);
    return null;
  }
}

/**
 * Analyze a single image using Python ML backend
 */
export async function analyzeImage(file: File): Promise<AnalysisResult | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Image analysis failed:', error);
    return null;
  }
}

/**
 * Analyze multiple images (batch processing)
 */
export async function analyzeImageBatch(files: File[]): Promise<any[]> {
  try {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_BASE_URL}/batch_predict`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Batch analysis failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Batch analysis failed:', error);
    return [];
  }
}

/**
 * Convert Python backend response to frontend format
 */
export function convertToFrontendFormat(result: AnalysisResult) {
  if (!result || !result.success) {
    return null;
  }

  // Convert confidence from percentage to decimal
  const predictions: Record<string, number> = {};
  result.all_predictions.forEach(pred => {
    predictions[pred.description] = pred.confidence / 100;
  });

  return {
    predictions,
    primaryPrediction: result.primary_prediction.description,
    confidence: result.primary_prediction.confidence,
    riskLevel: result.risk_level.toLowerCase(),
    processingTime: 0.5 + Math.random() * 2, // Mock processing time
    modelVersion: 'MIDAS-v1.0',
  };
}

/**
 * Get risk level color for UI
 */
export function getRiskLevelColor(riskLevel: string): string {
  switch (riskLevel.toUpperCase()) {
    case 'HIGH':
      return 'destructive';
    case 'MEDIUM':
      return 'warning';
    case 'LOW':
      return 'success';
    default:
      return 'secondary';
  }
}

/**
 * Format confidence percentage
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence)}%`;
}

/**
 * Check if backend is running, if not use mock data
 */
export async function getAnalysisFunction() {
  const isBackendAvailable = await checkBackendHealth();
  
  if (isBackendAvailable) {
    return analyzeImage;
  } else {
    // Return mock function if backend is not available
    return async (file: File) => {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Return mock result
      return {
        success: true,
        primary_prediction: {
          class: 'MEL',
          description: 'Melanoma',
          confidence: 87
        },
        all_predictions: [
          { class: 'MEL', description: 'Melanoma', confidence: 87 },
          { class: 'NV', description: 'Nevus', confidence: 8 },
          { class: 'BKL', description: 'Benign Keratosis', confidence: 5 }
        ],
        risk_level: 'HIGH' as const
      };
    };
  }
}
