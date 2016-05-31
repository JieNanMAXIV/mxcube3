import fetch from 'isomorphic-fetch';
import { sendClearQueue, sendRunSample, sendAddSample, sendMountSample } from './queue';
import { showTaskForm } from './taskForm';
import { setLoading, showErrorPanel } from './general';

export function doUpdateSamples(samples_list) {
  return { type: 'UPDATE_SAMPLES', samples_list };
}

export function doGetSamplesList() {
  return function (dispatch) {
    dispatch(setLoading(true));
    fetch('mxcube/api/v0.1/sample_changer/samples_list', { credentials: 'include' })
            .then(response => response.json())
            .then(json => {
              dispatch(setLoading(false));
              dispatch(doUpdateSamples(json));
            }, () => {
              dispatch(setLoading(false));
              dispatch(showErrorPanel(true, 'Could not get samples list'));
            });
  };
}

export function doAddSample(id, parameters) {
  return function (dispatch) {
    dispatch(sendAddSample(id)).then(
            queueID => {
              dispatch(sendMountSample(queueID));
            }
        );
    dispatch(doAddSampleGrid(id, parameters));
  };
}

export function doAddSampleGrid(id, parameters) {
  return {
    type: 'ADD_SAMPLE_TO_GRID',
    id :id,
    data: parameters
  };
}



export function doSetLoadable(loadable) {
  return { type: 'SET_LOADABLE', loadable };
}

export function doAddTag(tag) {
  return { type: 'ADD_TAG', tag };
}

export function doToggleSelected(index) {
  return { type: 'TOGGLE_SELECTED', index };
}

export function doSelectAll() {
  let selected = true;
  return { type: 'SELECT_ALL', selected };
}

export function doUnselectAll() {
  let selected = false;
  return { type: 'UNSELECT_ALL', selected };
}

export function doFilter(filter_text) {
  return { type: 'FILTER', filter_text };
}

export function doSetSamplesInfo(sample_info_list) {
  return { type: 'SET_SAMPLES_INFO', sample_info_list };
}

export function doSyncSamples(proposal_id) {
  return function (dispatch) {
    fetch('mxcube/api/v0.1/samples/' + proposal_id, { credentials: 'include' })
            .then(response => response.json())
            .then(json => {
              dispatch(doSetSamplesInfo(json.samples_info));
            });
  };
}

export function doAddTask(sample_queueID, sample_id, task, parameters) {
  return { type: 'ADD_METHOD',
            task_type: task.Type,
            index: sample_id,
            parent_id: sample_queueID,
            queueID: task.QueueId,
            parameters: parameters
           };
}

export function doAddTaskResult(sample_id, task_queueID, state) {
  return { type: 'ADD_METHOD_RESULTS',
            index: sample_id,
            queueID: task_queueID,
            state: state
            };
}

export function sendManualMount(manual) {
  return function (dispatch) {
    fetch('mxcube/api/v0.1/diffractometer/usesc', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-type': 'application/json'
      },
      body: JSON.stringify({ 'use_sc': !manual })
    }).then((response) => {
      if (response.status >= 400) {
        dispatch(showErrorPanel(true, 'Could not toogle manual mode'));
      } else {
        dispatch(sendClearQueue());
        dispatch(doSetManualMount(manual));
        if (manual) {
          dispatch(showTaskForm('AddSample'));
        }
      }
    });
  };
}

export function doSetManualMount(manual) {
  return { type: 'SET_MANUAL_MOUNT', manual };
}


export function doChangeTask(queueID, sample_id, parameters) {
  return { type: 'CHANGE_METHOD',
            index: sample_id,
            queueID: queueID,
            parameters: parameters
    };
}

export function doRemoveTask(sample_queueID, queueID, sample_id) {
  return { type: 'REMOVE_METHOD',
            index: sample_id,
            parent_id: sample_queueID,
            queueID: queueID
            };
}

export function sendAddSampleTask(queueID, sample_id, parameters, runNow) {
  return function (dispatch) {
    fetch('mxcube/api/v0.1/queue/' + queueID, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-type': 'application/json'
      },
      body: JSON.stringify(parameters)
    }).then((response) => {
      if (response.status >= 400) {
        throw new Error('Could not add sample task, server refused');
      }
      return response.json();
    }).then(function (json) {
      if (runNow) {
        dispatch(sendRunSample(json.QueueId));
      }
      dispatch(doAddTask(queueID, sample_id, json, parameters));
    });
  };
}

export function sendAddSampleAndTask(sample_id, parameters) {
  return function (dispatch) {
    dispatch(sendAddSample(sample_id)).then(
            queueID => {
              dispatch(sendAddSampleTask(queueID, sample_id, parameters));
            });
  };
}

export function sendChangeSampleTask(task_queueID, sample_queueID, sample_id, parameters, runNow) {
  return function (dispatch) {
    fetch('mxcube/api/v0.1/queue/' + sample_queueID + '/' + task_queueID, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-type': 'application/json'
      },
      body: JSON.stringify(parameters)
    }).then((response) => {
      if (response.status >= 400) {
        throw new Error('Could not change sample task, server refused');
      }
      return response.json();
    }).then(function () {
      if (runNow) {
        dispatch(sendRunSample(task_queueID));
      }
      dispatch(doChangeTask(task_queueID, sample_id, parameters));
    });
  };
}


export function sendDeleteSampleTask(parent_id, queueID, sample_id) {
  return function (dispatch) {
    fetch('mxcube/api/v0.1/queue/' + queueID, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-type': 'application/json'
      }

    }).then(function (response) {
      if (response.status >= 400) {
        throw new Error('Server refused to remove sample');
      } else {
        dispatch(doRemoveTask(parent_id, queueID, sample_id));
      }
    });
  };
}
