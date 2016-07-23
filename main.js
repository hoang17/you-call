'use strict';

import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
  TextInput,
  ListView,
  KeyboardAvoidingView,
  AsyncStorage,
} from 'react-native';
import io from 'socket.io-client/socket.io';
import {
  RTCPeerConnection,
  RTCMediaStream,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStreamTrack,
  getUserMedia,
} from 'react-native-webrtc';
import OneSignal from 'react-native-onesignal';

var ContactList = require('./components/ContactList')
import AddressBook from 'react-native-addressbook'
import InCallManager from 'react-native-incall-manager';


const pcPeers = {};
let localStream;
var container;
var socket;

const configuration = {iceServers: [
  {url:'stun:stun.l.google.com:19302'},
  // {url:'stun:stun1.l.google.com:19302'},
  // {url:'stun:stun2.l.google.com:19302'},
  // {url:'stun:stun3.l.google.com:19302'},
  // {url:'stun:stun4.l.google.com:19302'},
  // {url:'stun:stun.services.mozilla.com'},
  {
    url: 'turn:188.166.191.174:3478',
    credential: 'otoke123',
    username: 'client'
  },
  {
    url: 'turn:numb.viagenie.ca',
    credential: 'youcal123',
    username: 'jinnguyen019@gmail.com'
  },
  {
    url: 'turn:numb.viagenie.ca',
    credential: '123123',
    username: 'lehuyhoang117@gmail.com'
  },
]};

var pendingnoti = null;


// Check permissions
// OneSignal.checkPermissions((permissions) => {
//     log(permissions);
// });

// Setting requestPermissions
// permissions = {
//     alert: true,
//     badge: true,
//     sound: true
// };
// OneSignal.requestPermissions(permissions);

// Calling registerForPushNotifications
// Call when you want to prompt the user to accept push notifications.
// Only call once and only if you passed false to *initWithLaunchOptions autoRegister*:.
// OneSignal.registerForPushNotifications();

class MainView extends Component{

  constructor(props) {
    super(props);

    // alert('1')

    container = this;

    this.state = {
      info:'Initializing',
      status:'ready',
      contacts:[],
      phone:null,
      device:null,
    };

    socket = io.connect('youcall.herokuapp.com', {transports: ['websocket']});
    // socket = io.connect('http://192.168.100.10:5000', {transports: ['websocket']});

    // @hoang load turn dynamically
    // fetch("https://computeengineondemand.appspot.com/turn?username=iapprtc&key=4080218913", { method: "GET" })
    // .then((response) => response.json())
    // .then((item) => {
    //   if (!item.uris) return
    //   item.uris.forEach(function(url){
    //     configuration.iceServers.push({ username: item.username, credential: item.password, url: url})
    //   })
    // }).done();

    this.getLocalStream(function(stream) {
      localStream = stream;
    });

    AsyncStorage.getItem("phone").then((jstring) => {
      var phone = null;
      try{
        phone = jstring ? JSON.parse(jstring) : null;
      } catch(e){}
      if (phone && phone._id){
        log('phone', phone._id);
        container._setPhone(phone);
      }
      else{
        var LoginView = require("./login");
        container.props.navigator.push({
          title: "Login",
          component: LoginView,
          passProps: { socket: socket, main:container},
        });
      }
    }).done();

    OneSignal.configure({
        onIdsAvailable: function(data) {
          var device = data.userId
          container.setState({device: device});
          if (!container.state.phone){
            return;
          }
          if (container.state.phone.device != device){
            container.state.phone.device = device;
            socket.emit('device', device);
            log('device', device);
          }
        },
        onNotificationOpened: function(message, data, isActive) {
          // alert(message);

          var from = data.p2p_notification ? data.p2p_notification.from : data.from;
          var type = data.p2p_notification ? data.p2p_notification.type : data.type;

          if (type == 'call'){
            // ring back to caller
            socket.emit('answer', from);

            if (container.state.status != 'ready'){
              return
            }

            container.setState({status: 'calling', info: message});
            pendingnoti = {room: data.p2p_notification ? data.p2p_notification.room : data.room, message: message};
            if (socket.connected){
              container.join(pendingnoti.room);
              container.setState({status: 'calling', info: message});
            }
          }
          else if (type == 'ringback' || type == 'answer'){
            container.setState({status: 'calling', info: message});
          }

        },
    });

    socket.on('ringback', function(number){
      var from = container.state.contacts[number];
      var name = from ? from.fullName + '\n' + number : number;
      container.setState({status: 'calling', info: name + '\n ringing...'});
    });

    socket.on('answer', function(number){
      // InCallManager.stopRingtone();
      // InCallManager.stop();
      var from = container.state.contacts[number];
      var name = from ? from.fullName + '\n' + number : number;
      container.setState({status: 'calling', info: name + '\n answering your call...'});
    });

    socket.on('exchange', function(data){
      container.exchange(data);
    });

    socket.on('leave', function(socketId){
      container.leave(socketId);
      if (Object.keys(pcPeers).length == 0){
        socket.emit('leave');
        container.setState({status: 'ready', info: container.state.phone._id});
      }
    });

    socket.on('connect', function() {
      log('connect', socket.id);

      if (!container.state.phone){
        return;
      }

      socket.emit('auth', container.state.phone._id, function(phone){

        log('connect auth', phone._id);

        // sync device to server
        var device = container.state.device;
        if (device && device != phone.device){
          socket.emit('device', device);
          log('sync device', device);
        }

        // sync contacts to server
        var contacts = container.state.contacts;
        var localLen = contacts ? Object.keys(contacts).length : 0;
        var serverLen = phone.contacts ? Object.keys(phone.contacts).length : 0;
        if (localLen > serverLen){
            socket.emit('contacts', contacts);
            log('sync contacts', localLen);
        }
      });

      // handling pending push notification
      if (pendingnoti){
        container.join(pendingnoti.room);
        container.setState({status: 'calling', info: pendingnoti.message});
        pendingnoti = null;
      }
    });

    socket.on('call', function(data) {
      log('call', data);
      if (container.state.status != 'ready'){
        return;
      }
      // ring back to caller
      socket.emit('ringback', data.from);

      // InCallManager.startRingtone('_BUNDLE_');

      // join room
      container.join(data.room);
      var from = container.state.contacts[data.from];
      var name = from ? from.fullName + '\n' + from.number : from.number;
      container.setState({status: 'calling', info: name + '\n connecting...'});
    });

  }

