from flask import session, redirect, url_for, render_template, request, Response, stream_with_context
from mxcube3 import app as mxcube
import time, logging, collections
import gevent.event
import os, json
import signals

SAMPLE_IMAGE = None

for signal in signals.MaxLabMicrodiff_signals:
    mxcube.diffractometer.connect(mxcube.diffractometer,signal, signals.signalCallback4)

#mxcube.resolution.connect(mxcube.resolution, 'deviceReady', signals.signalCallback4)
###----SSE SAMPLE VIDEO STREAMING----###
keep_streaming = True
camera_hwobj = mxcube.diffractometer.getObjectByRole("camera")

def new_sample_video_frame_received(img, width, height, *args):
    global SAMPLE_IMAGE
    SAMPLE_IMAGE = img
    camera_hwobj.new_frame.set()
    camera_hwobj.new_frame.clear()
    #logging.getLogger('HWR.MX3').info('[Stream] Camera video set&clear')


camera_hwobj.connect("imageReceived", new_sample_video_frame_received)
camera_hwobj.new_frame = gevent.event.Event()

keep_streaming = True

def stream_video():
    """it just send a message to the client so it knows that there is a new image. A HO is supplying that image"""
    #logging.getLogger('HWR.Mx3').info('[Stream] Camera video streaming started')
    global SAMPLE_IMAGE
    while keep_streaming:
        try:
            camera_hwobj.new_frame.wait()
            logging.getLogger('HWR.MX3').info('[Stream] Camera video yielding')
            yield 'Content-type: image/jpg\n\n'+SAMPLE_IMAGE+"\n--!>"
        except:
            pass
@mxcube.route("/mxcube/api/v0.1/samplecentring/camera/subscribe", methods=['GET'])
def subscribeToCamera():
    """SampleCentring: subscribe to the streaming
    data = {generic_data} #or nothing?
    return_data={"url": url}
    """
    #logging.getLogger('HWR').info('[Stream] Camera video streaming going to start')
    camera_hwobj.stopper = False
    camera_hwobj.init()
    return Response(stream_video(), mimetype='multipart/x-mixed-replace; boundary="!>"')


@mxcube.route("/mxcube/api/v0.1/samplecentring/camera/unsubscribe", methods=['GET'])
def unsubscribeToCamera():
    """SampleCentring: subscribe from the streaming
    data = {generic_data} #or nothing?
    return_data={"result": True/False}
    """
    keep_streaming = False
    camera_hwobj.stopper = True
    return "True"

###----SAMPLE CENTRING----###
clicks = collections.deque(maxlen=3)

centred_pos=[]
####
#To access parameters submitted in the URL (?key=value) you can use the args attribute:
#searchword = request.args.get('key', '')
@mxcube.route("/mxcube/api/v0.1/samplecentring/<id>/move", methods=['PUT'])
def moveSampleCentringMotor(id):
    """SampleCentring: move "id" moveable to the position specified in the data:position
    Moveable can be a motor (kappa, omega, phi), a ligth, light/zoom level.
    data in the url: /mxcube/api/v0.1/samplecentring/<id>/move?newpos=value
    return_data={"result": True/False}
    """
    new_pos = request.args.get('newpos','')
    motor_hwobj = mxcube.diffractometer.getObjectByRole(id.lower())
    logging.getLogger('HWR').info('[SampleCentring] Movement called for motor: "%s", new position: "%s"' %(id, str(new_pos)))
    logging.getLogger('HWR').info('[SampleCentring] Movement called for motor with motor name: '+str(motor_hwobj.motor_name))

    #the following if-s to solve inconsistent movement method
    try:
        if motor_hwobj.motor_name.lower() == 'zoom':
            motor_hwobj.moveToPosition(new_pos)
        elif motor_hwobj.motor_name.lower() == 'backlight':
            if int(new_pos):
                motor_hwobj.wagoIn()
                mxcube.diffractometer.getObjectByRole('light').move(1)
            else: 
                motor_hwobj.wagoOut()
                mxcube.diffractometer.getObjectByRole('light').move(0)
        else: 
            motor_hwobj.move(float(new_pos))
    except Exception as ex:
        print ex
        return "False"
    logging.getLogger('HWR').info('[SampleCentring] Movement finished for motor: "%s"' %(motor_hwobj.motor_name))#, str(motor_hwobj.getPosition()))) #zoom motor will fail in getPosition(), perhaps an alias there?
    return "True"

