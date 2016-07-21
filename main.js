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

const pcPeers = {};
let localStream;
var container;
var socket;
var callTo;
const configuration = {iceServers: [
  {url:'stun:stun.l.google.com:19302'},
  {url:'stun:stun1.l.google.com:19302'},
  {url:'stun:stun2.l.google.com:19302'},
  {url:'stun:stun3.l.google.com:19302'},
  {url:'stun:stun4.l.google.com:19302'},
  {url:'stun:stun.services.mozilla.com'},
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

var noti;
var pendingnoti = {
  roomId: null,
  message: null,
  callback: function(){
    noti = { message: pendingnoti.message, roomId: pendingnoti.roomId };
  },
};


// Check permissions
// OneSignal.checkPermissions((permissions) => {
//     console.log(permissions);
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

    container = this;

    this.state = {
      info: 'Initializing',
      status: 'init',
      contacts:[],
      user:null,
    };

    console.log('MainView initializing...');

    // socket = io.connect('youcall.herokuapp.com', {transports: ['websocket'], query: 'phone='+this.props.phone});
    socket = io.connect('http://192.168.100.10:5000', {transports: ['websocket'], query: 'phone='+this.props.phone});

    // @hoang load turn dynamically
    fetch("https://computeengineondemand.appspot.com/turn?username=iapprtc&key=4080218913", { method: "GET" })
    .then((response) => response.json())
    .then((item) => {
      if (!item.uris) return
      item.uris.forEach(function(url){
        configuration.iceServers.push({ username: item.username, credential: item.password, url: url})
      })
    }).done();

    socket.on('exchange', function(data){
      container.exchange(data);
    });

    socket.on('leave', function(socketId){
      container.leave(socketId);
      if (Object.keys(pcPeers).length == 0){
        socket.emit('leave');
        container.setState({status: 'ready', info: container.props.phone});
      }
    });

    socket.on('connect', function() {
      console.log('connect', socket.id);
      var ready = noti ? false : true;
      container.getLocalStream(function(stream) {
        localStream = stream;
        if (ready) container.setState({status: 'ready', info: container.props.phone});
      });
      // handling pending push notification
      if (noti){
        container.join(noti.roomId);
        container.setState({status: 'calling', info: noti.message});
        noti = null;
      }
    });

    socket.on('error', function(err) {
      pendingnoti.callback()
    });

    socket.on('user', function(user) {
      console.log('user', user.phone);

      container.setState({user: user});
      container.setState({contacts: user.contacts});

      OneSignal.configure({
          onIdsAvailable: function(device) {
            device.id = user._id;
            console.log('device', device.userId);
            socket.emit('device', device);
          },
          onNotificationOpened: function(message, data, isActive) {
            if (isActive || container.state.status != 'ready'){
              return
            }

            pendingnoti.roomId = data.p2p_notification ? data.p2p_notification.roomId : data.roomId;
            pendingnoti.message = message;

            if (socket.connected){
              container.join(pendingnoti.roomId);
              container.setState({status: 'calling', info: message});
}
          },
      });

    });

    socket.on('call', function(data) {
      console.log('call', data);
      if (container.state.status != 'ready'){
        return;
      }
      container.join(data.roomId);
      var from = container.state.contacts[data.from];
      var name = from ? from.fullName : data.fromNumber;
      container.setState({status: 'calling', info: name + ' is calling...'});
    });

  }

  getLocalStream(callback) {
    MediaStreamTrack.getSources(sourceInfos => {
      // console.log(sourceInfos);
      getUserMedia({
        "audio": true,
        "video": false
      }, function (stream) {
        // console.log('stream', stream);
        callback(stream);
      }, logError);
    });
  }

  join(roomId) {
    console.log('join', roomId);
    socket.emit('join', roomId, function(socketIds){
      for (const i in socketIds) {
        container.createPC(socketIds[i], true);
      }
    });
  }

  createPC(socketId, isOffer) {

    const pc = new RTCPeerConnection(configuration);
    pcPeers[socketId] = pc;

    pc.onicecandidate = function (event) {
      console.log('onicecandidate');
      if (event.candidate) {
        socket.emit('exchange', {'to': socketId, 'candidate': event.candidate });
      }
    };
    pc.onnegotiationneeded = function () {
      console.log('onnegotiationneeded');
      if (isOffer) {
        createOffer();
      }
    }
    pc.oniceconnectionstatechange = function(event) {
      console.log('*** oniceconnectionstatechange ***', event.target.iceConnectionState);

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
      console.log('onsignalingstatechange', event.target.signalingState);
    };
    pc.ondatachannel = function(event){
      console.log("### ondatachannel ###");
      // dataChannel = event.channel;
      // dataChannel.onmessage = function (event) {
      //   console.log("dataChannel.onmessage:", event.data);
      //   container.receiveTextData({user: socketId, message: event.data});
      // };
    }
    pc.onaddstream = function (event) {
      console.log('onaddstream');
    };
    pc.onremovestream = function (event) {
      console.log('onremovestream');
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
    //     console.log("dataChannel.onerror", error);
    //   };
    //
    //   dataChannel.onmessage = function (event) {
    //     console.log("dataChannel.onmessage:", event.data);
    //     container.receiveTextData({user: socketId, message: event.data});
    //   };
    //
    //   dataChannel.onopen = function () {
    //     console.log('dataChannel.onopen');
    //   };
    //
    //   dataChannel.onclose = function () {
    //     console.log("dataChannel.onclose");
    //   };
    //
    //   pc.textDataChannel = dataChannel;
    // }

    function createOffer() {
      pc.createOffer(function(desc) {
        // console.log('createOffer', desc);
        pc.setLocalDescription(desc, function () {
          // console.log('setLocalDescription', pc.localDescription);
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
      console.log('@@@ exchange pc @@@', fromId)
      pc = container.createPC(fromId, false);
    }

    if (data.sdp) {
      // console.log('exchange sdp', data);
      pc.setRemoteDescription(new RTCSessionDescription(data.sdp), function () {
        if (pc.remoteDescription.type == "offer")
          pc.createAnswer(function(desc) {
            // console.log('createAnswer', desc);
            pc.setLocalDescription(desc, function () {
              // console.log('setLocalDescription', pc.localDescription);
              socket.emit('exchange', {'to': fromId, 'sdp': pc.localDescription });
            }, logError);
          }, logError);
      }, logError);
    } else {
      // console.log('exchange candidate', data);
      pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }

  leave(socketId) {
    console.log('leave', socketId);
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
          console.log('activeContacts', activeContacts);
          container.setState({contacts: activeContacts});
          container.setState({status: 'ready', info:'found ' + Object.keys(activeContacts).length +' active contacts'});
        });
      }
    })
  }

  _call(contact){
    if (container.state.status != 'ready'){
      return;
    }
    var user = container.state.user;
    var roomId = container._getRoomId(user.phone, contact.phone);
    container.join(roomId);
    callTo = contact;
    socket.emit('call', {to: callTo.userId, roomId: roomId, phone: callTo.phone}, function(data){
      data.roomId = roomId;
      container._push(data);
    });
    container.setState({status: 'calling', info: 'Calling ' + callTo.fullName + '...'});
  }

  _getRoomId(p1, p2){
    var s1 = p1.substr(p1.length-4);
    var s2 = p2.substr(p2.length-4);
    return s1 < s2 ? s1 + '-' + s2 : s2 + '-' + s1;
  }

  _push(to){
    var contents = {en: to.fullName + ' is callling...' };
    var data = { from: container.state.user.id, roomId: to.roomId };
    OneSignal.postNotification(contents, data, to.device);
  }

  _hangup(){
    console.log('_hangup');
    for (var socketId in pcPeers) {
      container.leave(socketId);
    }
    socket.emit('hangup');
    container.setState({status: 'ready', info: container.props.phone});
  }

  render() {
    return (
      <View style={styles.outerContainer}>
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
        </KeyboardAvoidingView>
      </View>
    );
  }
}

function logError(error) {
  console.log("logError", error);
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
