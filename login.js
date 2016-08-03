'use strict';

import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  AsyncStorage,
} from 'react-native';

var Digits = require('react-native-fabric-digits');
var { DigitsLoginButton, DigitsLogoutButton } = Digits;

class LoginView extends Component{

  constructor(props) {
    super(props);

    this.onLogin = this.onLogin.bind(this);
    this.onLogout = this.onLogout.bind(this);

    this.state = {
      login: false,
    };
  }

  onLogin(error, response) {

    if (error && error.code !== 1) {
      console.log('onLogin', error);
    }
    else if (response) {
      this.setState({ login: true });

      console.log('onLogin response', response);

      fetch('https://api.digits.com/1.1/sdk/account.json', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': response['X-Verify-Credentials-Authorization']
        }
      })
      .then((response) => response.json())
      .then((responseJson) => {
        var number = responseJson.phone_number;
        var me = this;
        if (number && number != 'undefined'){
          me.props.socket.emit('auth', number, function(phone){
            console.log('login auth', phone._id);
            var device = me.props.main.state.device;
            if (!phone.device && device){
              me.props.socket.emit('device', device);
              console.log('device', device);
            }
            me.props.main._setPhone(phone);
            AsyncStorage.setItem('phone', JSON.stringify(phone));
            me.props.main._hideLogin();
          });
        }
      })
      .catch((error) => {
        console.error(error);
      });
    }
  }

  onLogout(error, response) {
    if (error && error.code !== 1) {
      console.error(error);
    }
    else if (response) {
      this.setState({ login: false });
      AsyncStorage.removeItem("phone", function(err){
        if (err) console.log(err);
      });
      this.props.main._setPhone(null);
    }
  }

  render() {
    return (
      <View style={styles.container}>
        {this.state.login && !this.props.phone ?
          <Text>Logging in...</Text> : null}

        {this.props.phone ?
        <DigitsLogoutButton
          completion={this.onLogout}
          text="Logout"
          buttonStyle={styles.DigitsAuthenticateButton}
          textStyle={styles.DigitsAuthenticateButtonText}/> : null}

        {!this.state.login && !this.props.phone ?
        <DigitsLoginButton
          options={{
            title: "YouCall",
            phoneNumber: "+84",
            appearance: {
              // backgroundColor: {
              //   hex: "#ffffff",
              //   alpha: 1.0
              // },
              // accentColor: {
              //   hex: "#43a16f",
              //   alpha: 0.7
              // },
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
          completion={this.onLogin}
          text="Verify your number"
          buttonStyle={styles.DigitsAuthenticateButton}
          textStyle={styles.DigitsAuthenticateButtonText}/> : null}
      </View>
    );
  }
}

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

module.exports = LoginView
