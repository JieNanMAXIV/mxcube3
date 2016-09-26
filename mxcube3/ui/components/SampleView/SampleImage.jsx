import './SampleView.css';
import React from 'react';
import { makePoints, makeLines, makeImageOverlay } from './shapes';
import SampleControls from './SampleControls';
import 'fabric';
const fabric = window.fabric;

export default class SampleImage extends React.Component {

  constructor(props) {
    super(props);
    this.setImageRatio = this.setImageRatio.bind(this);
    this.canvas = {};
  }

  componentDidMount() {
    // Create fabric and set image background to sample
    this.canvas = new fabric.Canvas('canvas', { defaultCursor: 'crosshair' });

    // Bind leftClick to function
    this.canvas.on('mouse:down', (option) => this.leftClick(option));

    // Bind rigthclick to function manually with javascript
    const imageOverlay = document.getElementById('insideWrapper');
    imageOverlay.addEventListener('contextmenu', (e) => this.rightClick(e), false);
    // Bind mouse scroll up/down to function manually with javascript
    imageOverlay.addEventListener('wheel', (e) => this.wheel(e), false);
    // Bind mouse double click to function manually with javascript
    imageOverlay.addEventListener('dblclick', (e) => this.goToBeam(e), false);

    this.setImageRatio();

    // Add so that the canvas will resize if the window changes size
    window.addEventListener('resize', this.setImageRatio);
  }

  componentWillReceiveProps(nextProps) {
    const { width, cinema } = this.props;
    if (nextProps.width !== width || nextProps.cinema !== cinema) {
      this.setImageRatio();
    }
  }

  componentWillUpdate(nextProps) {
    this.renderSampleView(nextProps);
  }

  componentWillUnmount() {
    // Important to remove listener if component isn't active
    window.removeEventListener('resize', this.setImageRatio);
  }

  setImageRatio() {
    this.props.sampleActions.setImageRatio(document.getElementById('outsideWrapper').clientWidth);
  }
  goToBeam(e) {
    const { sampleActions, imageRatio } = this.props;
    const { sendGoToBeam } = sampleActions;
    sendGoToBeam(e.layerX * imageRatio, e.layerY * imageRatio);
  }

  drawCanvas(imageRatio) {
    // Getting the size of screen
    const { width, height } = this.props;
    const w = width / imageRatio;
    const h = height / imageRatio;
    // Set the size of the original html Canvas
    const canvasWindow = document.getElementById('canvas');
    canvasWindow.width = w;
    canvasWindow.height = h;
    // Set the size of the created FabricJS Canvas
    this.canvas.setDimensions({ width: w, height: h });
    this.canvas.renderAll();
    this.canvas.clear();

    // Set size of the Image from MD2
    document.getElementById('sample-img').style.height = `${h}px`;
    document.getElementById('sample-img').style.width = `${w}px`;
    document.getElementById('insideWrapper').style.height = `${h}px`;
  }


  rightClick(e) {
    const group = this.canvas.getActiveGroup();
    const { sampleActions } = this.props;
    const { showContextMenu } = sampleActions;
    let objectFound = false;
    const clickPoint = new fabric.Point(e.offsetX, e.offsetY);
    e.preventDefault();
    showContextMenu(false);

    this.canvas.forEachObject((obj) => {
      if (!objectFound && obj.containsPoint(clickPoint) && obj.selectable) {
        objectFound = true;
        this.canvas.setActiveObject(obj);
        showContextMenu(true, obj, obj.left, obj.top);
      }
    });

    if (group && group.containsPoint(clickPoint) && group.getObjects().length === 2) {
      const points = group.getObjects();

      showContextMenu(true, {
        type: 'GROUP',
        p1: points[0].id,
        p2: points[1].id },
        e.offsetX, e.offsetY);
    } else if (!objectFound) {
      showContextMenu(true, { type: 'NONE' }, e.offsetX, e.offsetY);
    }
  }

