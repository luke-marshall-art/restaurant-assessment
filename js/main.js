let currentLocation = 'front';
let stream = null;
let stickers = [];
let activeSticker = null;
let isDragging = false;
let startX = 0;
let startY = 0;
let initialSticker = null;
let basePhoto = null;
let baseImage = null;
let isMouseDown = false;
let isResizing = false;
let initialDistance = 0;
let initialScale = 1;
let isPinching = false;

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

        // Initialize the base image
        baseImage = new Image();
        baseImage.onload = () => {
            console.log('Base image initialized');
        };
        baseImage.src = basePhoto;

        stream.getTracks().forEach(track => track.stop());
        stream = null;

        video.style.display = 'none';
        canvas.style.display = 'block';
        captureBtn.disabled = true;
        saveBtn.disabled = false;

        // Setup all interaction handlers
        setupInteractionHandlers();
        canvas.addEventListener('mousemove', handleMouseOver, false);

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

    // Force a redraw of the base photo first
    const photo = new Image();
    photo.src = basePhoto;
    ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);

    // Calculate sticker dimensions
    const targetWidth = canvas.width * 0.5;
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    const stickerWidth = targetWidth;
    const stickerHeight = targetWidth / aspectRatio;

    // Center sticker
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
    if (!basePhoto || !baseImage) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

    stickers.forEach(sticker => {
        ctx.drawImage(sticker.img, sticker.x, sticker.y, sticker.width, sticker.height);

        // Highlight active sticker
        if (sticker === activeSticker) {
            ctx.strokeStyle = '#0066cc';
            ctx.lineWidth = 2;
            ctx.strokeRect(sticker.x, sticker.y, sticker.width, sticker.height);
        }

        // Draw resize handle
        ctx.drawImage(resizeIcon,
            sticker.x + sticker.width - 30,
            sticker.y + sticker.height - 30,
            60, 60);
    });
}

function setupInteractionHandlers() {
    // Existing touch handlers
    canvas.addEventListener('touchstart', handleTouchStart, false);
    canvas.addEventListener('touchmove', handleTouchMove, false);
    canvas.addEventListener('touchend', handleTouchEnd, false);

    // New mouse handlers
    canvas.addEventListener('mousedown', handleMouseDown, false);
    canvas.addEventListener('mousemove', handleMouseMove, false);
    canvas.addEventListener('mouseup', handleMouseUp, false);
    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), false);
}

function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.type.startsWith('touch')) {
        const touch = e.touches[0] || e.changedTouches[0];
        return {
            x: (touch.clientX - rect.left) * scaleX,
            y: (touch.clientY - rect.top) * scaleY
        };
    } else {
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }
}

function handleMouseDown(e) {
    e.preventDefault();
    isMouseDown = true;
    const coords = getCanvasCoordinates(e);

    // Check for resize handle first
    stickers.forEach(sticker => {
        const resizeHandleX = sticker.x + sticker.width - 30;
        const resizeHandleY = sticker.y + sticker.height - 30;
        const resizeDistance = Math.hypot(
            coords.x - (sticker.x + sticker.width),
            coords.y - (sticker.y + sticker.height)
        );

        if (resizeDistance < 30) { // 30px hit area for resize handle
            activeSticker = sticker;
            isResizing = true;
            isDragging = false;
            initialSticker = { ...sticker };
            startX = coords.x;
            startY = coords.y;
            return;
        }

        // Check for sticker body
        if (coords.x >= sticker.x && coords.x <= sticker.x + sticker.width &&
            coords.y >= sticker.y && coords.y <= sticker.y + sticker.height) {
            activeSticker = sticker;
            isDragging = true;
            isResizing = false;
            startX = coords.x - sticker.x;
            startY = coords.y - sticker.y;
        }
    });

    // Update cursor based on action
    if (isResizing) {
        canvas.style.cursor = 'nw-resize';
    } else if (isDragging) {
        canvas.style.cursor = 'move';
    }
}

function handleMouseMove(e) {
    e.preventDefault();
    if (!isMouseDown || !activeSticker) return;

    const coords = getCanvasCoordinates(e);

    requestAnimationFrame(() => {
        if (isDragging) {
            // Move the sticker
            activeSticker.x = coords.x - startX;
            activeSticker.y = coords.y - startY;
        } else if (isResizing) {
            // Resize the sticker
            const originalAspectRatio = activeSticker.img.naturalWidth / activeSticker.img.naturalHeight;
            const newWidth = Math.max(50, Math.abs(coords.x - activeSticker.x));
            const newHeight = newWidth / originalAspectRatio;

            activeSticker.width = newWidth;
            activeSticker.height = newHeight;
        }
        redrawCanvas();
    });
}

function handleMouseUp(e) {
    e.preventDefault();
    isMouseDown = false;
    isDragging = false;
    isResizing = false;
    activeSticker = null;
    canvas.style.cursor = 'default';
}

