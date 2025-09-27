/**
 * Visual Plot Editor - Core functionality
 * Handles canvas rendering, coordinate system, and plot objects
 */

/**
 * Base Command class for undo/redo functionality
 */
class Command {
    /**
     * Execute the command
     * @abstract
     */
    execute() {
        throw new Error('Command.execute() must be implemented');
    }
    
    /**
     * Undo the command
     * @abstract
     */
    undo() {
        throw new Error('Command.undo() must be implemented');
    }
    
    /**
     * Get a description of the command
     * @returns {string}
     */
    getDescription() {
        return 'Unknown command';
    }
}

/**
 * Command for adding objects to the plot
 */
class AddObjectCommand extends Command {
    constructor(plot_editor, object) {
        super();
        this.plot_editor = plot_editor;
        this.object = object;
    }
    
    execute() {
        this.plot_editor.plot_objects.push(this.object);
        this.plot_editor.selectObject(this.object);
        this.plot_editor.updateObjectList();
        this.plot_editor.redraw();
    }
    
    undo() {
        const index = this.plot_editor.plot_objects.findIndex(obj => obj.id === this.object.id);
        if (index !== -1) {
            this.plot_editor.plot_objects.splice(index, 1);
            this.plot_editor.selected_object = null;
            this.plot_editor.updatePropertiesPanel();
            this.plot_editor.updateObjectList();
            this.plot_editor.redraw();
        }
    }
    
    getDescription() {
        return `Add ${this.object.type}`;
    }
}

/**
 * Command for deleting objects from the plot
 */
class DeleteObjectCommand extends Command {
    constructor(plot_editor, object) {
        super();
        this.plot_editor = plot_editor;
        this.object = object;
        this.object_index = plot_editor.plot_objects.findIndex(obj => obj.id === object.id);
    }
    
    execute() {
        if (this.object_index !== -1) {
            this.plot_editor.plot_objects.splice(this.object_index, 1);
            this.plot_editor.selected_object = null;
            this.plot_editor.updatePropertiesPanel();
            this.plot_editor.updateObjectList();
            this.plot_editor.redraw();
        }
    }
    
    undo() {
        this.plot_editor.plot_objects.splice(this.object_index, 0, this.object);
        this.plot_editor.selectObject(this.object);
        this.plot_editor.updateObjectList();
        this.plot_editor.redraw();
    }
    
    getDescription() {
        return `Delete ${this.object.type}`;
    }
}

/**
 * Command for modifying object properties
 */
class ModifyObjectCommand extends Command {
    constructor(plot_editor, object, property, old_value, new_value) {
        super();
        this.plot_editor = plot_editor;
        this.object = object;
        this.property = property;
        this.old_value = old_value;
        this.new_value = new_value;
    }
    
    execute() {
        this.object[this.property] = this.new_value;
        this.plot_editor.updateObjectList();
        this.plot_editor.redraw();
    }
    
    undo() {
        this.object[this.property] = this.old_value;
        this.plot_editor.updateObjectList();
        this.plot_editor.redraw();
    }
    
    getDescription() {
        return `Modify ${this.object.type} ${this.property}`;
    }
}

/**
 * Command for moving objects
 */
class MoveObjectCommand extends Command {
    constructor(plot_editor, object, old_coords, new_coords) {
        super();
        this.plot_editor = plot_editor;
        this.object = object;
        this.old_coords = old_coords;
        this.new_coords = new_coords;
    }
    
    execute() {
        this.plot_editor.setObjectCoordinates(this.object, this.new_coords);
        this.plot_editor.updateObjectList();
        this.plot_editor.redraw();
    }
    
    undo() {
        this.plot_editor.setObjectCoordinates(this.object, this.old_coords);
        this.plot_editor.updateObjectList();
        this.plot_editor.redraw();
    }
    
    getDescription() {
        return `Move ${this.object.type}`;
    }
}

/**
 * Command for clearing all objects
 */
class ClearPlotCommand extends Command {
    constructor(plot_editor) {
        super();
        this.plot_editor = plot_editor;
        this.saved_objects = [...plot_editor.plot_objects];
        this.saved_selection = plot_editor.selected_object;
    }
    
    execute() {
        this.plot_editor.plot_objects = [];
        this.plot_editor.selected_object = null;
        this.plot_editor.updatePropertiesPanel();
        this.plot_editor.updateObjectList();
        this.plot_editor.redraw();
    }
    
    undo() {
        this.plot_editor.plot_objects = [...this.saved_objects];
        this.plot_editor.selected_object = this.saved_selection;
        this.plot_editor.updatePropertiesPanel();
        this.plot_editor.updateObjectList();
        this.plot_editor.redraw();
    }
    
    getDescription() {
        return 'Clear plot';
    }
}

class PlotEditor {
    constructor(canvas_element) {
        this.canvas = canvas_element;
        this.context = canvas_element.getContext('2d');
        
        // Create invisible picking canvas for accurate selection
        this.picking_canvas = document.createElement('canvas');
        this.picking_canvas.width = canvas_element.width;
        this.picking_canvas.height = canvas_element.height;
        this.picking_context = this.picking_canvas.getContext('2d');
        
        // Disable ALL forms of antialiasing for exact color matching
        this.picking_context.imageSmoothingEnabled = false;
        this.picking_context.webkitImageSmoothingEnabled = false;
        this.picking_context.mozImageSmoothingEnabled = false;
        this.picking_context.msImageSmoothingEnabled = false;
        this.picking_context.oImageSmoothingEnabled = false;
        
        if (this.picking_context.textRenderingOptimization) {
            this.picking_context.textRenderingOptimization = 'optimizeSpeed';
        }
        if (this.picking_context.textRendering) {
            this.picking_context.textRendering = 'optimizeSpeed';
        }
        
        this.picking_context.font = '10px monospace'; // Use monospace for consistent rendering
        
        // Color mapping for object picking
        this.object_color_map = new Map(); // color -> object_id
        this.id_color_map = new Map(); // object_id -> color
        this.next_color_id = 1;
        
        // Plot bounds and coordinate system
        this.plot_bounds = {
            x_min: -10,
            x_max: 10,
            y_min: -10,
            y_max: 10
        };
        
        // Canvas properties
        this.canvas_padding = 60;
        this.plot_width = this.canvas.width - 2 * this.canvas_padding;
        this.plot_height = this.canvas.height - 2 * this.canvas_padding;
        
        // Plot objects storage
        this.plot_objects = [];
        this.selected_object = null;
        this.current_tool = 'select';
        
        // Axes properties
        this.axes_properties = {
            x_label: 'X-axis',
            y_label: 'Y-axis',
            show_grid: true,
            aspect_ratio: 1.0
        };
        
        // Drawing state for multi-step operations
        this.drawing_state = {
            is_drawing: false,
            temp_object: null,
            start_point: null
        };
        
        // Dragging state for object movement
        this.dragging_state = {
            is_dragging: false,
            dragged_object: null,
            drag_start_mouse: null,
            drag_start_coords: null,
            drag_offset: null
        };
        
        // Initialize undo/redo system
        this.command_history = [];
        this.current_command_index = -1;
        this.max_history_size = 50;
        
        // Event handlers
        this.setupEventListeners();
        
        // Initial render
        this.updateObjectList();
        this.updateUndoRedoButtons();
        this.redraw();
    }
    
    /**
     * Convert canvas coordinates to plot coordinates
     * @param {number} canvas_x - Canvas X coordinate
     * @param {number} canvas_y - Canvas Y coordinate
     * @returns {Object} Plot coordinates {x, y}
     */
    canvasToPlot(canvas_x, canvas_y) {
        // Calculate effective dimensions considering aspect ratio (same as plotToCanvas)
        const plot_x_range = this.plot_bounds.x_max - this.plot_bounds.x_min;
        const plot_y_range = this.plot_bounds.y_max - this.plot_bounds.y_min;
        const aspect_ratio = this.axes_properties.aspect_ratio;
        
        // Determine which dimension constrains the scaling
        const canvas_aspect = this.plot_width / this.plot_height;
        const plot_aspect = (plot_x_range * aspect_ratio) / plot_y_range;
        
        let effective_width, effective_height, x_offset, y_offset;
        
        if (plot_aspect > canvas_aspect) {
            // X dimension constrains - use full width
            effective_width = this.plot_width;
            effective_height = this.plot_width / plot_aspect;
            x_offset = 0;
            y_offset = (this.plot_height - effective_height) / 2;
        } else {
            // Y dimension constrains - use full height
            effective_height = this.plot_height;
            effective_width = this.plot_height * plot_aspect;
            x_offset = (this.plot_width - effective_width) / 2;
            y_offset = 0;
        }
        
        // Reverse the transformation
        const plot_x = ((canvas_x - this.canvas_padding - x_offset) / effective_width) * plot_x_range + 
                      this.plot_bounds.x_min;
        const plot_y = this.plot_bounds.y_max - 
                      ((canvas_y - this.canvas_padding - y_offset) / effective_height) * plot_y_range;
        
        return { x: plot_x, y: plot_y };
    }
    
    /**
     * Convert plot coordinates to canvas coordinates
     * @param {number} plot_x - Plot X coordinate
     * @param {number} plot_y - Plot Y coordinate
     * @returns {Object} Canvas coordinates {x, y}
     */
    plotToCanvas(plot_x, plot_y) {
        // Calculate effective dimensions considering aspect ratio
        const plot_x_range = this.plot_bounds.x_max - this.plot_bounds.x_min;
        const plot_y_range = this.plot_bounds.y_max - this.plot_bounds.y_min;
        const aspect_ratio = this.axes_properties.aspect_ratio;
        
        // Determine which dimension constrains the scaling
        const canvas_aspect = this.plot_width / this.plot_height;
        const plot_aspect = (plot_x_range * aspect_ratio) / plot_y_range;
        
        let effective_width, effective_height, x_offset, y_offset;
        
        if (plot_aspect > canvas_aspect) {
            // X dimension constrains - use full width
            effective_width = this.plot_width;
            effective_height = this.plot_width / plot_aspect;
            x_offset = 0;
            y_offset = (this.plot_height - effective_height) / 2;
        } else {
            // Y dimension constrains - use full height
            effective_height = this.plot_height;
            effective_width = this.plot_height * plot_aspect;
            x_offset = (this.plot_width - effective_width) / 2;
            y_offset = 0;
        }
        
        const canvas_x = ((plot_x - this.plot_bounds.x_min) / plot_x_range) * effective_width + 
                        this.canvas_padding + x_offset;
        const canvas_y = this.canvas_padding + y_offset + 
                        (1 - (plot_y - this.plot_bounds.y_min) / plot_y_range) * effective_height;
        
        return { x: canvas_x, y: canvas_y };
    }
    