  leftClick(option) {
    const { sampleActions, clickCentring, measureDistance, imageRatio } = this.props;

    sampleActions.showContextMenu(false);
    if (clickCentring) {
      sampleActions.sendCentringPoint(option.e.layerX * imageRatio, option.e.layerY * imageRatio);
    } else if (measureDistance) {
      sampleActions.addDistancePoint(option.e.layerX * imageRatio, option.e.layerY * imageRatio);
    }
  }

  wheel(e) {
    e.preventDefault();
    e.stopPropagation();
    const { sampleActions, motorSteps, zoom } = this.props;
    const { sendMotorPosition, sendZoomPos } = sampleActions;
    const motors = this.props.beamline.motors;
    if (e.ctrlKey && motors.phi.Status === 2) {
      // then we rotate phi axis by the step size defined in its box
      if (e.deltaX > 0 || e.deltaY > 0) {
        // zoom in
        sendMotorPosition('Phi', motors.phi.position + parseInt(motorSteps.phiStep, 10));
      } else if (e.deltaX < 0 || e.deltaY < 0) {
        // zoom out
        sendMotorPosition('Phi', motors.phi.position - parseInt(motorSteps.phiStep, 10));
      }
    } else if (e.altKey && motors.focus.Status === 2) {
      if (e.deltaY > 0) {
        // Focus in
        sendMotorPosition('Focus', motors.focus.position + parseFloat(motorSteps.focusStep, 10));
      } else if (e.deltaY < 0) {
        // Focus out
        sendMotorPosition('Focus', motors.focus.position - parseFloat(motorSteps.focusStep, 10));
      }
    } else if (!e.ctrlKey && !e.altKey && motors.zoom.Status === 2) {
      // in this case zooming
      if (e.deltaY > 0 && zoom < 10) {
        // zoom in
        sendZoomPos(zoom + 1);
      } else if (e.deltaY < 0 && zoom > 1) {
        // zoom out
        sendZoomPos(zoom - 1);
      }
    }
  }

  renderSampleView(nextProps) {
    const group = this.canvas.getActiveGroup();
    const selection = this.canvas.getActiveObject();
    const {
      imageRatio,
      beamPosition,
      beamShape,
      beamSize,
      clickCentringPoints,
      distancePoints,
      points,
      lines,
      pixelsPerMm
    } = nextProps;
    this.drawCanvas(imageRatio);
    this.canvas.add(...makeImageOverlay(
      imageRatio,
      pixelsPerMm,
      beamPosition,
      beamShape,
      beamSize,
      clickCentringPoints,
      distancePoints,
      this.canvas
    ));
    const fabricSelectables = [...makePoints(points, imageRatio), ...makeLines(lines, points, imageRatio)];
    this.canvas.add(...fabricSelectables);
    if (group) {
      const groupIDs = group.getObjects().map((shape) => shape.id);
      const selectedShapes = [];
      fabricSelectables.forEach((shape) => {
        if (groupIDs.includes(shape.id)) {
          selectedShapes.push(shape);
        }
      });
      this.canvas.setActiveGroup(
        new fabric.Group(
          selectedShapes,
          {
            originX: 'center',
            originY: 'center'
          })
      );

    } else if (selection) {
      fabricSelectables.forEach((shape) => {
        if (shape.id === selection.id) {
          this.canvas.setActiveObject(shape);
        }
      });
    }
  }


  render() {
    return (
      <div>
        <div className="outsideWrapper" id="outsideWrapper">
            <div className="insideWrapper" id="insideWrapper">
                <img
                  id= "sample-img"
                  className="img"
                  src="/mxcube/api/v0.1/sampleview/camera/subscribe"
                  alt="SampleView"
                />
                <canvas id="canvas" className="coveringCanvas" />
            </div>
        </div>
        <SampleControls
          {...this.props}
          canvas={this.canvas}
        />
      </div>
    );
  }
}