@mxcube.route("/mxcube/api/v0.1/samplecentring/status", methods=['GET'])
def get_status():
    """SampleCentring: get generic status, positions of moveables ...
    data = {generic_data}
    return_data = { generic_data, 
                  Moveable1:{'Status': status, 'position': position}, 
                  ...,  
                  MoveableN:{'Status': status, 'position': position} 
                  }
    """
    motors = ['Kappa', 'Omega', 'Phi', 'Zoom', 'Light'] #more are needed

    data = {}
    for mot in motors:
        motor_hwobj = mxcube.diffractometer.getObjectByRole(mot.lower())
        if mot == 'Zoom':
            pos = motor_hwobj.getCurrentPositionName()
            status = "unknown" 
        elif mot == 'Light':
            pos = motor_hwobj.getWagoState() # {0:"out", 1:"in", True:"in", False:"out"}
            status = motor_hwobj.getWagoState()
        else: 
            pos = motor_hwobj.get_position()
            status = motor_hwobj.get_state()

        data[mot] = {'Status': status, 'position': pos}    

    return data
    
@mxcube.route("/mxcube/api/v0.1/samplecentring/<id>/status", methods=['GET'])
def get_status_of_id(id):
    """SampleCentring: get status of element with id:"id"
    data = {generic_data, 'Moveable1', ..., MoveableN}
    return_data = {'Status': status, 'position': position}
    """
    data = {}
    motor = mxcube.diffractometer.getObjectByRole(id.lower())

    if motor.motor_name == 'Zoom':
        pos = motor.getCurrentPositionName()
        status = "unknown" 
    elif motor.motor_name == 'Light':
        pos = motor.getWagoState() # {0:"out", 1:"in", True:"in", False:"out"}
        status = motor.getWagoState()
    else: 
        pos = motor.get_position()
        status = motor.get_state()
    
    data[motor_name] = {'Status': status, 'position': pos}

    return data

@mxcube.route("/mxcube/api/v0.1/samplecentring/centring/<id>", methods=['GET'])
def get_centring_of_id(id):
    """SampleCentring: get centring point position of point with id:"id", id=1,2,3...
    data = {generic_data, "point": id}
    return_data = {"id": {x,y}}
    """
    return "True"

@mxcube.route("/mxcube/api/v0.1/samplecentring/centring/<id>", methods='POST')
def put_centring_with_id(id):
    """SampleCentring: set centring point position of point with id:"id", id=1,2,3...
    data = {generic_data, "point": id, "position": {x,y}}
    return_data={"result": True/False}
    """
    data = dict(request.POST.items())
    clicks.append([data['PosX'],data['PosY']])
    return "True"

@mxcube.route("/mxcube/api/v0.1/samplecentring/centring/startauto", methods=['PUT'])
def centreAuto():
    """Start automatic (lucid) centring procedure
    data = {generic_data, "Mode": mode}
    return_data={"result": True/False}
    """
    #mxcube.diffractometer.emit('minidiffReady','sadfasfadf')
    # mxcube.resolution.emit("deviceReady", 'some data')
    try:
        centred_pos = mxcube.diffractometer.startAutoCentring()
        if centred_pos is not None:
            return "True"
        else:
            return "False"
    except:
        return "False"

@mxcube.route("/mxcube/api/v0.1/samplecentring/centring/start3click", methods=['PUT'])
def centre3click():
    """Start 3 click centring procedure
    data = {generic_data, "Mode": mode}
    return_data={"result": True/False}
    """
    logging.getLogger('HWR.MX3').info('[Centring] 3click method requested')  
    try:
        currentCentringProcedure = mxcube.diffractometer.start3ClickCentring()
        return "True" #this only means the call was succesfull
    except:
        return "False"
