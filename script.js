/**
 * Main application script - handles UI interactions and initialization
 * side-effects: Initializes plot editor and sets up event listeners
 */

// Global plot editor instance
let g_plot_editor = null;

/**
 * Initialize the application when DOM is loaded
 * side-effects: Creates plot editor instance and sets up all event listeners
 */
document.addEventListener('DOMContentLoaded', function() {
    initializePlotEditor();
    setupUIEventListeners();
    updateAxesFromUI();
});

/**
 * Initialize the plot editor
 * side-effects: Creates global plot editor instance
 */
function initializePlotEditor() {
    const canvas_element = document.getElementById('plot-canvas');
    assert(canvas_element !== null, "Expected canvas element to exist, got null");
    
    g_plot_editor = new PlotEditor(canvas_element);
    
    // Make it globally accessible for property panel callbacks
    window.plotEditor = g_plot_editor;
}

/**
 * Set up all UI event listeners
 * side-effects: Adds event listeners to various UI elements
 */
function setupUIEventListeners() {
    setupToolButtons();
    setupFunctionPanel();
    setupAxesControls();
    setupTopToolbar();
    setupKeyboardShortcuts();
    setupCollapsiblePanels();
}

/**
 * Set up tool button event listeners
 * side-effects: Adds click listeners to tool buttons
 */
function setupToolButtons() {
    const tool_buttons = document.querySelectorAll('.tool-btn');
    
    tool_buttons.forEach(button => {
        button.addEventListener('click', function() {
            const tool_name = this.getAttribute('data-tool');
            assert(tool_name !== null, "Expected tool name to be set, got null");
            
            selectTool(tool_name);
            setActiveTool(this);
        });
    });
}

/**
 * Set up function panel event listeners
 * side-effects: Adds event listeners for function panel
 */
function setupFunctionPanel() {
    const function_panel = document.getElementById('function-panel');
    const function_tool_btn = document.getElementById('tool-function');
    const add_function_btn = document.getElementById('add-function');

    // Show/hide function panel when function tool is selected
    if (function_tool_btn) {
        function_tool_btn.addEventListener('click', function() {
            const is_active = this.classList.contains('active');
            if (is_active) {
                function_panel.style.display = 'block';
            } else {
                function_panel.style.display = 'none';
            }
        });
    }

    // Add function button click handler
    if (add_function_btn) {
        add_function_btn.addEventListener('click', function() {
            const expression = document.getElementById('function-expression').value.trim();
            const x_min_input = document.getElementById('function-x-min').value.trim();
            const x_max_input = document.getElementById('function-x-max').value.trim();
            const color = document.getElementById('function-color').value;
            const width = parseInt(document.getElementById('function-width').value);

            // Parse x_min and x_max, handling infinity
            let x_min, x_max;
            if (x_min_input === '-∞' || x_min_input === '-inf' || x_min_input === '') {
                x_min = null; // Will use axes bounds
            } else {
                x_min = parseFloat(x_min_input);
            }

            if (x_max_input === '∞' || x_max_input === 'inf' || x_max_input === '') {
                x_max = null; // Will use axes bounds
            } else {
                x_max = parseFloat(x_max_input);
            }

            if (expression) {
                g_plot_editor.addFunction(expression, x_min, x_max, color, width);
                // Clear the form
                document.getElementById('function-expression').value = '';
            } else {
                alert('Please enter a valid function expression.');
            }
        });
    }
}

/**
 * Set up axes control event listeners
 * side-effects: Adds change listeners to axes input fields
 */
function setupAxesControls() {
    // Axes labels
    const x_label_input = document.getElementById('x-axis-label');
    const y_label_input = document.getElementById('y-axis-label');
    
    x_label_input.addEventListener('change', updateAxesFromUI);
    y_label_input.addEventListener('change', updateAxesFromUI);
    
    // Axes ranges
    const x_min_input = document.getElementById('x-min');
    const x_max_input = document.getElementById('x-max');
    const y_min_input = document.getElementById('y-min');
    const y_max_input = document.getElementById('y-max');
    
    x_min_input.addEventListener('change', updateAxesFromUI);
    x_max_input.addEventListener('change', updateAxesFromUI);
    y_min_input.addEventListener('change', updateAxesFromUI);
    y_max_input.addEventListener('change', updateAxesFromUI);
    
    // Grid toggle
    const grid_checkbox = document.getElementById('show-grid');
    grid_checkbox.addEventListener('change', updateAxesFromUI);
    
    // Aspect ratio
    const aspect_ratio_input = document.getElementById('aspect-ratio');
    aspect_ratio_input.addEventListener('change', updateAxesFromUI);
}

