if (!window.navigator.userAgent) {
  window.navigator.userAgent = "react-native";
}
// @hoang add RCTLog because error with CodePush
var RCTLog = require('RCTLog');
require('./main');
