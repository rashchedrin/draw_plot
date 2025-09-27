# Visual Plot Editor

A comprehensive HTML5 Canvas-based visual plot editor that allows users to create and edit mathematical plots with interactive elements.

## Features

### Core Functionality
- **Axes Properties**: Customize axis labels, ranges, and grid display
- **Interactive Tools**: Multiple drawing tools for different plot elements
- **Object Properties**: Modify colors, coordinates, and other properties of objects
- **Real-time Editing**: Live updates as you modify object properties

### Supported Plot Elements
1. **Points**: Add circular points with customizable size, color, text labels, and coordinate display
2. **Lines**: Draw straight lines between two points
3. **Filled Areas**: Create rectangular filled regions
  4. **Curly Braces**: Add mathematical notation braces with adjustable direction (mirror option) and style:
     - **Smooth**: Simple curved brace style
     - **Traditional**: Authentic mathematical brace with quarter circles and straight segments
5. **Text Annotations**: Add labeled text at any position

### User Interface
- **Tool Panel**: Select different drawing tools
- **Axes Controls**: Configure plot bounds and labels
- **Object List**: View and select all objects, including occluded ones
- **Properties Panel**: Edit selected object properties
- **Interactive Dragging**: Click and drag objects to reposition them
- **Coordinate Display**: Real-time cursor position display

## Usage

### Getting Started
1. Open `index.html` in a modern web browser
2. Or serve using a local HTTP server:
   ```bash
   python3 -m http.server 8000
   ```
   Then navigate to `http://localhost:8000`

### Tools and Controls

#### Tool Selection
- **Select Tool** (Ctrl+1): Select and modify existing objects, drag to reposition them
- **Point Tool** (Ctrl+2): Click to add points
- **Line Tool** (Ctrl+3): Click and drag to draw lines
- **Area Tool** (Ctrl+4): Click and drag to create filled rectangles
- **Brace Tool** (Ctrl+5): Click and drag to draw braces between two points
- **Text Tool** (Ctrl+6): Click to add text annotations

#### Axes Configuration
- **X/Y Axis Labels**: Set custom labels for axes
- **Axis Ranges**: Define the coordinate bounds (x-min, x-max, y-min, y-max)
- **Grid Toggle**: Show or hide the coordinate grid
- **Aspect Ratio**: Control the visual scaling ratio between X and Y axes (default: 1.0)
- **Automatic Tick Marks**: X and Y axes display tick marks with numerical labels
- **Smart Label Positioning**: Tick labels automatically avoid overlapping with axis intersection

#### Object Properties
When an object is selected, the properties panel shows:
- **Coordinates**: X, Y positions (and X2, Y2 for lines/areas/braces)
- **Colors**: Fill colors, border colors, or text colors
- **Sizes**: Point sizes, line widths, text font sizes
- **Text Content**: For text objects and point labels
- **Point Features**: Text labels and coordinate display toggle
  - **Brace Options**: Mirror checkbox to flip brace direction, style selector, and width control:
    - **Smooth**: Simple curved brace style
    - **Traditional**: Mathematical brace with quarter circles and straight line segments
    - **Width**: Adjustable brace thickness (distance from the connecting line)

#### Object List
The object list panel allows you to:
- **View All Objects**: See every object in your plot with descriptive names
- **Select Occluded Objects**: Click on any object in the list to select it, even if it's hidden behind others
- **Object Information**: View coordinates and properties at a glance
- **Visual Indicators**: Selected objects are highlighted in the list

#### Interactive Object Movement
With the Select Tool active, you can:
- **Click and Drag**: Move any object by clicking on it and dragging to a new position
- **Visual Feedback**: Dragged objects become slightly transparent during movement
- **Smart Cursor**: Cursor changes to indicate when objects can be moved
- **Real-time Updates**: Properties panel and object list update during dragging
- **Precise Positioning**: Use property panel for exact coordinate input

### Keyboard Shortcuts
- `Escape`: Deselect object and switch to select tool
- `Ctrl+1-6`: Quick tool selection
- `Ctrl+S`: Save plot (browser download)

### File Operations
- **Clear Plot**: Remove all objects from the plot
- **Export PNG**: Download the plot as a PNG bitmap image
- **Export SVG**: Download the plot as a scalable vector graphics file
- **Save Plot**: Export plot data as JSON file
- **Load Plot**: Import previously saved plot data

## Technical Implementation

### Architecture
- **PlotEditor Class**: Core functionality for coordinate system and object management
- **Object-Oriented Design**: Each plot element is represented as a typed object
- **Canvas Rendering**: HTML5 Canvas for high-performance graphics
- **Event-Driven**: Mouse and keyboard event handling for interaction

### Coordinate System
- **Plot Coordinates**: Mathematical coordinate system with configurable bounds
- **Canvas Coordinates**: Screen pixel coordinates for rendering
- **Automatic Conversion**: Seamless conversion between coordinate systems
- **Aspect Ratio Control**: Configurable scaling ratio between X and Y units
- **Smart Centering**: Plot automatically centers when aspect ratio changes effective dimensions

### Object Types
Each plot object contains:
- `type`: Object type identifier
- `id`: Unique identifier for selection and modification
- Coordinate properties (`x`, `y`, etc.)
- Visual properties (colors, sizes, etc.)
- Type-specific properties

### Browser Compatibility
- Requires modern browser with HTML5 Canvas support
- Tested on Chrome, Firefox, Safari, and Edge
- No external dependencies - fully self-contained

## Development

### File Structure
```
/
├── index.html      # Main HTML interface
├── style.css       # UI styling and layout
├── plotEditor.js   # Core plot editor functionality
├── script.js       # UI event handling and initialization
└── README.md       # This documentation
```

### Code Quality
- Full TypeScript-style documentation
- Assert-based error checking
- Semantic variable naming
- Fail-fast error handling
- Side-effects documentation

### Extending Functionality
To add new plot object types:
1. Add object creation method in PlotEditor class
2. Implement drawing method for the object type
3. Add distance calculation for selection
4. Create property panel UI for the object type
5. Add tool button and event handlers

### Development and Debugging

#### Object Selection Debug Mode
The editor uses a color-coded picking canvas for accurate object selection. To debug selection issues, you can visualize this picking canvas:

```javascript
// Show the picking canvas overlay (in browser console)
plotEditor.showPickingCanvas(true);

// Hide the picking canvas overlay
plotEditor.showPickingCanvas(false);
```

The picking canvas shows:
- **Bounding boxes** (first pass) - filled rectangles/circles for selectable areas
- **Objects** (second pass) - actual object shapes drawn on top
- **Unique colors** - each object gets a unique RGB color mapped to its ID
- **Z-index ordering** - objects drawn in correct layer order

This visualization helps debug selection accuracy, especially for rotated text and overlapping objects.

## License

This project is open source and available under the MIT License.