/**
 * Set up top toolbar event listeners
 * side-effects: Adds click listeners to toolbar buttons
 */
function setupTopToolbar() {
    const clear_button = document.getElementById('clear-plot');
    const export_button = document.getElementById('export-plot');
    const export_svg_button = document.getElementById('export-svg');
    const undo_button = document.getElementById('undo-btn');
    const redo_button = document.getElementById('redo-btn');
    
    clear_button.addEventListener('click', clearPlot);
    export_button.addEventListener('click', exportPlot);
    export_svg_button.addEventListener('click', exportPlotAsSVG);
    undo_button.addEventListener('click', () => plotEditor.undo());
    redo_button.addEventListener('click', () => plotEditor.redo());
}

/**
 * Set up keyboard shortcuts
 * side-effects: Adds keydown listener to document
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(event) {
        // Escape key - deselect and switch to select tool
        if (event.key === 'Escape') {
            selectTool('select');
            setActiveToolByName('select');
        }
        
        // Undo/Redo shortcuts
        if (event.ctrlKey || event.metaKey) {
            if (event.key === 'z' && !event.shiftKey) {
                event.preventDefault();
                plotEditor.undo();
                return;
            }
            if ((event.key === 'y') || (event.key === 'z' && event.shiftKey)) {
                event.preventDefault();
                plotEditor.redo();
                return;
            }
        }
        
        // Tool shortcuts
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case '1':
                    event.preventDefault();
                    selectTool('select');
                    setActiveToolByName('select');
                    break;
                case '2':
                    event.preventDefault();
                    selectTool('point');
                    setActiveToolByName('point');
                    break;
                case '3':
                    event.preventDefault();
                    selectTool('line');
                    setActiveToolByName('line');
                    break;
                case '4':
                    event.preventDefault();
                    selectTool('area');
                    setActiveToolByName('area');
                    break;
                case '5':
                    event.preventDefault();
                    selectTool('brace');
                    setActiveToolByName('brace');
                    break;
                case '6':
                    event.preventDefault();
                    selectTool('text');
                    setActiveToolByName('text');
                    break;
                case '7':
                    event.preventDefault();
                    selectTool('function');
                    setActiveToolByName('function');
                    break;
            }
        }
    });
}

/**
 * Update tool panel visibility based on selected tool
 * @param {string} tool_name - Name of selected tool
 * side-effects: Shows/hides tool-specific panels
 */
function updateToolPanelVisibility(tool_name) {
    const function_panel = document.getElementById('function-panel');

    if (tool_name === 'function') {
        function_panel.style.display = 'block';
    } else {
        function_panel.style.display = 'none';
    }
}

/**
 * Select a tool and update the plot editor
 * @param {string} tool_name - Name of tool to select
 * side-effects: Updates plot editor tool and canvas cursor
 */
function selectTool(tool_name) {
    assert(typeof tool_name === 'string', `Expected tool_name to be string, got ${typeof tool_name}`);
    assert(g_plot_editor !== null, "Expected plot editor to be initialized, got null");

    g_plot_editor.setTool(tool_name);
    updateCanvasCursor(tool_name);
    updateToolPanelVisibility(tool_name);
}

/**
 * Update canvas cursor based on selected tool
 * @param {string} tool_name - Name of selected tool
 * side-effects: Changes canvas cursor style
 */
function updateCanvasCursor(tool_name) {
    const canvas_element = document.getElementById('plot-canvas');
    
    switch (tool_name) {
        case 'select':
            canvas_element.style.cursor = 'default';
            break;
        case 'point':
            canvas_element.style.cursor = 'crosshair';
            break;
        case 'line':
        case 'area':
            canvas_element.style.cursor = 'crosshair';
            break;
        case 'text':
            canvas_element.style.cursor = 'text';
            break;
        case 'brace':
            canvas_element.style.cursor = 'crosshair';
            break;
        case 'function':
            canvas_element.style.cursor = 'default';
            break;
        default:
            canvas_element.style.cursor = 'default';
    }
}

/**
 * Set active tool button visual state
 * @param {HTMLElement} active_button - Button element to make active
 * side-effects: Updates button classes
 */
function setActiveTool(active_button) {
    assert(active_button instanceof HTMLElement, "Expected active_button to be HTMLElement");
    
    // Remove active class from all buttons
    const tool_buttons = document.querySelectorAll('.tool-btn');
    tool_buttons.forEach(button => button.classList.remove('active'));
    
    // Add active class to selected button
    active_button.classList.add('active');
}

/**
 * Set active tool by tool name
 * @param {string} tool_name - Name of tool to make active
 * side-effects: Updates button classes
 */
