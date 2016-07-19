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

var ContactList = require('./components/ContactList')
import AddressBook from 'react-native-addressbook'

const pcPeers = {};
let localStream;
var container;
var socket;
var user;
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

class MainView extends Component{

  constructor(props) {
    super(props);

    container = this;

    this.ds = new ListView.DataSource({rowHasChanged: (r1, r2) => true});

    this.state = {
      info: 'Initializing',
      status: 'init',
      remoteList: {},
      contacts:[],
    };

    // socket = io.connect('youcall.herokuapp.com', {transports: ['websocket'], query: 'phone='+this.props.phoe});
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
    });
    socket.on('connect', function() {
      console.log('connect', socket.id);
      container.getLocalStream(function(stream) {
        localStream = stream;
        container.setState({status: 'ready', info: container.props.phone});
      });
    });
    socket.on('user', function(data) {
      console.log('user', data.user);
      user = data.user;
      container.setState({contacts: data.contacts});
    });
    socket.on('call', function(data) {
      alert(data.fromNumber + ' is calling...')
      console.log('call', data);
      container.join(data.roomId);
    });
  }

  getLocalStream(callback) {
    MediaStreamTrack.getSources(sourceInfos => {
      console.log(sourceInfos);
      getUserMedia({
        "audio": true,
        "video": false
      }, function (stream) {
        console.log('stream', stream);
        callback(stream);
      }, logError);
    });
  }

  join(roomID) {
    socket.emit('join', roomID, function(socketIds){
      console.log('join', socketIds);
      for (const i in socketIds) {
        const socketId = socketIds[i];
        console.log('socketId', socketId)
        container.createPC(socketId, true);
      }
    });
  }

  createPC(socketId, isOffer) {

    const pc = new RTCPeerConnection(configuration);
    pcPeers[socketId] = pc;

    pc.onicecandidate = function (event) {
      console.log('onicecandidate', event.candidate);
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
        container._hangup()
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
      console.log('onaddstream', event.stream);
      container.setState({info: 'Peer joined'});

      const remoteList = container.state.remoteList;
      remoteList[socketId] = event.stream.toURL();
      container.setState({ remoteList: remoteList });
    };
    pc.onremovestream = function (event) {
      console.log('onremovestream', event.stream);
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
        console.log('createOffer', desc);
        pc.setLocalDescription(desc, function () {
          console.log('setLocalDescription', pc.localDescription);
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
      console.log('exchange sdp', data);
      pc.setRemoteDescription(new RTCSessionDescription(data.sdp), function () {
        if (pc.remoteDescription.type == "offer")
          pc.createAnswer(function(desc) {
            console.log('createAnswer', desc);
            pc.setLocalDescription(desc, function () {
              console.log('setLocalDescription', pc.localDescription);
              socket.emit('exchange', {'to': fromId, 'sdp': pc.localDescription });
            }, logError);
          }, logError);
      }, logError);
    } else {
      console.log('exchange candidate', data);
      pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }

  leave(socketId) {
    console.log('leave', socketId);
    const pc = pcPeers[socketId];
    if (!pc) return;
    pc.close();
    delete pcPeers[socketId];

    const remoteList = container.state.remoteList;
    delete remoteList[socketId]
    container.setState({ remoteList: remoteList });
    container.setState({status: 'hangup', info: container.props.phone});
  }

  _syncContacts(){
    AddressBook.getContacts( (err, contacts) => {
      if(err && err.type === 'permissionDenied'){
        // x.x
      }
      else{
        // container.setState({contacts: contacts});
        socket.emit('sync contacts', contacts, function(activeContacts){
          console.log('activeContacts', activeContacts);
          container.setState({contacts: activeContacts});
        });
      }
    })
  }

  _call(contact){
    container.setState({status: 'connect', info: 'Calling ' + contact.fullName});
    alert('Calling ' + contact.fullName);
    var to = contact.userId;
    var roomId = user._id;
    socket.emit('call', {'to': to, 'roomId': roomId  });
    container.join(roomId);
  }

  _hangup(){
    for (var socketId in pcPeers) {
      container.leave(socketId);
    }
    socket.emit('hangup');
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
            { this.state.status == 'connected' ?
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
    height:400,
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
	roomInput: {
	  height: 36,
	  padding: 4,
	  marginRight: 5,
	  flex: 5,
	  fontSize: 18,
	  borderWidth: 1,
	  borderColor: '#48BBEC',
	  borderRadius: 4,
	  color: '#48BBEC'
	}
});

module.exports = MainView
