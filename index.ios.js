// @flow
"use strict";
if (!window.navigator.userAgent) {
  window.navigator.userAgent = "react-native";
}

// @hoang add RCTLog because error with CodePush
var RCTLog = require('RCTLog');

require('./main');

// import codePush from "react-native-code-push";
// import React, { Component } from 'react';
// import {
//   AppRegistry,
//   StyleSheet,
//   Text,
//   View,
//   NavigatorIOS,
// } from 'react-native';
//
// var MainView = require("./main");
//
// var YouCall = React.createClass({
//
//   componentDidMount: function() {
//     codePush.sync();
//   },
//
//   render: function() {
//       return (
//           <NavigatorIOS
//             navigationBarHidden={true}
//             style={styles.navigationContainer}
//             initialRoute={{ title: "Main", component: MainView }}
//           />
//       );
//   }
// });
//
// var styles = StyleSheet.create({
//     navigationContainer: {
//         flex: 1
//     }
// });
//
// AppRegistry.registerComponent("YouCall", () => YouCall);
