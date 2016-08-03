'use strict';

import React, { Component } from 'react';
import {
  Modal,
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
  PushNotificationIOS,
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

import Button from 'apsl-react-native-button'
import AddressBook from 'react-native-addressbook'
import VoipPushNotification from 'react-native-voip-push-notification';
import PushNotification from 'react-native-push-notification';
// import InCallManager from 'react-native-incall-manager';

var Sound = require('react-native-sound');

let ContactList = require('./components/ContactList')
let LoginView = require("./login");

const pcPeers = {};
let localStream;
let audioTrack;
let container;
let socket;
let call;
let calls = [];
let missedCalls = {};

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
let pendingno = null;

var ringtone = new Sound('Marimba.m4r', Sound.MAIN_BUNDLE);
var ringbacktone = new Sound('ringback.wav', Sound.MAIN_BUNDLE);
// ringbacktone.setCategory('PlayAndRecord');
// var ringbacktone = new Sound('/Library/Ringtones/Signal.m4r');

ringtone.setNumberOfLoops(10);
ringbacktone.setNumberOfLoops(10);
// ringtone.enableInSilenceMode(false);
// ringbacktone.enableInSilenceMode(true);

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
      showIncall: false,
      showLogin: false,
      showContacts: false,
      syncInfo:'sync contacts',
      syncing: false,
    };

    // socket = io.connect('youcall.io', {transports: ['websocket']});
    socket = io.connect('youcall.herokuapp.com', { transports: ['websocket'] });
    // socket = io.connect('http://192.168.100.10:5000', { transports: ['websocket'] });

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

    AppState.addEventListener("change", (newState) => {
      if (newState == 'active'){
        if (!call){
          PushNotificationIOS.setApplicationIconBadgeNumber(0);
          for (var number in missedCalls){
            missedCalls[number] = [];
          }
          AsyncStorage.setItem('phone', JSON.stringify(container.state.phone));
        }
      }
    });

    AsyncStorage.getItem("phone").then((jstring) => {
      var phone = null;
      try {
        phone = jstring ? JSON.parse(jstring) : null;
      } catch(e){}
      if (phone && phone._id){
        log('phone', phone._id);
        container._setPhone(phone);
        if (!phone.missedCalls)
          phone.missedCalls = missedCalls;
        else
          missedCalls = phone.missedCalls;
      }
      else {
        container._showLogin();
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

      // var sound = notification.getSound();
      var data = notification.getData();
      var number = data.from;
      var type = data.type;
      var room = data.room;
      var status = data.status;

      if (type == 'call'){
        if (!missedCalls[number]) missedCalls[number] = [];
        missedCalls[number].push({ number: number, type: 'incoming', date: Date.now });

        if (call) return;

        call = { number: number, type: 'incoming', date: Date.now, duration: 0 };

        // Show notification
        var c = container.state.contacts[number];
        PushNotificationIOS.presentLocalNotification({
          alertBody: (c ? c.fullName : number) + '\nincoming call...',
          soundName: 'Marimba.m4r',
          alertAction: 'answer call',
          userInfo: {number: number},
        });

        if (status == 'connected'){

          // try to join room
          slog('noti join');
          socket.emit('join', room, function(socketIds){
            if (!socketIds){
              return;
            }
            if (socketIds.length == 0){
              call = null;
              // missed calls
              PushNotificationIOS.cancelAllLocalNotifications();
              var badgeCount = 0;
              if (missedCalls){
                for (var number in missedCalls){
                  var length = missedCalls[number].length;
                  if (length > 0){
                    badgeCount++;
                    var c = container.state.contacts[number];
                    PushNotificationIOS.presentLocalNotification({
                      alertBody: (c ? c.fullName : number) + (length > 1 ? '\nmissed calls (' + length + ')' : '\nmissed call'),
                      soundName: 'default',
                      alertAction: 'call',
                      userInfo: {number: number},
                    });
                  }
                }
                AsyncStorage.setItem('phone', JSON.stringify(container.state.phone));
                PushNotificationIOS.setApplicationIconBadgeNumber(badgeCount);
              }
              return;
            }

            // ring back to caller
            socket.emit('ringback', call.number);

            // create pc
            for (const i in socketIds) {
              container.createPC(socketIds[i], true);
            }

            var info = (c ? c.fullName + '\n' + c.number : call.number) + '\nincoming call...';
            container.setState({showIncall: true, status: 'incoming', info: info});
          });

        }
        else {
          pendingno = { number: number, room: room};
        }

      }
    });

    PushNotification.configure({
      // (required) Called when a remote or local
      // notification is opened or received
      onNotification: function(notification) {
        // slog('notification', notification);
        // slog('call', call);
        if (notification.userInteraction) {
          if (call) {
            container._accept();
          } else if (notification.data.number) {
            PushNotificationIOS.setApplicationIconBadgeNumber(0);
            for (var number in missedCalls){
              missedCalls[number] = [];
            }
            AsyncStorage.setItem('phone', JSON.stringify(container.state.phone));
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

      ringtone.stop();

      // container.setState({showIncall: false});

      // PushNotificationIOS.cancelLocalNotifications({ number: call.number });
      PushNotificationIOS.cancelAllLocalNotifications();
      var badgeCount = 0;
      if (missedCalls){
        for (var number in missedCalls){
          var length = missedCalls[number].length;
          if (length > 0){
            badgeCount++;
            var c = container.state.contacts[number];
            PushNotificationIOS.presentLocalNotification({
              alertBody: (c ? c.fullName : number) + (length > 1 ? '\nmissed calls (' + length + ')' : '\nmissed call'),
              soundName: 'default',
              alertAction: 'call',
              userInfo: {number: number},
            });
          }
        }
        AsyncStorage.setItem('phone', JSON.stringify(container.state.phone));
        PushNotificationIOS.setApplicationIconBadgeNumber(badgeCount);
      }

      call = null;
      for (var socketId in pcPeers) {
        container.leave(socketId);
      }
      socket.emit('leave');
      container.setState({showIncall: false, status: 'ready', info: container.state.phone._id});
    });

    socket.on('connect', function() {
      log('connect', socket.id);

      if (!container.state.phone){
        return;
      }

      // container.setState({showIncall: false});

      // reset call and peers
      call = null;
      for (var socketId in pcPeers) {
        container.leave(socketId);
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
      if (pendingno){

        var room = pendingno.room;
        var number = pendingno.number;
        pendingno = null;

        call = { number: number, type: 'incoming', date: Date.now, duration: 0 };

        // try to join room
        slog('pendingno join');
        socket.emit('join', room, function(socketIds){

          if (!socketIds){
            return;
          }
          if (socketIds.length == 0){
            call = null;
            // missed calls
            var c = container.state.contacts[number];
            PushNotificationIOS.cancelAllLocalNotifications();
            var badgeCount = 0;
            if (missedCalls){
              for (var n in missedCalls){
                var length = missedCalls[n].length;
                if (length > 0){
                  badgeCount++;
                  var c = container.state.contacts[n];
                  PushNotificationIOS.presentLocalNotification({
                    alertBody: (c ? c.fullName : n) + (length > 1 ? '\nmissed calls (' + length + ')' : '\nmissed call'),
                    soundName: 'default',
                    alertAction: 'call',
                    userInfo: {number: n},
                  });
                }
              }
              AsyncStorage.setItem('phone', JSON.stringify(container.state.phone));
              PushNotificationIOS.setApplicationIconBadgeNumber(badgeCount);
            }

            return;
          }

          // // Show notification
          // var c = container.state.contacts[number];
          // PushNotificationIOS.presentLocalNotification({
          //   alertBody: (c ? c.fullName : number) + '\nincoming call...',
          //   soundName: 'Marimba.m4r',
          //   alertAction: 'answer call',
          //   userInfo: {number: number},
          // });

          // ring back to caller
          socket.emit('ringback', number);

          // create pc
          for (const i in socketIds) {
            container.createPC(socketIds[i], true);
          }

          var c = container.state.contacts[number];
          var info = (c ? c.fullName + '\n' + c.number : number) + '\nincoming call...';
          if (container.state.status == 'accept'){
            container.setState({ showIncall: true, info: info });
          } else {
            container.setState({showIncall: true, status: 'incoming', info: info});
          }
        });
      }
    });

    socket.on('disconnect', function(){
      log('disconnect');

      call = null;
      for (var socketId in pcPeers) {
        container.leave(socketId);
      }
      container.setState({showIncall: false, status: 'ready', info: container.state.phone._id});
      // try reconnecting
      // socket.io.connect();
    });

    socket.on('call', function(data) {

      log('call', data);

      if (call) return;

      call = { number: data.from, type: 'incoming', date: Date.now, duration: 0 };

      // Show notification
      var c = container.state.contacts[call.number];
      PushNotificationIOS.presentLocalNotification({
        alertBody: (c ? c.fullName : call.number) + '\nincoming call...',
        soundName: 'Marimba.m4r',
        alertAction: 'answer call',
        userInfo: {number: call.number},
      });

      // try to join room
      slog('oncall join');
      socket.emit('join', data.room, function(socketIds){
        // slog('oncall join socketIds', socketIds);
        if (!socketIds){
          return;
        }
        if (socketIds.length == 0){
          call = null;
          // missed calls
          PushNotificationIOS.cancelAllLocalNotifications();
          var badgeCount = 0;
          if (missedCalls){
            for (var number in missedCalls){
              var length = missedCalls[number].length;
              if (length > 0){
                badgeCount++;
                var c = container.state.contacts[number];
                PushNotificationIOS.presentLocalNotification({
                  alertBody: (c ? c.fullName : number) + (length > 1 ? '\nmissed calls (' + length + ')' : '\nmissed call'),
                  soundName: 'default',
                  alertAction: 'call',
                  userInfo: {number: number},
                });
              }
            }
            AsyncStorage.setItem('phone', JSON.stringify(container.state.phone));
            PushNotificationIOS.setApplicationIconBadgeNumber(badgeCount);
          }
          return;
        }

        if (AppState.currentState == 'active'){
          ringtone.play();
        }

        // ring back to caller
        socket.emit('ringback', call.number);

        // create pc
        for (const i in socketIds) {
          container.createPC(socketIds[i], true);
        }

        var c = container.state.contacts[call.number];
        var name = c ? c.fullName + '\n' + c.number : call.number;
        container.setState({showIncall: true, status: 'incoming', info: name + '\n incoming call...'});
      });

    });

    socket.on("pinging", function(number){
      log('received ping from', number);
      slog('received ping from', number);
    });

    // socket.on("ping", function(callback){
    //   var number = container.state.phone ? container.state.phone._id : 'empty number';
    //   callback(number);
    // });
  }

  _setPhone(phone){
    if (phone && !phone.device && container.state.device){
      phone.device = container.state.device;
    }
    container.setState({phone: phone});
    container.setState({contacts: phone ? phone.contacts : null});
    container.setState({info: phone ? phone._id : null});
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
          var c = container.state.contacts[call.number];
          var name = c ? c.fullName + '\n' + c.number : call.number;
          if (container.state.status == 'outgoing'){
            container.setState({ info: name + '\n waiting for accept...'});
          }
          else if (container.state.status == 'accept'){
            container.setState({ info: name + '\n connected'});
          }

          // if (container.state.status == 'incoming'){
          //   // Show notification
          //   PushNotificationIOS.presentLocalNotification({
          //   // VoipPushNotification.presentLocalNotification({
          //     alertBody: (c ? c.fullName : c.number) + '\nincoming call...',
          //     soundName: 'Marimba.m4r',
          //     alertAction: 'answer call',
          //     userInfo: {number: c.number},
          //   });
          // }
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
      container.setState({syncing: true});
      if(err && err.type === 'permissionDenied'){
        alert('Can not sync contacts: Permisson not granted');
      }
      else{
        container.setState({ syncInfo:'begin syncing ' + contacts.length +' contacts...'});
        socket.emit('sync contacts', contacts, function(activeContacts){
          container.setState({contacts: activeContacts});
          container.state.phone.contacts = activeContacts;
          AsyncStorage.setItem('phone', JSON.stringify(container.state.phone));
          container.setState({ syncInfo:'found ' + Object.keys(activeContacts).length +' active contacts'});
        });
      }
    })
  }

  _call(number){

    if (container.state.status != 'ready') {
      return;
    }

    ringbacktone.play();

    // container.setState({showIncall: true});

    call = { number: number, type: 'outgoing', date: Date.now, duration: 0 };

    log('call', number);

    // InCallManager.start({media: 'audio', ringback: '_DEFAULT_'}); // _BUNDLE_ or _DEFAULT_ or _DTMF_

    var phone = container.state.phone;
    var room = container._getRoomId(phone._id, number);
    socket.emit('call', {to: number, room: room}, function(socketIds){
      // if room already existed then
      // connect to all in room peers
      if (socketIds && socketIds.length > 0){
        for (const i in socketIds) {
          container.createPC(socketIds[i], true);
        }
        container._accept();
      }
      else if (!socketIds){
        // if alredy joint to room then accept
        container._accept();
      }
    });

    var c = container.state.contacts[number];
    var info = (c ? c.fullName + '\n' + number : number) + '\n calling...';
    container.setState({showIncall: true, status: 'outgoing', info: info});
  }

  _getRoomId(p1, p2){
    var s1 = p1.substr(p1.length-4);
    var s2 = p2.substr(p2.length-4);
    return s1 < s2 ? s1 + '-' + s2 : s2 + '-' + s1;
  }

  _hangup(){
    log('hangup');

    ringtone.stop();
    ringbacktone.stop();

    // container.setState({showIncall: false});

    call = null;
    for (var socketId in pcPeers) {
      container.leave(socketId);
    }
    socket.emit('hangup');
    container.setState({showIncall: false, status: 'ready', info: container.state.phone._id});
  }

  _accept(){

    if (!call){
      return;
    }

    ringtone.stop();
    ringbacktone.stop();

    audioTrack.enabled = true;

    var from = container.state.contacts[call.number];
    var name = from ? from.fullName + '\n' + from.number : from.number;
    container.setState({ status: 'accept', info: name + '\n connected'});

    // notify caller
    socket.emit('accept', call.number);
    log('accept', audioTrack.enabled);

    calls.push(call);
    missedCalls[call.number].pop();
  }

  _toggleMic(){
    audioTrack.enabled = !audioTrack.enabled;
    log('mic', audioTrack.enabled);
  }

  _ping(){
    log('ping');
    var startTime = Date.now();
    socket.emit('pinging', function(){
      var latency = Date.now() - startTime;
      log('latency', latency);
    });
  }

  _showLogin(){
    container.setState({showLogin: true});
  }

  _hideLogin(){
    container.setState({showLogin: false});
  }

  _showContacts(){
    container.setState({syncing: false, syncInfo: 'sync contacts', showContacts: true});
  }

  _hideContacts(){
    container.setState({syncing: false, syncInfo: 'sync contacts', showContacts: false});
  }

  render() {
    return (
      <View style={styles.outerContainer}>
        { this.state.phone ?
        <KeyboardAvoidingView behavior='padding' style={styles.container}>
          {/*<Button
              onPress={this._showContacts}
              style={styles.buttonStyle6}
              textStyle={styles.textStyle}>
            Sync contacts
          </Button>*/}
          {/*<View>
            <Text style={styles.info}>{this.state.info}</Text>
          </View>*/}
          <View>
            <Button
              onPress={this._showContacts}
              style={styles.buttonStyle8}
              textStyle={styles.textStyle8}>
              Contacts
            </Button>
          </View>
          <View style={styles.contacts}>
            <ContactList
              contacts={this.state.contacts}
              syncContacts={this._syncContacts}
              call={this._call} />
          </View>
        </KeyboardAvoidingView> : null }
        <Modal
          animationType='slide'
          transparent={false}
          visible={this.state.showIncall}
          //onRequestClose={() => {this._setModalVisible(false)}}
          >
          <View style={[styles.container, { backgroundColor: '#f5fcff' }]}>
            <View style={[styles.innerContainer]}>
              <Text style={styles.info}>{this.state.info}</Text>
              { this.state.status == 'incoming' ?
              <Button
                onPress={this._accept}
                style={styles.buttonStyle4}
                textStyle={styles.textStyle}>
                Accept
              </Button> : null }
              { this.state.status == 'outgoing' || this.state.status == 'incoming' || this.state.status == 'accept' ?
              <Button
                onPress={this._hangup}
                style={styles.buttonStyle2}
                textStyle={styles.textStyle}>
                Hangup
              </Button>: null }
            </View>
          </View>
        </Modal>
        <Modal
          animationType='slide'
          transparent={false}
          visible={this.state.showContacts}
          >
          <View style={[styles.container, { backgroundColor: '#f5fcff' }]}>
            <View style={[styles.innerContainer]}>
              <Text style={styles.info}>{this.state.syncInfo}</Text>
              { this.state.syncing ?
              <Button
                  onPress={this._hideContacts}
                  style={styles.buttonStyle5}
                  textStyle={styles.textStyle}>
                Done
              </Button> :
              <Button
                  onPress={this._syncContacts}
                  style={styles.buttonStyle1}
                  textStyle={styles.textStyle}>
                Sync contacts
              </Button> }
            </View>
          </View>
          </Modal>
        { this.state.showLogin ?
        <LoginView
          socket={socket}
          main={this}
          phone={this.state.phone}
          >
        </LoginView> : null}
      </View>
    );
  }
}

function slog(msg, data){
  socket.emit('log', msg, data);
}

function logError(error) {
  console.log('error', error);
}

function log(msg, data) {
  if (data)
    console.log(msg, data);
  else
    console.log(msg);
}

const styles = StyleSheet.create({
  info: {
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
    paddingTop:20,
    paddingLeft:10,
    paddingRight:10,
    flex:1,
  },
  flowRight: {
	  alignItems: 'center',
	  alignSelf: 'stretch'
	},
  contacts: {
    flex: 1,
    alignSelf: 'stretch',
    // height:300,
    // borderWidth:1,
    // borderColor: '#48BBEC',
    // borderColor: '#27ae60',
    // borderRadius: 4,
  },

  textStyle: {
    color: 'white'
  },
  textStyle6: {
    color: '#8e44ad',
    fontFamily: 'Avenir',
    fontWeight: 'bold'
  },
  buttonStyle: {
    borderColor: '#f39c12',
    backgroundColor: '#f1c40f',
    borderWidth: 2,
    borderRadius: 22,
    paddingLeft:20,
    paddingRight:20,
  },
  buttonStyle1: {
    borderColor: '#d35400',
    backgroundColor: '#e98b39',
    borderWidth: 2,
    borderRadius: 22,
    paddingLeft:20,
    paddingRight:20,
  },
  buttonStyle2: {
    borderColor: '#c0392b',
    backgroundColor: '#e74c3c',
    borderWidth: 2,
    borderRadius: 22,
    paddingLeft:20,
    paddingRight:20,
  },
  buttonStyle3: {
    borderColor: '#16a085',
    backgroundColor: '#1abc9c',
    borderWidth: 2,
    borderRadius: 22,
    paddingLeft:20,
    paddingRight:20,
  },
  buttonStyle4: {
    borderColor: '#27ae60',
    backgroundColor: '#2ecc71',
    borderWidth: 2,
    borderRadius: 22,
    paddingLeft:20,
    paddingRight:20,
  },
  buttonStyle5: {
    borderColor: '#2980b9',
    backgroundColor: '#3498db',
    borderWidth: 2,
    borderRadius: 22,
    paddingLeft:20,
    paddingRight:20,
  },
  buttonStyle6: {
    borderColor: '#8e44ad',
    backgroundColor: '#9b59b6',
    borderWidth: 2,
    borderRadius: 22,
    paddingLeft:20,
    paddingRight:20,
  },
  buttonStyle7: {
    borderColor: '#8e44ad',
    backgroundColor: 'white',
    borderRadius: 0,
    borderWidth: 3,
  },
  buttonStyle8: {
    // backgroundColor: 'white',
    // borderColor: '#333',
    borderColor: '#27ae60',
    backgroundColor: '#2ecc71',
    borderWidth: 2,
    borderRadius: 22,
    paddingLeft:20,
    paddingRight:20,
  },
  textStyle8: {
    fontFamily: 'Avenir Next',
    fontWeight: '500',
    // color: '#333',
    color: 'white'
  },
  customViewStyle: {
    width: 120,
    height: 40,
    alignItems: 'center',
    flexDirection: 'row',
  }

});

// module.exports = MainView

AppRegistry.registerComponent('YouCall', () => MainView);