  _setPhone(phone){
    if (!phone.device && container.state.device){
      phone.device = container.state.device;
    }
    container.setState({phone: phone});
    container.setState({contacts: phone.contacts});
    container.setState({info: phone._id});
  }

  getLocalStream(callback) {
    MediaStreamTrack.getSources(sourceInfos => {
      // log(sourceInfos);
      getUserMedia({
        "audio": true,
        "video": false
      }, function (stream) {
        // log('stream', stream);
        callback(stream);
      }, logError);
    });
  }

  join(room) {
    log('join', room);
    socket.emit('join', room, function(socketIds){
      log('socketIds', socketIds);
      for (const i in socketIds) {
        container.createPC(socketIds[i], true);
      }
    });
  }

  createPC(socketId, isOffer) {

    const pc = new RTCPeerConnection(configuration);
    pcPeers[socketId] = pc;

    pc.onicecandidate = function (event) {
      log('onicecandidate');
      if (event.candidate) {
        socket.emit('exchange', {'to': socketId, 'candidate': event.candidate });
      }
    };
    pc.onnegotiationneeded = function () {
      log('onnegotiationneeded');
      if (isOffer) {
        createOffer();
      }
    }
    pc.oniceconnectionstatechange = function(event) {
      log('*** oniceconnectionstatechange ***', event.target.iceConnectionState);

      if (event.target.iceConnectionState === 'disconnected') {
        // container.setState({status: 'calling', info: 'Peer disconnected'});
      }

      if (event.target.iceConnectionState === 'closed') {
        // container.setState({status: 'calling', info: 'Peer hangup'});
      }

      if (event.target.iceConnectionState === 'connected') {
        container.setState({status: 'connected', info: 'Peer connected'});
        // createDataChannel();
      }
    };
    pc.onsignalingstatechange = function(event) {
      log('onsignalingstatechange', event.target.signalingState);
    };
    pc.ondatachannel = function(event){
      log("### ondatachannel ###");
      // dataChannel = event.channel;
      // dataChannel.onmessage = function (event) {
      //   log("dataChannel.onmessage:", event.data);
      //   container.receiveTextData({user: socketId, message: event.data});
      // };
    }
    pc.onaddstream = function (event) {
      log('onaddstream');
      // InCallManager.stopRingtone();
    };
    pc.onremovestream = function (event) {
      log('onremovestream');
    };
    pc.addStream(localStream);

    // function createDataChannel() {
    //
    //   if (pc.textDataChannel) {
    //     return;
    //   }
    //
    //   var dataChannel = pc.createDataChannel("text");
    //
    //   dataChannel.onerror = function (error) {
    //     log("dataChannel.onerror", error);
    //   };
    //
    //   dataChannel.onmessage = function (event) {
    //     log("dataChannel.onmessage:", event.data);
    //     container.receiveTextData({user: socketId, message: event.data});
    //   };
    //
    //   dataChannel.onopen = function () {
    //     log('dataChannel.onopen');
    //   };
    //
    //   dataChannel.onclose = function () {
    //     log("dataChannel.onclose");
    //   };
    //
    //   pc.textDataChannel = dataChannel;
    // }

    function createOffer() {
      pc.createOffer(function(desc) {
        // log('createOffer', desc);
        pc.setLocalDescription(desc, function () {
          // log('setLocalDescription', pc.localDescription);
          socket.emit('exchange', {'to': socketId, 'sdp': pc.localDescription });
        }, logError);
      }, logError);
    }
    return pc;
  }

