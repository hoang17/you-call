// @flow
'use strict';

// @hoang import code push
import codePush from "react-native-code-push";
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

var Digits = require('react-native-fabric-digits');
var { DigitsLoginButton, DigitsLogoutButton } = Digits;

// const socket = io.connect('youcall.herokuapp.com/', {transports: ['websocket']});
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

// @hoang load turn dynamically
fetch("https://computeengineondemand.appspot.com/turn?username=iapprtc&key=4080218913", { method: "GET" })
.then((response) => response.json())
.then((item) => {
  if (!item.uris) return
  item.uris.forEach(function(url){
    configuration.iceServers.push({ username: item.username, credential: item.password, url: url})
  })
}).done();

const pcPeers = {};
let localStream;

function getLocalStream(isFront, callback) {
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

function join(roomID) {
  socket.emit('join', roomID, function(socketIds){
    console.log('join', socketIds);
    for (const i in socketIds) {
      const socketId = socketIds[i];
      console.log('socketId', socketId)
      createPC(socketId, true);
    }
  });
}

function createPC(socketId, isOffer) {

  container.setState({socketId: socketId})

  console.log('%%% createPC socketId %%%', socketId)
  console.log('%%% createPC isOffer %%%', isOffer)

  const pc = new RTCPeerConnection(configuration);
  pcPeers[socketId] = pc;

  pc.onicecandidate = function (event) {
    console.log('onicecandidate', event.candidate);
    if (event.candidate) {
      socket.emit('exchange', {'to': socketId, 'candidate': event.candidate });
    }
  };

  function createOffer() {
    pc.createOffer(function(desc) {
      console.log('createOffer', desc);
      pc.setLocalDescription(desc, function () {
        console.log('setLocalDescription', pc.localDescription);
        socket.emit('exchange', {'to': socketId, 'sdp': pc.localDescription });
      }, logError);
    }, logError);
  }

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
        getStats();
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

  return pc;
}

function exchange(data) {
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

function leave(socketId) {
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

// socket.on('exchange', function(data){
//   exchange(data);
// });
// socket.on('leave', function(socketId){
//   leave(socketId);
// });
// socket.on('connect', function(data) {
//   console.log('connect');
//   getLocalStream(true, function(stream) {
//     localStream = stream;
//     container.setState({selfViewSrc: stream.toURL()});
//     container.setState({status: 'ready', info: 'Enter friend name to call'});
//   });
// });

function logError(error) {
  console.log("logError", error);
}

function getStats() {
  const pc = pcPeers[Object.keys(pcPeers)[0]];
  if (pc.getRemoteStreams && pc.getRemoteStreams()[0] && pc.getRemoteStreams()[0].getAudioTracks()[0]) {
    const track = pc.getRemoteStreams()[0].getAudioTracks()[0];
    console.log('track', track);
    pc.getStats(track, function(report) {
      console.log('getStats report', report);
    }, logError);
  }
}

let container;

const RCTWebRTCDemo = React.createClass({
  // getInitialState: function() {
  //   this.ds = new ListView.DataSource({rowHasChanged: (r1, r2) => true});
  //   return {
  //     info: 'Initializing',
  //     status: 'init',
  //     roomID: 'abc',
  //     isFront: true,
  //     selfViewSrc: null,
  //     remoteList: {},
  //     textRoomConnected: false,
  //     textRoomData: [],
  //     textRoomValue: '',
  //     socketId:''
  //   };
  // },
  // componentDidMount: function() {
  //   // @hoang add code push sync
  //   codePush.sync();
  //   container = this;
  // },
  // _press(event) {
  //   this.refs.roomID.blur();
  //   this.setState({status: 'connect', info: 'Connecting'});
  //   join(this.state.roomID);
  // },
  // receiveTextData(data) {
  //   const textRoomData = this.state.textRoomData.slice();
  //   textRoomData.push(data);
  //   this.setState({textRoomData, textRoomValue: ''});
  // },
  // _textRoomPress() {
  //   if (!this.state.textRoomValue) {
  //     return
  //   }
  //   const textRoomData = this.state.textRoomData.slice();
  //   textRoomData.push({user: "me", message: this.state.textRoomValue});
  //   for (const key in pcPeers) {
  //     const pc = pcPeers[key];
  //     pc.textDataChannel.send(this.state.textRoomValue);
  //     console.log('textDataChannel.readyState', pc.textDataChannel.readyState)
  //     console.log('send', this.state.textRoomValue)
  //   }
  //   this.setState({textRoomData, textRoomValue: ''});
  // },

  // render() {
  //   return (
  //     <View style={styles.outerContainer}>
  //       <KeyboardAvoidingView behavior='padding' style={styles.container}>
  //         <View>
  //           <Text style={styles.description}>{this.state.info}</Text>
  //         </View>
  //         {this.state.textRoomConnected ?
  //           <View style={styles.chatBox}>
  //             <ListView
  //               enableEmptySections={true}
  //               style={{marginBottom:10}}
  //               dataSource={this.ds.cloneWithRows(this.state.textRoomData)}
  //               renderRow={rowData =>
  //                 <View style={styles.row}>
  //                   <Text style={styles.text}>
  //                     {`${rowData.user}: ${rowData.message}`}
  //                   </Text>
  //                 </View>
  //               }
  //             />
  //             <View style={styles.flowRight}>
  //               <TextInput
  //                 style={styles.roomInput}
  //                 onChangeText={value => this.setState({textRoomValue: value})}
  //                 value={this.state.textRoomValue}
  //               />
  //               <TouchableHighlight style={styles.button}
  //                   underlayColor='#99d9f4'
  //                   onPress={this._textRoomPress}
  //                   >
  //                 <Text style={styles.buttonText}>Send</Text>
  //               </TouchableHighlight>
  //             </View>
  //           </View> : null}
  //         { this.state.status == 'ready' ?
  //           (<View style={styles.flowRight}>
  //             <TextInput
  //               ref='roomID'
  //               autoCorrect={false}
  //               style={styles.roomInput}
  //               onChangeText={(text) => this.setState({roomID: text})}
  //               value={this.state.roomID}
  //               placeholder='friend name'
  //             />
  //
  //             <TouchableHighlight style={styles.button}
  //     				    underlayColor='#99d9f4'
  //     						onPress={this._press}
  //     				    >
  //     				  <Text style={styles.buttonText}>Call</Text>
  //     				</TouchableHighlight>
  //           </View>) : null
  //         }
  //       </KeyboardAvoidingView>
  //     </View>
  //   );
  // }
// });

// const styles = StyleSheet.create({
//   chatBox: {
//     alignSelf: 'stretch',
//     height:200
//   },
//   row: {
//     flexDirection: 'row',
//     padding: 3,
//     backgroundColor: '#F6F6F6',
//   },
//   description: {
//     marginBottom: 20,
//     fontSize: 18,
//     textAlign: 'center',
//     color: '#656565'
//   },
//   outerContainer: {
//     flex: 1,
//   },
//   container: {
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 20,
//     flex:1
//   },
//   flowRight: {
// 	  flexDirection: 'row',
// 	  alignItems: 'center',
// 	  alignSelf: 'stretch'
// 	},
// 	buttonText: {
// 	  fontSize: 18,
// 	  color: 'white',
// 	  alignSelf: 'center'
// 	},
// 	button: {
// 	  height: 36,
// 	  flex: 1,
// 	  flexDirection: 'row',
// 	  backgroundColor: '#48BBEC',
// 	  borderColor: '#48BBEC',
// 	  borderWidth: 1,
// 	  borderRadius: 4,
// 	  marginBottom: 10,
// 	  alignSelf: 'stretch',
// 	  justifyContent: 'center'
// 	},
// 	roomInput: {
// 	  height: 36,
// 	  padding: 4,
// 	  marginRight: 5,
// 	  flex: 5,
// 	  fontSize: 18,
// 	  borderWidth: 1,
// 	  borderColor: '#48BBEC',
// 	  borderRadius: 4,
// 	  color: '#48BBEC'
// 	}
// });

getInitialState: function() {
  return { logged: false, error: false, response: {} };
},

completion: function(error, response) {
  if (error && error.code !== 1) {
    this.setState({ logged: false, error: true, response: {} });
  } else if (response) {
    var logged = JSON.stringify(response) === '{}' ? false : true;
    this.setState({ logged: logged, error: false, response: response });
  }
},

render: function() {
  var error = this.state.error ? <Text>An error occured.</Text> : null;
  var content = this.state.logged ?
    (<View>
      <Text>
        Auth Token: {this.state.response.authToken}{'\n'}
        Auth Token Secret: {this.state.response.authTokenSecret}{'\n\n'}
      </Text>
      <DigitsLogoutButton
        completion={this.completion}
        text="Logout"
        buttonStyle={styles.DigitsAuthenticateButton}
        textStyle={styles.DigitsAuthenticateButtonText}/>
    </View>) : (<DigitsLoginButton
      options={{
        title: "Logging in is great",
        phoneNumber: "+61",
        appearance: {
          backgroundColor: {
            hex: "#ffffff",
            alpha: 1.0
          },
          accentColor: {
            hex: "#43a16f",
            alpha: 0.7
          },
          headerFont: {
            name: "Arial",
            size: 16
          },
          labelFont: {
            name: "Helvetica",
            size: 18
          },
          bodyFont: {
            name: "Helvetica",
            size: 16
          }
        }
      }}
      completion={this.completion}
      text="Login (Do it)"
      buttonStyle={styles.DigitsAuthenticateButton}
      textStyle={styles.DigitsAuthenticateButtonText}/>);
  return (
    <View style={styles.container}>
      {error}
      {content}
    </View>
  );
},
});

var styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  DigitsAuthenticateButton: {
    height: 50,
    width: 230,
    backgroundColor: '#13988A',
    justifyContent: 'center',
    borderRadius: 5
  },
  DigitsAuthenticateButtonText: {
    fontSize: 16,
    color: '#fff',
    alignSelf: 'center',
    fontWeight: 'bold'
  }
});


AppRegistry.registerComponent('RCTWebRTCDemo', () => RCTWebRTCDemo);
