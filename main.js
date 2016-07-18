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

const pcPeers = {};
let localStream;
var container;
var socket;
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
      roomID: 'abc',
      isFront: true,
      selfViewSrc: null,
      remoteList: {},
      textRoomConnected: false,
      textRoomData: [],
      textRoomValue: '',
      socketId:''
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
    socket.on('connect', function(data) {
      console.log('connect');
      container.getLocalStream(true, function(stream) {
        localStream = stream;
        container.setState({selfViewSrc: stream.toURL()});
        container.setState({status: 'ready', info: 'Enter friend name to call'});
      });
    });

  }

  getLocalStream(isFront, callback) {
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

    container.setState({socketId: socketId})

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
      if (event.target.iceConnectionState === 'completed') {
        setTimeout(() => {
          container.getStats();
        }, 1000);
      }
      if (event.target.iceConnectionState === 'connected') {
        createDataChannel();
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
      container.setState({info: 'One peer join ' + socketId});

      const remoteList = container.state.remoteList;
      remoteList[socketId] = event.stream.toURL();
      container.setState({ remoteList: remoteList });
    };
    pc.onremovestream = function (event) {
      console.log('onremovestream', event.stream);
    };
    pc.addStream(localStream);

    function createDataChannel() {

      if (pc.textDataChannel) {
        return;
      }

      var dataChannel = pc.createDataChannel("text");

      dataChannel.onerror = function (error) {
        console.log("dataChannel.onerror", error);
      };

      dataChannel.onmessage = function (event) {
        console.log("dataChannel.onmessage:", event.data);
        container.receiveTextData({user: socketId, message: event.data});
      };

      dataChannel.onopen = function () {
        console.log('dataChannel.onopen');
        container.setState({textRoomConnected: true});
      };

      dataChannel.onclose = function () {
        console.log("dataChannel.onclose");
      };

      pc.textDataChannel = dataChannel;
    }
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
      pc = createPC(fromId, false);
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
    const viewIndex = pc.viewIndex;
    pc.close();
    delete pcPeers[socketId];

    const remoteList = container.state.remoteList;
    delete remoteList[socketId]
    container.setState({ remoteList: remoteList });
    container.setState({info: 'One peer leave!'});
  }

  getStats() {
    const pc = pcPeers[Object.keys(pcPeers)[0]];
    if (pc.getRemoteStreams && pc.getRemoteStreams()[0] && pc.getRemoteStreams()[0].getAudioTracks()[0]) {
      const track = pc.getRemoteStreams()[0].getAudioTracks()[0];
      console.log('track', track);
      pc.getStats(track, function(report) {
        console.log('getStats report', report);
      }, logError);
    }
  }

  _press(event) {
    container.refs.roomID.blur();
    container.setState({status: 'connect', info: 'Connecting'});
    container.join(container.state.roomID);
  }

  receiveTextData(data) {
    const textRoomData = container.state.textRoomData.slice();
    textRoomData.push(data);
    container.setState({textRoomData, textRoomValue: ''});
  }

  _textRoomPress() {
    if (!container.state.textRoomValue) {
      return
    }
    const textRoomData = container.state.textRoomData.slice();
    textRoomData.push({user: "me", message: container.state.textRoomValue});
    for (const key in pcPeers) {
      const pc = pcPeers[key];
      pc.textDataChannel.send(container.state.textRoomValue);
      console.log('textDataChannel.readyState', pc.textDataChannel.readyState)
      console.log('send', container.state.textRoomValue)
    }
    container.setState({textRoomData, textRoomValue: ''});
  }

  render() {
    return (
      <View style={styles.outerContainer}>
        <KeyboardAvoidingView behavior='padding' style={styles.container}>
          <View>
            <Text style={styles.description}>{this.props.phone}</Text>
            <Text style={styles.description}>{this.state.info}</Text>
          </View>
          {this.state.textRoomConnected ?
            <View style={styles.chatBox}>
              <ListView
                enableEmptySections={true}
                style={{marginBottom:10}}
                dataSource={this.ds.cloneWithRows(this.state.textRoomData)}
                renderRow={rowData =>
                  <View style={styles.row}>
                    <Text style={styles.text}>
                      {`${rowData.user}: ${rowData.message}`}
                    </Text>
                  </View>
                }
              />
              <View style={styles.flowRight}>
                <TextInput
                  style={styles.roomInput}
                  onChangeText={value => this.setState({textRoomValue: value})}
                  value={this.state.textRoomValue}
                />
                <TouchableHighlight style={styles.button}
                    underlayColor='#99d9f4'
                    onPress={this._textRoomPress}
                    >
                  <Text style={styles.buttonText}>Send</Text>
                </TouchableHighlight>
              </View>
            </View> : null}
          { this.state.status == 'ready' ?
            (<View style={styles.flowRight}>
              <TextInput
                ref='roomID'
                autoCorrect={false}
                style={styles.roomInput}
                onChangeText={(text) => this.setState({roomID: text})}
                value={this.state.roomID}
                placeholder='friend name'
              />

              <TouchableHighlight style={styles.button}
      				    underlayColor='#99d9f4'
      						onPress={this._press}
      				    >
      				  <Text style={styles.buttonText}>Call</Text>
      				</TouchableHighlight>
            </View>) : null
          }
        </KeyboardAvoidingView>
      </View>
    );
  }
}

function logError(error) {
  console.log("logError", error);
}

const styles = StyleSheet.create({
  chatBox: {
    alignSelf: 'stretch',
    height:200
  },
  row: {
    flexDirection: 'row',
    padding: 3,
    backgroundColor: '#F6F6F6',
  },
  description: {
    marginBottom: 20,
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
    flex:1
  },
  flowRight: {
	  flexDirection: 'row',
	  alignItems: 'center',
	  alignSelf: 'stretch'
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
	  marginBottom: 10,
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
