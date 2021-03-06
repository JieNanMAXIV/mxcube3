import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import SampleImage from '../components/SampleView/SampleImage';
import MotorControl from '../components/SampleView/MotorControl';
import ContextMenu from '../components/SampleView/ContextMenu';
import * as SampleViewActions from '../actions/sampleview';
import { showTaskForm } from '../actions/taskForm';
import BeamlineSetupContainer from './BeamlineSetupContainer';
import SampleQueueContainer from './SampleQueueContainer';


class SampleViewContainer extends Component {

  render() {
    const { imageRatio, motorSteps, cinema } = this.props.sampleViewState;
    const { sendMotorPosition, setStepSize, sendStopMotor } = this.props.sampleViewActions;
    const sampleId = this.props.current.node;

    return (
      <div className="row">
        <div className="col-xs-1">
            <MotorControl
              save={sendMotorPosition}
              saveStep={setStepSize}
              motors={this.props.beamline.motors}
              steps={motorSteps}
              stop={sendStopMotor}
            />
        </div>
        <div className={cinema ? 'col-xs-9' : 'col-xs-8'}>
            <div className="row">
              <div className="col-xs-12">
                <ContextMenu
                  {...this.props.contextMenu}
                  sampleActions={this.props.sampleViewActions}
                  showForm={this.props.showForm}
                  sampleId={sampleId}
                  samplesInformation={this.props.sampleInformation}
                  defaultParameters={this.props.defaultParameters}
                  imageRatio={imageRatio}
                />
                <SampleImage
                  sampleActions={this.props.sampleViewActions}
                  {...this.props.sampleViewState}
                  beamline={this.props.beamline}
                />
              </div>
            </div>
        </div>
        <div className={cinema ? 'col-xs-2' : 'col-xs-3'}>
          <BeamlineSetupContainer />
          <SampleQueueContainer />
        </div>
      </div>
    );
  }
}


function mapStateToProps(state) {
  return {
    current: state.queue.current,
    sampleInformation: state.queue.sampleList,
    sampleViewState: state.sampleview,
    contextMenu: state.contextMenu,
    beamline: state.beamline,
    defaultParameters: state.taskForm.defaultParameters
  };
}

function mapDispatchToProps(dispatch) {
  return {
    sampleViewActions: bindActionCreators(SampleViewActions, dispatch),
    showForm: bindActionCreators(showTaskForm, dispatch)
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SampleViewContainer);