function setActiveToolByName(tool_name) {
    const tool_button = document.querySelector(`[data-tool="${tool_name}"]`);
    if (tool_button) {
        setActiveTool(tool_button);
    }
}

/**
 * Update axes properties from UI inputs
 * side-effects: Updates plot editor axes properties
 */
function updateAxesFromUI() {
    assert(g_plot_editor !== null, "Expected plot editor to be initialized, got null");
    
    // Get input values
    const x_label = document.getElementById('x-axis-label').value;
    const y_label = document.getElementById('y-axis-label').value;
    const x_min = parseFloat(document.getElementById('x-min').value);
    const x_max = parseFloat(document.getElementById('x-max').value);
    const y_min = parseFloat(document.getElementById('y-min').value);
    const y_max = parseFloat(document.getElementById('y-max').value);
    const show_grid = document.getElementById('show-grid').checked;
    const aspect_ratio = parseFloat(document.getElementById('aspect-ratio').value);
    
    // Validate ranges
    assert(x_min < x_max, `Expected x_min (${x_min}) to be less than x_max (${x_max})`);
    assert(y_min < y_max, `Expected y_min (${y_min}) to be less than y_max (${y_max})`);
    assert(aspect_ratio > 0, `Expected aspect_ratio (${aspect_ratio}) to be greater than 0`);
    
    // Update plot editor
    g_plot_editor.updatePlotBounds({
        x_min: x_min,
        x_max: x_max,
        y_min: y_min,
        y_max: y_max
    });
    
    g_plot_editor.updateAxesProperties({
        x_label: x_label,
        y_label: y_label,
        show_grid: show_grid,
        aspect_ratio: aspect_ratio
    });
}

/**
 * Clear all objects from the plot
 * side-effects: Clears plot editor objects
 */
function clearPlot() {
    assert(g_plot_editor !== null, "Expected plot editor to be initialized, got null");
    
    if (confirm('Are you sure you want to clear all objects from the plot?')) {
        g_plot_editor.clearPlot();
    }
}

/**
 * Export plot as image
 * side-effects: Downloads canvas as PNG image
 */
function exportPlot() {
    assert(g_plot_editor !== null, "Expected plot editor to be initialized, got null");
    
    const canvas_element = document.getElementById('plot-canvas');
    const link_element = document.createElement('a');
    
    // Create download link
    link_element.download = `plot_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    link_element.href = canvas_element.toDataURL('image/png');
    
    // Trigger download
    document.body.appendChild(link_element);
    link_element.click();
    document.body.removeChild(link_element);
}

/**
 * Export plot as SVG
 * side-effects: Downloads plot as SVG file
 */
function exportPlotAsSVG() {
    assert(g_plot_editor !== null, "Expected plot editor to be initialized, got null");
    
    const svg_content = g_plot_editor.generateSVG();
    const blob = new Blob([svg_content], { type: 'image/svg+xml' });
    
    const link_element = document.createElement('a');
    link_element.download = `plot_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.svg`;
    link_element.href = URL.createObjectURL(blob);
    
    // Trigger download
    document.body.appendChild(link_element);
    link_element.click();
    document.body.removeChild(link_element);
    
    URL.revokeObjectURL(link_element.href);
}

/**
 * Utility function to create plot data structure for saving/loading
 * @returns {Object} Plot data object containing all plot information
 */
function getPlotData() {
    assert(g_plot_editor !== null, "Expected plot editor to be initialized, got null");

    // Create a copy of objects with serializable data only
    const serializable_objects = g_plot_editor.plot_objects.map(obj => {
        const serializable_obj = { ...obj };

        // For function objects, we need to remove any non-serializable properties
        if (obj.type === 'function') {
            // Keep only the essential properties that can be serialized
            // The compiled function will be recreated when loading
            return {
                type: obj.type,
                id: obj.id,
                expression: obj.expression,
                xMin: obj.xMin,
                xMax: obj.xMax,
                color: obj.color,
                width: obj.width,
                z_index: obj.z_index
            };
        }

        return serializable_obj;
    });

    return {
        version: '1.0',
        plot_bounds: g_plot_editor.plot_bounds,
        axes_properties: g_plot_editor.axes_properties,
        objects: serializable_objects,
        timestamp: new Date().toISOString()
    };
}

/**
 * Load plot data from object
 * @param {Object} plot_data - Plot data object
 * side-effects: Updates plot editor with loaded data
 */
function loadPlotData(plot_data) {
    assert(g_plot_editor !== null, "Expected plot editor to be initialized, got null");
    assert(typeof plot_data === 'object', `Expected plot_data to be object, got ${typeof plot_data}`);
    assert(plot_data.version !== undefined, "Expected plot_data to have version property");
    
    // Update plot bounds
    if (plot_data.plot_bounds) {
        g_plot_editor.updatePlotBounds(plot_data.plot_bounds);
        
        // Update UI inputs
        document.getElementById('x-min').value = plot_data.plot_bounds.x_min;
        document.getElementById('x-max').value = plot_data.plot_bounds.x_max;
        document.getElementById('y-min').value = plot_data.plot_bounds.y_min;
        document.getElementById('y-max').value = plot_data.plot_bounds.y_max;
    }
    
    // Update axes properties
    if (plot_data.axes_properties) {
        g_plot_editor.updateAxesProperties(plot_data.axes_properties);
        
        // Update UI inputs
        document.getElementById('x-axis-label').value = plot_data.axes_properties.x_label || 'X-axis';
        document.getElementById('y-axis-label').value = plot_data.axes_properties.y_label || 'Y-axis';
        document.getElementById('show-grid').checked = plot_data.axes_properties.show_grid !== false;
        document.getElementById('aspect-ratio').value = plot_data.axes_properties.aspect_ratio || 1.0;
    }
    
    // Load objects
    if (plot_data.objects) {
        g_plot_editor.plot_objects = plot_data.objects;
        g_plot_editor.selected_object = null;
        g_plot_editor.updatePropertiesPanel();
        g_plot_editor.updateObjectList();

        // Wait for math library to be ready before redrawing
        g_plot_editor.initializeMathLibrary(() => {
            console.log('Math library ready, redrawing after load');
            g_plot_editor.redraw();
        });
    }
}

/**
 * Save plot data as JSON file
 * side-effects: Downloads plot data as JSON file
 */
function savePlotAsJSON() {
    const plot_data = getPlotData();
    const data_string = JSON.stringify(plot_data, null, 2);
    const blob = new Blob([data_string], { type: 'application/json' });
    
    const link_element = document.createElement('a');
    link_element.download = `plot_data_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    link_element.href = URL.createObjectURL(blob);
    
    document.body.appendChild(link_element);
    link_element.click();
    document.body.removeChild(link_element);
    
    URL.revokeObjectURL(link_element.href);
}

