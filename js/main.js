let currentLocation = 'front';
let stream = null;
let stickers = [];
let activeSticker = null;
let isDragging = false;
let startX = 0;
let startY = 0;
let initialSticker = null;
const stickerImages = {};

const video = document.getElementById('videoElement');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('captureBtn');
const saveBtn = document.getElementById('saveBtn');
const ctx = canvas.getContext('2d');

// Preload sticker images
window.addEventListener('load', () => {
    const stickerTypes = ['fountain', 'electrical', 'syrup', 'storage'];
    stickerTypes.forEach(type => {
        const img = new Image();
        img.src = `images/${type}-marker.png`;
        stickerImages[type] = img;
    });
});

// Add click handlers for stickers
document.addEventListener('DOMContentLoaded', () => {
    const stickerItems = document.querySelectorAll('.sticker-item');
    stickerItems.forEach(item => {
        item.addEventListener('click', () => {
            const stickerType = item.getAttribute('data-sticker-type');
            if (stickerType) {
                toggleSticker(stickerType);
            }
        });
    });
});

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

        setupTouchHandlers();

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

    const img = stickerImages[stickerType];
    if (!img) {
        showNotification('Error loading sticker image');
        return;
    }

    // Calculate initial sticker size as 75% of canvas width
    const targetWidth = canvas.width * 0.75;  // Changed from 0.5 to 0.75
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    const stickerWidth = targetWidth;
    const stickerHeight = targetWidth / aspectRatio;

    // Center the sticker
    const x = (canvas.width - stickerWidth) / 2;
    const y = (canvas.height - stickerHeight) / 2;

    const newSticker = {
        id: Date.now(),
        type: stickerType,
        x: x,
        y: y,
        width: stickerWidth,
        height: stickerHeight,
        img: img
    };

    stickers.push(newSticker);
    redrawCanvas();
    showNotification('Sticker added - tap and hold to move, drag corner to resize');
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

function redrawCanvas() {
    // Clear the entire canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Redraw the original photo
    const photo = new Image();
    photo.src = canvas.toDataURL();
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Now draw all stickers
    stickers.forEach(sticker => {
        ctx.drawImage(sticker.img, sticker.x, sticker.y, sticker.width, sticker.height);

// Draw resize handle - larger white arrows
        ctx.save();
        ctx.translate(sticker.x + sticker.width, sticker.y + sticker.height);
        ctx.rotate(Math.PI / 4); // 45-degree rotation

        // Draw white arrow with black outline
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 6;  // Increased line width
        ctx.fillStyle = 'white';

        // Draw bidirectional arrow
        const arrowSize = 60;  // Increased from 20 to 60
        // Arrow body
        ctx.beginPath();
        ctx.moveTo(-arrowSize/2, 0);
        ctx.lineTo(arrowSize/2, 0);
        ctx.lineWidth = 8;  // Increased line width
        ctx.stroke();

        // Arrow heads
        const headSize = 24;  // Increased from 8 to 24
        // Left arrow head
        ctx.beginPath();
        ctx.moveTo(-arrowSize/2, 0);
        ctx.lineTo(-arrowSize/2 + headSize, -headSize/2);
        ctx.lineTo(-arrowSize/2 + headSize, headSize/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Right arrow head
        ctx.beginPath();
        ctx.moveTo(arrowSize/2, 0);
        ctx.lineTo(arrowSize/2 - headSize, -headSize/2);
        ctx.lineTo(arrowSize/2 - headSize, headSize/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    });
}

function setupTouchHandlers() {
    canvas.addEventListener('touchstart', handleTouchStart, false);
    canvas.addEventListener('touchmove', handleTouchMove, false);
    canvas.addEventListener('touchend', handleTouchEnd, false);
}

function handleTouchStart(evt) {
    evt.preventDefault();
    const touch = evt.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // Check if touch is on a sticker
    stickers.forEach(sticker => {
        // Check for resize handle
        const resizeDistance = Math.hypot(
            x - (sticker.x + sticker.width),
            y - (sticker.y + sticker.height)
        );
        if (resizeDistance < 20) {
            activeSticker = sticker;
            isDragging = false;
            initialSticker = { ...sticker };
            startX = x;
            startY = y;
            return;
        }

        // Check for drag
        if (x >= sticker.x && x <= sticker.x + sticker.width &&
            y >= sticker.y && y <= sticker.y + sticker.height) {
            activeSticker = sticker;
            isDragging = true;
            startX = x - sticker.x;
            startY = y - sticker.y;
        }
    });
}

function handleTouchMove(evt) {
    if (!activeSticker) return;
    evt.preventDefault();

    const touch = evt.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (isDragging) {
        // Handle dragging
        activeSticker.x = x - startX;
        activeSticker.y = y - startY;
    } else {
        // Handle resizing with aspect ratio
        const originalAspectRatio = activeSticker.img.naturalWidth / activeSticker.img.naturalHeight;

        // Calculate new width based on drag position
        const newWidth = Math.max(50, Math.abs(x - activeSticker.x));
        // Calculate height to maintain aspect ratio
        const newHeight = newWidth / originalAspectRatio;

        activeSticker.width = newWidth;
        activeSticker.height = newHeight;
    }

    redrawCanvas();
}

function handleTouchEnd() {
    activeSticker = null;
    isDragging = false;
}

function toggleSticker(stickerType) {
    // Check if this type of sticker already exists
    const existingSticker = stickers.find(s => s.type === stickerType);

    if (existingSticker) {
        // Remove the sticker if it exists
        stickers = stickers.filter(s => s.type !== stickerType);
        redrawCanvas();
        showNotification('Sticker removed');
    } else {
        // Add new sticker if it doesn't exist
        addSticker(stickerType);
    }
}
