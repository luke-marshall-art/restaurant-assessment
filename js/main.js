let currentLocation = 'front';
let stream = null;
let stickers = [];

const video = document.getElementById('videoElement');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('captureBtn');
const saveBtn = document.getElementById('saveBtn');
const ctx = canvas.getContext('2d');

async function startCamera() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera API not supported in this browser. Please try Chrome, Firefox, or Safari.');
        }

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: true
            });
            
            stream.getTracks().forEach(track => track.stop());
            
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                throw new Error('Camera permission denied. Please allow camera access in your browser settings and try again.');
            } else {
                throw err;
            }
        }

        video.srcObject = stream;
        video.style.display = 'block';
        canvas.style.display = 'none';
        captureBtn.disabled = false;
        
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve();
            };
        });

        showNotification('Camera started successfully');
    } catch (err) {
        console.error('Camera error:', err);
        handleCameraError(err);
    }
}

function handleCameraError(err) {
    const errorMessage = err.message || 'Unknown camera error';
    showNotification(errorMessage);
    
    const videoContainer = document.querySelector('.camera-container');
    const existingError = videoContainer.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <p><strong>Camera Error:</strong> ${errorMessage}</p>
        <p>Troubleshooting steps:</p>
        <ol>
            <li>Make sure you're using a modern browser (Chrome, Firefox, Safari)</li>
            <li>Check that camera permissions are allowed in your browser settings</li>
            <li>If using a mobile device, ensure the site has camera permissions</li>
            <li>Try reloading the page</li>
        </ol>
    `;
    videoContainer.appendChild(errorDiv);
}

function selectLocation(locationType) {
    currentLocation = locationType;
    document.querySelectorAll('.location-btn').forEach(btn => 
        btn.classList.remove('active'));
    document.querySelectorAll('.sticker-panel').forEach(panel => 
        panel.classList.remove('active'));
    
    event.target.classList.add('active');
    document.querySelector(`.sticker-panel.${locationType}`)
            .classList.add('active');
}

function validateInputs() {
    const restaurantNumber = document.getElementById('restaurantNumber').value;
    return restaurantNumber.length === 6 && /^\d+$/.test(restaurantNumber);
}

function generateFilename() {
    const restaurantId = document.getElementById('restaurantNumber').value;
    const locationType = currentLocation === 'front' ? 'fountain' : 'syrup';
    const timestamp = new Date().toISOString()
        .replace(/[-:]/g, '')
        .replace('T', '-')
        .split('.')[0];
    
    return `${restaurantId}_${locationType}_${timestamp}.png`;
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function capturePhoto() {
    if (!validateInputs()) {
        showNotification('Please enter restaurant number first');
        return;
    }

    if (!stream) {
        showNotification('Please start the camera first');
        return;
    }

    try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        
        video.style.display = 'none';
        canvas.style.display = 'block';
        captureBtn.disabled = true;
        saveBtn.disabled = false;
        
        showNotification('Photo captured! Add stickers or save.');
    } catch (error) {
        console.error('Error capturing photo:', error);
        showNotification('Error capturing photo. Please try again.');
    }
}

function addSticker(stickerType) {
    if (!canvas.getContext) {
        showNotification('Please take a photo first');
        return;
    }

    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(50, 50, 100, 100);
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.fillText(stickerType, 60, 100);

    stickers.push({
        type: stickerType,
        x: 50,
        y: 50
    });

    showNotification('Sticker added');
}

function saveImage() {
    if (!validateInputs()) {
        showNotification('Please enter a valid 6-digit restaurant number');
        return;
    }

    const filename = generateFilename();
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL();
    link.click();
    
    showNotification(`Saved as: ${filename}`);
}