/**
 * Load plot data from JSON file
 * side-effects: Creates file input and loads selected file
 */
function loadPlotFromJSON() {
    const file_input = document.createElement('input');
    file_input.type = 'file';
    file_input.accept = '.json';
    
    file_input.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const plot_data = JSON.parse(e.target.result);
                    loadPlotData(plot_data);
                } catch (error) {
                    alert('Error loading plot data: ' + error.message);
                }
            };
            reader.readAsText(file);
        }
    });
    
    file_input.click();
}

/**
 * Add save/load functionality to toolbar
 * side-effects: Adds save/load buttons to header toolbar
 */
function addSaveLoadButtons() {
    const toolbar_element = document.querySelector('.toolbar');
    
    const save_button = document.createElement('button');
    save_button.className = 'btn btn-primary';
    save_button.textContent = 'Save Plot';
    save_button.addEventListener('click', savePlotAsJSON);
    
    const load_button = document.createElement('button');
    load_button.className = 'btn btn-primary';
    load_button.textContent = 'Load Plot';
    load_button.addEventListener('click', loadPlotFromJSON);
    
    toolbar_element.appendChild(save_button);
    toolbar_element.appendChild(load_button);
}

// Add save/load buttons when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    addSaveLoadButtons();
});

/**
 * Set up collapsible panels functionality
 * side-effects: Adds click listeners to collapse toggles
 */
function setupCollapsiblePanels() {
    const toggle_button = document.getElementById('objects-collapse-toggle');
    const content = document.getElementById('object-list');
    
    if (toggle_button && content) {
        // Load saved state from localStorage
        const is_collapsed = localStorage.getItem('objects-list-collapsed') === 'true';
        if (is_collapsed) {
            toggle_button.classList.add('collapsed');
            content.classList.add('collapsed');
        }
        
        toggle_button.addEventListener('click', function() {
            const is_currently_collapsed = toggle_button.classList.contains('collapsed');
            
            if (is_currently_collapsed) {
                // Expand
                toggle_button.classList.remove('collapsed');
                content.classList.remove('collapsed');
                localStorage.setItem('objects-list-collapsed', 'false');
            } else {
                // Collapse
                toggle_button.classList.add('collapsed');
                content.classList.add('collapsed');
                localStorage.setItem('objects-list-collapsed', 'true');
            }
        });
    }
}

/**
 * Assert function for debugging and validation
 * @param {boolean} condition - Condition to check
 * @param {string} message - Error message if condition fails
 * side-effects: Throws error if condition is false
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error('Assertion failed: ' + message);
    }
}