// Update the cursor when hovering over interactive elements
function handleMouseOver(e) {
    if (isMouseDown) return;

    const coords = getCanvasCoordinates(e);
    let cursorSet = false;

    stickers.forEach(sticker => {
        const resizeDistance = Math.hypot(
            coords.x - (sticker.x + sticker.width),
            coords.y - (sticker.y + sticker.height)
        );

        if (resizeDistance < 30) {
            canvas.style.cursor = 'nw-resize';
            cursorSet = true;
            return;
        }

        if (coords.x >= sticker.x && coords.x <= sticker.x + sticker.width &&
            coords.y >= sticker.y && coords.y <= sticker.y + sticker.height) {
            canvas.style.cursor = 'move';
            cursorSet = true;
            return;
        }
    });

    if (!cursorSet) {
        canvas.style.cursor = 'default';
    }
}

function handleTouchStart(evt) {
    evt.preventDefault();

    if (evt.touches.length === 2 && activeSticker) {
        // Initialize pinch-zoom
        isPinching = true;
        isDragging = false;
        isResizing = false;

        initialDistance = getTouchDistance(evt.touches[0], evt.touches[1]);
        initialScale = activeSticker.width / activeSticker.img.naturalWidth;

        return;
    }

    if (evt.touches.length === 1) {
        isPinching = false;
        const touch = evt.touches[0];
        const coords = getCanvasCoordinates(evt);

        // Check stickers in reverse order (top to bottom)
        for (let i = stickers.length - 1; i >= 0; i--) {
            const sticker = stickers[i];

            // Check for resize handle first
            const resizeDistance = Math.hypot(
                coords.x - (sticker.x + sticker.width),
                coords.y - (sticker.y + sticker.height)
            );

            if (resizeDistance < 30) {
                activeSticker = sticker;
                isResizing = true;
                isDragging = false;
                initialSticker = { ...sticker };
                startX = coords.x;
                startY = coords.y;
                return;
            }

            // Check for sticker body
            if (coords.x >= sticker.x && coords.x <= sticker.x + sticker.width &&
                coords.y >= sticker.y && coords.y <= sticker.y + sticker.height) {
                activeSticker = sticker;
                isDragging = true;
                isResizing = false;
                startX = coords.x - sticker.x;
                startY = coords.y - sticker.y;
                // Bring sticker to front
                stickers = stickers.filter(s => s !== sticker);
                stickers.push(sticker);
                redrawCanvas();
                return;
            }
        }
    }
}


function handleTouchMove(evt) {
    evt.preventDefault();
    if (!activeSticker) return;

    if (isPinching && evt.touches.length === 2) {
        // Handle pinch-zoom
        const currentDistance = getTouchDistance(evt.touches[0], evt.touches[1]);
        const scale = (currentDistance / initialDistance);
        const center = getTouchCenter(evt.touches[0], evt.touches[1]);

        // Calculate new dimensions while maintaining aspect ratio
        const originalAspectRatio = activeSticker.img.naturalWidth / activeSticker.img.naturalHeight;
        const baseWidth = activeSticker.img.naturalWidth * initialScale;
        const newWidth = Math.max(50, baseWidth * scale);
        const newHeight = newWidth / originalAspectRatio;

        // Update sticker position to zoom around center point
        const widthDiff = newWidth - activeSticker.width;
        const heightDiff = newHeight - activeSticker.height;

        activeSticker.width = newWidth;
        activeSticker.height = newHeight;
        activeSticker.x -= widthDiff / 2;
        activeSticker.y -= heightDiff / 2;

        requestAnimationFrame(redrawCanvas);
        return;
    }

    if (evt.touches.length === 1) {
        const coords = getCanvasCoordinates(evt);

        requestAnimationFrame(() => {
            if (isDragging) {
                activeSticker.x = coords.x - startX;
                activeSticker.y = coords.y - startY;
            } else if (isResizing) {
                const originalAspectRatio = activeSticker.img.naturalWidth / activeSticker.img.naturalHeight;
                const newWidth = Math.max(50, Math.abs(coords.x - activeSticker.x));
                const newHeight = newWidth / originalAspectRatio;

                activeSticker.width = newWidth;
                activeSticker.height = newHeight;
            }
            redrawCanvas();
        });
    }
}

function handleTouchEnd(evt) {
    if (evt.touches.length === 0) {
        isPinching = false;
        isDragging = false;
        isResizing = false;
        activeSticker = null;
    } else if (evt.touches.length === 1) {
        // If we were pinching and now have one finger, reset to potential drag
        if (isPinching) {
            isPinching = false;
            const touch = evt.touches[0];
            const coords = getCanvasCoordinates({ type: 'touch', touches: [touch] });
            startX = coords.x - activeSticker.x;
            startY = coords.y - activeSticker.y;
            isDragging = true;
        }
    }
}


function toggleSticker(stickerType) {
    const existingSticker = stickers.find(s => s.type === stickerType);
    // Find the corresponding button
    const stickerButton = document.querySelector(`[data-sticker-type="${stickerType}"]`);

    if (existingSticker) {
        stickers = stickers.filter(s => s.type !== stickerType);
        redrawCanvas();
        showNotification('Sticker removed');
        // Remove active class from button
        stickerButton?.classList.remove('active');
    } else {
        addSticker(stickerType);
        // Add active class to button
        stickerButton?.classList.add('active');
    }
}

// Helper function to calculate distance between two touch points
function getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// Helper function to get center point between two touches
function getTouchCenter(touch1, touch2) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: ((touch1.clientX + touch2.clientX) / 2 - rect.left) * scaleX,
        y: ((touch1.clientY + touch2.clientY) / 2 - rect.top) * scaleY
    };
}
