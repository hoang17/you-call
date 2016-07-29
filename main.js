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
  AppState,
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
import AddressBook from 'react-native-addressbook'
import VoipPushNotification from 'react-native-voip-push-notification';
// import InCallManager from 'react-native-incall-manager';

let ContactList = require('./components/ContactList')

const pcPeers = {};
let localStream;
let audioTrack;
let container;
let socket;
let call;

const configuration = {iceServers: [
  {url:'stun:stun.l.google.com:19302'},
  {url:'stun:stun1.l.google.com:19302'},
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

// TODO
let pendingnoti = null;

class MainView extends Component{

  constructor(props) {
    super(props);

    container = this;

    this.state = {
      info:'Initializing',
      status:'ready',
      contacts:[],
      phone:null,
      device:null,
    };

    // socket = io.connect('youcall.io', {transports: ['websocket']});
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
      audioTrack = localStream.getTrackById(0);
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


    VoipPushNotification.requestPermissions();

    VoipPushNotification.addEventListener('register', (device) => {
      container.setState({device: device});
      if (container.state.phone && container.state.phone.device != device){
        container.state.phone.device = device;
        AsyncStorage.setItem('phone', JSON.stringify(container.state.phone));
        socket.emit('device', device);
        log('device', device);
      }
    });

    VoipPushNotification.addEventListener('notification', (notification) => {

      log('notification', notification);

      var sound = notification.getSound();
      var data = notification.getData();
      var number = data.from;
      var type = data.type;
      var room = data.room;

      if (type == 'call'){

        // if (AppState.currentState == 'active' || container.state.status != 'incoming') {
        //   return
        // }

        if (call) return;

        // Show notification
        var c = container.state.contacts[number];
        VoipPushNotification.presentLocalNotification({
          alertBody: (c ? c.fullName : number) + '\nincoming call...',
          applicationIconBadgeNumber: notification.getBadgeCount(),
          soundName: sound ? sound : 'Marimba.m4r',
          alertAction: 'answer call',
          userInfo: {number: number}
        });

        pendingnoti = { number: number, room: room};

        if (socket.connected){

          // try to join room
          socket.emit('join', room, function(socketIds){
            if (socketIds.length == 0){
              return;
            }

            call = { number: number, type: 'incoming', date: Date.now, duration: 0 };

            // ring back to caller
            socket.emit('ringback', call.number);

            // create pc
            for (const i in socketIds) {
              container.createPC(socketIds[i], true);
            }

            var info = (c ? c.fullName + '\n' + c.number : c.number) + '\nincoming call...';
            container.setState({status: 'incoming', info: info});
          });

        }
      }
    });

    var PushNotification = require('react-native-push-notification');

    PushNotification.configure({

      // (required) Called when a remote or local
      // notification is opened or received
      onNotification: function(notification) {
        // slog(notification);
        if (notification.userInteraction) {
          if (call){
            container._accept();
          } else if (notification.data.number) {
            container._call(notification.data.number);
          }
        }
      },

      // (optional) Called when Token is generated (iOS and Android)
      // onRegister: function(token) {
      //     console.log( 'TOKEN', token );
      // },

      // ANDROID ONLY: (optional) GCM Sender ID.
      // senderID: "YOUR GCM SENDER ID",

      // IOS ONLY (optional): default: all - Permissions to register.
      // permissions: {
      //     alert: true,
      //     badge: true,
      //     sound: true
      // },

      // Should the initial notification be popped automatically
      // default: true
      // popInitialNotification: true,

      /**
        * (optional) default: true
        * - Specified if permissions (ios) and token (android and ios) will requested or not,
        * - if not, you must call PushNotificationsHandler.requestPermissions() later
        */
      // requestPermissions: true,
    });

    socket.on('ringback', function(number){
      if (container.state.status == 'outgoing'){
        var from = container.state.contacts[number];
        var name = from ? from.fullName + '\n' + number : number;
        container.setState({info: name + '\n ringing...'});
      }
    });

    socket.on('accept', function(number){
      if (container.state.status == 'outgoing'){
        audioTrack.enabled = true;

        var from = container.state.contacts[number];
        var name = from ? from.fullName + '\n' + from.number : from.number;
        container.setState({ status: 'accept', info: name + '\n connected'});

        log('accept', audioTrack.enabled);
      }
    });

    socket.on('exchange', function(data){
      container.exchange(data);
    });

    socket.on('hangup', function(socketId){
      slog('hangup');
      call = null;
      for (var socketId in pcPeers) {
        container.leave(socketId);
      }
      socket.emit('leave');
      container.setState({status: 'ready', info: container.state.phone._id});
    });

    socket.on('connect', function() {
      log('connect', socket.id);

      if (!container.state.phone){
        return;
      }

      socket.emit('auth', container.state.phone._id, function(phone){

        log('auth', phone._id);

        // sync device to server
        var device = container.state.device;
        if (device && device != phone.device){
          phone.device = device;
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

        var room = pendingnoti.room;
        var number = pendingnoti.number;
        pendingnoti = null;

        if (call) return;

        // try to join room
        socket.emit('join', room, function(socketIds){
          if (socketIds.length == 0){
            return;
          }

          call = { number: number, type: 'incoming', date: Date.now, duration: 0 };

          // ring back to caller
          socket.emit('ringback', call.number);

          // create pc
          for (const i in socketIds) {
            container.createPC(socketIds[i], true);
          }

          var c = container.state.contacts[call.number];
          var info = (c ? c.fullName + '\n' + c.number : c.number) + '\nincoming call...';
          container.setState({status: 'incoming', info: info});
        });
      }
    });

    socket.on('disconnect', function(){
      log('disconnect');
      if (container.state.status != 'ready') {
        call = null;
        for (var socketId in pcPeers) {
          container.leave(socketId);
        }
        container.setState({status: 'ready', info: container.state.phone._id});
      }
    });

    socket.on('call', function(data) {
      log('call', data);
      if (call != null){
        return;
      }
      // try to join room
      socket.emit('join', data.room, function(socketIds){
        if (socketIds.length == 0){
          return;
        }

        call = { number: data.from, type: 'incoming', date: Date.now, duration: 0 };

        // ring back to caller
        socket.emit('ringback', call.number);

        // create pc
        for (const i in socketIds) {
          container.createPC(socketIds[i], true);
        }

        var from = container.state.contacts[call.number];
        var name = from ? from.fullName + '\n' + from.number : from.number;
        container.setState({status: 'incoming', info: name + '\n incoming call...'});
      });

    });

    var slog = function(msg, data){
      socket.emit('log', msg, data);
    }
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

  // join(room) {
  //   log('join', room);
  //   socket.emit('join', room, function(socketIds){
  //     log('socketIds', socketIds);
  //     for (const i in socketIds) {
  //       container.createPC(socketIds[i], true);
  //     }
  //   });
  // }

  createPC(socketId, isOffer) {

    if (pcPeers[socketId]){
      return;
    }

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
        if (call){
          var from = container.state.contacts[call.number];
          var name = from ? from.fullName + '\n' + from.number : from.number;
          container.setState({ info: name + '\n disconnected'});
        }
        // container.setState({info: 'Peer connected'});
      }

      if (event.target.iceConnectionState === 'closed') {
        // container.setState({info: 'Peer disconnected'});
      }

      if (event.target.iceConnectionState === 'connected') {
        if (call){
          var from = container.state.contacts[call.number];
          var name = from ? from.fullName + '\n' + from.number : from.number;
          if (container.state.status == 'outgoing'){
            container.setState({ info: name + '\n waiting for accept...'});
          }
          else if (container.state.status == 'accept'){
            container.setState({ info: name + '\n connected'});
          }
        }
        // container.setState({info: 'Peer connected'});
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
      if (container.state.status != 'accept'){
        audioTrack.enabled = false;
      }
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

  _call(number){

    if (container.state.status != 'ready') {
      return;
    }

    call = { number: number, type: 'outgoing', date: Date.now, duration: 0 };

    log('call', number);

    // InCallManager.start({media: 'audio', ringback: '_DEFAULT_'}); // _BUNDLE_ or _DEFAULT_ or _DTMF_

    var phone = container.state.phone;
    var room = container._getRoomId(phone._id, number);
    socket.emit('call', {to: number, room: room}, function(socketIds){
      // if room already existed then
      // connect to all in room peers
      log('socketIds', socketIds);
      for (const i in socketIds) {
        container.createPC(socketIds[i], true);
      }
    });

    var c = container.state.contacts[number];
    var info = (c ? c.fullName + '\n' + number : number) + '\n calling...';
    container.setState({status: 'outgoing', info: info});
  }

  _getRoomId(p1, p2){
    var s1 = p1.substr(p1.length-4);
    var s2 = p2.substr(p2.length-4);
    return s1 < s2 ? s1 + '-' + s2 : s2 + '-' + s1;
  }

  _hangup(){
    log('hangup');
    call = null;
    for (var socketId in pcPeers) {
      container.leave(socketId);
    }
    socket.emit('hangup');
    container.setState({status: 'ready', info: container.state.phone._id});
  }

  _accept(){
    if (!call){
      return;
    }
    audioTrack.enabled = true;

    var from = container.state.contacts[number];
    var name = from ? from.fullName + '\n' + from.number : from.number;
    container.setState({ status: 'accept', info: name + '\n connected'});

    // notify caller
    socket.emit('accept', call.number);
    log('accept', audioTrack.enabled);
  }

  _toggleMic(){
    audioTrack.enabled = !audioTrack.enabled;
    log('mic', audioTrack.enabled);
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
            { this.state.status == 'outgoing' || this.state.status == 'incoming' || this.state.status == 'accept' ?
            <TouchableHighlight style={styles.redbutton}
                underlayColor='#99d9f4'
                onPress={this._hangup}
                >
              <Text style={styles.buttonText}>Hang Up</Text>
            </TouchableHighlight> : null }
            { this.state.status == 'incoming' ?
            <TouchableHighlight style={styles.greenbutton}
                underlayColor='#99d9f4'
                onPress={this._accept}
                >
              <Text style={styles.buttonText}>Accept</Text>
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
  redbutton: {
	  height: 36,
	  flex: 1,
	  flexDirection: 'row',
	  backgroundColor: 'red',
	  borderColor: 'red',
	  borderWidth: 1,
	  borderRadius: 4,
	  marginTop: 10,
	  alignSelf: 'stretch',
	  justifyContent: 'center'
	},
  greenbutton: {
	  height: 36,
	  flex: 1,
	  flexDirection: 'row',
	  backgroundColor: 'green',
	  borderColor: 'green',
	  borderWidth: 1,
	  borderRadius: 4,
	  marginTop: 10,
	  alignSelf: 'stretch',
	  justifyContent: 'center'
	},
});

module.exports = MainView
