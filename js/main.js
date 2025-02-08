let currentLocation = 'front';
let stream = null;
let stickers = [];
let activeSticker = null;
let isDragging = false;
let startX = 0;
let startY = 0;
let initialSticker = null;
let basePhoto = null;
const stickerImages = {};

const video = document.getElementById('videoElement');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('captureBtn');
const saveBtn = document.getElementById('saveBtn');
const ctx = canvas.getContext('2d');
const resizeIcon = new Image();
resizeIcon.src = 'images/resize-icon.png';  // Update path as needed

// Preload sticker images
window.addEventListener('load', () => {
    const frontStickers = [
        'CED400_CRF_FR', 'CED400_CRF_PL', 'CED400_CRF_PR',
        'Delta600_CRF_FR', 'Delta600_CRF_PL', 'Delta600_CRF_PR'
    ];

    const backStickers = [
        'Low_6BIB_CRF_FR', 'Low_6BIB_CRF_PL', 'Low_6BIB_CRF_PR',
        'Mid_6BIB_CRF_FR', 'Mid_6BIB_CRF_PL', 'Mid_6BIB_CRF_PR',
        'Tall_6BIB_CRF_FR', 'Tall_6BIB_CRF_PL', 'Tall_6BIB_CRF_PR',
        'BIB_Utilities_CRF_FR'
    ];

    // Load Front of House stickers
    frontStickers.forEach(type => {
        const img = new Image();
        // Encode the URL to handle spaces correctly
        img.src = encodeURI(`images/Front of House/${type}.png`);
        stickerImages[type] = img;
        // Add error handling to debug loading issues
        img.onerror = () => {
            console.error(`Failed to load image: ${type}`);
        };
    });

    // Load Back of House stickers
    backStickers.forEach(type => {
        const img = new Image();
        img.src = encodeURI(`images/Back of House/${type}.png`);
        stickerImages[type] = img;
        img.onerror = () => {
            console.error(`Failed to load image: ${type}`);
        };
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

        // Store the base photo data
        basePhoto = canvas.toDataURL('image/png');

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

    // Adjust to 50% of canvas width for initial size
    const targetWidth = canvas.width * 0.5;
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    const stickerWidth = targetWidth;
    const stickerHeight = targetWidth / aspectRatio;

    // Center both horizontally and vertically
    const x = Math.max(0, (canvas.width - stickerWidth) / 2);
    const y = Math.max(0, (canvas.height - stickerHeight) / 2);

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
    if (!basePhoto) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the stored base photo
    const photo = new Image();
    photo.onload = () => {
        ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);

        // Draw all stickers
        stickers.forEach(sticker => {
            ctx.drawImage(sticker.img, sticker.x, sticker.y, sticker.width, sticker.height);

             // Draw resize icon in corner
            ctx.drawImage(resizeIcon,
                         sticker.x + sticker.width - 30,  // X position (15px left of corner)
                         sticker.y + sticker.height - 30, // Y position (15px up from corner)
                         60,  // Width of drawn icon
                         60); // Height of drawn icon
        });
    };
    photo.src = basePhoto;
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

   stickers.forEach(sticker => {
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
       activeSticker.x = x - startX;
       activeSticker.y = y - startY;
   } else {
       const originalAspectRatio = activeSticker.img.naturalWidth / activeSticker.img.naturalHeight;
       const newWidth = Math.max(50, Math.abs(x - activeSticker.x));
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
   const existingSticker = stickers.find(s => s.type === stickerType);

   if (existingSticker) {
       stickers = stickers.filter(s => s.type !== stickerType);
       redrawCanvas();
       showNotification('Sticker removed');
   } else {
       addSticker(stickerType);
   }
}