  exchange(data) {
    const fromId = data.from;
    let pc;
    if (fromId in pcPeers) {
      pc = pcPeers[fromId];
    } else {
      log('@@@ exchange pc @@@', fromId)
      pc = container.createPC(fromId, false);
    }

    if (data.sdp) {
      // log('exchange sdp', data);
      pc.setRemoteDescription(new RTCSessionDescription(data.sdp), function () {
        if (pc.remoteDescription.type == "offer")
          pc.createAnswer(function(desc) {
            // log('createAnswer', desc);
            pc.setLocalDescription(desc, function () {
              // log('setLocalDescription', pc.localDescription);
              socket.emit('exchange', {'to': fromId, 'sdp': pc.localDescription });
            }, logError);
          }, logError);
      }, logError);
    } else {
      // log('exchange candidate', data);
      pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }

  leave(socketId) {
    // InCallManager.stopRingtone();
    // InCallManager.stop();
    log('leave', socketId);
    if (!pcPeers[socketId]) return;
    pcPeers[socketId].close();
    delete pcPeers[socketId];
  }

  _syncContacts(){
    AddressBook.getContacts( (err, contacts) => {
      if(err && err.type === 'permissionDenied'){
        alert('Can not sync contacts because permisson not granted');
      }
      else{
        container.setState({status: 'ready', info:'begin syncing ' + contacts.length +' contacts...'});
        socket.emit('sync contacts', contacts, function(activeContacts){
          // log('activeContacts', activeContacts);
          container.setState({contacts: activeContacts});
          container.state.phone.contacts = activeContacts;
          AsyncStorage.setItem('phone', JSON.stringify(container.state.phone));
          container.setState({status: 'ready', info:'found ' + Object.keys(activeContacts).length +' active contacts'});
        });
      }
    })
  }

  _call(contact){
    if (container.state.status != 'ready'){
      return;
    }
    log('call', contact.number);

    // InCallManager.start();
    // InCallManager.start({media: 'audio', ringback: '_DTMF_'}); // _BUNDLE_ or _DEFAULT_ or _DTMF_

    var phone = container.state.phone;
    var room = container._getRoomId(phone._id, contact.number);
    socket.emit('call', {to: contact.number, room: room}, function(socketIds){
      log('socketIds', socketIds);
      for (const i in socketIds) {
        container.createPC(socketIds[i], true);
      }
    });
    // direct push when server can not push
    // , function(data){
    //   container._push(data);
    // });
    // container.join(room);
    container.setState({status: 'calling', info: contact.fullName + '\n' + contact.number + '\n calling...'});
  }

  _getRoomId(p1, p2){
    var s1 = p1.substr(p1.length-4);
    var s2 = p2.substr(p2.length-4);
    return s1 < s2 ? s1 + '-' + s2 : s2 + '-' + s1;
  }

  _push(to){
    var contents = {en: to.content };
    var data = { from: container.state.phone._id, room: to.room };
    log('push', data);
    OneSignal.postNotification(contents, data, to.device);
  }

  _hangup(){
    log('_hangup');
    for (var socketId in pcPeers) {
      container.leave(socketId);
    }
    socket.emit('hangup');
    container.setState({status: 'ready', info: container.state.phone._id});
  }

  render() {
    return (
      <View style={styles.outerContainer}>
        { this.state.phone ?
        <KeyboardAvoidingView behavior='padding' style={styles.container}>
          <View>
            <Text style={styles.description}>{this.state.info}</Text>
          </View>
          <View style={styles.contacts}>
            <ContactList contacts={this.state.contacts} callback={this._call} />
          </View>
          <View style={styles.flowRight}>
            <TouchableHighlight style={styles.button}
                underlayColor='#99d9f4'
                onPress={this._syncContacts}
                >
              <Text style={styles.buttonText}>Sync contacts</Text>
            </TouchableHighlight>
            { this.state.status == 'calling' || this.state.status == 'connected' ?
            <TouchableHighlight style={styles.button}
                underlayColor='#99d9f4'
                onPress={this._hangup}
                >
              <Text style={styles.buttonText}>Hang Up</Text>
            </TouchableHighlight> : null }
          </View>
        </KeyboardAvoidingView> : null }
      </View>
    );
  }
}

function logError(error) {
  console.log("[YouCall][Error]", error);
}

function log(msg, data) {
  if (data){
    console.log('[YouCall]['+msg+']', data);
  } else {
    console.log('[YouCall]['+msg+']');
  }
}

const styles = StyleSheet.create({
  description: {
    marginBottom: 10,
    fontSize: 18,
    textAlign: 'center',
    color: '#656565'
  },
  outerContainer: {
    flex: 1,
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    flex:1,
    marginBottom:20
  },
  flowRight: {
	  alignItems: 'center',
	  alignSelf: 'stretch'
	},
  contacts: {
    alignSelf: 'stretch',
    height:300,
    borderWidth:1,
    borderColor: '#48BBEC',
    borderRadius: 4,
  },
	buttonText: {
	  fontSize: 18,
	  color: 'white',
	  alignSelf: 'center'
	},
	button: {
	  height: 36,
	  flex: 1,
	  flexDirection: 'row',
	  backgroundColor: '#48BBEC',
	  borderColor: '#48BBEC',
	  borderWidth: 1,
	  borderRadius: 4,
	  marginTop: 10,
	  alignSelf: 'stretch',
	  justifyContent: 'center'
	},
});

module.exports = MainView
