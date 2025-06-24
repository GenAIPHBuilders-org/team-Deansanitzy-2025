import { GEMINI_API_KEY } from '../js/config.js';

// Gemini Pro Vision Configuration
const GEMINI_VISION_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

class ReceiptScanner {
    constructor() {
        this.isScanning = false;
        this.stream = null;
        this.canvas = null;
        this.context = null;
    }

    // Initialize camera stream
    async initCamera() {
        try {
            console.log('🎥 Initializing camera...');
            
            // Check if device supports camera
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported on this device');
            }

            // Request camera permission
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera for better receipt scanning
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            console.log('✅ Camera initialized successfully');
            return this.stream;
        } catch (error) {
            console.error('❌ Camera initialization failed:', error);
            throw error;
        }
    }

    // Create camera UI modal
    createCameraModal() {
        const modal = document.createElement('div');
        modal.id = 'camera-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            padding: 20px;
            box-sizing: border-box;
        `;

        modal.innerHTML = `
            <div style="width: 100%; max-width: 500px; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div style="background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); color: white; padding: 15px; text-align: center;">
                    <h3 style="margin: 0; font-size: 1.2rem;">📸 Scan Receipt</h3>
                    <p style="margin: 5px 0 0 0; font-size: 0.9rem; opacity: 0.9;">Capture or upload your receipt</p>
                </div>
                
                <!-- Tab Navigation -->
                <div style="display: flex; background: #f8f9fa;">
                    <button id="camera-tab" class="scan-tab active-tab" style="flex: 1; padding: 12px; border: none; background: white; font-weight: 600; color: #FF6B35; border-bottom: 2px solid #FF6B35;">
                        📸 Camera
                    </button>
                    <button id="upload-tab" class="scan-tab" style="flex: 1; padding: 12px; border: none; background: #f8f9fa; font-weight: 600; color: #666; border-bottom: 2px solid transparent;">
                        📁 Upload
                    </button>
                </div>
                
                <!-- Camera Section -->
                <div id="camera-section" style="display: block;">
                    <div style="position: relative; background: #000;">
                        <video id="camera-preview" autoplay playsinline style="width: 100%; height: 300px; object-fit: cover;"></video>
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 2px solid #FF6B35; width: 80%; height: 70%; border-radius: 10px; pointer-events: none;"></div>
                    </div>
                    
                    <div style="padding: 20px; text-align: center;">
                        <div style="margin-bottom: 15px;">
                            <button id="capture-btn" style="background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); color: white; border: none; padding: 12px 30px; border-radius: 25px; font-size: 1rem; font-weight: 600; cursor: pointer; margin-right: 10px; box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);">
                                📷 Capture Receipt
                            </button>
                            <button id="cancel-scan-btn" style="background: #6c757d; color: white; border: none; padding: 12px 30px; border-radius: 25px; font-size: 1rem; font-weight: 600; cursor: pointer;">
                                ❌ Cancel
                            </button>
                        </div>
                        <div id="scan-status" style="font-size: 0.9rem; color: #666; min-height: 20px;"></div>
                    </div>
                </div>
                
                <!-- Upload Section -->
                <div id="upload-section" style="display: none;">
                    <div style="padding: 30px; text-align: center;">
                        <div id="upload-area" style="border: 2px dashed #FF6B35; border-radius: 10px; padding: 40px; margin-bottom: 20px; background: #fef7f5; cursor: pointer; transition: all 0.3s ease;">
                            <div style="font-size: 3rem; margin-bottom: 10px;">📁</div>
                            <p style="margin: 0 0 10px 0; font-weight: 600; color: #FF6B35;">Drop receipt image here</p>
                            <p style="margin: 0; color: #666; font-size: 0.9rem;">or click to select file</p>
                            <input type="file" id="file-input" accept="image/*" style="display: none;">
                        </div>
                        
                        <div id="file-preview" style="display: none; margin-bottom: 20px;">
                            <img id="preview-image" style="max-width: 100%; max-height: 200px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                            <p id="file-name" style="margin: 10px 0 0 0; color: #666; font-size: 0.9rem;"></p>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <button id="analyze-btn" style="background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); color: white; border: none; padding: 12px 30px; border-radius: 25px; font-size: 1rem; font-weight: 600; cursor: pointer; margin-right: 10px; box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3); display: none;">
                                🧠 Analyze Receipt
                            </button>
                            <button id="cancel-upload-btn" style="background: #6c757d; color: white; border: none; padding: 12px 30px; border-radius: 25px; font-size: 1rem; font-weight: 600; cursor: pointer;">
                                ❌ Cancel
                            </button>
                        </div>
                        
                        <div id="upload-status" style="font-size: 0.9rem; color: #666; min-height: 20px;"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        return modal;
    }

    // Capture image from video stream
    captureImage(video) {
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.context = this.canvas.getContext('2d');
        }

        this.canvas.width = video.videoWidth;
        this.canvas.height = video.videoHeight;
        this.context.drawImage(video, 0, 0);

        return this.canvas.toDataURL('image/jpeg', 0.8);
    }

    // Convert base64 to format expected by Gemini
    prepareImageForGemini(base64Image) {
        // Remove data URL prefix
        const base64Data = base64Image.split(',')[1];
        return {
            inlineData: {
                data: base64Data,
                mimeType: 'image/jpeg'
            }
        };
    }

    // Analyze receipt using Gemini Pro Vision
    async analyzeReceipt(imageData) {
        try {
            console.log('🧠 Analyzing receipt with Gemini Pro Vision...');
            
            const prompt = `
Analyze this receipt image and extract transaction information. Return ONLY a valid JSON object with the following structure:

{
    "name": "Store name or main item description",
    "amount": 0.00,
    "type": "expense",
    "category": "food|shopping|bills|transportation|entertainment|health|housing|education|other",
    "date": "YYYY-MM-DD",
    "notes": "Any additional details from the receipt",
    "items": [
        {
            "name": "Item name",
            "price": 0.00,
            "quantity": 1
        }
    ],
    "merchant": "Store/merchant name",
    "total": 0.00
}

Rules:
- Extract the total amount as a number (no currency symbols)
- Use ISO date format (YYYY-MM-DD)
- If date is unclear, use today's date
- Choose the most appropriate category
- Set type to "expense" for purchases
- Include merchant name if visible
- List individual items if clearly visible
- Ensure all JSON is properly formatted and valid

Return ONLY the JSON object, no additional text.
            `;

            const requestBody = {
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            this.prepareImageForGemini(imageData)
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.1,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 1024,
                }
            };

            const response = await fetch(`${GEMINI_VISION_ENDPOINT}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('Gemini API error:', errorData);
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                throw new Error('Invalid response from Gemini API');
            }

            const extractedText = data.candidates[0].content.parts[0].text;
            console.log('🎯 Raw Gemini response:', extractedText);

            // Parse the JSON response
            const cleanedJson = extractedText.replace(/```json\n?|\n?```/g, '').trim();
            const parsedData = JSON.parse(cleanedJson);
            
            console.log('✅ Parsed receipt data:', parsedData);
            return parsedData;

        } catch (error) {
            console.error('❌ Receipt analysis failed:', error);
            throw error;
        }
    }

    // Convert file to base64 for Gemini
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Validate uploaded file
    validateFile(file) {
        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        
        if (file.size > maxSize) {
            throw new Error('File size must be less than 5MB');
        }
        
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Please upload a valid image file (JPEG, PNG, or WebP)');
        }
        
        return true;
    }

    // Handle file upload events
    setupUploadHandlers(modal) {
        const uploadArea = modal.querySelector('#upload-area');
        const fileInput = modal.querySelector('#file-input');
        const filePreview = modal.querySelector('#file-preview');
        const previewImage = modal.querySelector('#preview-image');
        const fileName = modal.querySelector('#file-name');
        const analyzeBtn = modal.querySelector('#analyze-btn');
        const uploadStatus = modal.querySelector('#upload-status');
        
        let selectedFile = null;

        // Click to select file
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // Drag and drop events
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#F7931E';
            uploadArea.style.background = '#fff3e0';
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#FF6B35';
            uploadArea.style.background = '#fef7f5';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#FF6B35';
            uploadArea.style.background = '#fef7f5';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelection(files[0]);
            }
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelection(e.target.files[0]);
            }
        });

        // Handle file selection
        const handleFileSelection = async (file) => {
            try {
                uploadStatus.textContent = 'Validating file...';
                
                // Validate file
                this.validateFile(file);
                selectedFile = file;
                
                // Show preview
                const base64 = await this.fileToBase64(file);
                previewImage.src = base64;
                fileName.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
                
                filePreview.style.display = 'block';
                analyzeBtn.style.display = 'inline-block';
                uploadStatus.textContent = 'File ready for analysis';
                
                console.log('✅ File selected successfully:', file.name);
                
            } catch (error) {
                console.error('❌ File validation failed:', error);
                uploadStatus.textContent = `❌ ${error.message}`;
                filePreview.style.display = 'none';
                analyzeBtn.style.display = 'none';
                selectedFile = null;
            }
        };

        // Analyze button click
        analyzeBtn.addEventListener('click', async () => {
            if (!selectedFile) {
                uploadStatus.textContent = '❌ No file selected';
                return;
            }

            try {
                analyzeBtn.disabled = true;
                analyzeBtn.textContent = '🧠 Analyzing...';
                uploadStatus.textContent = 'Analyzing receipt with AI...';
                
                // Convert file to base64
                const base64Image = await this.fileToBase64(selectedFile);
                
                // Analyze with Gemini
                const extractedData = await this.analyzeReceipt(base64Image);
                
                // Close modal and cleanup
                this.cleanup(modal, null);
                
                // Handle success
                this.handleScanSuccess(extractedData);
                
            } catch (error) {
                console.error('❌ Upload analysis failed:', error);
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = '🧠 Analyze Receipt';
                uploadStatus.textContent = `❌ Analysis failed: ${error.message}`;
                
                setTimeout(() => {
                    if (confirm('Failed to analyze the uploaded image. Would you like to try again?')) {
                        uploadStatus.textContent = 'File ready for analysis';
                    }
                }, 2000);
            }
        });

        return { selectedFile: () => selectedFile };
    }

    // Setup tab switching
    setupTabSwitching(modal, stream) {
        const cameraTab = modal.querySelector('#camera-tab');
        const uploadTab = modal.querySelector('#upload-tab');
        const cameraSection = modal.querySelector('#camera-section');
        const uploadSection = modal.querySelector('#upload-section');

        cameraTab.addEventListener('click', () => {
            // Switch to camera tab
            cameraTab.style.background = 'white';
            cameraTab.style.color = '#FF6B35';
            cameraTab.style.borderBottom = '2px solid #FF6B35';
            
            uploadTab.style.background = '#f8f9fa';
            uploadTab.style.color = '#666';
            uploadTab.style.borderBottom = '2px solid transparent';
            
            cameraSection.style.display = 'block';
            uploadSection.style.display = 'none';
        });

        uploadTab.addEventListener('click', () => {
            // Switch to upload tab
            uploadTab.style.background = 'white';
            uploadTab.style.color = '#FF6B35';
            uploadTab.style.borderBottom = '2px solid #FF6B35';
            
            cameraTab.style.background = '#f8f9fa';
            cameraTab.style.color = '#666';
            cameraTab.style.borderBottom = '2px solid transparent';
            
            cameraSection.style.display = 'none';
            uploadSection.style.display = 'block';
        });
    }

    // Start the scanning process
    async startScan() {
        if (this.isScanning) {
            console.log('⚠️ Scan already in progress');
            return;
        }

        try {
            this.isScanning = true;
            
            // Create modal first
            const modal = this.createCameraModal();
            
            // Get UI elements
            const video = modal.querySelector('#camera-preview');
            const captureBtn = modal.querySelector('#capture-btn');
            const cancelBtn = modal.querySelector('#cancel-scan-btn');
            const cancelUploadBtn = modal.querySelector('#cancel-upload-btn');
            const statusDiv = modal.querySelector('#scan-status');
            
            // Setup upload handlers
            const uploadHandlers = this.setupUploadHandlers(modal);
            
            // Try to initialize camera (optional for upload-only users)
            let stream = null;
            try {
                stream = await this.initCamera();
                video.srcObject = stream;
                
                // Setup tab switching
                this.setupTabSwitching(modal, stream);
                
            } catch (cameraError) {
                console.warn('⚠️ Camera not available, upload-only mode:', cameraError);
                
                // Hide camera tab and show upload tab by default
                const cameraTab = modal.querySelector('#camera-tab');
                const uploadTab = modal.querySelector('#upload-tab');
                const cameraSection = modal.querySelector('#camera-section');
                const uploadSection = modal.querySelector('#upload-section');
                
                cameraTab.style.display = 'none';
                uploadTab.style.width = '100%';
                uploadTab.style.background = 'white';
                uploadTab.style.color = '#FF6B35';
                uploadTab.style.borderBottom = '2px solid #FF6B35';
                
                cameraSection.style.display = 'none';
                uploadSection.style.display = 'block';
                
                // Update modal title
                modal.querySelector('h3').textContent = '📁 Upload Receipt';
                modal.querySelector('p').textContent = 'Upload your receipt image for analysis';
            }
            
            // Handle capture button (camera)
            if (captureBtn) {
                captureBtn.addEventListener('click', async () => {
                    try {
                        statusDiv.textContent = '📸 Capturing image...';
                        captureBtn.disabled = true;
                        
                        // Capture image
                        const imageData = this.captureImage(video);
                        statusDiv.textContent = '🧠 Analyzing receipt...';
                        
                        // Analyze with Gemini
                        const extractedData = await this.analyzeReceipt(imageData);
                        
                        // Close modal and cleanup
                        this.cleanup(modal, stream);
                        
                        // Return extracted data
                        return this.handleScanSuccess(extractedData);
                        
                    } catch (error) {
                        console.error('❌ Capture/analysis failed:', error);
                        statusDiv.textContent = '❌ Failed to analyze receipt. Please try again.';
                        captureBtn.disabled = false;
                        
                        // Show error and option to retry
                        setTimeout(() => {
                            if (confirm('Failed to analyze receipt. Would you like to try again?')) {
                                statusDiv.textContent = 'Position your receipt in the camera view';
                                captureBtn.disabled = false;
                            } else {
                                this.cleanup(modal, stream);
                            }
                        }, 2000);
                    }
                });
            }
            
            // Handle cancel buttons
            const handleCancel = () => {
                this.cleanup(modal, stream);
            };
            
            if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
            if (cancelUploadBtn) cancelUploadBtn.addEventListener('click', handleCancel);
            
        } catch (error) {
            console.error('❌ Failed to start scan:', error);
            this.isScanning = false;
            
            // For upload-only mode, still show the modal
            if (error.message.includes('Camera not supported')) {
                const modal = this.createCameraModal();
                
                // Hide camera elements and show upload only
                const cameraTab = modal.querySelector('#camera-tab');
                const uploadTab = modal.querySelector('#upload-tab');
                const cameraSection = modal.querySelector('#camera-section');
                const uploadSection = modal.querySelector('#upload-section');
                
                cameraTab.style.display = 'none';
                uploadTab.style.width = '100%';
                uploadSection.style.display = 'block';
                cameraSection.style.display = 'none';
                
                // Setup upload handlers
                this.setupUploadHandlers(modal);
                
                // Handle cancel
                modal.querySelector('#cancel-upload-btn').addEventListener('click', () => {
                    this.cleanup(modal, null);
                });
                
                return;
            }
            
            let errorMessage = 'Failed to start scanner. ';
            if (error.name === 'NotAllowedError') {
                errorMessage += 'Please allow camera access and try again, or use the upload option.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'No camera found. You can still upload receipt images.';
            } else {
                errorMessage += 'Please try again or use the upload option.';
            }
            
            if (confirm('📱 ' + errorMessage + '\n\nWould you like to upload an image instead?')) {
                // Retry with upload-only mode
                setTimeout(() => this.startScan(), 100);
            }
        }
    }

    // Handle successful scan
    handleScanSuccess(extractedData) {
        console.log('🎉 Receipt scan successful!', extractedData);
        
        // Dispatch custom event with extracted data
        const scanEvent = new CustomEvent('receiptScanned', {
            detail: extractedData
        });
        document.dispatchEvent(scanEvent);
        
        return extractedData;
    }

    // Cleanup camera and modal
    cleanup(modal, stream) {
        this.isScanning = false;
        
        // Stop camera stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        // Remove modal
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
        
        console.log('🧹 Camera cleanup completed');
    }
}

// Global instance
window.receiptScanner = new ReceiptScanner();

// Export for use in other modules
export { ReceiptScanner };

// Initialize scan functionality
export function initReceiptScanning() {
    console.log('📸 Receipt scanning module initialized');
    return window.receiptScanner;
}
