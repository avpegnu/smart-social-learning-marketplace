import { apiClient } from '@shared/api-client';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  duration?: number;
  bytes: number;
  format: string;
  original_filename: string;
  resource_type: string;
}

interface VideoSignature {
  timestamp: number;
  signature: string;
  folder: string;
  type: string;
  cloudName: string;
  apiKey: string;
}

// Upload video ở dạng authenticated: xin chữ ký từ backend rồi POST kèm chữ ký.
// Video sẽ KHÔNG public, chỉ xem được qua URL đã ký (backend sinh khi đọc bài).
export async function uploadVideoAuthenticated(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  const { data: sig } = await apiClient.post<VideoSignature>('/uploads/video-signature');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', sig.apiKey);
  formData.append('timestamp', String(sig.timestamp));
  formData.append('signature', sig.signature);
  formData.append('folder', sig.folder);
  formData.append('type', sig.type);

  const url = `https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as CloudinaryUploadResult);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.open('POST', url);
    xhr.send(formData);
  });
}

export function uploadToCloudinary(
  file: File,
  resourceType: 'image' | 'video' | 'raw' | 'auto',
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    return Promise.reject(new Error('Cloudinary config missing'));
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as CloudinaryUploadResult);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.open('POST', url);
    xhr.send(formData);
  });
}