@mxcube.route("/mxcube/api/v0.1/samplecentring/centring/click", methods=['PUT'])
def aClick():
    """Start centring procedure
    data = {generic_data, "Mode": mode}
    return_data={"result": True/False}
    """
    clickPosition = json.loads(request.args.get('clickPos',''))

    try:
        mxcube.diffractometer.imageClicked(clickPosition['x'], clickPosition['y'], clickPosition['x'], clickPosition['y'])
        return "True"
    except:
        return "False"

@mxcube.route("/mxcube/api/v0.1/samplecentring/centring/<id>/save", methods=['PUT'])
def savePosition(id):
    """Save centring position
    return_data={"result": True/False}
    """
    print id    
    centredPosId = 'pos'+str(len(centred_pos)+1)
    #if request.args.get('rename',''): renaming option comes later

    try:
        mxcube.diffractometer.saveCurrentPos()
        motorPositions = mxcube.diffractometer.centringStatus["motors"]
        #motorPositions = {'focus': 0.69518381761112, 'kappa': 0.0009, 'kappa_phi': 311.0, 'phi': 0.34759190880556, 'phiy': 1.04277572641668, 'phiz': 1.39036763522224, 'sampx': 1.379595440278002, 'sampy': 2.08555145283336, 'zoom': 8.53}
        data = {'name':centredPosId, 'motorPositions': motorPositions}
        #or
        #motorPositions = mxcube.diffractometer.getPositions()
        centred_pos.append(data)
        logging.getLogger('HWR.MX3').info('[Centring] Centring Positions saved:'+str(data)) 
        print centred_pos
        return centredPosId
    except:
        return "False"

@mxcube.route("/mxcube/api/v0.1/samplecentring/centring/<id>/delete", methods=['DELETE'])
def deletePosition(id):
    """delete centring position with name <id>
    return_data={"result": True/False}
    """
    logging.getLogger('HWR.MX3').info('[Centring] Centring Position deletd')  
    try:
        centred_pos[:] = [d for d in centred_pos if d.get('name') != id] #python magic...
        print centred_pos
        return "True"
    except:
        return "False"

@mxcube.route("/mxcube/api/v0.1/samplecentring/centring/<id>/rename", methods=['PUT'])
def renamePosition(id):
    """rename centring position
    return_data={"result": True/False}
    """
    newName = str(request.args.get('newname',''))

    try:
        [d.update({'name':newName}) for d in centred_pos if d.get('name') == id]
        logging.getLogger('HWR.MX3').info('[Centring] Centring Position renamed')  
        print centred_pos

        return "True", newName
    except:
        return "False"

@mxcube.route("/mxcube/api/v0.1/samplecentring/centring/<position>/move", methods=['PUT'])
def moveToCentredPosition(id):
    """Move to centring position
    return_data={"result": True/False}
    """
    motorPositions = [d['motorPositions'] for d in centred_pos if d.get('name') == id]
    #or moveMotors(self, roles_positions_dict)???
    try:
        mxcube.diffractometer.moveToCentredPosition(motorPositions)
        logging.getLogger('HWR.MX3').info('[Centring] moved to Centring Position')  
        return "True"
    except:
        return "False"

@mxcube.route("/mxcube/api/v0.1/samplecentring/snapshot", methods=['PUT'])
def snapshot():
    """Save snapshot of the sample view
    data = {generic_data, "Path": path} # not sure if path should be available, or directly use the user/proposal path
    return_data={"result": True/False}
    """
    filenam = time.strftime("%Y-%m-%d-%H:%M:%S", time.gmtime())+sample.jpg
    try:
        camera_hwobj.takeSnapshot(os.path.join(os.path.dirname(__file__), 'snapshots/'))
        return "True"
    except:
        return "False"