    /**
     * Set up event listeners for canvas interaction
     * side-effects: Adds event listeners to canvas element
     */
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('click', this.handleClick.bind(this));
    }
    
    /**
     * Handle mouse down events
     * @param {MouseEvent} event - Mouse event
     * side-effects: May start drawing operation, select object, or start dragging
     */
    handleMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const canvas_x = event.clientX - rect.left;
        const canvas_y = event.clientY - rect.top;
        const plot_coords = this.canvasToPlot(canvas_x, canvas_y);
        
        if (this.current_tool === 'select') {
            // First, check if we're clicking on an existing object
            const clicked_object = this.getObjectAt(plot_coords);
            
            if (clicked_object) {
                // Select the object and start dragging
                this.selectObject(clicked_object);
                this.startDragging(clicked_object, { x: canvas_x, y: canvas_y }, plot_coords);
            } else {
                // Clicking on empty space - deselect
                this.selectObject(null);
            }
        } else if (this.current_tool === 'line' || this.current_tool === 'area' || this.current_tool === 'brace') {
            this.startDrawing(plot_coords);
        }
    }
    
    /**
     * Handle mouse move events
     * @param {MouseEvent} event - Mouse event
     * side-effects: Updates coordinate display, drawing preview, or object dragging
     */
    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const canvas_x = event.clientX - rect.left;
        const canvas_y = event.clientY - rect.top;
        const plot_coords = this.canvasToPlot(canvas_x, canvas_y);
        
        // Update coordinate display
        this.updateCoordinateDisplay(plot_coords);
        
        // Handle dragging
        if (this.dragging_state.is_dragging) {
            this.updateDragging({ x: canvas_x, y: canvas_y }, plot_coords);
            return; // Don't handle other mouse move events while dragging
        }
        
        // Handle drawing preview
        if (this.drawing_state.is_drawing) {
            this.updateDrawingPreview(plot_coords);
        }
        
        // Update cursor based on what's under the mouse
        if (this.current_tool === 'select') {
            const object_under_mouse = this.getObjectAt(plot_coords);
            this.canvas.style.cursor = object_under_mouse ? 'move' : 'default';
        }
    }
    
    /**
     * Handle mouse up events
     * @param {MouseEvent} event - Mouse event
     * side-effects: May complete drawing operation or stop dragging
     */
    handleMouseUp(event) {
        const rect = this.canvas.getBoundingClientRect();
        const canvas_x = event.clientX - rect.left;
        const canvas_y = event.clientY - rect.top;
        const plot_coords = this.canvasToPlot(canvas_x, canvas_y);
        
        // Handle dragging completion
        if (this.dragging_state.is_dragging) {
            this.stopDragging();
            return;
        }
        
        // Handle drawing completion
        if (this.drawing_state.is_drawing) {
            this.completeDrawing(plot_coords);
        }
    }
    
    /**
     * Handle click events
     * @param {MouseEvent} event - Mouse event
     * side-effects: May add point or text object
     */
    handleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const canvas_x = event.clientX - rect.left;
        const canvas_y = event.clientY - rect.top;
        const plot_coords = this.canvasToPlot(canvas_x, canvas_y);
        
        if (this.current_tool === 'point') {
            this.addPoint(plot_coords);
        } else if (this.current_tool === 'text') {
            this.addText(plot_coords);
        }
    }
    
    /**
     * Start drawing operation for lines and areas
     * @param {Object} start_coords - Starting coordinates {x, y}
     * side-effects: Initializes drawing state
     */
    startDrawing(start_coords) {
        this.drawing_state.is_drawing = true;
        this.drawing_state.start_point = start_coords;
    }
    
    /**
     * Update drawing preview during mouse move
     * @param {Object} current_coords - Current coordinates {x, y}
     * side-effects: Redraws canvas with preview
     */
    updateDrawingPreview(current_coords) {
        this.redraw();
        
        if (this.current_tool === 'line') {
            this.drawLinePreview(this.drawing_state.start_point, current_coords);
        } else if (this.current_tool === 'area') {
            this.drawAreaPreview(this.drawing_state.start_point, current_coords);
        } else if (this.current_tool === 'brace') {
            this.drawBracePreview(this.drawing_state.start_point, current_coords);
        }
    }
    
    /**
     * Complete drawing operation
     * @param {Object} end_coords - Ending coordinates {x, y}
     * side-effects: Adds object to plot and resets drawing state
     */
    completeDrawing(end_coords) {
        if (this.current_tool === 'line') {
            this.addLine(this.drawing_state.start_point, end_coords);
        } else if (this.current_tool === 'area') {
            this.addArea(this.drawing_state.start_point, end_coords);
        } else if (this.current_tool === 'brace') {
            this.addBrace(this.drawing_state.start_point, end_coords);
        }
        
        this.drawing_state.is_drawing = false;
        this.drawing_state.start_point = null;
        this.redraw();
    }
    
    /**
     * Execute a command and add it to history
     * @param {Command} command - Command to execute
     * side-effects: Executes command, updates history
     */
    executeCommand(command) {
        // Remove any commands after current index (when redoing after undo)
        this.command_history = this.command_history.slice(0, this.current_command_index + 1);
        
        // Execute the command
        command.execute();
        
        // Add to history
        this.command_history.push(command);
        this.current_command_index++;
        
        // Limit history size
        if (this.command_history.length > this.max_history_size) {
            this.command_history.shift();
            this.current_command_index--;
        }
        
        this.updateUndoRedoButtons();
        
        // Initialize math.js for function parsing
        this.math = window.math;
    }
    
    /**
     * Undo the last command
     * side-effects: Undoes command, updates history index
     */
    undo() {
        if (this.current_command_index >= 0) {
            const command = this.command_history[this.current_command_index];
            command.undo();
            this.current_command_index--;
            this.updateUndoRedoButtons();
        }
    }
    
    /**
     * Redo the next command
     * side-effects: Redoes command, updates history index
     */
    redo() {
        if (this.current_command_index < this.command_history.length - 1) {
            this.current_command_index++;
            const command = this.command_history[this.current_command_index];
            command.execute();
            this.updateUndoRedoButtons();
        }
    }
    
    /**
     * Update undo/redo button states
     * side-effects: Updates UI button disabled states
     */
    updateUndoRedoButtons() {
        const undo_button = document.getElementById('undo-btn');
        const redo_button = document.getElementById('redo-btn');
        
        if (undo_button) {
            undo_button.disabled = this.current_command_index < 0;
            undo_button.title = this.current_command_index >= 0 ? 
                `Undo: ${this.command_history[this.current_command_index].getDescription()}` : 
                'Nothing to undo';
        }
        
        if (redo_button) {
            redo_button.disabled = this.current_command_index >= this.command_history.length - 1;
            redo_button.title = this.current_command_index < this.command_history.length - 1 ? 
                `Redo: ${this.command_history[this.current_command_index + 1].getDescription()}` : 
                'Nothing to redo';
        }
    }
    
    /**
     * Get or create a unique color for an object ID
     * @param {string} object_id - Object ID
     * @returns {string} RGB color string
     */
    getObjectColor(object_id) {
        if (this.id_color_map.has(object_id)) {
            return this.id_color_map.get(object_id);
        }
        
        // Generate unique color with collision detection
        let color = this.generateUniqueColor(object_id);
        let collision_attempts = 0;
        const max_attempts = 1000; // Prevent infinite loops
        
        // Keep trying until we get a unique color that's not a background color
        while ((this.object_color_map.has(color) || this.isBackgroundColor(color)) && collision_attempts < max_attempts) {
            collision_attempts++;
            if (this.isBackgroundColor(color)) {
                console.warn(`Background color avoided for object ${object_id}. Attempt ${collision_attempts} to resolve.`);
            } else {
                console.warn(`Color collision detected for object ${object_id}. Attempt ${collision_attempts} to resolve.`);
            }
            color = this.generateUniqueColor(object_id, collision_attempts);
        }
        
        if (collision_attempts >= max_attempts) {
            console.error(`Failed to resolve color collision for object ${object_id} after ${max_attempts} attempts.`);
            // Fallback to sequential color generation
            color = this.generateSequentialColor();
        }
        
        // Store the mapping
        this.id_color_map.set(object_id, color);
        this.object_color_map.set(color, object_id);
        
        if (collision_attempts > 0) {
            console.log(`Resolved color collision for object ${object_id} with color ${color} after ${collision_attempts} attempts.`);
        }
        
        return color;
    }
    
    /**
     * Generate a unique high-contrast color
     * @param {string} object_id - Object ID for seeding
     * @param {number} salt - Additional salt for collision resolution
     * @returns {string} RGB color string
     */
    generateUniqueColor(object_id, salt = 0) {
        // Use a hash function based on object ID and salt for deterministic but varied colors
        let hash = salt * 31; // Start with salt
        for (let i = 0; i < object_id.length; i++) {
            hash = ((hash << 5) - hash + object_id.charCodeAt(i)) & 0xffffffff;
        }
        hash = Math.abs(hash);
        
        // Generate high-contrast RGB values with different multipliers
        const r = ((hash * 73 + salt * 17) % 256);
        const g = ((hash * 151 + salt * 37) % 256);  
        const b = ((hash * 233 + salt * 59) % 256);
        
        // Ensure minimum contrast by avoiding mid-range values
        const enhance_contrast = (value) => {
            if (value < 85) return Math.max(0, value - 30);
            if (value > 170) return Math.min(255, value + 30);
            return value < 128 ? 30 : 225; // Force to dark or light
        };
        
        const final_r = enhance_contrast(r);
        const final_g = enhance_contrast(g);
        const final_b = enhance_contrast(b);
        
        return `rgb(${final_r},${final_g},${final_b})`;
    }
    
    /**
     * Generate sequential color as fallback for collision resolution
     * @returns {string} RGB color string
     */
    generateSequentialColor() {
        const color_id = this.next_color_id++;
        
        // Use bit manipulation to ensure unique colors
        const r = (color_id & 0xFF);
        const g = ((color_id >> 8) & 0xFF);
        const b = ((color_id >> 16) & 0xFF);
        
        return `rgb(${r},${g},${b})`;
    }
    
    /**
     * Get object ID from picking canvas color
     * @param {number} x - Canvas X coordinate
     * @param {number} y - Canvas Y coordinate
     * @returns {string|null} Object ID or null if no object
     */
    getObjectIdFromPicking(x, y) {
        const pixel_data = this.picking_context.getImageData(x, y, 1, 1).data;
        const color = `rgb(${pixel_data[0]},${pixel_data[1]},${pixel_data[2]})`;
        
        // Check if it's background color (transparent/white/black)
        if (this.isBackgroundColor(color)) {
            return null; // Background clicked, no object
        }
        
        const object_id = this.object_color_map.get(color);
        
        if (!object_id) {
            // Color doesn't match any known object - this shouldn't happen
            // console.error(`Invalid picking color detected: ${color} at coordinates (${x}, ${y}). This color is not mapped to any object.`);
            // console.error('Available object colors:', Array.from(this.object_color_map.keys()));
            return null;
        }
        
        return object_id;
    }
    
    /**
     * Check if a color is considered background
     * @param {string} color - RGB color string
     * @returns {boolean} True if background color
     */
    isBackgroundColor(color) {
        const background_colors = [
            'rgb(0,0,0)',     // Black
            'rgb(255,255,255)', // White
            'rgb(240,240,240)', // Light gray (common canvas background)
            'rgb(248,249,250)', // Very light gray
        ];
        return background_colors.includes(color);
    }
    
    /**
     * Debug function to show/hide picking canvas
     * @param {boolean} show - Whether to show the picking canvas
     * side-effects: Toggles picking canvas visibility for debugging
     */
    showPickingCanvas(show = true) {
        if (show) {
            // Get the canvas position relative to the viewport
            const canvas_rect = this.canvas.getBoundingClientRect();
            
            // Position picking canvas over the main canvas
            this.picking_canvas.style.position = 'fixed';
            this.picking_canvas.style.left = canvas_rect.left + 'px';
            this.picking_canvas.style.top = canvas_rect.top + 'px';
            this.picking_canvas.style.width = canvas_rect.width + 'px';
            this.picking_canvas.style.height = canvas_rect.height + 'px';
            this.picking_canvas.style.zIndex = '1000';
            this.picking_canvas.style.border = '2px solid red';
            this.picking_canvas.style.opacity = '0.7';
            this.picking_canvas.style.pointerEvents = 'none'; // Allow clicks to pass through
            this.picking_canvas.style.boxSizing = 'border-box';
            
            document.body.appendChild(this.picking_canvas);
            console.log('Picking canvas is now visible overlaying the main canvas. Use plotEditor.showPickingCanvas(false) to hide.');
        } else {
            if (this.picking_canvas.parentNode) {
                this.picking_canvas.parentNode.removeChild(this.picking_canvas);
            }
            console.log('Picking canvas hidden.');
        }
    }
    
    /**
     * Add a point to the plot
     * @param {Object} coords - Coordinates {x, y}
     * side-effects: Adds point object to plot_objects array
     */
    addPoint(coords) {
        const point_object = {
            type: 'point',
            id: this.generateId(),
            x: coords.x,
            y: coords.y,
            color: '#ff4444',
            size: 5,
            text: '',
            show_coordinates: false,
            z_index: 0,
            text_font_size: 12,
            text_font_family: 'Arial',
            coords_font_size: 10,
            coords_font_family: 'Arial'
        };
        
        const command = new AddObjectCommand(this, point_object);
        this.executeCommand(command);
    }
    
    /**
     * Add a line to the plot
     * @param {Object} start_coords - Start coordinates {x, y}
     * @param {Object} end_coords - End coordinates {x, y}
     * side-effects: Adds line object to plot_objects array
     */
    addLine(start_coords, end_coords) {
        const line_object = {
            type: 'line',
            id: this.generateId(),
            x1: start_coords.x,
            y1: start_coords.y,
            x2: end_coords.x,
            y2: end_coords.y,
            color: '#2196F3',
            width: 2,
            z_index: 0
        };
        
        const command = new AddObjectCommand(this, line_object);
        this.executeCommand(command);
    }
    
    /**
     * Add a filled area to the plot
     * @param {Object} start_coords - Start coordinates {x, y}
     * @param {Object} end_coords - End coordinates {x, y}
     * side-effects: Adds area object to plot_objects array
     */
    addArea(start_coords, end_coords) {
        const area_object = {
            type: 'area',
            id: this.generateId(),
            x1: Math.min(start_coords.x, end_coords.x),
            y1: Math.min(start_coords.y, end_coords.y),
            x2: Math.max(start_coords.x, end_coords.x),
            y2: Math.max(start_coords.y, end_coords.y),
            fill_color: '#4CAF5050',
            border_color: '#4CAF50',
            z_index: 0
        };
        const command = new AddObjectCommand(this, area_object);
        this.executeCommand(command);
    }
    
    /**
     * Add text to the plot
     * @param {Object} coords - Coordinates {x, y}
     * side-effects: Adds text object to plot_objects array
     */
    addText(coords) {
        const text_content = prompt('Enter text:');
        if (text_content) {
            const text_object = {
                type: 'text',
                id: this.generateId(),
                x: coords.x,
                y: coords.y,
                text: text_content,
                color: '#333333',
                font_size: 14,
                font_family: 'Arial',
                rotation: 0,
                z_index: 0
            };
            const command = new AddObjectCommand(this, text_object);
            this.executeCommand(command);
            this.redraw();
        }
    }
    
    /**
     * Add a curly brace to the plot
     * @param {Object} start_coords - Start coordinates {x, y}
     * @param {Object} end_coords - End coordinates {x, y}
     * side-effects: Adds brace object to plot_objects array
     */
    addBrace(start_coords, end_coords = null) {
        if (end_coords === null) {
            // Single click - create default brace
            const length = Math.sqrt(2 ** 2 + 3 ** 2); // Default brace length
            const default_elevation = 15; // Default elevation set to 15
            
            const brace_object = {
                type: 'brace',
                id: this.generateId(),
                x1: start_coords.x,
                y1: start_coords.y,
                x2: start_coords.x + 2,
                y2: start_coords.y + 3,
                color: '#333333',
                mirrored: false,
                style: '45deg', // 45deg, smooth, or traditional
                elevation: default_elevation,
                z_index: 0
            };
            const command = new AddObjectCommand(this, brace_object);
            this.executeCommand(command);
        } else {
            // Two points - create brace between them
            const length = Math.sqrt((end_coords.x - start_coords.x) ** 2 + (end_coords.y - start_coords.y) ** 2);
            const default_elevation = 15; // Default elevation set to 15
            
            const brace_object = {
                type: 'brace',
                id: this.generateId(),
                x1: start_coords.x,
                y1: start_coords.y,
                x2: end_coords.x,
                y2: end_coords.y,
                color: '#333333',
                mirrored: false,
                style: '45deg', // 45deg, smooth, or traditional
                elevation: default_elevation,
                z_index: 0
            };
            const command = new AddObjectCommand(this, brace_object);
            this.executeCommand(command);
        }
    }
    
    /**
     * Add a mathematical function to the plot
     * @param {string} expression - Function expression (e.g., "x^2", "sin(x)", "1/x")
     * @param {number|null} xMin - Start of x range (null for axes bounds)
     * @param {number|null} xMax - End of x range (null for axes bounds)
     * @param {string} color - Function color
     * @param {number} width - Line width
     * side-effects: Adds function object to plot_objects array
     */
    addFunction(expression, xMin, xMax, color = '#0066cc', width = 2) {
        const function_object = {
            type: 'function',
            id: this.generateId(),
            expression: expression,
            xMin: xMin,
            xMax: xMax,
            color: color,
            width: width,
            z_index: 0
        };

        const command = new AddObjectCommand(this, function_object);
        this.executeCommand(command);
        this.redraw();
    }
    
    /**
     * Update the object list display
     * side-effects: Updates the object list HTML
     */
    updateObjectList() {
        const object_list = document.getElementById('object-list');
        if (!object_list) return;
        
        if (this.plot_objects.length === 0) {
            object_list.innerHTML = '<p class="no-objects">No objects in plot</p>';
            return;
        }
        
        let html = '';
        for (const obj of this.plot_objects) {
            const is_selected = this.selected_object && this.selected_object.id === obj.id;
            const selected_class = is_selected ? 'selected' : '';
            
            let object_name = '';
            switch (obj.type) {
                case 'point':
                    object_name = `Point (${obj.x.toFixed(1)}, ${obj.y.toFixed(1)})`;
                    break;
                case 'line':
                    object_name = `Line (${obj.x1.toFixed(1)}, ${obj.y1.toFixed(1)}) to (${obj.x2.toFixed(1)}, ${obj.y2.toFixed(1)})`;
                    break;
                case 'area':
                    object_name = `Area (${obj.x1.toFixed(1)}, ${obj.y1.toFixed(1)}) to (${obj.x2.toFixed(1)}, ${obj.y2.toFixed(1)})`;
                    break;
                case 'text':
                    object_name = `Text: "${obj.text}"`;
                    break;
                case 'brace':
                    object_name = `Brace (${obj.x1.toFixed(1)}, ${obj.y1.toFixed(1)}) to (${obj.x2.toFixed(1)}, ${obj.y2.toFixed(1)})`;
                    break;
                case 'function':
                    const xMinDisplay = obj.xMin !== null ? obj.xMin.toFixed(1) : '-∞';
                    const xMaxDisplay = obj.xMax !== null ? obj.xMax.toFixed(1) : '∞';
                    object_name = `Function: f(x) = ${obj.expression} (${xMinDisplay} to ${xMaxDisplay})`;
                    break;
                default:
                    object_name = `${obj.type} object`;
            }
            
            html += `<div class="object-item ${selected_class}" data-object-id="${obj.id}">
                        <span class="object-name">${object_name}</span>
                        <span class="object-type">${obj.type}</span>
                    </div>`;
        }
        
        object_list.innerHTML = html;
    }
    
    /**
     * Update the properties panel for the selected object
     * side-effects: Updates the properties panel HTML
     */
    updatePropertiesPanel() {
        const properties_container = document.getElementById('object-properties');
        if (!properties_container) return;
        
        if (!this.selected_object) {
            properties_container.innerHTML = '<div class="no-selection">No object selected</div>';
            return;
        }
        
        let properties_html = `<div class="properties-header">
            <h4>${this.selected_object.type.charAt(0).toUpperCase() + this.selected_object.type.slice(1)} Properties</h4>
        </div>`;
        
        switch (this.selected_object.type) {
            case 'point':
                properties_html += `
                    <div class="property-row">
                        <label>X:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x}" 
                               onchange="plotEditor.updateObjectProperty('x', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y}" 
                               onchange="plotEditor.updateObjectProperty('y', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Size:</label>
                        <input type="number" min="1" max="50" step="1" value="${this.selected_object.size || 5}" 
                               onchange="plotEditor.updateObjectProperty('size', parseInt(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Color:</label>
                        <input type="color" class="color-input" value="${this.selected_object.color}" 
                               onchange="plotEditor.updateObjectProperty('color', this.value)">
                    </div>
                    <div class="property-row">
                        <label>Text:</label>
                        <input type="text" value="${this.selected_object.text || ''}" 
                               onchange="plotEditor.updateObjectProperty('text', this.value)">
                    </div>
                    <div class="property-row">
                        <label>Show Coordinates:</label>
                        <input type="checkbox" ${this.selected_object.show_coordinates ? 'checked' : ''} 
                               onchange="plotEditor.updateObjectProperty('show_coordinates', this.checked)">
                    </div>
                    <div class="property-row">
                        <label>Z-Index:</label>
                        <input type="number" value="${this.selected_object.z_index || 0}" 
                               onchange="plotEditor.updateObjectProperty('z_index', parseInt(this.value))">
                    </div>`;
                break;
            case 'line':
                properties_html += `
                    <div class="property-row">
                        <label>X1:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x1}" 
                               onchange="plotEditor.updateObjectProperty('x1', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y1:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y1}" 
                               onchange="plotEditor.updateObjectProperty('y1', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>X2:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x2}" 
                               onchange="plotEditor.updateObjectProperty('x2', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y2:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y2}" 
                               onchange="plotEditor.updateObjectProperty('y2', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Color:</label>
                        <input type="color" class="color-input" value="${this.selected_object.color}" 
                               onchange="plotEditor.updateObjectProperty('color', this.value)">
                    </div>
                    <div class="property-row">
                        <label>Width:</label>
                        <input type="number" min="1" max="20" step="1" value="${this.selected_object.width || 2}" 
                               onchange="plotEditor.updateObjectProperty('width', parseInt(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Z-Index:</label>
                        <input type="number" value="${this.selected_object.z_index || 0}" 
                               onchange="plotEditor.updateObjectProperty('z_index', parseInt(this.value))">
                    </div>`;
                break;
            case 'area':
                properties_html += `
                    <div class="property-row">
                        <label>X1:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x1}" 
                               onchange="plotEditor.updateObjectProperty('x1', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y1:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y1}" 
                               onchange="plotEditor.updateObjectProperty('y1', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>X2:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x2}" 
                               onchange="plotEditor.updateObjectProperty('x2', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y2:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y2}" 
                               onchange="plotEditor.updateObjectProperty('y2', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Color:</label>
                        <input type="color" class="color-input" value="${this.selected_object.color}" 
                               onchange="plotEditor.updateObjectProperty('color', this.value)">
                    </div>
                    <div class="property-row">
                        <label>Z-Index:</label>
                        <input type="number" value="${this.selected_object.z_index || 0}" 
                               onchange="plotEditor.updateObjectProperty('z_index', parseInt(this.value))">
                    </div>`;
                break;
            case 'text':
                properties_html += `
                    <div class="property-row">
                        <label>X:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x}" 
                               onchange="plotEditor.updateObjectProperty('x', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y}" 
                               onchange="plotEditor.updateObjectProperty('y', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Text:</label>
                        <input type="text" value="${this.selected_object.text}" 
                               onchange="plotEditor.updateObjectProperty('text', this.value)">
                    </div>
                    <div class="property-row">
                        <label>Color:</label>
                        <input type="color" class="color-input" value="${this.selected_object.color}" 
                               onchange="plotEditor.updateObjectProperty('color', this.value)">
                    </div>
                    <div class="property-row">
                        <label>Font Size:</label>
                        <input type="number" min="8" max="72" step="1" value="${this.selected_object.font_size || 12}" 
                               onchange="plotEditor.updateObjectProperty('font_size', parseInt(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Font Family:</label>
                        <select onchange="plotEditor.updateObjectProperty('font_family', this.value)" style="width: 100%;">
                            <option value="Arial" ${(this.selected_object.font_family || 'Arial') === 'Arial' ? 'selected' : ''}>Arial</option>
                            <option value="Times New Roman" ${(this.selected_object.font_family || 'Arial') === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                            <option value="Courier New" ${(this.selected_object.font_family || 'Arial') === 'Courier New' ? 'selected' : ''}>Courier New</option>
                            <option value="Georgia" ${(this.selected_object.font_family || 'Arial') === 'Georgia' ? 'selected' : ''}>Georgia</option>
                        </select>
                    </div>
                    <div class="property-row">
                        <label>Rotation (degrees):</label>
                        <input type="number" min="-360" max="360" step="1" value="${this.selected_object.rotation || 0}" 
                               onchange="plotEditor.updateObjectProperty('rotation', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Z-Index:</label>
                        <input type="number" value="${this.selected_object.z_index || 0}" 
                               onchange="plotEditor.updateObjectProperty('z_index', parseInt(this.value))">
                    </div>`;
                break;
            case 'brace':
                properties_html += `
                    <div class="property-row">
                        <label>X1:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x1}" 
                               onchange="plotEditor.updateObjectProperty('x1', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y1:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y1}" 
                               onchange="plotEditor.updateObjectProperty('y1', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>X2:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x2}" 
                               onchange="plotEditor.updateObjectProperty('x2', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y2:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y2}" 
                               onchange="plotEditor.updateObjectProperty('y2', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Color:</label>
                        <input type="color" class="color-input" value="${this.selected_object.color}" 
                               onchange="plotEditor.updateObjectProperty('color', this.value)">
                    </div>
                    <div class="property-row">
                        <label>Mirror:</label>
                        <input type="checkbox" ${this.selected_object.mirrored ? 'checked' : ''} 
                               onchange="plotEditor.updateObjectProperty('mirrored', this.checked)">
                    </div>
                    <div class="property-row">
                        <label>Style:</label>
                        <select onchange="plotEditor.updateObjectProperty('style', this.value)" style="width: 100%;">
                            <option value="smooth" ${(this.selected_object.style || '45deg') === 'smooth' ? 'selected' : ''}>Smooth</option>
                            <option value="traditional" ${(this.selected_object.style || '45deg') === 'traditional' ? 'selected' : ''}>Traditional</option>
                            <option value="45deg" ${(this.selected_object.style || '45deg') === '45deg' ? 'selected' : ''}>45° (No Overlap)</option>
                        </select>
                    </div>
                    <div class="property-row">
                        <label>Elevation:</label>
                        <input type="number" min="1" max="100" step="1" value="${this.selected_object.elevation || this.selected_object.width || 15}" 
                               onchange="plotEditor.updateObjectProperty('elevation', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Z-Index:</label>
                        <input type="number" value="${this.selected_object.z_index || 0}" 
                               onchange="plotEditor.updateObjectProperty('z_index', parseInt(this.value))">
                    </div>`;
                break;
            case 'function':
                const funcXMinDisplay = this.selected_object.xMin !== null ? this.selected_object.xMin : '-∞';
                const funcXMaxDisplay = this.selected_object.xMax !== null ? this.selected_object.xMax : '∞';
                properties_html += `
                    <div class="property-row">
                        <label>Expression:</label>
                        <input type="text" value="${this.selected_object.expression}"
                               onchange="plotEditor.updateObjectProperty('expression', this.value)">
                    </div>
                    <div class="property-row">
                        <label>X Min:</label>
                        <input type="text" value="${funcXMinDisplay}"
                               onchange="plotEditor.updateObjectProperty('xMin', this.value === '-∞' || this.value === '' ? null : parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>X Max:</label>
                        <input type="text" value="${funcXMaxDisplay}"
                               onchange="plotEditor.updateObjectProperty('xMax', this.value === '∞' || this.value === '' ? null : parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Color:</label>
                        <input type="color" class="color-input" value="${this.selected_object.color}"
                               onchange="plotEditor.updateObjectProperty('color', this.value)">
                    </div>
                    <div class="property-row">
                        <label>Width:</label>
                        <input type="number" min="1" max="20" step="1" value="${this.selected_object.width || 2}"
                               onchange="plotEditor.updateObjectProperty('width', parseInt(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Z-Index:</label>
                        <input type="number" value="${this.selected_object.z_index || 0}"
                               onchange="plotEditor.updateObjectProperty('z_index', parseInt(this.value))">
                    </div>`;
                break;
        }
        
        properties_html += `
            <button class="delete-btn" onclick="plotEditor.deleteSelectedObject()">Delete Object</button>
        </div>`;
        
        properties_container.innerHTML = properties_html;
    }
    
    /**
     * Select object at given coordinates
     * @param {Object} coords - Coordinates {x, y}
     * side-effects: Changes selected_object
     */
    selectObjectAt(coords) {
        const closest_object = this.getObjectAt(coords);
        this.selectObject(closest_object);
    }
    
    /**
     * Get object at given coordinates
     * @param {Object} coords - Coordinates {x, y}
     * @returns {Object|null} Object at coordinates or null
     */
    getObjectAt(coords) {
        // Convert plot coordinates to canvas coordinates
        const canvas_coords = this.plotToCanvas(coords.x, coords.y);
        
        // Get object ID from picking canvas
        const object_id = this.getObjectIdFromPicking(canvas_coords.x, canvas_coords.y);
        
        if (object_id) {
            return this.plot_objects.find(obj => obj.id === object_id) || null;
        }
        
        return null;
    }
    
    /**
     * Get distance from coordinates to object
     * @param {Object} obj - Plot object
     * @param {Object} coords - Coordinates {x, y}
     * @returns {number} Distance to object
     */
    getDistanceToObject(obj, coords) {
        switch (obj.type) {
            case 'point':
                return Math.sqrt(Math.pow(obj.x - coords.x, 2) + Math.pow(obj.y - coords.y, 2));
            case 'line':
                return this.distanceToLine(coords, {x: obj.x1, y: obj.y1}, {x: obj.x2, y: obj.y2});
            case 'area':
                return this.distanceToRectangle(coords, obj);
            case 'text':
                return this.distanceToTextBBox(coords, obj);
            case 'brace':
                return this.distanceToLine(coords, {x: obj.x1, y: obj.y1}, {x: obj.x2, y: obj.y2});
            default:
                return Infinity;
        }
    }
    
    /**
     * Calculate distance from point to line segment
     * @param {Object} point - Point coordinates {x, y}
     * @param {Object} line_start - Line start coordinates {x, y}
     * @param {Object} line_end - Line end coordinates {x, y}
     * @returns {number} Distance to line
     */
    distanceToLine(point, line_start, line_end) {
        const line_length_squared = Math.pow(line_end.x - line_start.x, 2) + Math.pow(line_end.y - line_start.y, 2);
        if (line_length_squared === 0) return Math.sqrt(Math.pow(point.x - line_start.x, 2) + Math.pow(point.y - line_start.y, 2));
        
        const t = Math.max(0, Math.min(1, ((point.x - line_start.x) * (line_end.x - line_start.x) + 
                                           (point.y - line_start.y) * (line_end.y - line_start.y)) / line_length_squared));
        
        const projection = {
            x: line_start.x + t * (line_end.x - line_start.x),
            y: line_start.y + t * (line_end.y - line_start.y)
        };
        
        return Math.sqrt(Math.pow(point.x - projection.x, 2) + Math.pow(point.y - projection.y, 2));
    }
    
    /**
     * Calculate distance from point to rectangle
     * @param {Object} point - Point coordinates {x, y}
     * @param {Object} rect - Rectangle object with x1, y1, x2, y2
     * @returns {number} Distance to rectangle
     */
    distanceToRectangle(point, rect) {
        const dx = Math.max(rect.x1 - point.x, 0, point.x - rect.x2);
        const dy = Math.max(rect.y1 - point.y, 0, point.y - rect.y2);
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Calculate distance from point to text bounding box (considering rotation)
     * @param {Object} point - Point coordinates {x, y}
     * @param {Object} text_obj - Text object
     * @returns {number} Distance to text bounding box (0 if inside)
     */
    distanceToTextBBox(point, text_obj) {
        // Get text dimensions by measuring
        this.context.save();
        this.context.font = `${text_obj.font_size}px ${text_obj.font_family}`;
        const text_metrics = this.context.measureText(text_obj.text);
        const text_width = text_metrics.width;
        const text_height = text_obj.font_size; // Approximate height
        this.context.restore();
        
        // Convert to plot coordinates
        const text_width_plot = text_width / (this.plot_width / (this.plot_bounds.x_max - this.plot_bounds.x_min));
        const text_height_plot = text_height / (this.plot_height / (this.plot_bounds.y_max - this.plot_bounds.y_min));
        
        // Text anchor point
        const text_x = text_obj.x;
        const text_y = text_obj.y;
        
        // If no rotation, use simple rectangle check
        if (!text_obj.rotation || text_obj.rotation === 0) {
            // Simple bounding box (text extends to the right and up from anchor point)
            const bbox = {
                x1: text_x,
                y1: text_y - text_height_plot,
                x2: text_x + text_width_plot,
                y2: text_y
            };
            
            const dx = Math.max(bbox.x1 - point.x, 0, point.x - bbox.x2);
            const dy = Math.max(bbox.y1 - point.y, 0, point.y - bbox.y2);
            return Math.sqrt(dx * dx + dy * dy);
        }
        
        // For rotated text, transform the point to text's local coordinate system
        const rotation_rad = (text_obj.rotation * Math.PI) / 180;
        const cos_rot = Math.cos(-rotation_rad); // Negative because we're transforming point, not text
        const sin_rot = Math.sin(-rotation_rad);
        
        // Translate point relative to text anchor
        const rel_x = point.x - text_x;
        const rel_y = point.y - text_y;
        
        // Rotate point to text's local coordinate system
        const local_x = rel_x * cos_rot - rel_y * sin_rot;
        const local_y = rel_x * sin_rot + rel_y * cos_rot;
        
        // Check against unrotated bounding box in local coordinates
        const bbox = {
            x1: 0,
            y1: -text_height_plot,
            x2: text_width_plot,
            y2: 0
        };
        
        const dx = Math.max(bbox.x1 - local_x, 0, local_x - bbox.x2);
        const dy = Math.max(bbox.y1 - local_y, 0, local_y - bbox.y2);
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Select an object
     * @param {Object|null} obj - Object to select or null to deselect
     * side-effects: Updates selected_object and UI
     */
    selectObject(obj) {
        this.selected_object = obj;
        this.updatePropertiesPanel();
        this.updateObjectList();
        this.redraw();
    }
    
    /**
     * Generate unique ID for objects
     * @returns {string} Unique identifier
     */
    generateId() {
        return 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Set current drawing tool
     * @param {string} tool - Tool name
     * side-effects: Changes current_tool
     */
    setTool(tool) {
        this.current_tool = tool;
        this.drawing_state.is_drawing = false;
        this.selected_object = null;
        this.updatePropertiesPanel();
        this.redraw();
    }
    
    /**
     * Update plot bounds
     * @param {Object} bounds - New bounds {x_min, x_max, y_min, y_max}
     * side-effects: Updates plot_bounds and redraws
     */
    updatePlotBounds(bounds) {
        this.plot_bounds = { ...bounds };
        this.redraw();
    }
    
    /**
     * Update axes properties
     * @param {Object} properties - Axes properties
     * side-effects: Updates axes_properties and redraws
     */
    updateAxesProperties(properties) {
        this.axes_properties = { ...this.axes_properties, ...properties };
        this.redraw();
    }
    
    /**
     * Clear all plot objects
     * side-effects: Empties plot_objects array and redraws
     */
    clearPlot() {
        if (this.plot_objects.length > 0) {
            const command = new ClearPlotCommand(this);
            this.executeCommand(command);
        }
    }
    
    /**
     * Delete selected object
     * side-effects: Removes object from plot_objects array
     */
    deleteSelectedObject() {
        if (this.selected_object) {
            const command = new DeleteObjectCommand(this, this.selected_object);
            this.executeCommand(command);
        }
    }
    
    /**
     * Update object property
     * @param {string} property - Property name
     * @param {any} value - New value
     * side-effects: Updates selected object and redraws
     */
    updateObjectProperty(property, value) {
        if (this.selected_object) {
            const old_value = this.selected_object[property];
            if (old_value !== value) {
                const command = new ModifyObjectCommand(this, this.selected_object, property, old_value, value);
                this.executeCommand(command);
            }
        }
    }
    
    /**
     * Start dragging an object
     * @param {Object} obj - Object to drag
     * @param {Object} mouse_coords - Mouse canvas coordinates {x, y}
     * @param {Object} plot_coords - Plot coordinates {x, y}
     * side-effects: Initializes dragging state
     */
    startDragging(obj, mouse_coords, plot_coords) {
        this.dragging_state.is_dragging = true;
        this.dragging_state.dragged_object = obj;
        this.dragging_state.drag_start_mouse = mouse_coords;
        this.dragging_state.drag_start_coords = plot_coords;
        
        // Store the original object coordinates for reference
        this.dragging_state.original_coords = this.getObjectCoordinates(obj);
        
        // Change cursor to grabbing
        this.canvas.style.cursor = 'grabbing';
    }
    
    /**
     * Update object position during dragging
     * @param {Object} mouse_coords - Current mouse canvas coordinates {x, y}
     * @param {Object} plot_coords - Current plot coordinates {x, y}
     * side-effects: Updates object coordinates and redraws
     */
    updateDragging(mouse_coords, plot_coords) {
        if (!this.dragging_state.is_dragging || !this.dragging_state.dragged_object) return;
        
        const obj = this.dragging_state.dragged_object;
        const dx = plot_coords.x - this.dragging_state.drag_start_coords.x;
        const dy = plot_coords.y - this.dragging_state.drag_start_coords.y;
        
        // Update object coordinates based on its type
        this.updateObjectCoordinates(obj, dx, dy);
        
        // Update UI and redraw
        this.updateObjectList();
        this.updatePropertiesPanel();
        this.redraw();
    }
    
    /**
     * Stop dragging operation
     * side-effects: Resets dragging state and cursor
     */
    stopDragging() {
        if (this.dragging_state.is_dragging && this.dragging_state.dragged_object && this.dragging_state.original_coords) {
            const current_coords = this.getObjectCoordinates(this.dragging_state.dragged_object);
            
            // Check if the object actually moved
            const moved = JSON.stringify(this.dragging_state.original_coords) !== JSON.stringify(current_coords);
            
            if (moved) {
                // Create and execute move command for undo/redo
                const command = new MoveObjectCommand(
                    this, 
                    this.dragging_state.dragged_object, 
                    this.dragging_state.original_coords, 
                    current_coords
                );
                
                // Add to history without executing (object already moved during drag)
                this.command_history = this.command_history.slice(0, this.current_command_index + 1);
                this.command_history.push(command);
                this.current_command_index++;
                
                if (this.command_history.length > this.max_history_size) {
                    this.command_history.shift();
                    this.current_command_index--;
                }
                
                this.updateUndoRedoButtons();
            }
        }
        
        this.dragging_state.is_dragging = false;
        this.dragging_state.dragged_object = null;
        this.dragging_state.drag_start_mouse = null;
        this.dragging_state.drag_start_coords = null;
        this.dragging_state.original_coords = null;
        
        // Reset cursor
        this.canvas.style.cursor = 'default';
    }
    
    /**
     * Get coordinates from object based on its type
     * @param {Object} obj - Plot object
     * @returns {Object} Object coordinates
     */
    getObjectCoordinates(obj) {
        switch (obj.type) {
            case 'point':
            case 'text':
                return { x: obj.x, y: obj.y };
            case 'line':
            case 'area':
            case 'brace':
                return { x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2 };
            default:
                return {};
        }
    }
    
    /**
     * Update object coordinates during dragging
     * @param {Object} obj - Plot object to update
     * @param {number} dx - X offset from drag start
     * @param {number} dy - Y offset from drag start
     * side-effects: Updates object coordinates
     */
    updateObjectCoordinates(obj, dx, dy) {
        const original = this.dragging_state.original_coords;
        
        switch (obj.type) {
            case 'point':
            case 'text':
                obj.x = original.x + dx;
                obj.y = original.y + dy;
                break;
            case 'line':
            case 'area':
            case 'brace':
                obj.x1 = original.x1 + dx;
                obj.y1 = original.y1 + dy;
                obj.x2 = original.x2 + dx;
                obj.y2 = original.y2 + dy;
                break;
        }
    }
    
    /**
     * Set object coordinates to absolute values
     * @param {Object} obj - Object to update
     * @param {Object} coords - New coordinate values
     * side-effects: Updates object coordinates
     */
    setObjectCoordinates(obj, coords) {
        switch (obj.type) {
            case 'point':
            case 'text':
                obj.x = coords.x;
                obj.y = coords.y;
                break;
            case 'line':
            case 'area':
            case 'brace':
                obj.x1 = coords.x1;
                obj.y1 = coords.y1;
                obj.x2 = coords.x2;
                obj.y2 = coords.y2;
                break;
        }
    }
    
    /**
     * Main drawing function - renders entire plot
     * side-effects: Draws on canvas
     */
    redraw() {
        // Clear canvas
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw axes and grid
        this.drawAxes();
        
        // Draw all objects sorted by z-index (lowest first)
        const sorted_objects = [...this.plot_objects].sort((a, b) => (a.z_index || 0) - (b.z_index || 0));
        for (const obj of sorted_objects) {
            // Apply visual feedback for dragged objects
            if (this.dragging_state.is_dragging && this.dragging_state.dragged_object === obj) {
                this.context.save();
                this.context.globalAlpha = 0.7; // Make dragged object slightly transparent
                this.drawObject(obj);
                this.context.restore();
            } else {
                this.drawObject(obj);
            }
        }
        
        // Highlight selected object
        if (this.selected_object) {
            this.highlightObject(this.selected_object);
        }
        
        // Update picking canvas
        this.renderPickingCanvas();
    }
    
    /**
     * Completely disable antialiasing on picking context
     * side-effects: Sets all antialiasing properties to false/optimizeSpeed
     */
    disablePickingAntialiasing() {
        // Disable image smoothing (all browser prefixes)
        this.picking_context.imageSmoothingEnabled = false;
        this.picking_context.webkitImageSmoothingEnabled = false;
        this.picking_context.mozImageSmoothingEnabled = false;
        this.picking_context.msImageSmoothingEnabled = false;
        this.picking_context.oImageSmoothingEnabled = false;
        
        // Optimize text rendering for speed (no antialiasing)
        if (this.picking_context.textRenderingOptimization) {
            this.picking_context.textRenderingOptimization = 'optimizeSpeed';
        }
        if (this.picking_context.textRendering) {
            this.picking_context.textRendering = 'optimizeSpeed';
        }
        
        // Set quality to fastest (least antialiasing)
        if (this.picking_context.imageSmoothingQuality) {
            this.picking_context.imageSmoothingQuality = 'low';
        }
    }
    
    /**
     * Render picking canvas for accurate object selection
     * side-effects: Draws objects on invisible picking canvas with ID colors
     */
    renderPickingCanvas() {
        // Clear picking canvas
        this.picking_context.clearRect(0, 0, this.picking_canvas.width, this.picking_canvas.height);
        
        // Ensure antialiasing is completely disabled
        this.disablePickingAntialiasing();
        
        // Sort objects by z-index (lowest first for proper layering)
        const sorted_objects = [...this.plot_objects].sort((a, b) => (a.z_index || 0) - (b.z_index || 0));
        
        // First pass: Draw bounding boxes
        for (const obj of sorted_objects) {
            const color = this.getObjectColor(obj.id);
            this.drawPickingBBox(obj, color);
        }
        
        // Second pass: Draw actual objects on top (skip areas - they already have large bboxes)
        for (const obj of sorted_objects) {
            if (obj.type === 'area') {
                continue; // Skip areas - their bboxes already fully cover them
            }
            const color = this.getObjectColor(obj.id);
            this.drawPickingObject(obj, color);
        }
    }
    
    /**
     * Draw object bounding box on picking canvas
     * @param {Object} obj - Object to draw bbox for
     * @param {string} color - Picking color for this object
     * side-effects: Draws filled bbox on picking canvas
     */
    drawPickingBBox(obj, color) {
        this.picking_context.fillStyle = color;
        
        switch (obj.type) {
            case 'point':
                const point_coords = this.plotToCanvas(obj.x, obj.y);
                this.picking_context.beginPath();
                this.picking_context.arc(point_coords.x, point_coords.y, obj.size + 3, 0, 2 * Math.PI);
                this.picking_context.fill();
                break;
            case 'text':
                this.drawPickingTextBBox(obj, color);
                break;
            case 'line':
                this.drawPickingLineBBox(obj, color);
                break;
            case 'area':
                this.drawPickingAreaBBox(obj, color);
                break;
            case 'brace':
                this.drawPickingBraceBBox(obj, color);
                break;
        }
    }
    
    /**
     * Draw text bounding box on picking canvas
     * @param {Object} text_obj - Text object
     * @param {string} color - Picking color
     * side-effects: Draws filled rotated text bbox on picking canvas
     */
    drawPickingTextBBox(text_obj, color) {
        // Get text dimensions
        this.picking_context.save();
        
        // Disable antialiasing for exact color matching
        this.disablePickingAntialiasing();
        
        this.picking_context.font = `${text_obj.font_size}px ${text_obj.font_family}`;
        const text_metrics = this.picking_context.measureText(text_obj.text);
        const text_width = text_metrics.width;
        const text_height = text_obj.font_size;
        this.picking_context.restore();
        
        const text_canvas_coords = this.plotToCanvas(text_obj.x, text_obj.y);
        
        this.picking_context.save();
        this.picking_context.fillStyle = color;
        
        // Disable antialiasing for exact color matching
        this.disablePickingAntialiasing();
        
        // Apply rotation if specified
        if (text_obj.rotation && text_obj.rotation !== 0) {
            this.picking_context.translate(text_canvas_coords.x, text_canvas_coords.y);
            this.picking_context.rotate((text_obj.rotation * Math.PI) / 180);
            this.picking_context.fillRect(0, -text_height, text_width, text_height);
        } else {
            this.picking_context.fillRect(text_canvas_coords.x, text_canvas_coords.y - text_height, text_width, text_height);
        }
        
        this.picking_context.restore();
    }
    
    /**
     * Draw brace bounding box on picking canvas
     * @param {Object} brace_obj - Brace object
     * @param {string} color - Picking color
     * side-effects: Draws filled brace bbox on picking canvas
     */
    drawPickingBraceBBox(brace_obj, color) {
        const start_coords = this.plotToCanvas(brace_obj.x1, brace_obj.y1);
        const end_coords = this.plotToCanvas(brace_obj.x2, brace_obj.y2);
        
        // Calculate brace dimensions
        const dx = end_coords.x - start_coords.x;
        const dy = end_coords.y - start_coords.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length < 1) return; // Skip very short braces
        
        // Calculate perpendicular direction for brace width
        const along_x = dx / length;
        const along_y = dy / length;
        const perp_x = -along_y;
        const perp_y = along_x;
        
        // Brace extends in perpendicular direction based on elevation
        const brace_elevation = (brace_obj.elevation || brace_obj.width || 15) * 2; // Make bbox wider than actual brace
        const half_width = brace_elevation / 2;
        
        // Create bounding box around the brace
        const bbox_points = [
            {
                x: start_coords.x + perp_x * half_width,
                y: start_coords.y + perp_y * half_width
            },
            {
                x: start_coords.x - perp_x * half_width,
                y: start_coords.y - perp_y * half_width
            },
            {
                x: end_coords.x - perp_x * half_width,
                y: end_coords.y - perp_y * half_width
            },
            {
                x: end_coords.x + perp_x * half_width,
                y: end_coords.y + perp_y * half_width
            }
        ];
        
        // Draw filled polygon
        this.picking_context.save();
        this.picking_context.fillStyle = color;
        this.picking_context.beginPath();
        this.picking_context.moveTo(bbox_points[0].x, bbox_points[0].y);
        for (let i = 1; i < bbox_points.length; i++) {
            this.picking_context.lineTo(bbox_points[i].x, bbox_points[i].y);
        }
        this.picking_context.closePath();
        this.picking_context.fill();
        this.picking_context.restore();
    }
    
    /**
     * Draw area bounding box on picking canvas
     * @param {Object} area_obj - Area object
     * @param {string} color - Picking color
     * side-effects: Draws filled area bbox on picking canvas
     */
    drawPickingAreaBBox(area_obj, color) {
        const start_coords = this.plotToCanvas(area_obj.x1, area_obj.y1);
        const end_coords = this.plotToCanvas(area_obj.x2, area_obj.y2);
        
        // Calculate area dimensions
        const left = Math.min(start_coords.x, end_coords.x);
        const top = Math.min(start_coords.y, end_coords.y);
        const width = Math.abs(end_coords.x - start_coords.x);
        const height = Math.abs(end_coords.y - start_coords.y);
        
        // Draw filled rectangle
        this.picking_context.save();
        this.picking_context.fillStyle = color;
        this.picking_context.fillRect(left, top, width, height);
        this.picking_context.restore();
    }
    
    /**
     * Draw line bounding box on picking canvas (rotated rectangle around the line)
     * @param {Object} line_obj - Line object
     * @param {string} color - Picking color
     * side-effects: Draws filled rotated rectangle on picking canvas
     */
    drawPickingLineBBox(line_obj, color) {
        const start_coords = this.plotToCanvas(line_obj.x1, line_obj.y1);
        const end_coords = this.plotToCanvas(line_obj.x2, line_obj.y2);
        
        // Calculate line dimensions
        const dx = end_coords.x - start_coords.x;
        const dy = end_coords.y - start_coords.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length < 1) return; // Skip very short lines
        
        // Calculate perpendicular direction for line width
        const along_x = dx / length;
        const along_y = dy / length;
        const perp_x = -along_y;
        const perp_y = along_x;
        
        // Line extends in perpendicular direction based on width
        const line_width = Math.max(8, (line_obj.width || 2) * 4); // Make thick for picking
        const half_width = line_width / 2;
        
        // Create bounding box around the line
        const bbox_points = [
            {
                x: start_coords.x + perp_x * half_width,
                y: start_coords.y + perp_y * half_width
            },
            {
                x: start_coords.x - perp_x * half_width,
                y: start_coords.y - perp_y * half_width
            },
            {
                x: end_coords.x - perp_x * half_width,
                y: end_coords.y - perp_y * half_width
            },
            {
                x: end_coords.x + perp_x * half_width,
                y: end_coords.y + perp_y * half_width
            }
        ];
        
        // Draw filled polygon
        this.picking_context.save();
        this.picking_context.fillStyle = color;
        this.picking_context.beginPath();
        this.picking_context.moveTo(bbox_points[0].x, bbox_points[0].y);
        for (let i = 1; i < bbox_points.length; i++) {
            this.picking_context.lineTo(bbox_points[i].x, bbox_points[i].y);
        }
        this.picking_context.closePath();
        this.picking_context.fill();
        this.picking_context.restore();
    }
    
    /**
     * Draw object on picking canvas
     * @param {Object} obj - Object to draw
     * @param {string} color - Picking color for this object
     * side-effects: Draws object on picking canvas
     */
    drawPickingObject(obj, color) {
        this.picking_context.strokeStyle = color;
        this.picking_context.fillStyle = color;
        this.picking_context.lineWidth = Math.max(2, obj.width || 2); // Ensure minimum width for picking
        
        switch (obj.type) {
            case 'point':
                const point_coords = this.plotToCanvas(obj.x, obj.y);
                this.picking_context.beginPath();
                this.picking_context.arc(point_coords.x, point_coords.y, Math.max(obj.size, 3), 0, 2 * Math.PI);
                this.picking_context.fill();
                break;
            case 'line':
                const line_start = this.plotToCanvas(obj.x1, obj.y1);
                const line_end = this.plotToCanvas(obj.x2, obj.y2);
                this.picking_context.beginPath();
                this.picking_context.moveTo(line_start.x, line_start.y);
                this.picking_context.lineTo(line_end.x, line_end.y);
                this.picking_context.stroke();
                break;
            case 'area':
                const area_top_left = this.plotToCanvas(obj.x1, obj.y2);
                const area_bottom_right = this.plotToCanvas(obj.x2, obj.y1);
                this.picking_context.fillRect(area_top_left.x, area_top_left.y, 
                                            area_bottom_right.x - area_top_left.x, 
                                            area_bottom_right.y - area_top_left.y);
                break;
            case 'text':
                // Text is handled by bbox, but we can also draw the text itself
                const text_coords = this.plotToCanvas(obj.x, obj.y);
                this.picking_context.save();
                
                // Disable antialiasing for exact color matching
                this.disablePickingAntialiasing();
                
                this.picking_context.font = `${obj.font_size}px ${obj.font_family}`;
                if (obj.rotation && obj.rotation !== 0) {
                    this.picking_context.translate(text_coords.x, text_coords.y);
                    this.picking_context.rotate((obj.rotation * Math.PI) / 180);
                    this.picking_context.fillText(obj.text, 0, 0);
                } else {
                    this.picking_context.fillText(obj.text, text_coords.x, text_coords.y);
                }
                this.picking_context.restore();
                break;
            case 'brace':
                this.drawPickingBrace(obj, color);
                break;
            case 'function':
                this.drawPickingFunction(obj, color);
                break;
        }
    }
    
    /**
     * Draw brace on picking canvas using existing brace rendering code
     * @param {Object} brace_obj - Brace object
     * @param {string} color - Picking color
     * side-effects: Draws brace shape on picking canvas
     */
    drawPickingBrace(brace_obj, color) {
        // Save current context and switch to picking context
        const original_context = this.context;
        this.context = this.picking_context;
        
        // Save picking context state
        this.picking_context.save();
        
        // Disable antialiasing completely
        this.disablePickingAntialiasing();
        
        // Create a modified brace object with picking color but same width
        const picking_brace = {
            ...brace_obj,
            color: color
            // Keep original width - picking area should match visual exactly
        };
        
        // Use the existing brace drawing logic
        this.drawBrace(picking_brace);
        
        // Restore picking context state
        this.picking_context.restore();
        
        // Restore original context
        this.context = original_context;
    }

    /**
     * Draw function on picking canvas (simplified path for selection)
     * @param {Object} func_obj - Function object
     * @param {string} color - Picking color
     * side-effects: Draws function path on picking canvas
     */
    drawPickingFunction(func_obj, color) {
        try {
            // Create a compiled function for better performance
            const compiledFunction = this.math.compile(func_obj.expression);

            // Determine the actual x range to plot
            const plot_x_min = func_obj.xMin !== null ? func_obj.xMin : this.plot_bounds.x_min;
            const plot_x_max = func_obj.xMax !== null ? func_obj.xMax : this.plot_bounds.x_max;

            // Calculate number of samples (fewer than display for performance)
            const range = plot_x_max - plot_x_min;
            const samples = Math.min(Math.max(Math.floor(range * 20), 50), 500); // 20 samples per unit, min 50, max 500
            const step = range / samples;

            this.picking_context.strokeStyle = color;
            this.picking_context.lineWidth = Math.max(4, func_obj.width || 2); // Make thicker for easier picking
            this.picking_context.beginPath();

            let firstPoint = true;

            for (let i = 0; i <= samples; i++) {
                const x = plot_x_min + i * step;

                try {
                    // Evaluate function at x
                    const y = compiledFunction.evaluate({ x: x });

                    if (isFinite(y)) {
                        const canvasCoords = this.plotToCanvas(x, y);

                        // Only draw if the point is within the effective plot area
                        const effective_plot_area = this.getEffectivePlotArea();
                        if (canvasCoords.x >= effective_plot_area.left &&
                            canvasCoords.x <= effective_plot_area.right &&
                            canvasCoords.y >= effective_plot_area.top &&
                            canvasCoords.y <= effective_plot_area.bottom) {

                            if (firstPoint) {
                                this.picking_context.moveTo(canvasCoords.x, canvasCoords.y);
                                firstPoint = false;
                            } else {
                                this.picking_context.lineTo(canvasCoords.x, canvasCoords.y);
                            }
                        }
                    } else {
                        // Invalid point - end current path and start new one
                        if (!firstPoint) {
                            this.picking_context.stroke();
                            this.picking_context.beginPath();
                            firstPoint = true;
                        }
                    }
                } catch (error) {
                    // Function evaluation error - end current path and start new one
                    if (!firstPoint) {
                        this.picking_context.stroke();
                        this.picking_context.beginPath();
                        firstPoint = true;
                    }
                }
            }

            // Stroke the final path
            this.picking_context.stroke();

        } catch (error) {
            console.error('Error drawing function on picking canvas:', error);
        }
    }

    /**
     * Draw axes and grid
     * side-effects: Draws axes on canvas
     */
    drawAxes() {
        // Calculate effective dimensions considering aspect ratio (same as plotToCanvas)
        const plot_x_range = this.plot_bounds.x_max - this.plot_bounds.x_min;
        const plot_y_range = this.plot_bounds.y_max - this.plot_bounds.y_min;
        const aspect_ratio = this.axes_properties.aspect_ratio;
        
        // Determine which dimension constrains the scaling
        const canvas_aspect = this.plot_width / this.plot_height;
        const plot_aspect = (plot_x_range * aspect_ratio) / plot_y_range;
        
        let effective_width, effective_height, x_offset, y_offset;
        
        if (plot_aspect > canvas_aspect) {
            // X dimension constrains - use full width
            effective_width = this.plot_width;
            effective_height = this.plot_width / plot_aspect;
            x_offset = 0;
            y_offset = (this.plot_height - effective_height) / 2;
        } else {
            // Y dimension constrains - use full height
            effective_height = this.plot_height;
            effective_width = this.plot_height * plot_aspect;
            x_offset = (this.plot_width - effective_width) / 2;
            y_offset = 0;
        }
        
        // Calculate effective plot area bounds
        const plot_left = this.canvas_padding + x_offset;
        const plot_right = this.canvas_padding + x_offset + effective_width;
        const plot_top = this.canvas_padding + y_offset;
        const plot_bottom = this.canvas_padding + y_offset + effective_height;
        
        this.context.strokeStyle = '#333';
        this.context.lineWidth = 1;
        this.context.font = '12px Arial';
        this.context.fillStyle = '#333';
        
        // Grid
        if (this.axes_properties.show_grid) {
            this.context.strokeStyle = '#e0e0e0';
            this.context.lineWidth = 0.5;
            
            // Vertical grid lines
            const x_step = (this.plot_bounds.x_max - this.plot_bounds.x_min) / 10;
            for (let x = this.plot_bounds.x_min; x <= this.plot_bounds.x_max; x += x_step) {
                const canvas_coords = this.plotToCanvas(x, 0);
                this.context.beginPath();
                this.context.moveTo(canvas_coords.x, plot_top);
                this.context.lineTo(canvas_coords.x, plot_bottom);
                this.context.stroke();
            }
            
            // Horizontal grid lines
            const y_step = (this.plot_bounds.y_max - this.plot_bounds.y_min) / 10;
            for (let y = this.plot_bounds.y_min; y <= this.plot_bounds.y_max; y += y_step) {
                const canvas_coords = this.plotToCanvas(0, y);
                this.context.beginPath();
                this.context.moveTo(plot_left, canvas_coords.y);
                this.context.lineTo(plot_right, canvas_coords.y);
                this.context.stroke();
            }
        }
        
        // Main axes
        this.context.strokeStyle = '#333';
        this.context.lineWidth = 2;
        
        // X-axis
        const x_axis_y = this.plotToCanvas(0, 0).y;
        this.context.beginPath();
        this.context.moveTo(plot_left, x_axis_y);
        this.context.lineTo(plot_right, x_axis_y);
        this.context.stroke();
        
        // X-axis arrow
        this.drawArrow(plot_right - 10, x_axis_y, plot_right, x_axis_y);
        
        // Y-axis
        const y_axis_x = this.plotToCanvas(0, 0).x;
        this.context.beginPath();
        this.context.moveTo(y_axis_x, plot_top);
        this.context.lineTo(y_axis_x, plot_bottom);
        this.context.stroke();
        
        // Y-axis arrow
        this.drawArrow(y_axis_x, plot_top + 10, y_axis_x, plot_top);
        
        // X-axis ticks and labels
        this.drawXTicksAndLabels(plot_left, plot_right, x_axis_y);
        
        // Y-axis ticks and labels
        this.drawYTicksAndLabels(plot_top, plot_bottom, y_axis_x);
        
        // Axis labels
        this.context.fillStyle = '#333';
        this.context.font = '14px Arial';
        this.context.fillText(this.axes_properties.x_label, plot_right + 5, x_axis_y + 5);
        this.context.fillText(this.axes_properties.y_label, y_axis_x - 5, plot_top - 5);
    }
    
    /**
     * Draw X-axis ticks and numerical labels
     * @param {number} plot_left - Left bound of plot area
     * @param {number} plot_right - Right bound of plot area
     * @param {number} x_axis_y - Y coordinate of X-axis
     * side-effects: Draws ticks and labels on canvas
     */
    drawXTicksAndLabels(plot_left, plot_right, x_axis_y) {
        this.context.strokeStyle = '#333';
        this.context.lineWidth = 1;
        this.context.fillStyle = '#333';
        this.context.font = '10px Arial';
        this.context.textAlign = 'center';
        this.context.textBaseline = 'top';
        
        const x_step = (this.plot_bounds.x_max - this.plot_bounds.x_min) / 10;
        const tick_length = 5;
        
        for (let x = this.plot_bounds.x_min; x <= this.plot_bounds.x_max; x += x_step) {
            const canvas_coords = this.plotToCanvas(x, 0);
            
            // Skip if outside effective plot area
            if (canvas_coords.x < plot_left || canvas_coords.x > plot_right) continue;
            
            // Draw tick mark
            this.context.beginPath();
            this.context.moveTo(canvas_coords.x, x_axis_y - tick_length);
            this.context.lineTo(canvas_coords.x, x_axis_y + tick_length);
            this.context.stroke();
            
            // Draw label (skip 0 if it's too close to Y-axis)
            const y_axis_x = this.plotToCanvas(0, 0).x;
            if (Math.abs(canvas_coords.x - y_axis_x) > 15) {
                this.context.fillText(x.toFixed(1), canvas_coords.x, x_axis_y + tick_length + 2);
            }
        }
        
        // Reset text alignment
        this.context.textAlign = 'left';
        this.context.textBaseline = 'alphabetic';
    }
    
    /**
     * Draw Y-axis ticks and numerical labels
     * @param {number} plot_top - Top bound of plot area
     * @param {number} plot_bottom - Bottom bound of plot area
     * @param {number} y_axis_x - X coordinate of Y-axis
     * side-effects: Draws ticks and labels on canvas
     */
    drawYTicksAndLabels(plot_top, plot_bottom, y_axis_x) {
        this.context.strokeStyle = '#333';
        this.context.lineWidth = 1;
        this.context.fillStyle = '#333';
        this.context.font = '10px Arial';
        this.context.textAlign = 'right';
        this.context.textBaseline = 'middle';
        
        const y_step = (this.plot_bounds.y_max - this.plot_bounds.y_min) / 10;
        const tick_length = 5;
        
        for (let y = this.plot_bounds.y_min; y <= this.plot_bounds.y_max; y += y_step) {
            const canvas_coords = this.plotToCanvas(0, y);
            
            // Skip if outside effective plot area
            if (canvas_coords.y < plot_top || canvas_coords.y > plot_bottom) continue;
            
            // Draw tick mark
            this.context.beginPath();
            this.context.moveTo(y_axis_x - tick_length, canvas_coords.y);
            this.context.lineTo(y_axis_x + tick_length, canvas_coords.y);
            this.context.stroke();
            
            // Draw label (skip 0 if it's too close to X-axis)
            const x_axis_y = this.plotToCanvas(0, 0).y;
            if (Math.abs(canvas_coords.y - x_axis_y) > 15) {
                this.context.fillText(y.toFixed(1), y_axis_x - tick_length - 2, canvas_coords.y);
            }
        }
        
        // Reset text alignment
        this.context.textAlign = 'left';
        this.context.textBaseline = 'alphabetic';
    }
    
    /**
     * Draw a plot object
     * @param {Object} obj - Object to draw
     * side-effects: Draws object on canvas
     */
    drawObject(obj) {
        switch (obj.type) {
            case 'point':
                this.drawPoint(obj);
                break;
            case 'line':
                this.drawLine(obj);
                break;
            case 'area':
                this.drawArea(obj);
                break;
            case 'text':
                this.drawText(obj);
                break;
            case 'brace':
                this.drawBrace(obj);
                break;
        }
    }
    
    /**
     * Draw a point
     * @param {Object} point - Point object
     * side-effects: Draws point on canvas
     */
    drawPoint(point) {
        const canvas_coords = this.plotToCanvas(point.x, point.y);
        
        // Draw the point
        this.context.fillStyle = point.color;
        this.context.beginPath();
        this.context.arc(canvas_coords.x, canvas_coords.y, point.size, 0, 2 * Math.PI);
        this.context.fill();
        
        // Draw text if present
        if (point.text && point.text.trim() !== '') {
            this.context.fillStyle = point.color;
            const text_font_size = point.text_font_size || 12;
            const text_font_family = point.text_font_family || 'Arial';
            this.context.font = `${text_font_size}px ${text_font_family}`;
            this.context.fillText(point.text, canvas_coords.x + point.size + 5, canvas_coords.y - 5);
        }
        
        // Draw coordinates if enabled
        if (point.show_coordinates) {
            this.context.fillStyle = '#666';
            const coords_font_size = point.coords_font_size || 10;
            const coords_font_family = point.coords_font_family || 'Arial';
            this.context.font = `${coords_font_size}px ${coords_font_family}`;
            const coord_text = `(${point.x.toFixed(2)}, ${point.y.toFixed(2)})`;
            this.context.fillText(coord_text, canvas_coords.x + point.size + 5, 
                                 canvas_coords.y + (point.text ? 10 : 5));
        }
    }
    
    /**
     * Draw a line
     * @param {Object} line - Line object
     * side-effects: Draws line on canvas
     */
    drawLine(line) {
        const start_coords = this.plotToCanvas(line.x1, line.y1);
        const end_coords = this.plotToCanvas(line.x2, line.y2);
        
        this.context.strokeStyle = line.color;
        this.context.lineWidth = line.width;
        this.context.beginPath();
        this.context.moveTo(start_coords.x, start_coords.y);
        this.context.lineTo(end_coords.x, end_coords.y);
        this.context.stroke();
    }
    
    /**
     * Draw a filled area
     * @param {Object} area - Area object
     * side-effects: Draws area on canvas
     */
    drawArea(area) {
        const top_left = this.plotToCanvas(area.x1, area.y2);
        const bottom_right = this.plotToCanvas(area.x2, area.y1);
        
        // Fill
        this.context.fillStyle = area.fill_color;
        this.context.fillRect(top_left.x, top_left.y, bottom_right.x - top_left.x, bottom_right.y - top_left.y);
        
        // Border
        this.context.strokeStyle = area.border_color;
        this.context.lineWidth = 1;
        this.context.strokeRect(top_left.x, top_left.y, bottom_right.x - top_left.x, bottom_right.y - top_left.y);
    }
    
    /**
     * Draw text
     * @param {Object} text - Text object
     * side-effects: Draws text on canvas
     */
    drawText(text) {
        const canvas_coords = this.plotToCanvas(text.x, text.y);
        
        this.context.save();
        
        // Apply rotation if specified
        if (text.rotation && text.rotation !== 0) {
            this.context.translate(canvas_coords.x, canvas_coords.y);
            this.context.rotate((text.rotation * Math.PI) / 180); // Convert degrees to radians
            this.context.translate(-canvas_coords.x, -canvas_coords.y);
        }
        
        this.context.fillStyle = text.color;
        this.context.font = `${text.font_size}px ${text.font_family}`;
        this.context.fillText(text.text, canvas_coords.x, canvas_coords.y);
        
        this.context.restore();
    }
    
    /**
     * Get the effective plot area (excluding padding)
     * @returns {Object} - {left, right, top, bottom} canvas coordinates
     */
    getEffectivePlotArea() {
        // Calculate effective plot area (same logic as plotToCanvas but for bounds)
        const plot_x_range = this.plot_bounds.x_max - this.plot_bounds.x_min;
        const plot_y_range = this.plot_bounds.y_max - this.plot_bounds.y_min;
        const aspect_ratio = this.axes_properties.aspect_ratio;

        // Determine which dimension constrains the scaling
        const canvas_aspect = this.plot_width / this.plot_height;
        const plot_aspect = (plot_x_range * aspect_ratio) / plot_y_range;

        let effective_width, effective_height;
        if (plot_aspect > canvas_aspect) {
            // Plot is wider, use height as constraint
            effective_height = this.plot_height;
            effective_width = effective_height * plot_aspect / aspect_ratio;
        } else {
            // Plot is taller, use width as constraint
            effective_width = this.plot_width;
            effective_height = effective_width * aspect_ratio / plot_aspect;
        }

        const offset_x = (this.plot_width - effective_width) / 2;
        const offset_y = (this.plot_height - effective_height) / 2;

        return {
            left: this.canvas_padding + offset_x,
            right: this.canvas_padding + offset_x + effective_width,
            top: this.canvas_padding + offset_y,
            bottom: this.canvas_padding + offset_y + effective_height
        };
    }

    /**
     * Draw a mathematical function using math.js
     * @param {Object} func - Function object
     * side-effects: Draws function on canvas with smart discontinuity detection
     */
    drawFunction(func) {
        try {
            // Create a compiled function for better performance
            const compiledFunction = this.math.compile(func.expression);

            // Determine the actual x range to plot
            const plot_x_min = func.xMin !== null ? func.xMin : this.plot_bounds.x_min;
            const plot_x_max = func.xMax !== null ? func.xMax : this.plot_bounds.x_max;

            // Calculate number of samples based on range
            const range = plot_x_max - plot_x_min;
            const samples = Math.min(Math.max(Math.floor(range * 50), 100), 2000); // 50 samples per unit, min 100, max 2000
            const step = range / samples;

            this.context.strokeStyle = func.color;
            this.context.lineWidth = func.width;
            this.context.beginPath();

            let firstPoint = true;
            let lastValidPoint = null;
            const maxJump = this.canvas.height * 0.2; // 20% of canvas height as discontinuity threshold

            for (let i = 0; i <= samples; i++) {
                const x = plot_x_min + i * step;

                try {
                    // Evaluate function at x
                    const y = compiledFunction.evaluate({ x: x });

                    if (isFinite(y)) {
                        const canvasCoords = this.plotToCanvas(x, y);

                        // Only draw if the point is within the effective plot area
                        const effective_plot_area = this.getEffectivePlotArea();
                        if (canvasCoords.x >= effective_plot_area.left &&
                            canvasCoords.x <= effective_plot_area.right &&
                            canvasCoords.y >= effective_plot_area.top &&
                            canvasCoords.y <= effective_plot_area.bottom) {

                            if (firstPoint) {
                                this.context.moveTo(canvasCoords.x, canvasCoords.y);
                                firstPoint = false;
                            } else if (lastValidPoint !== null) {
                                // Check for discontinuity (large jump in y)
                                const lastCanvasCoords = this.plotToCanvas(lastValidPoint.x, lastValidPoint.y);
                                const jump = Math.abs(canvasCoords.y - lastCanvasCoords.y);

                                if (jump > maxJump) {
                                    // Discontinuity detected - start new path
                                    this.context.stroke();
                                    this.context.beginPath();
                                    this.context.moveTo(canvasCoords.x, canvasCoords.y);
                                } else {
                                    this.context.lineTo(canvasCoords.x, canvasCoords.y);
                                }
                            } else {
                                this.context.lineTo(canvasCoords.x, canvasCoords.y);
                            }

                            lastValidPoint = { x, y };
                        }
                    } else {
                        // Invalid point (Infinity, NaN) - end current path
                        if (!firstPoint) {
                            this.context.stroke();
                            this.context.beginPath();
                            firstPoint = true;
                        }
                        lastValidPoint = null;
                    }
                } catch (error) {
                    // Function evaluation error - end current path
                    if (!firstPoint) {
                        this.context.stroke();
                        this.context.beginPath();
                        firstPoint = true;
                    }
                    lastValidPoint = null;
                }
            }

            // Stroke the final path
            this.context.stroke();

        } catch (error) {
            console.error('Error drawing function:', error);
            // Draw a simple error indicator
            this.context.strokeStyle = '#ff0000';
            this.context.lineWidth = 2;
            this.context.setLineDash([5, 5]);
            this.context.beginPath();
            this.context.moveTo(this.canvas.width / 2 - 50, this.canvas.height / 2);
            this.context.lineTo(this.canvas.width / 2 + 50, this.canvas.height / 2);
            this.context.stroke();
            this.context.setLineDash([]);
        }
    }
    
    /**
     * Draw an individual object based on its type
     * @param {Object} obj - Object to draw
     * side-effects: Draws object on canvas
     */
    drawObject(obj) {
        switch (obj.type) {
            case 'point':
                this.drawPoint(obj);
                break;
            case 'line':
                this.drawLine(obj);
                break;
            case 'area':
                this.drawArea(obj);
                break;
            case 'text':
                this.drawText(obj);
                break;
            case 'brace':
                this.drawBrace(obj);
                break;
            case 'function':
                this.drawFunction(obj);
                break;
        }
    }
    
    /**
     * Draw a curly brace
     * @param {Object} brace - Brace object
     * side-effects: Draws brace on canvas
     */
    drawBrace(brace) {
        // Default to 45deg style for new braces
        const brace_style = brace.style || '45deg';
        
        if (brace_style === 'traditional') {
            this.drawTraditionalBrace(brace);
        } else if (brace_style === '45deg') {
            this.draw45DegBrace(brace);
        } else {
            this.drawSmoothBrace(brace);
        }
    }
    
    /**
     * Draw a smooth curly brace (original style)
     * @param {Object} brace - Brace object
     * side-effects: Draws smooth brace on canvas
     */
    drawSmoothBrace(brace) {
        const start_coords = this.plotToCanvas(brace.x1, brace.y1);
        const end_coords = this.plotToCanvas(brace.x2, brace.y2);
        
        const dx = end_coords.x - start_coords.x;
        const dy = end_coords.y - start_coords.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        this.context.strokeStyle = brace.color;
        this.context.lineWidth = 2;
        this.context.beginPath();
        
        // Use brace width property or fallback to calculated value (2x thinner)
        const brace_elevation = brace.elevation || brace.width || Math.min(20, length * 0.125);
        const mirror_multiplier = brace.mirrored ? -1 : 1;
        const perpX = -dy / length * brace_elevation * mirror_multiplier;
        const perpY = dx / length * brace_elevation * mirror_multiplier;
        
        // Calculate mid point
        const midX = (start_coords.x + end_coords.x) / 2;
        const midY = (start_coords.y + end_coords.y) / 2;
        
        // Draw brace curve
        this.context.moveTo(start_coords.x, start_coords.y);
        this.context.quadraticCurveTo(midX + perpX, midY + perpY, midX, midY);
        this.context.quadraticCurveTo(midX + perpX, midY + perpY, end_coords.x, end_coords.y);
        
        this.context.stroke();
    }
    
    /**
     * Draw a traditional curly brace with quarter circles and straight segments
     * Following the exact pattern: quarter_circle -> line -> quarter_circle -> quarter_circle -> line -> quarter_circle
     * @param {Object} brace - Brace object
     * side-effects: Draws traditional brace on canvas
     */
    drawTraditionalBrace(brace) {
        const start_coords = this.plotToCanvas(brace.x1, brace.y1);
        const end_coords = this.plotToCanvas(brace.x2, brace.y2);
        
        const dx = end_coords.x - start_coords.x;
        const dy = end_coords.y - start_coords.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length < 20) return; // Skip very short braces
        
        this.context.strokeStyle = brace.color;
        this.context.lineWidth = 2;
        this.context.beginPath();
        
        // Use brace width property or fallback to calculated value (2x thinner)
        const brace_elevation = brace.elevation || brace.width || Math.min(length * 0.125, 20);
        const mirror_multiplier = brace.mirrored ? -1 : 1;
        
        // Unit vectors along and perpendicular to the brace line
        const alongUnitX = dx / length;
        const alongUnitY = dy / length;
        const perpUnitX = -dy / length * mirror_multiplier;
        const perpUnitY = dx / length * mirror_multiplier;
        
        // Quarter circle radius - half the brace width
        const radius = brace_elevation / 2;
        
        // Calculate the 6 key points along the brace path following your specification:
        // TOP: quarter_circle -> line -> quarter_circle (to tip)
        // BOTTOM: quarter_circle -> line -> quarter_circle (from tip)
        
        const quarter_distance = length / 4;
        
        // Key positions along the brace
        const p1_pos = radius; // End of first quarter circle
        const p2_pos = quarter_distance; // Start of second quarter circle  
        const tip_pos = length / 2; // Center tip
        const p3_pos = length - quarter_distance; // Start of fifth quarter circle
        const p4_pos = length - radius; // End of fifth quarter circle
        
        // Build the path following your exact specification
        this.context.moveTo(start_coords.x, start_coords.y);
        
        // TOP HALF
        // 1. First quarter circle (outward) - like "top left quarter of circle with center (2,7)"
        const q1_end_x = start_coords.x + alongUnitX * p1_pos + perpUnitX * radius;
        const q1_end_y = start_coords.y + alongUnitY * p1_pos + perpUnitY * radius;
        const q1_ctrl_x = start_coords.x + perpUnitX * radius;
        const q1_ctrl_y = start_coords.y + perpUnitY * radius;
        this.context.quadraticCurveTo(q1_ctrl_x, q1_ctrl_y, q1_end_x, q1_end_y);
        
        // 2. Straight line - like "line from 1,7 to 1,5"
        const line1_end_x = start_coords.x + alongUnitX * p2_pos + perpUnitX * radius;
        const line1_end_y = start_coords.y + alongUnitY * p2_pos + perpUnitY * radius;
        this.context.lineTo(line1_end_x, line1_end_y);
        
        // 3. Second quarter circle (inward to tip) - like "bottom right quarter of circle with center (0,5)"
        const tip_x = start_coords.x + alongUnitX * tip_pos + perpUnitX * brace_elevation;
        const tip_y = start_coords.y + alongUnitY * tip_pos + perpUnitY * brace_elevation;
        const q2_ctrl_x = start_coords.x + alongUnitX * tip_pos + perpUnitX * radius;
        const q2_ctrl_y = start_coords.y + alongUnitY * tip_pos + perpUnitY * radius;
        this.context.quadraticCurveTo(q2_ctrl_x, q2_ctrl_y, tip_x, tip_y);
        
        // BOTTOM HALF (vertically mirrored)
        // 4. Third quarter circle (outward from tip)
        const q3_end_x = start_coords.x + alongUnitX * p3_pos + perpUnitX * radius;
        const q3_end_y = start_coords.y + alongUnitY * p3_pos + perpUnitY * radius;
        const q3_ctrl_x = start_coords.x + alongUnitX * tip_pos + perpUnitX * radius;
        const q3_ctrl_y = start_coords.y + alongUnitY * tip_pos + perpUnitY * radius;
        this.context.quadraticCurveTo(q3_ctrl_x, q3_ctrl_y, q3_end_x, q3_end_y);
        
        // 5. Straight line
        const line2_end_x = start_coords.x + alongUnitX * p4_pos + perpUnitX * radius;
        const line2_end_y = start_coords.y + alongUnitY * p4_pos + perpUnitY * radius;
        this.context.lineTo(line2_end_x, line2_end_y);
        
        // 6. Fourth quarter circle (inward to end)
        const q4_ctrl_x = end_coords.x + perpUnitX * radius;
        const q4_ctrl_y = end_coords.y + perpUnitY * radius;
        this.context.quadraticCurveTo(q4_ctrl_x, q4_ctrl_y, end_coords.x, end_coords.y);
        
        this.context.stroke();
    }

    /**
     * Draw a 45-degree brace to prevent overlap at 90-degree corners
     * Outer arcs are 1/8 circles (45°), inner arcs are 1/4 circles (90°)
     * Straight segments are parallel to main brace line. Arc centers lie on normals
     * passing through the ends of straight segments, ensuring C1 continuity.
     * @param {Object} brace - Brace object
     * side-effects: Draws 45deg brace on canvas
     */
    draw45DegBrace(brace) {
        const start_coords = this.plotToCanvas(brace.x1, brace.y1);
        const end_coords = this.plotToCanvas(brace.x2, brace.y2);
        
        this.context.strokeStyle = brace.color;
        this.context.lineWidth = 2;
        this.context.beginPath();
        
        // Draw two halves. Flip mirror sign for the first half
        const mm = brace.mirrored ? -1 : 1;
        this.draw45DegBraceHalf(start_coords, end_coords, -mm, brace);
        this.draw45DegBraceHalf(end_coords, start_coords, mm, brace);
        
        this.context.stroke();
    }

    /**
     * Draw one half of a 45-degree brace from S to midpoint
     * @param {Object} S - Start canvas coords {x,y}
     * @param {Object} E - End canvas coords {x,y}
     * @param {Object} brace - Brace object (uses mirrored, width)
     * side-effects: Appends to current canvas path
     */
    draw45DegBraceHalf(S, E, mirrorMultiplier, brace) {
        const dx = E.x - S.x;
        const dy = E.y - S.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 20) return;
        
        const mirror_multiplier = mirrorMultiplier;
        const alongX = dx / length;
        const alongY = dy / length;
        const perpX = -dy / length * mirror_multiplier;
        const perpY = dx / length * mirror_multiplier;
        
        const innerR = brace.elevation || brace.width ? Math.min(brace.elevation || brace.width, length / 6) : length / 6;
        const outerR = innerR * Math.SQRT2;
        const segLen = Math.max(0, length / 2 - 2 * innerR);
        
        const pt = (s, p) => ({ x: S.x + alongX * s + perpX * p, y: S.y + alongY * s + perpY * p });
        const angle = (cx, cy, px, py) => Math.atan2(py - cy, px - cx);
        const ccwForMinorArc = (a0, a1) => {
            let d = a1 - a0;
            while (d <= -Math.PI) d += 2 * Math.PI;
            while (d > Math.PI) d -= 2 * Math.PI;
            return d < 0;
        };
        
        // Geometry for half: outer 1/8 arc -> straight -> inner 1/4 arc to midpoint
        const C1 = pt(innerR, innerR);
        const P1 = pt(innerR, innerR - outerR);
        const P2 = pt(innerR + segLen, innerR - outerR);
        const C2 = pt(innerR + segLen, -outerR);
        const PM = pt(length / 2, -outerR);
        
        // Outer arc
        this.context.moveTo(S.x, S.y);
        let a0 = angle(C1.x, C1.y, S.x, S.y);
        let a1 = angle(C1.x, C1.y, P1.x, P1.y);
        this.context.arc(C1.x, C1.y, outerR, a0, a1, ccwForMinorArc(a0, a1));
        // Straight
        this.context.lineTo(P2.x, P2.y);
        // Inner quarter to midpoint
        a0 = angle(C2.x, C2.y, P2.x, P2.y);
        a1 = angle(C2.x, C2.y, PM.x, PM.y);
        this.context.arc(C2.x, C2.y, innerR, a0, a1, ccwForMinorArc(a0, a1));
    }
    
    /**
     * Draw line preview during drawing
     * @param {Object} start - Start coordinates
     * @param {Object} end - End coordinates
     * side-effects: Draws preview line on canvas
     */
    drawLinePreview(start, end) {
        const start_coords = this.plotToCanvas(start.x, start.y);
        const end_coords = this.plotToCanvas(end.x, end.y);
        
        this.context.strokeStyle = '#2196F3';
        this.context.lineWidth = 2;
        this.context.setLineDash([5, 5]);
        this.context.beginPath();
        this.context.moveTo(start_coords.x, start_coords.y);
        this.context.lineTo(end_coords.x, end_coords.y);
        this.context.stroke();
        this.context.setLineDash([]);
    }
    
    /**
     * Draw area preview during drawing
     * @param {Object} start - Start coordinates
     * @param {Object} end - End coordinates
     * side-effects: Draws preview area on canvas
     */
    drawAreaPreview(start, end) {
        const top_left = this.plotToCanvas(Math.min(start.x, end.x), Math.max(start.y, end.y));
        const bottom_right = this.plotToCanvas(Math.max(start.x, end.x), Math.min(start.y, end.y));
        
        this.context.fillStyle = '#4CAF5020';
        this.context.fillRect(top_left.x, top_left.y, bottom_right.x - top_left.x, bottom_right.y - top_left.y);
        
        this.context.strokeStyle = '#4CAF50';
        this.context.lineWidth = 1;
        this.context.setLineDash([5, 5]);
        this.context.strokeRect(top_left.x, top_left.y, bottom_right.x - top_left.x, bottom_right.y - top_left.y);
        this.context.setLineDash([]);
    }
    
    /**
     * Draw brace preview during drawing
     * @param {Object} start - Start coordinates
     * @param {Object} end - End coordinates
     * side-effects: Draws preview brace on canvas
     */
    drawBracePreview(start, end) {
        // Create a temporary brace object for preview (using 45deg style)
        const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
        const default_elevation = 15; // Default elevation set to 15
        
        const temp_brace = {
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
            color: '#333333',
            mirrored: false,
            style: '45deg',
            elevation: default_elevation
        };
        
        // Save current context state
        this.context.save();
        this.context.setLineDash([5, 5]);
        
        // Draw preview using 45deg style
        this.drawBrace(temp_brace);
        
        // Restore context state
        this.context.restore();
    }
    
    /**
     * Draw an arrow head
     * @param {number} from_x - Start X coordinate
     * @param {number} from_y - Start Y coordinate
     * @param {number} to_x - End X coordinate
     * @param {number} to_y - End Y coordinate
     * side-effects: Draws arrow head on canvas
     */
    drawArrow(from_x, from_y, to_x, to_y) {
        const head_length = 10;
        const head_angle = Math.PI / 6;
        
        const angle = Math.atan2(to_y - from_y, to_x - from_x);
        
        this.context.beginPath();
        this.context.moveTo(to_x, to_y);
        this.context.lineTo(to_x - head_length * Math.cos(angle - head_angle), 
                           to_y - head_length * Math.sin(angle - head_angle));
        this.context.moveTo(to_x, to_y);
        this.context.lineTo(to_x - head_length * Math.cos(angle + head_angle), 
                           to_y - head_length * Math.sin(angle + head_angle));
        this.context.stroke();
    }
    
    /**
     * Highlight selected object
     * @param {Object} obj - Object to highlight
     * side-effects: Draws highlight around object
     */
    highlightObject(obj) {
        this.context.strokeStyle = '#ff4444';
        this.context.lineWidth = 2;
        this.context.setLineDash([3, 3]);
        
        switch (obj.type) {
            case 'point':
                const point_coords = this.plotToCanvas(obj.x, obj.y);
                this.context.beginPath();
                this.context.arc(point_coords.x, point_coords.y, obj.size + 3, 0, 2 * Math.PI);
                this.context.stroke();
                break;
            case 'line':
                this.highlightLineBBox(obj);
                break;
            case 'area':
                const area_top_left = this.plotToCanvas(obj.x1, obj.y2);
                const area_bottom_right = this.plotToCanvas(obj.x2, obj.y1);
                this.context.strokeRect(area_top_left.x - 2, area_top_left.y - 2, 
                                       area_bottom_right.x - area_top_left.x + 4, 
                                       area_bottom_right.y - area_top_left.y + 4);
                break;
            case 'text':
                this.highlightTextBBox(obj);
                break;
            case 'brace':
                this.highlightBraceBBox(obj);
                break;
            case 'function':
                this.highlightFunction(obj);
                break;
        }
        
        this.context.setLineDash([]);
    }
    
    /**
     * Highlight text bounding box with proper rotation
     * @param {Object} text_obj - Text object to highlight
     * side-effects: Draws rotated highlight around text
     */
    highlightTextBBox(text_obj) {
        // Get text dimensions by measuring
        this.context.save();
        this.context.font = `${text_obj.font_size}px ${text_obj.font_family}`;
        const text_metrics = this.context.measureText(text_obj.text);
        const text_width = text_metrics.width;
        const text_height = text_obj.font_size; // Approximate height
        this.context.restore();
        
        // Convert text position to canvas coordinates
        const text_canvas_coords = this.plotToCanvas(text_obj.x, text_obj.y);
        
        // Add some padding around the text
        const padding = 3;
        const bbox_width = text_width + 2 * padding;
        const bbox_height = text_height + 2 * padding;
        
        this.context.save();
        
        // Apply rotation if specified
        if (text_obj.rotation && text_obj.rotation !== 0) {
            this.context.translate(text_canvas_coords.x, text_canvas_coords.y);
            this.context.rotate((text_obj.rotation * Math.PI) / 180);
            
            // Draw rotated bounding box (text extends to the right and up from anchor point)
            this.context.strokeRect(-padding, -text_height - padding, bbox_width, bbox_height);
        } else {
            // Draw non-rotated bounding box
            this.context.strokeRect(text_canvas_coords.x - padding, 
                                   text_canvas_coords.y - text_height - padding, 
                                   bbox_width, bbox_height);
        }
        
        this.context.restore();
    }
    
    /**
     * Highlight line bounding box (rotated rectangle around the line)
     * @param {Object} line_obj - Line object to highlight
     * side-effects: Draws dashed rotated rectangle highlight
     */
    highlightLineBBox(line_obj) {
        const start_coords = this.plotToCanvas(line_obj.x1, line_obj.y1);
        const end_coords = this.plotToCanvas(line_obj.x2, line_obj.y2);
        
        // Calculate line dimensions
        const dx = end_coords.x - start_coords.x;
        const dy = end_coords.y - start_coords.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length < 1) return; // Skip very short lines
        
        // Calculate perpendicular direction for line width
        const along_x = dx / length;
        const along_y = dy / length;
        const perp_x = -along_y;
        const perp_y = along_x;
        
        // Line extends in perpendicular direction based on width
        const line_width = Math.max(8, (line_obj.width || 2) * 4); // Match picking bbox thickness
        const half_width = line_width / 2;
        
        // Create bounding box around the line
        const bbox_points = [
            {
                x: start_coords.x + perp_x * half_width,
                y: start_coords.y + perp_y * half_width
            },
            {
                x: start_coords.x - perp_x * half_width,
                y: start_coords.y - perp_y * half_width
            },
            {
                x: end_coords.x - perp_x * half_width,
                y: end_coords.y - perp_y * half_width
            },
            {
                x: end_coords.x + perp_x * half_width,
                y: end_coords.y + perp_y * half_width
            }
        ];
        
        // Draw dashed polygon
        this.context.save();
        this.context.strokeStyle = '#ff4444';
        this.context.lineWidth = 2;
        this.context.setLineDash([5, 5]); // Dashed pattern
        this.context.beginPath();
        this.context.moveTo(bbox_points[0].x, bbox_points[0].y);
        for (let i = 1; i < bbox_points.length; i++) {
            this.context.lineTo(bbox_points[i].x, bbox_points[i].y);
        }
        this.context.closePath();
        this.context.stroke();
        this.context.restore();
    }
    
    /**
     * Highlight brace bounding box (dashed polygon matching picking bbox)
     * @param {Object} brace_obj - Brace object to highlight
     * side-effects: Draws dashed polygon highlight around brace
     */
    highlightBraceBBox(brace_obj) {
        const start_coords = this.plotToCanvas(brace_obj.x1, brace_obj.y1);
        const end_coords = this.plotToCanvas(brace_obj.x2, brace_obj.y2);
        
        // Calculate brace dimensions (same logic as picking bbox)
        const dx = end_coords.x - start_coords.x;
        const dy = end_coords.y - start_coords.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length < 1) return; // Skip very short braces
        
        // Calculate perpendicular direction for brace elevation
        const along_x = dx / length;
        const along_y = dy / length;
        const perp_x = -along_y;
        const perp_y = along_x;
        
        // Brace extends in perpendicular direction based on elevation
        const brace_elevation = (brace_obj.elevation || brace_obj.width || 15) * 2; // Match picking bbox
        const half_width = brace_elevation / 2;
        
        // Create bounding box around the brace
        const bbox_points = [
            {
                x: start_coords.x + perp_x * half_width,
                y: start_coords.y + perp_y * half_width
            },
            {
                x: start_coords.x - perp_x * half_width,
                y: start_coords.y - perp_y * half_width
            },
            {
                x: end_coords.x - perp_x * half_width,
                y: end_coords.y - perp_y * half_width
            },
            {
                x: end_coords.x + perp_x * half_width,
                y: end_coords.y + perp_y * half_width
            }
        ];
        
        // Draw dashed polygon
        this.context.save();
        this.context.strokeStyle = '#ff4444';
        this.context.lineWidth = 2;
        this.context.setLineDash([5, 5]); // Dashed pattern
        this.context.beginPath();
        this.context.moveTo(bbox_points[0].x, bbox_points[0].y);
        for (let i = 1; i < bbox_points.length; i++) {
            this.context.lineTo(bbox_points[i].x, bbox_points[i].y);
        }
        this.context.closePath();
        this.context.stroke();
        this.context.restore();
    }

    /**
     * Highlight function with dashed outline
     * @param {Object} func_obj - Function object to highlight
     * side-effects: Draws dashed highlight around function
     */
    highlightFunction(func_obj) {
        try {
            // Create a compiled function for better performance
            const compiledFunction = this.math.compile(func_obj.expression);

            // Determine the actual x range to plot
            const plot_x_min = func_obj.xMin !== null ? func_obj.xMin : this.plot_bounds.x_min;
            const plot_x_max = func_obj.xMax !== null ? func_obj.xMax : this.plot_bounds.x_max;

            // Calculate number of samples (fewer than display for performance)
            const range = plot_x_max - plot_x_min;
            const samples = Math.min(Math.max(Math.floor(range * 20), 50), 500); // 20 samples per unit, min 50, max 500
            const step = range / samples;

            this.context.strokeStyle = '#ff4444';
            this.context.lineWidth = Math.max(4, func_obj.width || 2) + 2; // Make thicker than the function line
            this.context.setLineDash([5, 5]); // Dashed pattern
            this.context.beginPath();

            let firstPoint = true;

            for (let i = 0; i <= samples; i++) {
                const x = plot_x_min + i * step;

                try {
                    // Evaluate function at x
                    const y = compiledFunction.evaluate({ x: x });

                    if (isFinite(y)) {
                        const canvasCoords = this.plotToCanvas(x, y);

                        // Only draw if the point is within the effective plot area
                        const effective_plot_area = this.getEffectivePlotArea();
                        if (canvasCoords.x >= effective_plot_area.left &&
                            canvasCoords.x <= effective_plot_area.right &&
                            canvasCoords.y >= effective_plot_area.top &&
                            canvasCoords.y <= effective_plot_area.bottom) {

                            if (firstPoint) {
                                this.context.moveTo(canvasCoords.x, canvasCoords.y);
                                firstPoint = false;
                            } else {
                                this.context.lineTo(canvasCoords.x, canvasCoords.y);
                            }
                        }
                    } else {
                        // Invalid point - end current path and start new one
                        if (!firstPoint) {
                            this.context.stroke();
                            this.context.beginPath();
                            firstPoint = true;
                        }
                    }
                } catch (error) {
                    // Function evaluation error - end current path and start new one
                    if (!firstPoint) {
                        this.context.stroke();
                        this.context.beginPath();
                        firstPoint = true;
                    }
                }
            }

            // Stroke the final path
            this.context.stroke();

        } catch (error) {
            console.error('Error highlighting function:', error);
            // Draw a simple error indicator
            this.context.strokeStyle = '#ff0000';
            this.context.lineWidth = 2;
            this.context.setLineDash([5, 5]);
            this.context.beginPath();
            this.context.moveTo(this.canvas.width / 2 - 50, this.canvas.height / 2);
            this.context.lineTo(this.canvas.width / 2 + 50, this.canvas.height / 2);
            this.context.stroke();
        }

        this.context.setLineDash([]);
    }

    /**
     * Update coordinate display
     * @param {Object} coords - Current coordinates
     * side-effects: Updates coordinate display element
     */
    updateCoordinateDisplay(coords) {
        const coordinate_element = document.getElementById('coordinates');
        if (coordinate_element) {
            coordinate_element.textContent = `(${coords.x.toFixed(2)}, ${coords.y.toFixed(2)})`;
        }
    }
    
    /**
     * Generate SVG representation of the plot
     * @returns {string} SVG content as string
     */
    generateSVG() {
        const svg_width = this.canvas.width;
        const svg_height = this.canvas.height;
        
        let svg_content = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svg_width}" height="${svg_height}" viewBox="0 0 ${svg_width} ${svg_height}" 
     xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<defs>
    <style>
        .grid-line { stroke: #e0e0e0; stroke-width: 0.5; }
        .axis-line { stroke: #333; stroke-width: 2; }
        .axis-text { font-family: Arial, sans-serif; font-size: 12px; fill: #333; }
    </style>
</defs>
<rect width="100%" height="100%" fill="white"/>`;

        // Add axes and grid
        svg_content += this.generateAxesSVG();
        
        // Add all objects
        for (const obj of this.plot_objects) {
            svg_content += this.generateObjectSVG(obj);
        }
        
        svg_content += '\n</svg>';
        return svg_content;
    }
    
    /**
     * Generate SVG for axes and grid
     * @returns {string} SVG elements for axes
     */
    generateAxesSVG() {
        // Calculate effective dimensions considering aspect ratio (same as drawAxes)
        const plot_x_range = this.plot_bounds.x_max - this.plot_bounds.x_min;
        const plot_y_range = this.plot_bounds.y_max - this.plot_bounds.y_min;
        const aspect_ratio = this.axes_properties.aspect_ratio;
        
        // Determine which dimension constrains the scaling
        const canvas_aspect = this.plot_width / this.plot_height;
        const plot_aspect = (plot_x_range * aspect_ratio) / plot_y_range;
        
        let effective_width, effective_height, x_offset, y_offset;
        
        if (plot_aspect > canvas_aspect) {
            // X dimension constrains - use full width
            effective_width = this.plot_width;
            effective_height = this.plot_width / plot_aspect;
            x_offset = 0;
            y_offset = (this.plot_height - effective_height) / 2;
        } else {
            // Y dimension constrains - use full height
            effective_height = this.plot_height;
            effective_width = this.plot_height * plot_aspect;
            x_offset = (this.plot_width - effective_width) / 2;
            y_offset = 0;
        }
        
        // Calculate effective plot area bounds
        const plot_left = this.canvas_padding + x_offset;
        const plot_right = this.canvas_padding + x_offset + effective_width;
        const plot_top = this.canvas_padding + y_offset;
        const plot_bottom = this.canvas_padding + y_offset + effective_height;
        
        let svg_elements = '\n<!-- Axes and Grid -->';
        
        // Grid
        if (this.axes_properties.show_grid) {
            svg_elements += '\n<g class="grid">';
            
            // Vertical grid lines
            const x_step = (this.plot_bounds.x_max - this.plot_bounds.x_min) / 10;
            for (let x = this.plot_bounds.x_min; x <= this.plot_bounds.x_max; x += x_step) {
                const canvas_coords = this.plotToCanvas(x, 0);
                svg_elements += `\n  <line x1="${canvas_coords.x}" y1="${plot_top}" x2="${canvas_coords.x}" y2="${plot_bottom}" class="grid-line"/>`;
            }
            
            // Horizontal grid lines
            const y_step = (this.plot_bounds.y_max - this.plot_bounds.y_min) / 10;
            for (let y = this.plot_bounds.y_min; y <= this.plot_bounds.y_max; y += y_step) {
                const canvas_coords = this.plotToCanvas(0, y);
                svg_elements += `\n  <line x1="${plot_left}" y1="${canvas_coords.y}" x2="${plot_right}" y2="${canvas_coords.y}" class="grid-line"/>`;
            }
            
            svg_elements += '\n</g>';
        }
        
        // Main axes
        svg_elements += '\n<g class="axes">';
        
        // X-axis
        const x_axis_y = this.plotToCanvas(0, 0).y;
        svg_elements += `\n  <line x1="${plot_left}" y1="${x_axis_y}" x2="${plot_right}" y2="${x_axis_y}" class="axis-line"/>`;
        
        // X-axis arrow
        svg_elements += `\n  <polygon points="${plot_right},${x_axis_y} ${plot_right - 10},${x_axis_y - 5} ${plot_right - 10},${x_axis_y + 5}" fill="#333"/>`;
        
        // Y-axis
        const y_axis_x = this.plotToCanvas(0, 0).x;
        svg_elements += `\n  <line x1="${y_axis_x}" y1="${plot_top}" x2="${y_axis_x}" y2="${plot_bottom}" class="axis-line"/>`;
        
        // Y-axis arrow
        svg_elements += `\n  <polygon points="${y_axis_x},${plot_top} ${y_axis_x - 5},${plot_top + 10} ${y_axis_x + 5},${plot_top + 10}" fill="#333"/>`;
        
        // X-axis ticks and labels
        svg_elements += this.generateXTicksSVG(plot_left, plot_right, x_axis_y, y_axis_x);
        
        // Y-axis ticks and labels
        svg_elements += this.generateYTicksSVG(plot_top, plot_bottom, y_axis_x, x_axis_y);
        
        // Axis labels
        svg_elements += `\n  <text x="${plot_right + 5}" y="${x_axis_y + 5}" font-family="Arial" font-size="14" fill="#333">${this.escapeXML(this.axes_properties.x_label)}</text>`;
        svg_elements += `\n  <text x="${y_axis_x - 5}" y="${plot_top - 5}" font-family="Arial" font-size="14" fill="#333">${this.escapeXML(this.axes_properties.y_label)}</text>`;
        
        svg_elements += '\n</g>';
        
        return svg_elements;
    }
    
    /**
     * Generate SVG for X-axis ticks and labels
     * @param {number} plot_left - Left bound of plot area
     * @param {number} plot_right - Right bound of plot area
     * @param {number} x_axis_y - Y coordinate of X-axis
     * @param {number} y_axis_x - X coordinate of Y-axis
     * @returns {string} SVG elements for X ticks
     */
    generateXTicksSVG(plot_left, plot_right, x_axis_y, y_axis_x) {
        let svg_elements = '\n  <!-- X-axis ticks and labels -->';
        
        const x_step = (this.plot_bounds.x_max - this.plot_bounds.x_min) / 10;
        const tick_length = 5;
        
        for (let x = this.plot_bounds.x_min; x <= this.plot_bounds.x_max; x += x_step) {
            const canvas_coords = this.plotToCanvas(x, 0);
            
            // Skip if outside effective plot area
            if (canvas_coords.x < plot_left || canvas_coords.x > plot_right) continue;
            
            // Draw tick mark
            svg_elements += `\n  <line x1="${canvas_coords.x}" y1="${x_axis_y - tick_length}" x2="${canvas_coords.x}" y2="${x_axis_y + tick_length}" stroke="#333" stroke-width="1"/>`;
            
            // Draw label (skip 0 if it's too close to Y-axis)
            if (Math.abs(canvas_coords.x - y_axis_x) > 15) {
                svg_elements += `\n  <text x="${canvas_coords.x}" y="${x_axis_y + tick_length + 12}" font-family="Arial" font-size="10" fill="#333" text-anchor="middle">${x.toFixed(1)}</text>`;
            }
        }
        
        return svg_elements;
    }
    
    /**
     * Generate SVG for Y-axis ticks and labels
     * @param {number} plot_top - Top bound of plot area
     * @param {number} plot_bottom - Bottom bound of plot area
     * @param {number} y_axis_x - X coordinate of Y-axis
     * @param {number} x_axis_y - Y coordinate of X-axis
     * @returns {string} SVG elements for Y ticks
     */
    generateYTicksSVG(plot_top, plot_bottom, y_axis_x, x_axis_y) {
        let svg_elements = '\n  <!-- Y-axis ticks and labels -->';
        
        const y_step = (this.plot_bounds.y_max - this.plot_bounds.y_min) / 10;
        const tick_length = 5;
        
        for (let y = this.plot_bounds.y_min; y <= this.plot_bounds.y_max; y += y_step) {
            const canvas_coords = this.plotToCanvas(0, y);
            
            // Skip if outside effective plot area
            if (canvas_coords.y < plot_top || canvas_coords.y > plot_bottom) continue;
            
            // Draw tick mark
            svg_elements += `\n  <line x1="${y_axis_x - tick_length}" y1="${canvas_coords.y}" x2="${y_axis_x + tick_length}" y2="${canvas_coords.y}" stroke="#333" stroke-width="1"/>`;
            
            // Draw label (skip 0 if it's too close to X-axis)
            if (Math.abs(canvas_coords.y - x_axis_y) > 15) {
                svg_elements += `\n  <text x="${y_axis_x - tick_length - 2}" y="${canvas_coords.y + 3}" font-family="Arial" font-size="10" fill="#333" text-anchor="end">${y.toFixed(1)}</text>`;
            }
        }
        
        return svg_elements;
    }
    
    /**
     * Generate SVG for a plot object
     * @param {Object} obj - Plot object
     * @returns {string} SVG elements for the object
     */
    generateObjectSVG(obj) {
        switch (obj.type) {
            case 'point':
                return this.generatePointSVG(obj);
            case 'line':
                return this.generateLineSVG(obj);
            case 'area':
                return this.generateAreaSVG(obj);
            case 'text':
                return this.generateTextSVG(obj);
            case 'brace':
                return this.generateBraceSVG(obj);
            case 'function':
                return this.generateFunctionSVG(obj);
            default:
                return '';
        }
    }
    
    /**
     * Generate SVG for a point
     * @param {Object} point - Point object
     * @returns {string} SVG elements for point
     */
    generatePointSVG(point) {
        const canvas_coords = this.plotToCanvas(point.x, point.y);
        let svg_elements = `\n<g class="point">`;
        
        // Point circle
        svg_elements += `\n  <circle cx="${canvas_coords.x}" cy="${canvas_coords.y}" r="${point.size}" fill="${point.color}"/>`;
        
        // Point text if present
        if (point.text && point.text.trim() !== '') {
            const text_font_size = point.text_font_size || 12;
            const text_font_family = point.text_font_family || 'Arial';
            svg_elements += `\n  <text x="${canvas_coords.x + point.size + 5}" y="${canvas_coords.y - 5}" font-family="${text_font_family}" font-size="${text_font_size}" fill="${point.color}">${this.escapeXML(point.text)}</text>`;
        }
        
        // Coordinates if enabled
        if (point.show_coordinates) {
            const coords_font_size = point.coords_font_size || 10;
            const coords_font_family = point.coords_font_family || 'Arial';
            const coord_text = `(${point.x.toFixed(2)}, ${point.y.toFixed(2)})`;
            svg_elements += `\n  <text x="${canvas_coords.x + point.size + 5}" y="${canvas_coords.y + (point.text ? 10 : 5)}" font-family="${coords_font_family}" font-size="${coords_font_size}" fill="#666">${coord_text}</text>`;
        }
        
        svg_elements += '\n</g>';
        return svg_elements;
    }
    
    /**
     * Generate SVG for a line
     * @param {Object} line - Line object
     * @returns {string} SVG elements for line
     */
    generateLineSVG(line) {
        const start_coords = this.plotToCanvas(line.x1, line.y1);
        const end_coords = this.plotToCanvas(line.x2, line.y2);
        
        return `\n<line x1="${start_coords.x}" y1="${start_coords.y}" x2="${end_coords.x}" y2="${end_coords.y}" stroke="${line.color}" stroke-width="${line.width}"/>`;
    }
    
    /**
     * Generate SVG for a filled area
     * @param {Object} area - Area object
     * @returns {string} SVG elements for area
     */
    generateAreaSVG(area) {
        const top_left = this.plotToCanvas(area.x1, area.y2);
        const bottom_right = this.plotToCanvas(area.x2, area.y1);
        const width = bottom_right.x - top_left.x;
        const height = bottom_right.y - top_left.y;
        
        return `\n<rect x="${top_left.x}" y="${top_left.y}" width="${width}" height="${height}" fill="${area.fill_color}" stroke="${area.border_color}" stroke-width="1"/>`;
    }
    
    /**
     * Generate SVG for text
     * @param {Object} text - Text object
     * @returns {string} SVG elements for text
     */
    generateTextSVG(text) {
        const canvas_coords = this.plotToCanvas(text.x, text.y);
        
        let transform_attr = '';
        if (text.rotation && text.rotation !== 0) {
            transform_attr = ` transform="rotate(${text.rotation} ${canvas_coords.x} ${canvas_coords.y})"`;
        }
        
        return `\n<text x="${canvas_coords.x}" y="${canvas_coords.y}" font-family="${text.font_family}" font-size="${text.font_size}" fill="${text.color}"${transform_attr}>${this.escapeXML(text.text)}</text>`;
    }
    
    /**
     * Generate SVG for a brace
     * @param {Object} brace - Brace object
     * @returns {string} SVG elements for brace
     */
    generateBraceSVG(brace) {
        const start_coords = this.plotToCanvas(brace.x1, brace.y1);
        const end_coords = this.plotToCanvas(brace.x2, brace.y2);
        
        const brace_style = brace.style || '45deg';
        
        if (brace_style === 'traditional') {
            return this.generateTraditionalBraceSVG(brace, start_coords, end_coords);
        } else if (brace_style === '45deg') {
            return this.generate45DegBraceSVG(brace, start_coords, end_coords);
        } else {
            return this.generateSmoothBraceSVG(brace, start_coords, end_coords);
        }
    }
    
    /**
     * Generate SVG for smooth brace
     * @param {Object} brace - Brace object
     * @param {Object} start_coords - Start canvas coordinates
     * @param {Object} end_coords - End canvas coordinates
     * @returns {string} SVG path for smooth brace
     */
    generateSmoothBraceSVG(brace, start_coords, end_coords) {
        const dx = end_coords.x - start_coords.x;
        const dy = end_coords.y - start_coords.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        // Use brace width property or fallback to calculated value (2x thinner)
        const brace_elevation = brace.elevation || brace.width || Math.min(20, length * 0.125);
        const mirror_multiplier = brace.mirrored ? -1 : 1;
        const perpX = -dy / length * brace_elevation * mirror_multiplier;
        const perpY = dx / length * brace_elevation * mirror_multiplier;
        
        const midX = (start_coords.x + end_coords.x) / 2;
        const midY = (start_coords.y + end_coords.y) / 2;
        const controlX = midX + perpX;
        const controlY = midY + perpY;
        
        const path = `M ${start_coords.x} ${start_coords.y} Q ${controlX} ${controlY} ${midX} ${midY} Q ${controlX} ${controlY} ${end_coords.x} ${end_coords.y}`;
        
        return `\n<path d="${path}" stroke="${brace.color}" stroke-width="2" fill="none"/>`;
    }
    
    /**
     * Generate SVG for traditional brace with quarter circles and straight segments
     * Following the exact pattern: quarter_circle -> line -> quarter_circle -> quarter_circle -> line -> quarter_circle
     * @param {Object} brace - Brace object
     * @param {Object} start_coords - Start canvas coordinates
     * @param {Object} end_coords - End canvas coordinates
     * @returns {string} SVG path for traditional brace
     */
    generateTraditionalBraceSVG(brace, start_coords, end_coords) {
        const dx = end_coords.x - start_coords.x;
        const dy = end_coords.y - start_coords.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length < 20) return ''; // Skip very short braces
        
        // Use brace width property or fallback to calculated value (2x thinner)
        const brace_elevation = brace.elevation || brace.width || Math.min(length * 0.125, 20);
        const mirror_multiplier = brace.mirrored ? -1 : 1;
        
        // Unit vectors along and perpendicular to the brace line
        const alongUnitX = dx / length;
        const alongUnitY = dy / length;
        const perpUnitX = -dy / length * mirror_multiplier;
        const perpUnitY = dx / length * mirror_multiplier;
        
        // Quarter circle radius - half the brace width
        const radius = brace_elevation / 2;
        
        const quarter_distance = length / 4;
        
        // Key positions along the brace
        const p1_pos = radius; // End of first quarter circle
        const p2_pos = quarter_distance; // Start of second quarter circle  
        const tip_pos = length / 2; // Center tip
        const p3_pos = length - quarter_distance; // Start of fifth quarter circle
        const p4_pos = length - radius; // End of fifth quarter circle
        
        // Build SVG path following the exact same structure as canvas
        let path = `M ${start_coords.x} ${start_coords.y}`;
        
        // TOP HALF
        // 1. First quarter circle (outward)
        const q1_end_x = start_coords.x + alongUnitX * p1_pos + perpUnitX * radius;
        const q1_end_y = start_coords.y + alongUnitY * p1_pos + perpUnitY * radius;
        const q1_ctrl_x = start_coords.x + perpUnitX * radius;
        const q1_ctrl_y = start_coords.y + perpUnitY * radius;
        path += ` Q ${q1_ctrl_x} ${q1_ctrl_y} ${q1_end_x} ${q1_end_y}`;
        
        // 2. Straight line
        const line1_end_x = start_coords.x + alongUnitX * p2_pos + perpUnitX * radius;
        const line1_end_y = start_coords.y + alongUnitY * p2_pos + perpUnitY * radius;
        path += ` L ${line1_end_x} ${line1_end_y}`;
        
        // 3. Second quarter circle (inward to tip)
        const tip_x = start_coords.x + alongUnitX * tip_pos + perpUnitX * brace_elevation;
        const tip_y = start_coords.y + alongUnitY * tip_pos + perpUnitY * brace_elevation;
        const q2_ctrl_x = start_coords.x + alongUnitX * tip_pos + perpUnitX * radius;
        const q2_ctrl_y = start_coords.y + alongUnitY * tip_pos + perpUnitY * radius;
        path += ` Q ${q2_ctrl_x} ${q2_ctrl_y} ${tip_x} ${tip_y}`;
        
        // BOTTOM HALF (vertically mirrored)
        // 4. Third quarter circle (outward from tip)
        const q3_end_x = start_coords.x + alongUnitX * p3_pos + perpUnitX * radius;
        const q3_end_y = start_coords.y + alongUnitY * p3_pos + perpUnitY * radius;
        const q3_ctrl_x = start_coords.x + alongUnitX * tip_pos + perpUnitX * radius;
        const q3_ctrl_y = start_coords.y + alongUnitY * tip_pos + perpUnitY * radius;
        path += ` Q ${q3_ctrl_x} ${q3_ctrl_y} ${q3_end_x} ${q3_end_y}`;
        
        // 5. Straight line
        const line2_end_x = start_coords.x + alongUnitX * p4_pos + perpUnitX * radius;
        const line2_end_y = start_coords.y + alongUnitY * p4_pos + perpUnitY * radius;
        path += ` L ${line2_end_x} ${line2_end_y}`;
        
        // 6. Fourth quarter circle (inward to end)
        const q4_ctrl_x = end_coords.x + perpUnitX * radius;
        const q4_ctrl_y = end_coords.y + perpUnitY * radius;
        path += ` Q ${q4_ctrl_x} ${q4_ctrl_y} ${end_coords.x} ${end_coords.y}`;
        
        return `\n<path d="${path}" stroke="${brace.color}" stroke-width="2" fill="none"/>`;
    }

    /**
     * Generate SVG for 45-degree brace with 1/8 outer arcs and 1/4 inner arcs
     * @param {Object} brace - Brace object
     * @param {Object} start_coords - Start canvas coordinates
     * @param {Object} end_coords - End canvas coordinates
     * @returns {string} SVG path for 45deg brace
     */
    generate45DegBraceSVG(brace, start_coords, end_coords) {
        const dx = end_coords.x - start_coords.x;
        const dy = end_coords.y - start_coords.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 20) return '';
        
        const mirror_multiplier = brace.mirrored ? -1 : 1;
        const alongX = dx / length;
        const alongY = dy / length;
        const perpX = -dy / length * mirror_multiplier;
        const perpY = dx / length * mirror_multiplier;
        
        let innerR = brace.elevation || brace.width ? Math.min(brace.elevation || brace.width, length / 6) : length / 6;
        const outerR = innerR * Math.SQRT2;
        const segLen = Math.max(0, length / 2 - 2 * innerR);
        
        const pt = (s, p) => ({ x: start_coords.x + alongX * s + perpX * p, y: start_coords.y + alongY * s + perpY * p });
        const arc = (cx, cy, r, sx, sy, ex, ey) => {
            // Compute flags for minor arc in sweep direction
            const startAngle = Math.atan2(sy - cy, sx - cx);
            const endAngle = Math.atan2(ey - cy, ex - cx);
            let delta = endAngle - startAngle;
            while (delta <= -Math.PI) delta += 2 * Math.PI;
            while (delta > Math.PI) delta -= 2 * Math.PI;
            const sweepFlag = delta >= 0 ? 1 : 0;
            const largeArcFlag = 0;
            return ` A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${ex} ${ey}`;
        };
        
        // Build with reusable half function for symmetry
        const arcCmd = (cx, cy, r, sx, sy, ex, ey) => {
            const startAngle = Math.atan2(sy - cy, sx - cx);
            const endAngle = Math.atan2(ey - cy, ex - cx);
            let delta = endAngle - startAngle;
            while (delta <= -Math.PI) delta += 2 * Math.PI;
            while (delta > Math.PI) delta -= 2 * Math.PI;
            const sweepFlag = delta >= 0 ? 1 : 0;
            const largeArcFlag = 0;
            return ` A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${ex} ${ey}`;
        };
        const half = (Sx, Sy, Ex, Ey, mirrorMultiplier) => {
            const dx = Ex - Sx;
            const dy = Ey - Sy;
            const L = Math.sqrt(dx * dx + dy * dy);
            const ax = dx / L, ay = dy / L;
            const px = -dy / L * mirrorMultiplier;
            const py = dx / L * mirrorMultiplier;
            const rIn = brace.elevation || brace.width ? Math.min(brace.elevation || brace.width, L / 6) : L / 6;
            const rOut = rIn * Math.SQRT2;
            const seg = Math.max(0, L / 2 - 2 * rIn);
            const P1x = Sx + ax * rIn + px * (rIn - rOut);
            const P1y = Sy + ay * rIn + py * (rIn - rOut);
            const P2x = Sx + ax * (rIn + seg) + px * (rIn - rOut);
            const P2y = Sy + ay * (rIn + seg) + py * (rIn - rOut);
            const C1x = Sx + ax * rIn + px * rIn;
            const C1y = Sy + ay * rIn + py * rIn;
            const C2x = Sx + ax * (rIn + seg) - px * rOut;
            const C2y = Sy + ay * (rIn + seg) - py * rOut;
            const Mx = Sx + ax * (L / 2) - px * rOut;
            const My = Sy + ay * (L / 2) - py * rOut;
            let s = `M ${Sx} ${Sy}`;
            s += arcCmd(C1x, C1y, rOut, Sx, Sy, P1x, P1y);
            s += ` L ${P2x} ${P2y}`;
            s += arcCmd(C2x, C2y, rIn, P2x, P2y, Mx, My);
            return s;
        };
        const mm = brace.mirrored ? -1 : 1;
        let path = half(start_coords.x, start_coords.y, end_coords.x, end_coords.y, -mm);
        path += half(end_coords.x, end_coords.y, start_coords.x, start_coords.y, mm);
        
        return `\n<path d="${path}" stroke="${brace.color}" stroke-width="2" fill="none"/>`;
    }
    
    /**
     * Escape XML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeXML(text) {
        return text.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#39;');
    }
    
    /**
     * Update object list panel
     * side-effects: Updates DOM elements in object list panel
     */
    updateObjectList() {
        const object_list_container = document.getElementById('object-list');
        if (!object_list_container) return;
        
        if (this.plot_objects.length === 0) {
            object_list_container.innerHTML = '<p class="no-objects">No objects in plot</p>';
            return;
        }
        
        let objects_html = '';
        this.plot_objects.forEach((obj, index) => {
            const object_name = this.getObjectDisplayName(obj);
            const object_details = this.getObjectDisplayDetails(obj);
            const object_icon = this.getObjectIcon(obj.type);
            const is_selected = this.selected_object && this.selected_object.id === obj.id;
            
            objects_html += `
                <div class="object-item ${is_selected ? 'selected' : ''}" onclick="plotEditor.selectObjectById('${obj.id}')">
                    <div class="object-item-icon">${object_icon}</div>
                    <div class="object-item-info">
                        <div class="object-item-type">${object_name}</div>
                        <div class="object-item-details">${object_details}</div>
                    </div>
                </div>`;
        });
        
        object_list_container.innerHTML = objects_html;
    }
    
    /**
     * Get display name for object
     * @param {Object} obj - Plot object
     * @returns {string} Display name
     */
    getObjectDisplayName(obj) {
        switch (obj.type) {
            case 'point':
                return obj.text ? `Point: ${obj.text}` : 'Point';
            case 'line':
                return 'Line';
            case 'area':
                return 'Filled Area';
            case 'text':
                return `Text: ${obj.text}`;
            case 'brace':
                return 'Brace';
            default:
                return obj.type;
        }
    }
    
    /**
     * Get display details for object
     * @param {Object} obj - Plot object
     * @returns {string} Display details
     */
    getObjectDisplayDetails(obj) {
        switch (obj.type) {
            case 'point':
                return `(${obj.x.toFixed(1)}, ${obj.y.toFixed(1)})`;
            case 'line':
                return `(${obj.x1.toFixed(1)}, ${obj.y1.toFixed(1)}) → (${obj.x2.toFixed(1)}, ${obj.y2.toFixed(1)})`;
            case 'area':
                return `${Math.abs(obj.x2 - obj.x1).toFixed(1)}×${Math.abs(obj.y2 - obj.y1).toFixed(1)}`;
            case 'text':
                return `at (${obj.x.toFixed(1)}, ${obj.y.toFixed(1)})`;
            case 'brace':
                return `(${obj.x1.toFixed(1)}, ${obj.y1.toFixed(1)}) → (${obj.x2.toFixed(1)}, ${obj.y2.toFixed(1)})`;
            default:
                return '';
        }
    }
    
    /**
     * Get icon for object type
     * @param {string} type - Object type
     * @returns {string} Icon character
     */
    getObjectIcon(type) {
        switch (type) {
            case 'point': return '•';
            case 'line': return '📏';
            case 'area': return '▢';
            case 'text': return 'T';
            case 'brace': return '}';
            default: return '?';
        }
    }
    
    /**
     * Select object by ID
     * @param {string} object_id - Object ID to select
     * side-effects: Changes selected_object
     */
    selectObjectById(object_id) {
        const obj = this.plot_objects.find(o => o.id === object_id);
        this.selectObject(obj || null);
    }

    /**
     * Update properties panel with selected object properties
     * side-effects: Updates DOM elements in properties panel
     */
    updatePropertiesPanel() {
        const properties_container = document.getElementById('object-properties');
        if (!properties_container) return;
        
        if (!this.selected_object) {
            properties_container.innerHTML = '<p class="no-selection">No object selected</p>';
            return;
        }
        
        let properties_html = `<div class="property-group">
            <h4>${this.selected_object.type.toUpperCase()} Properties</h4>`;
        
        // Common properties based on object type
        switch (this.selected_object.type) {
            case 'point':
                properties_html += `
                    <div class="property-row">
                        <label>X:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x}" 
                               onchange="plotEditor.updateObjectProperty('x', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y}" 
                               onchange="plotEditor.updateObjectProperty('y', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Size:</label>
                        <input type="number" min="1" max="20" value="${this.selected_object.size}" 
                               onchange="plotEditor.updateObjectProperty('size', parseInt(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Color:</label>
                        <input type="color" class="color-input" value="${this.selected_object.color}" 
                               onchange="plotEditor.updateObjectProperty('color', this.value)">
                    </div>
                    <div class="property-row">
                        <label>Text:</label>
                        <input type="text" value="${this.selected_object.text || ''}" 
                               onchange="plotEditor.updateObjectProperty('text', this.value)" style="width: 100%;">
                    </div>
                    <div class="property-row">
                        <label>Show Coordinates:</label>
                        <input type="checkbox" ${this.selected_object.show_coordinates ? 'checked' : ''} 
                               onchange="plotEditor.updateObjectProperty('show_coordinates', this.checked)">
                    </div>
                    <div class="property-row">
                        <label>Text Font Size:</label>
                        <input type="number" min="8" max="48" value="${this.selected_object.text_font_size || 12}" 
                               onchange="plotEditor.updateObjectProperty('text_font_size', parseInt(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Text Font Family:</label>
                        <select onchange="plotEditor.updateObjectProperty('text_font_family', this.value)" style="width: 100%;">
                            <option value="Arial" ${(this.selected_object.text_font_family || 'Arial') === 'Arial' ? 'selected' : ''}>Arial</option>
                            <option value="Helvetica" ${(this.selected_object.text_font_family || 'Arial') === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
                            <option value="Times New Roman" ${(this.selected_object.text_font_family || 'Arial') === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                            <option value="Courier New" ${(this.selected_object.text_font_family || 'Arial') === 'Courier New' ? 'selected' : ''}>Courier New</option>
                            <option value="Georgia" ${(this.selected_object.text_font_family || 'Arial') === 'Georgia' ? 'selected' : ''}>Georgia</option>
                            <option value="Verdana" ${(this.selected_object.text_font_family || 'Arial') === 'Verdana' ? 'selected' : ''}>Verdana</option>
                        </select>
                    </div>
                    <div class="property-row">
                        <label>Coords Font Size:</label>
                        <input type="number" min="6" max="24" value="${this.selected_object.coords_font_size || 10}" 
                               onchange="plotEditor.updateObjectProperty('coords_font_size', parseInt(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Coords Font Family:</label>
                        <select onchange="plotEditor.updateObjectProperty('coords_font_family', this.value)" style="width: 100%;">
                            <option value="Arial" ${(this.selected_object.coords_font_family || 'Arial') === 'Arial' ? 'selected' : ''}>Arial</option>
                            <option value="Helvetica" ${(this.selected_object.coords_font_family || 'Arial') === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
                            <option value="Times New Roman" ${(this.selected_object.coords_font_family || 'Arial') === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                            <option value="Courier New" ${(this.selected_object.coords_font_family || 'Arial') === 'Courier New' ? 'selected' : ''}>Courier New</option>
                            <option value="Georgia" ${(this.selected_object.coords_font_family || 'Arial') === 'Georgia' ? 'selected' : ''}>Georgia</option>
                            <option value="Verdana" ${(this.selected_object.coords_font_family || 'Arial') === 'Verdana' ? 'selected' : ''}>Verdana</option>
                        </select>
                    </div>
                    <div class="property-row">
                        <label>Z-Index:</label>
                        <input type="number" value="${this.selected_object.z_index || 0}" 
                               onchange="plotEditor.updateObjectProperty('z_index', parseInt(this.value))">
                    </div>`;
                break;
            case 'line':
                properties_html += `
                    <div class="property-row">
                        <label>X1:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x1}" 
                               onchange="plotEditor.updateObjectProperty('x1', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y1:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y1}" 
                               onchange="plotEditor.updateObjectProperty('y1', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>X2:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x2}" 
                               onchange="plotEditor.updateObjectProperty('x2', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y2:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y2}" 
                               onchange="plotEditor.updateObjectProperty('y2', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Width:</label>
                        <input type="number" min="1" max="10" value="${this.selected_object.width}" 
                               onchange="plotEditor.updateObjectProperty('width', parseInt(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Color:</label>
                        <input type="color" class="color-input" value="${this.selected_object.color}" 
                               onchange="plotEditor.updateObjectProperty('color', this.value)">
                    </div>
                    <div class="property-row">
                        <label>Z-Index:</label>
                        <input type="number" value="${this.selected_object.z_index || 0}" 
                               onchange="plotEditor.updateObjectProperty('z_index', parseInt(this.value))">
                    </div>`;
                break;
            case 'area':
                properties_html += `
                    <div class="property-row">
                        <label>X1:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x1}" 
                               onchange="plotEditor.updateObjectProperty('x1', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y1:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y1}" 
                               onchange="plotEditor.updateObjectProperty('y1', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>X2:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x2}" 
                               onchange="plotEditor.updateObjectProperty('x2', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y2:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y2}" 
                               onchange="plotEditor.updateObjectProperty('y2', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Fill:</label>
                        <input type="color" class="color-input" value="${this.selected_object.fill_color.substring(0, 7)}" 
                               onchange="plotEditor.updateObjectProperty('fill_color', this.value + '50')">
                    </div>
                    <div class="property-row">
                        <label>Border:</label>
                        <input type="color" class="color-input" value="${this.selected_object.border_color}" 
                               onchange="plotEditor.updateObjectProperty('border_color', this.value)">
                    </div>
                    <div class="property-row">
                        <label>Z-Index:</label>
                        <input type="number" value="${this.selected_object.z_index || 0}" 
                               onchange="plotEditor.updateObjectProperty('z_index', parseInt(this.value))">
                    </div>`;
                break;
            case 'text':
                properties_html += `
                    <div class="property-row">
                        <label>X:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x}" 
                               onchange="plotEditor.updateObjectProperty('x', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y}" 
                               onchange="plotEditor.updateObjectProperty('y', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Text:</label>
                        <input type="text" value="${this.selected_object.text}" 
                               onchange="plotEditor.updateObjectProperty('text', this.value)" style="width: 100%;">
                    </div>
                    <div class="property-row">
                        <label>Size:</label>
                        <input type="number" min="8" max="48" value="${this.selected_object.font_size}" 
                               onchange="plotEditor.updateObjectProperty('font_size', parseInt(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Rotation (°):</label>
                        <input type="number" min="-360" max="360" step="1" value="${this.selected_object.rotation || 0}" 
                               onchange="plotEditor.updateObjectProperty('rotation', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Color:</label>
                        <input type="color" class="color-input" value="${this.selected_object.color}" 
                               onchange="plotEditor.updateObjectProperty('color', this.value)">
                    </div>
                    <div class="property-row">
                        <label>Z-Index:</label>
                        <input type="number" value="${this.selected_object.z_index || 0}" 
                               onchange="plotEditor.updateObjectProperty('z_index', parseInt(this.value))">
                    </div>`;
                break;
            case 'brace':
                properties_html += `
                    <div class="property-row">
                        <label>X1:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x1}" 
                               onchange="plotEditor.updateObjectProperty('x1', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y1:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y1}" 
                               onchange="plotEditor.updateObjectProperty('y1', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>X2:</label>
                        <input type="number" step="0.1" value="${this.selected_object.x2}" 
                               onchange="plotEditor.updateObjectProperty('x2', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Y2:</label>
                        <input type="number" step="0.1" value="${this.selected_object.y2}" 
                               onchange="plotEditor.updateObjectProperty('y2', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Color:</label>
                        <input type="color" class="color-input" value="${this.selected_object.color}" 
                               onchange="plotEditor.updateObjectProperty('color', this.value)">
                    </div>
                    <div class="property-row">
                        <label>Mirror:</label>
                        <input type="checkbox" ${this.selected_object.mirrored ? 'checked' : ''} 
                               onchange="plotEditor.updateObjectProperty('mirrored', this.checked)">
                    </div>
                    <div class="property-row">
                        <label>Style:</label>
                        <select onchange="plotEditor.updateObjectProperty('style', this.value)" style="width: 100%;">
                            <option value="smooth" ${(this.selected_object.style || '45deg') === 'smooth' ? 'selected' : ''}>Smooth</option>
                            <option value="traditional" ${(this.selected_object.style || '45deg') === 'traditional' ? 'selected' : ''}>Traditional</option>
                            <option value="45deg" ${(this.selected_object.style || '45deg') === '45deg' ? 'selected' : ''}>45° (No Overlap)</option>
                        </select>
                    </div>
                    <div class="property-row">
                        <label>Elevation:</label>
                        <input type="number" min="1" max="100" step="1" value="${this.selected_object.elevation || this.selected_object.width || 15}" 
                               onchange="plotEditor.updateObjectProperty('elevation', parseFloat(this.value))">
                    </div>
                    <div class="property-row">
                        <label>Z-Index:</label>
                        <input type="number" value="${this.selected_object.z_index || 0}" 
                               onchange="plotEditor.updateObjectProperty('z_index', parseInt(this.value))">
                    </div>`;
                break;
        }
        
        properties_html += `
            <button class="delete-btn" onclick="plotEditor.deleteSelectedObject()">Delete Object</button>
        </div>`;
        
        properties_container.innerHTML = properties_html;
    }

    /**
     * Generate SVG for a mathematical function
     * @param {Object} func - Function object
     * @returns {string} SVG path for function
     */
    generateFunctionSVG(func) {
        try {
            // Create a compiled function for better performance
            const compiledFunction = this.math.compile(func.expression);

            // Determine the actual x range to plot
            const plot_x_min = func.xMin !== null ? func.xMin : this.plot_bounds.x_min;
            const plot_x_max = func.xMax !== null ? func.xMax : this.plot_bounds.x_max;

            // Calculate number of samples based on range
            const range = plot_x_max - plot_x_min;
            const samples = Math.min(Math.max(Math.floor(range * 50), 100), 2000); // 50 samples per unit, min 100, max 2000
            const step = range / samples;

            let path = '';
            let firstPoint = true;
            let lastValidPoint = null;
            const maxJump = this.canvas.height * 0.2; // 20% of canvas height as discontinuity threshold

            for (let i = 0; i <= samples; i++) {
                const x = plot_x_min + i * step;

                try {
                    // Evaluate function at x
                    const y = compiledFunction.evaluate({ x: x });

                    if (isFinite(y)) {
                        const canvasCoords = this.plotToCanvas(x, y);

                        // Only include points within the effective plot area
                        const effective_plot_area = this.getEffectivePlotArea();
                        if (canvasCoords.x >= effective_plot_area.left &&
                            canvasCoords.x <= effective_plot_area.right &&
                            canvasCoords.y >= effective_plot_area.top &&
                            canvasCoords.y <= effective_plot_area.bottom) {

                            if (firstPoint) {
                                path += `M ${canvasCoords.x} ${canvasCoords.y}`;
                                firstPoint = false;
                            } else if (lastValidPoint !== null) {
                                // Check for discontinuity (large jump in y)
                                const lastCanvasCoords = this.plotToCanvas(lastValidPoint.x, lastValidPoint.y);
                                const jump = Math.abs(canvasCoords.y - lastCanvasCoords.y);

                                if (jump > maxJump) {
                                    // Discontinuity detected - start new path
                                    path += `" stroke="${func.color}" stroke-width="${func.width}" fill="none"/>
            <path d="M ${canvasCoords.x} ${canvasCoords.y}`;
                                } else {
                                    path += ` L ${canvasCoords.x} ${canvasCoords.y}`;
                                }
                            } else {
                                path += ` L ${canvasCoords.x} ${canvasCoords.y}`;
                            }

                            lastValidPoint = { x, y };
                        }
                    } else {
                        // Invalid point - end current path
                        if (!firstPoint) {
                            path += `" stroke="${func.color}" stroke-width="${func.width}" fill="none"/>
            <path d="`;
                            firstPoint = true;
                        }
                        lastValidPoint = null;
                    }
                } catch (error) {
                    // Function evaluation error - end current path
                    if (!firstPoint) {
                        path += `" stroke="${func.color}" stroke-width="${func.width}" fill="none"/>
            <path d="`;
                        firstPoint = true;
                    }
                    lastValidPoint = null;
                }
            }

            // Close the final path
            if (!firstPoint) {
                path += `" stroke="${func.color}" stroke-width="${func.width}" fill="none"/>`;
            }

            return path;

        } catch (error) {
            console.error('Error generating function SVG:', error);
            return '';
        }
    }
}
