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

var Digits = require('react-native-fabric-digits');
var { DigitsLoginButton, DigitsLogoutButton } = Digits;

var MainView = require("./main");


class LoginView extends Component{

  constructor(props) {
    super(props);

    AsyncStorage.getItem("phone").then((phone) => {

      this.props.navigator.push({
        title: "Main",
        component: MainView,
        passProps: {phone: phone},
      });

    }).done();

    this.onLogin = this.onLogin.bind(this);
    this.onLogout = this.onLogout.bind(this);

    this.state = {
      logged: false,
      error: false,
      response: {}
    };
  }

  onLogin(error, response) {
    if (error && error.code !== 1) {
      this.setState({ logged: false, error: true, response: {} });
    }
    else if (response) {
      var logged = JSON.stringify(response) === '{}' ? false : true;
      this.setState({ logged: logged, error: false, response: response });

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
        // return responseJson.movies;
        console.log(responseJson);

        var phone = responseJson.phone_number;

        AsyncStorage.setItem('phone', phone);

        this.props.navigator.push({
          title: "Main",
          component: MainView,
          passProps: {phone: phone},
        });

      })
      .catch((error) => {
        console.error(error);
      });
    }
  }

  onLogout(error, response) {
    if (error && error.code !== 1) {
      this.setState({ logged: false, error: true, response: {} });
    }
    else if (response) {
      var logged = JSON.stringify(response) === '{}' ? false : true;
      this.setState({ logged: logged, error: false, response: response });
      AsyncStorage.setItem("phone", null);
    }
  }

  render() {
    var error = this.state.error ? <Text>An error occured.</Text> : null;
    var content = this.state.logged ?
      (<View>
        <DigitsLogoutButton
          completion={this.onLogout}
          text="Logout"
          buttonStyle={styles.DigitsAuthenticateButton}
          textStyle={styles.DigitsAuthenticateButtonText}/>
      </View>) : (<DigitsLoginButton
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
        text="Login"
        buttonStyle={styles.DigitsAuthenticateButton}
        textStyle={styles.DigitsAuthenticateButtonText}/>);
    return (
      <View style={styles.container}>
        {error}
        {content}
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
