// Sticker Class for handling individual stickers
class DraggableSticker {
    constructor(imageUrl, container) {
        this.imageUrl = imageUrl;
        this.container = container;
        this.position = { x: 100, y: 100 };
        this.scale = 1;
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.touchRefs = {
            initialDistance: 0,
            initialScale: 1
        };
        
        this.element = this.createStickerElement();
        this.setupEventListeners();
    }

    createStickerElement() {
        const stickerDiv = document.createElement('div');
        stickerDiv.className = 'sticker';
        stickerDiv.style.transform = `translate(${this.position.x}px, ${this.position.y}px) scale(${this.scale})`;

        const wrapper = document.createElement('div');
        wrapper.className = 'sticker-wrapper';

        const img = document.createElement('img');
        img.src = this.imageUrl;
        img.alt = 'Sticker';
        img.draggable = false; // Prevent default drag behavior

        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '×';
        deleteButton.className = 'delete-button';

        wrapper.appendChild(img);
        wrapper.appendChild(deleteButton);
        stickerDiv.appendChild(wrapper);

        return stickerDiv;
    }

    setupEventListeners() {
        // Mouse events
        this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // Touch events
        this.element.addEventListener('touchstart', this.handleTouchStart.bind(this));
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleMouseUp.bind(this));

        // Delete button
        const deleteButton = this.element.querySelector('.delete-button');
        deleteButton.addEventListener('click', () => this.element.remove());
    }

    handleMouseDown(e) {
        if (e.target.classList.contains('delete-button')) return;
        
        this.isDragging = true;
        this.dragStart = {
            x: e.clientX - this.position.x,
            y: e.clientY - this.position.y
        };
        this.element.style.zIndex = '1000';
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;

        this.position = {
            x: e.clientX - this.dragStart.x,
            y: e.clientY - this.dragStart.y
        };

        this.updateTransform();
    }

    handleMouseUp() {
        this.isDragging = false;
        this.element.style.zIndex = '';
    }

    handleTouchStart(e) {
        if (e.target.classList.contains('delete-button')) return;

        if (e.touches.length === 2) {
            // Initialize scaling
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            this.touchRefs.initialDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            this.touchRefs.initialScale = this.scale;
        } else {
            // Initialize dragging
            this.handleMouseDown(e.touches[0]);
        }
    }

    handleTouchMove(e) {
        e.preventDefault(); // Prevent screen scrolling while manipulating stickers

        if (e.touches.length === 2) {
            // Handle scaling
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            this.scale = (distance / this.touchRefs.initialDistance) * this.touchRefs.initialScale;
            this.scale = Math.min(Math.max(0.5, this.scale), 2); // Limit scale between 0.5 and 2
            this.updateTransform();
        } else {
            // Handle dragging
            this.handleMouseMove(e.touches[0]);
        }
    }

    updateTransform() {
        this.element.style.transform = `translate(${this.position.x}px, ${this.position.y}px) scale(${this.scale})`;
    }
}

// Main Application Class
class RestaurantAssessment {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.initializeCamera();
        this.currentLocation = 'front';
        this.setupStickerPalette();
    }

    initializeElements() {
        // Camera elements
        this.video = document.getElementById('camera');
        this.canvas = document.getElementById('photoCanvas');
        this.captureBtn = document.getElementById('captureBtn');
        this.switchCameraBtn = document.getElementById('switchCameraBtn');
        
        // Location buttons
        this.frontHouseBtn = document.getElementById('frontHouse');
        this.backHouseBtn = document.getElementById('backHouse');
        
        // Assessment input
        this.assessmentInput = document.getElementById('assessmentId');
        
        // Sticker container
        this.stickerContainer = document.querySelector('.sticker-container');
        
        // Camera settings
        this.stream = null;
        this.facingMode = 'environment';
    }

    setupEventListeners() {
        this.captureBtn.addEventListener('click', () => this.capturePhoto());
        this.switchCameraBtn.addEventListener('click', () => this.switchCamera());
        this.frontHouseBtn.addEventListener('click', () => this.setLocation('front'));
        this.backHouseBtn.addEventListener('click', () => this.setLocation('back'));
        this.assessmentInput.addEventListener('input', (e) => this.handleAssessmentInput(e));
    }

    setupStickerPalette() {
        const palette = document.createElement('div');
        palette.className = 'sticker-palette';

        // Define your sticker images
        const stickerImages = [
            'stickers/critical.png',
            'stickers/major.png',
            'stickers/minor.png'
        ];

        stickerImages.forEach(imageUrl => {
            const button = document.createElement('button');
            button.className = 'sticker-button';

            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = 'Sticker';

            button.appendChild(img);
            button.addEventListener('click', () => this.addSticker(imageUrl));
            palette.appendChild(button);
        });

        document.getElementById('camera-container').appendChild(palette);
    }

    addSticker(imageUrl) {
        const sticker = new DraggableSticker(imageUrl, this.stickerContainer);
        this.stickerContainer.appendChild(sticker.element);
    }

    async initializeCamera() {
        try {
            const constraints = {
                video: {
                    facingMode: this.facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
        } catch (error) {
            console.error('Camera access denied:', error);
            // You might want to show an error message to the user here
        }
    }

    async switchCamera() {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        
        await this.initializeCamera();
    }

    capturePhoto() {
        // Set canvas dimensions to match video
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;

        const ctx = this.canvas.getContext('2d');
        
        // Draw the video frame
        ctx.drawImage(this.video, 0, 0);

        // Draw all stickers onto the canvas
        const stickers = this.stickerContainer.querySelectorAll('.sticker');
        stickers.forEach(sticker => {
            const img = sticker.querySelector('img');
            const transform = new DOMMatrix(window.getComputedStyle(sticker).transform);
            
            ctx.save();
            ctx.setTransform(
                transform.a,
                transform.b,
                transform.c,
                transform.d,
                transform.e,
                transform.f
            );
            ctx.drawImage(img, 0, 0, img.width, img.height);
            ctx.restore();
        });

        // Generate filename and save
        const filename = this.generateFilename();
        this.savePhoto(filename);
    }

    generateFilename() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const location = this.currentLocation === 'front' ? 'FOH' : 'BOH';
        const assessmentId = this.assessmentInput.value || 'NOID';
        return `assessment_${assessmentId}_${location}_${timestamp}.jpg`;
    }

    savePhoto(filename) {
        // Create a temporary link to download the image
        const link = document.createElement('a');
        link.download = filename;
        link.href = this.canvas.toDataURL('image/jpeg', 0.8);
        link.click();
    }

    setLocation(location) {
        this.currentLocation = location;
        
        if (location === 'front') {
            this.frontHouseBtn.classList.add('active');
            this.backHouseBtn.classList.remove('active');
        } else {
            this.frontHouseBtn.classList.remove('active');
            this.backHouseBtn.classList.add('active');
        }
    }

    handleAssessmentInput(e) {
        // Limit to 6 digits
        if (e.target.value.length > 6) {
            e.target.value = e.target.value.slice(0, 6);
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new RestaurantAssessment();
});
